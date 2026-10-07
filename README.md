# Capshion AI

**Capshion AI**, kullanıcıların yükledikleri fotoğraflar için yapay zeka destekli, "dark-luxe" estetiğinde yaratıcı metinler (caption) üreten, hibrit kredi/abonelik modeline sahip bir full-stack mobil uygulamadır. Proje, modern bir mobil ürünün uçtan uca gereksinimlerini (kimlik doğrulama, ödeme entegrasyonu, gerçek zamanlı push bildirimleri, güvenli backend mimarisi) karşılayacak şekilde tasarlanmıştır.

---

## 🔗 Live Test Environment (Canlı Test Ortamı)

> Aşağıdaki bilgiler, projeyi lokal olarak derlemeden doğrudan test edebilmeniz için sağlanmıştır. Uygulama, üretim (production) ortamında canlı bir backend (Railway) ve canlı bir veritabanına (Supabase) bağlı olarak çalışmaktadır.



---

## 🧱 Teknoloji Yığını (Tech Stack)

| Katman | Teknoloji |
|---|---|
| **Frontend** | React Native (Expo, TypeScript) |
| **Backend** | Node.js (Express) |
| **Veritabanı & Auth** | Supabase (PostgreSQL) |
| **Uygulama İçi Satın Alma** | RevenueCat (Google Play Billing entegrasyonu) |
| **AI Motoru** | OpenAI API (görsel analiz ve metin üretimi) |
| **Push Bildirimleri** | Firebase Cloud Messaging (FCM) |
| **Analitik** | PostHog |
| **Barındırma (Backend)** | Railway |

---

## 🏗️ Mimari Genel Bakış

Uygulama, istemci (React Native) ile backend (Express) arasında REST API üzerinden haberleşen, olay güdümlü (event-driven) bir kredi/abonelik senkronizasyon mekanizmasına sahiptir:

```
[Kullanıcı] → [React Native App] → [Express API] → [Supabase (PostgreSQL)]
                                          ↑
                                   [RevenueCat Webhook]
                                          ↑
                            [Google Play Billing / Satın Alma Olayı]
```

Satın alma işlemleri istemci tarafında değil, **sunucu tarafında doğrulanan bir webhook akışıyla** işlenir; bu, istemci tarafı manipülasyonuna karşı ek bir güvenlik katmanı sağlar.

---

## 📁 Klasör Mimarisi (Folder Structure)

```
Capshion-AI/
├── app/                      # Expo Router tabanlı ekran/route tanımları
│   ├── (auth)/                # Giriş, kayıt ekranları
│   ├── (tabs)/                 # Ana sekme navigasyonu (Home, History, Profile vb.)
│   └── caption/[id].tsx        # Dinamik caption detay ekranı
├── components/                # Yeniden kullanılabilir UI bileşenleri
├── hooks/                      # Özel React hook'ları (useAuth, usePushNotifications vb.)
├── context/                    # React Context sağlayıcıları (ToastContext vb.)
├── services/                   # API istemcisi ve dış servis entegrasyonları
├── android/                    # Native Android proje dosyaları (Expo prebuild çıktısı)
├── server.js                   # Express backend giriş noktası ve tüm route tanımları
├── .env.example                 # Ortam değişkeni şablonu (bkz. aşağıda)
├── schema.sql                   # Veritabanı şema tanımı
├── eas.json                     # EAS Build yapılandırması
└── app.json                     # Expo uygulama yapılandırması
```

> Not: Proje büyüklüğüne bağlı olarak `services/` ve `routes/` katmanları gelecekte ayrı modüllere bölünecek şekilde tasarlanmıştır; şu anki sürümde backend mantığı `server.js` içinde merkezi olarak yönetilmektedir.

---

## 🔐 Öne Çıkan Mühendislik ve Güvenlik Pratikleri

1. **Ortam Değişkeni İzolasyonu:** Tüm API anahtarları (OpenAI, RevenueCat, PostHog), veritabanı bağlantı adresleri ve gizli anahtarlar (JWT secret, webhook secret) kod tabanına hardcoded olarak yazılmamış, `.env` dosyaları ve dağıtım platformlarının (Railway, EAS) çevresel değişken yönetim sistemleri üzerinden enjekte edilmektedir.

2. **Hassas Veri Loglama Kontrolü:** Backend loglama mekanizması, kullanıcı şifrelerinin veya diğer hassas kimlik bilgilerinin açık metin (plaintext) olarak sunucu loglarına yazılmasını engelleyecek şekilde yapılandırılmıştır.

3. **Modüler Klasör Yapısı:** Frontend tarafı `screens/components/hooks/services` ayrımı ile organize edilmiştir; bu, sorumlulukların ayrılması (separation of concerns) prensibini destekler.

4. **Sunucu Taraflı Kredi/Abonelik Senkronizasyonu:** RevenueCat'ten gelen satın alma olayları, imzalı bir webhook (Bearer token doğrulamalı) aracılığıyla backend'e iletilir; backend bu olayı doğrulayıp Supabase (PostgreSQL) üzerindeki kullanıcı kredi bakiyesini veya premium durumunu günceller. Bu mimari, istemci tarafında kredi/premium durumunun manipüle edilmesini engeller.

5. **Kapsamlı Hata Yönetimi:** Hem istemci (try-catch blokları, kullanıcıya yönelik zarif hata mesajları) hem backend (API hata kodları, loglama) tarafında hata yönetimi uygulanarak uygulamanın beklenmedik şekilde çökmesi engellenmiş, üçüncü parti servis (OpenAI, RevenueCat) kaynaklı hatalar kullanıcı deneyimini bozmadan yönetilmiştir.

---

## 💻 Local Setup (Opsiyonel — Projeyi Kendi Bilgisayarınızda Çalıştırmak İçin)

Aşağıdaki adımlar, projeyi yukarıdaki canlı test ortamı yerine kendi geliştirme makinenizde derlemek isterseniz gereklidir.

### Ön Koşullar
- Node.js 22.13.x veya üzeri
- npm
- Android Studio (Android emülatörü veya fiziksel cihaz için)
- Bir Supabase projesi (veya kendi PostgreSQL örneğiniz)

### Adımlar

```bash
# 1. Depoyu klonlayın
git clone <repository-url>
cd Capshion-AI

# 2. Bağımlılıkları yükleyin
npm install

# 3. Ortam değişkenlerini yapılandırın
cp .env.example .env
# .env dosyasını kendi API anahtarlarınız ve veritabanı bağlantı bilginizle doldurun

# 4. Veritabanı şemasını oluşturun
# schema.sql dosyasını Supabase SQL Editor'e veya kendi PostgreSQL istemcinize yapıştırıp çalıştırın

# 5. Backend'i başlatın
node server.js

# 6. Mobil uygulamayı başlatın (ayrı bir terminalde)
npx expo prebuild --clean
npx expo run:android
```

---

## 📄 İlgili Dosyalar

- [`schema.sql`](./schema.sql) — Veritabanı tablo ve ilişki tanımları
- [`.env.example`](./.env.example) — Gerekli ortam değişkenlerinin şablonu

---

