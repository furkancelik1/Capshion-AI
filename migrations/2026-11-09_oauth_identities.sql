-- ============================================================
-- CAPSHION AI — SOSYAL GİRİŞ KİMLİKLERİ (2026-11-09)
-- ============================================================
-- Apple, kullanıcının e-postasını her girişte göndermeyebilir. Apple'ın
-- değişmeyen kullanıcı kimliğini ("sub") hesapla eşleştirmek için.
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
        CREATE TABLE IF NOT EXISTS oauth_identities (
            provider    TEXT NOT NULL,                 -- 'apple' (ileride 'google')
            subject     TEXT NOT NULL,                 -- sağlayıcının değişmeyen kullanıcı kimliği
            user_id     %s NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (provider, subject)
        )$sql$, uid_type);
END
$migration$;

ALTER TABLE oauth_identities ENABLE ROW LEVEL SECURITY;
