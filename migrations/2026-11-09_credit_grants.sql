-- ============================================================
-- CAPSHION AI — KREDİ ALIMLARI TEKRAR KORUMASI (2026-11-09)
-- ============================================================
-- Her mağaza işlemi (transaction) en fazla BİR kez kredi verir; uygulama
-- senkronizasyonu ve RevenueCat webhook'u aynı alımı iki kez işleyemez.
-- Yalnızca EKLEME yapar. Tekrar çalıştırılması güvenlidir.
-- ============================================================

DO $migration$
DECLARE
    uid_type TEXT;
BEGIN
    SELECT format_type(a.atttypid, a.atttypmod) INTO uid_type
      FROM pg_attribute a
     WHERE a.attrelid = 'profiles'::regclass AND a.attname = 'id' AND NOT a.attisdropped;

    EXECUTE format($sql$
        CREATE TABLE IF NOT EXISTS credit_grants (
            transaction_id  TEXT PRIMARY KEY,           -- mağaza işlem numarası
            user_id         %s NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
            product_id      TEXT NOT NULL,
            credits         INTEGER NOT NULL,
            source          TEXT NOT NULL,              -- 'sync' | 'webhook'
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
        )$sql$, uid_type);
END
$migration$;

CREATE INDEX IF NOT EXISTS idx_credit_grants_user ON credit_grants(user_id, created_at DESC);
ALTER TABLE credit_grants ENABLE ROW LEVEL SECURITY;
