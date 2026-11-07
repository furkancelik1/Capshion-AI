-- ============================================================
-- CAPSHION AI — REKLAM ÖDÜLLERİ MİGRASYONU (2026-11-07)
-- ============================================================
-- Yalnızca EKLEME yapar; mevcut tablolara DOKUNMAZ. Tekrar çalıştırılması güvenlidir.
-- user_id tipi profiles.id'den otomatik alınır.
--
-- Çalıştırma:
--   Supabase  → Dashboard → SQL Editor'e yapıştır
--   Yerel     → node scripts/run-migration.js migrations/2026-11-07_ad_rewards.sql
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

    -- AD_REWARDS — AdMob sunucu tarafı doğrulama (SSV) kayıtları.
    -- transaction_id UNIQUE: Google aynı bildirimi 5 kereye kadar tekrar gönderebilir;
    -- her reklam izlemesi en fazla BİR kez kredi verir.
    EXECUTE format($sql$
        CREATE TABLE IF NOT EXISTS ad_rewards (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            transaction_id  TEXT NOT NULL UNIQUE,
            user_id         %s NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
            ad_unit         TEXT,
            reward_credits  INTEGER NOT NULL DEFAULT 0,
            granted         BOOLEAN NOT NULL DEFAULT false,
            reason          TEXT,                       -- 'ok' | 'daily_limit' | ...
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
        )$sql$, uid_type);
END
$migration$;

CREATE INDEX IF NOT EXISTS idx_ad_rewards_user_created
    ON ad_rewards(user_id, created_at DESC);

ALTER TABLE ad_rewards ENABLE ROW LEVEL SECURITY;
