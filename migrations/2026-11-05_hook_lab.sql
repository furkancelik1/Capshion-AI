-- ============================================================
-- CAPSHION AI — HOOK LAB MİGRASYONU (2026-11-05)
-- ============================================================
-- Yalnızca EKLEME yapar: mevcut tablolara (profiles,
-- generated_captions, purchase_events) DOKUNMAZ.
-- Tekrar çalıştırılması güvenlidir (IF NOT EXISTS).
-- user_id kolonunun tipi profiles.id'den otomatik alınır
-- (Supabase'de UUID, yerel veritabanında farklı olabilir).
--
-- Çalıştırma:
--   Supabase  → Dashboard → SQL Editor'e yapıştır
--   Yerel     → node scripts/run-migration.js migrations/2026-11-05_hook_lab.sql
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

    -- 1. HOOK_LAB_SESSIONS — Her Hook Lab üretiminin tam çıktısı.
    -- Kilitli varyantlar da burada saklanır; kullanıcı Premium'a
    -- geçtiğinde aynı oturumdaki kilitler sunucu tarafında açılır.
    EXECUTE format($sql$
        CREATE TABLE IF NOT EXISTS hook_lab_sessions (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id         %s NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
            platform        TEXT NOT NULL,
            tone            TEXT,
            language        TEXT,
            variants        JSONB NOT NULL,
            unlocked_count  INTEGER NOT NULL DEFAULT 2,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
        )$sql$, uid_type);

    -- 2. CAPTION_FEEDBACK — Swipe / kopyalama sinyalleri
    -- (ileride "Brand Voice DNA" özelliğinin eğitim verisi).
    EXECUTE format($sql$
        CREATE TABLE IF NOT EXISTS caption_feedback (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id         %s NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
            session_id      UUID REFERENCES hook_lab_sessions(id) ON DELETE CASCADE,
            variant_index   SMALLINT,
            hook_style      TEXT,
            platform        TEXT,
            action          TEXT NOT NULL CHECK (action IN ('like', 'skip', 'copy', 'edit_copy')),
            edited_text     TEXT,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
        )$sql$, uid_type);
END
$migration$;

CREATE INDEX IF NOT EXISTS idx_hook_lab_sessions_user
    ON hook_lab_sessions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_caption_feedback_user
    ON caption_feedback(user_id, created_at DESC);

-- Backend doğrudan Postgres bağlantısı (DATABASE_URL) kullandığı için
-- RLS'yi politika OLMADAN açıyoruz: Supabase'in anon/authenticated
-- REST erişimi bu tablolara tamamen kapanır, sunucu etkilenmez.
ALTER TABLE hook_lab_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE caption_feedback  ENABLE ROW LEVEL SECURITY;
