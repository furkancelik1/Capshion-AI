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
-- Not: Kimlik doğrulama backend'de (bcrypt + JWT) yapılır; şifreler
-- yalnızca bcrypt hash'i olarak saklanır.

CREATE TABLE IF NOT EXISTS profiles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,               -- Şifreler hash'lenmiş olarak saklanır, asla plaintext değil
    age_range       TEXT,                         -- Örn: "18-24", "25-34"
    credits         INTEGER NOT NULL DEFAULT 5 CHECK (credits >= 0), -- Başlangıç kredisi (register: 5)
    is_premium      BOOLEAN NOT NULL DEFAULT false,
    push_token      TEXT,                          -- Expo push token'ı
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE profiles IS 'Kullanıcı hesap bilgileri, kredi bakiyesi ve premium abonelik durumu.';
COMMENT ON COLUMN profiles.credits IS 'Kullanıcının harcayabileceği toplam kredi miktarı; her caption üretiminde azaltılır, satın alma webhook''u ile artırılır.';
COMMENT ON COLUMN profiles.is_premium IS 'RevenueCat aboneliği aktifse true; webhook aracılığıyla senkronize edilir.';


-- ------------------------------------------------------------
-- 2. GENERATED_CAPTIONS — Üretilen İçerik Geçmişi
-- ------------------------------------------------------------
-- Tek bir üretim isteği (post_id) 2-4 alternatif caption satırı oluşturur.

CREATE TABLE IF NOT EXISTS generated_captions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    post_id         UUID NOT NULL,                   -- Aynı istekte üretilen caption'ları gruplar
    caption_text    TEXT NOT NULL,                   -- AI tarafından üretilen metin
    hashtags        TEXT[] NOT NULL DEFAULT '{}',
    image_url       TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE generated_captions IS 'Kullanıcıların AI ile ürettiği tüm caption kayıtlarının geçmişi.';

CREATE INDEX IF NOT EXISTS idx_generated_captions_user_created ON generated_captions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generated_captions_post_id ON generated_captions(post_id);


-- ------------------------------------------------------------
-- 3. PROCESSED_WEBHOOK_EVENTS — RevenueCat Webhook İdempotency Kaydı
-- ------------------------------------------------------------
-- RevenueCat, 2xx yanıt alamadığı olayları yeniden gönderir. İşlenen her
-- event.id burada tutulur; aynı olay ikinci kez geldiğinde kredi tekrar
-- eklenmez. (server.js açılışta bu tabloyu yoksa oluşturur.)

CREATE TABLE IF NOT EXISTS processed_webhook_events (
    event_id        TEXT PRIMARY KEY,                 -- RevenueCat event.id
    event_type      TEXT,                             -- Örn: "INITIAL_PURCHASE", "RENEWAL", "EXPIRATION"
    received_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ------------------------------------------------------------
-- 4. FEEDBACKS — Uygulama İçi Geri Bildirimler
-- ------------------------------------------------------------
-- Mobil istemci bu tabloya doğrudan Supabase (anon anahtar) ile yazar.

CREATE TABLE IF NOT EXISTS feedbacks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES profiles(id) ON DELETE SET NULL,
    message         TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ------------------------------------------------------------
-- İLİŞKİ ÖZETİ (Entity Relationship Summary)
-- ------------------------------------------------------------
-- profiles (1) ────< (N) generated_captions
-- profiles (1) ────< (N) feedbacks
-- ------------------------------------------------------------


-- ------------------------------------------------------------
-- SATIR DÜZEYİ GÜVENLİK (Row Level Security)
-- ------------------------------------------------------------
-- Supabase anon anahtarı mobil uygulamanın içinde gömülüdür, yani herkese
-- açıktır. RLS kapalı bir tablo, bu anahtarla Supabase REST API üzerinden
-- doğrudan okunabilir/değiştirilebilir (ör. profiles.password_hash, credits).
--
-- Backend (server.js) veritabanına DATABASE_URL ile tablo sahibi "postgres"
-- rolüyle bağlanır; bu rol RLS'ten etkilenmez, dolayısıyla aşağıdakiler
-- backend davranışını değiştirmez. İstemci yalnızca feedbacks tablosuna
-- ekleme yapabilir; diğer tablolar anon/authenticated rollere tamamen kapalıdır.

ALTER TABLE profiles                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_captions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE processed_webhook_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedbacks                 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feedbacks_insert_only" ON feedbacks;
CREATE POLICY "feedbacks_insert_only" ON feedbacks
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);


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
