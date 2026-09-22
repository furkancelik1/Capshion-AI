-- ============================================================
-- CAPSHION AI — VERİTABANI ŞEMA TANIMI
-- ============================================================
-- Veritabanı Motoru: PostgreSQL (Supabase)
-- Bu betik, uygulamanın temel veri modelini ve tablolar arası
-- ilişkileri göstermek amacıyla hazırlanmıştır.
-- ============================================================

-- UUID üretimi için gerekli eklenti
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ------------------------------------------------------------
-- 1. PROFILES — Kullanıcı Hesap ve Kredi/Abonelik Durumu
-- ------------------------------------------------------------
-- Not: "id" alanı, Supabase Auth tarafından üretilen kullanıcı
-- UUID'si ile birebir eşleşir (auth.users.id referansı).

CREATE TABLE IF NOT EXISTS profiles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,               -- Şifreler hash'lenmiş olarak saklanır, asla plaintext değil
    age_range       TEXT,                         -- Örn: "18-24", "25-34"
    credits         INTEGER NOT NULL DEFAULT 3,    -- Yeni kullanıcılara tanımlanan başlangıç kredisi
    is_premium      BOOLEAN NOT NULL DEFAULT false,
    push_token      TEXT,                          -- Firebase Cloud Messaging cihaz token'ı
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE profiles IS 'Kullanıcı hesap bilgileri, kredi bakiyesi ve premium abonelik durumu.';
COMMENT ON COLUMN profiles.credits IS 'Kullanıcının harcayabileceği toplam kredi miktarı; her caption üretiminde azaltılır, satın alma webhook''u ile artırılır.';
COMMENT ON COLUMN profiles.is_premium IS 'RevenueCat aboneliği aktifse true; webhook aracılığıyla senkronize edilir.';


-- ------------------------------------------------------------
-- 2. CAPTIONS — Üretilen İçerik Geçmişi
-- ------------------------------------------------------------
-- Her kullanıcının AI ile ürettiği caption kayıtlarını tutar.

CREATE TABLE IF NOT EXISTS captions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    image_url       TEXT,                          -- Kaynak görselin geçici/kalıcı depolama adresi
    generated_text  TEXT NOT NULL,                  -- AI tarafından üretilen metin
    mode            TEXT NOT NULL DEFAULT 'default', -- Örn: "default", "alternatives"
    credits_used    INTEGER NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE captions IS 'Kullanıcıların AI ile ürettiği tüm caption kayıtlarının geçmişi.';

CREATE INDEX IF NOT EXISTS idx_captions_user_id ON captions(user_id);
CREATE INDEX IF NOT EXISTS idx_captions_created_at ON captions(created_at DESC);


-- ------------------------------------------------------------
-- 3. PURCHASE_EVENTS — RevenueCat Webhook Denetim Kaydı
-- ------------------------------------------------------------
-- Gelen her satın alma/abonelik olayının ham kaydını tutar;
-- hem denetim (audit) hem de olası tekrar-işleme (replay)
-- senaryoları için referans niteliğindedir.

CREATE TABLE IF NOT EXISTS purchase_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES profiles(id) ON DELETE SET NULL,
    event_type      TEXT NOT NULL,                  -- Örn: "INITIAL_PURCHASE", "RENEWAL", "NON_RENEWING_PURCHASE"
    product_id      TEXT,                            -- Örn: "10_credits", "premium_monthly"
    raw_payload     JSONB,                            -- RevenueCat'ten gelen ham webhook gövdesi
    processed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE purchase_events IS 'RevenueCat webhook''undan gelen tüm satın alma/abonelik olaylarının denetim kaydı.';

CREATE INDEX IF NOT EXISTS idx_purchase_events_user_id ON purchase_events(user_id);


-- ------------------------------------------------------------
-- İLİŞKİ ÖZETİ (Entity Relationship Summary)
-- ------------------------------------------------------------
-- profiles (1) ────< (N) captions
-- profiles (1) ────< (N) purchase_events
--
-- Bir kullanıcı (profiles) birden fazla caption üretebilir ve
-- birden fazla satın alma olayına sahip olabilir. captions ve
-- purchase_events tabloları, profiles.id alanına yabancı anahtar
-- (foreign key) ile bağlıdır.
-- ------------------------------------------------------------


-- ------------------------------------------------------------
-- updated_at OTOMATİK GÜNCELLEME TETİKLEYİCİSİ (Trigger)
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
