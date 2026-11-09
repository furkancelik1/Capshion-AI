-- ============================================================
-- CAPSHION AI — GÜNLÜK RİTİM MİGRASYONU (2026-11-09)
-- ============================================================
-- Yalnızca EKLEME yapar; mevcut tablolara DOKUNMAZ (generated_captions'a
-- yalnızca performans için bir indeks eklenir). Tekrar çalıştırılması güvenlidir.
--
-- Çalıştırma:
--   Supabase  → Dashboard → SQL Editor'e yapıştır
--   Yerel     → node scripts/run-migration.js migrations/2026-11-09_daily_ritual.sql
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $migration$
DECLARE
    uid_type TEXT;
BEGIN
    SELECT format_type(a.atttypid, a.atttypmod)
      INTO uid_type
      FROM pg_attribute a
     WHERE a.attrelid = 'profiles'::regclass
       AND a.attname = 'id'
       AND NOT a.attisdropped;

    RAISE NOTICE 'profiles.id tipi: %', uid_type;

    -- USER_PREFERENCES — günlük fikir bildirimi tercihleri (isteğe bağlı, kullanıcı açar)
    EXECUTE format($sql$
        CREATE TABLE IF NOT EXISTS user_preferences (
            user_id                %s PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
            niche                  TEXT NOT NULL DEFAULT 'genel',
            language               TEXT NOT NULL DEFAULT 'tr',
            notify_hour            SMALLINT NOT NULL DEFAULT 10 CHECK (notify_hour BETWEEN 0 AND 23),
            daily_enabled          BOOLEAN NOT NULL DEFAULT true,
            last_idea_push_date    DATE,     -- aynı gün iki kez gönderimi engeller
            last_streak_push_date  DATE,
            created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
        )$sql$, uid_type);
END
$migration$;

-- DAILY_IDEAS — niş + gün + dil başına TEK fikir (herkes aynı fikri paylaşır → sabit maliyet)
CREATE TABLE IF NOT EXISTS daily_ideas (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    niche       TEXT NOT NULL,
    idea_date   DATE NOT NULL,
    language    TEXT NOT NULL DEFAULT 'tr',
    idea        JSONB NOT NULL,          -- { title, idea, tip, hook }
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (niche, idea_date, language)
);

-- Seri hesabı generated_captions'ı kullanıcı + tarihe göre tarar
CREATE INDEX IF NOT EXISTS idx_generated_captions_user_created
    ON generated_captions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_preferences_hour
    ON user_preferences(notify_hour) WHERE daily_enabled;

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_ideas      ENABLE ROW LEVEL SECURITY;
