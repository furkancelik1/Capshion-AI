require("dotenv").config({ quiet: true });

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const compression = require("compression");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");
const OpenAI = require("openai");


const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN || "http://localhost:8081,http://localhost:19006").split(",");

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Çok fazla istek. Lütfen daha sonra tekrar deneyin." }
});
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false });

const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE || "10485760"), files: parseInt(process.env.MAX_FILES || "5") },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|heic/;
    const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowed.test(file.mimetype.split("/")[1]);
    cb(null, extOk || mimeOk);
  },
});

if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(compression());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(cors({ origin: ALLOWED_ORIGINS, methods: ["GET", "POST", "PUT", "DELETE"], credentials: true }));
app.use(express.json({
  limit: "50mb",
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  },
}));
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", authenticateToken, express.static("uploads"));

if (!process.env.DATABASE_URL) {
  console.error("[DB] DATABASE_URL ortam değişkeni gerekli!");
  process.exit(1);
}
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
  query_timeout: 10000,
});

if (!process.env.JWT_SECRET) {
  console.error("[Auth] JWT_SECRET ortam değişkeni gerekli!");
  process.exit(1);
}


const JWT_SECRET = process.env.JWT_SECRET;

pool.on("error", (err) => {
  console.error("[DB] Pool hatası:", err.message);
});

async function dbHealthCheck() {
  try {
    await pool.query("SELECT 1");
    console.log("[DB] PostgreSQL bağlantısı başarılı");
    return true;
  } catch (err) {
    console.error("[DB] PostgreSQL bağlantı HATASI:", err.message);
    return false;
  }
}

// Genel API rate limiting (authLimiter yalnızca register/login uç noktalarında uygulanır)
app.use("/api", apiLimiter);

app.post("/api/auth/register", authLimiter, async (req, res) => {
  console.log(
    "[Register] İstek alındı, body:",
    JSON.stringify({ ...req.body, password: "***" }),
  );

  try {
    const { email, password, ageRange } = req.body;

    if (!email || !password) {
      console.log("[Register] Eksik alanlar - email veya şifre yok");
      return res.status(400).json({ error: "E-posta ve şifre zorunludur." });
    }

    if (password.length < 6) {
      console.log("[Register] Şifre çok kısa");
      return res
        .status(400)
        .json({ error: "Şifre en az 6 karakter olmalıdır." });
    }

    console.log("[Register] Email kontrol ediliyor:", email);
    const existing = await pool.query(
      "SELECT id FROM profiles WHERE email = $1",
      [email],
    );
    if (existing.rows.length > 0) {
      console.log("[Register] Bu e-posta zaten kayıtlı:", email);
      return res
        .status(409)
        .json({ error: "Bu e-posta adresi zaten kayıtlı." });
    }

    console.log("[Register] Şifre hash'leniyor...");
    const hashedPassword = await bcrypt.hash(password, 10);

    console.log("[Register] Kullanıcı veritabanına ekleniyor...");
    const result = await pool.query(
      `INSERT INTO profiles (email, password_hash, age_range, credits, created_at)
       VALUES ($1, $2, $3, 5, NOW())
       RETURNING id`,
      [email, hashedPassword, ageRange || null],
    );

    const userId = result.rows[0].id;
    console.log("[Register] Kullanıcı oluşturuldu, id:", userId);

    const token = jwt.sign(
      { userId, email },
      JWT_SECRET,
      { expiresIn: "365d" }
    );

    return res.status(201).json({
      user: { id: userId, email },
      token,
      message: "Kayıt başarılı",
    });
  } catch (err) {
    console.error("[Register] Hata:", err.message);
    console.error("[Register] Stack:", err.stack);
    return res
      .status(500)
      .json({ error: "Sunucu hatası. Lütfen daha sonra tekrar deneyin." });
  }
});

app.post("/api/auth/login", authLimiter, async (req, res) => {
  console.log(
    "[Login] İstek alındı, body:",
    JSON.stringify({ ...req.body, password: "***" }),
  );

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      console.log("[Login] Eksik alanlar");
      return res.status(400).json({ error: "E-posta ve şifre zorunludur." });
    }

    console.log("[Login] Kullanıcı aranıyor:", email);
    const result = await pool.query(
      "SELECT id, email, password_hash FROM profiles WHERE email = $1",
      [email],
    );
    const user = result.rows[0];

    if (!user) {
      console.log("[Login] Kullanıcı bulunamadı:", email);
      return res.status(401).json({ error: "E-posta veya şifre hatalı." });
    }

    console.log("[Login] Şifre doğrulanıyor...");
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      console.log("[Login] Yanlış şifre:", email);
      return res.status(401).json({ error: "E-posta veya şifre hatalı." });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: "365d",
    });

    console.log("[Login] Başarılı, kullanıcı id:", user.id);
    return res.json({ user: { id: user.id, email: user.email }, token });
  } catch (err) {
    console.error("[Login] Hata:", err.message);
    console.error("[Login] Stack:", err.stack);
    return res
      .status(500)
      .json({ error: "Sunucu hatası. Lütfen daha sonra tekrar deneyin." });
  }
});

app.post("/api/auth/social-login", authLimiter, async (req, res) => {
  console.log("[SocialLogin] İstek alındı, provider:", req.body?.provider);
  try {
    const { provider, idToken, email: rawEmail } = req.body;

    if (!provider || (!idToken && !rawEmail)) {
      return res.status(400).json({ error: "Sağlayıcı veya kimlik bilgisi eksik." });
    }

    let verifiedEmail = rawEmail;

    if (provider === "google" && idToken) {
      try {
        const tokenRes = await fetch(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
        );
        if (tokenRes.ok) {
          const tokenData = await tokenRes.json();
          if (tokenData.email) {
            verifiedEmail = tokenData.email;
          }
        } else {
          console.warn("[SocialLogin] Google tokeninfo yanıtı başarısız, iletilen e-posta kontrol edilecek.");
        }
      } catch (verifyErr) {
        console.warn("[SocialLogin] Google token doğrulama uyarısı:", verifyErr.message);
      }
    }

    if (!verifiedEmail) {
      return res.status(400).json({ error: "E-posta adresi doğrulanamadı." });
    }

    const email = verifiedEmail.toLowerCase().trim();

    // Kullanıcı mevcut mu kontrol et
    let userResult = await pool.query(
      "SELECT id, email FROM profiles WHERE email = $1",
      [email]
    );

    let user = userResult.rows[0];

    // Kayıtlı değilse otomatik oluştur
    if (!user) {
      console.log("[SocialLogin] Yeni profil oluşturuluyor:", email);
      const randomPassword = crypto.randomUUID();
      const hashedPassword = await bcrypt.hash(randomPassword, 10);
      const insertResult = await pool.query(
        `INSERT INTO profiles (email, password_hash, credits, created_at)
         VALUES ($1, $2, 5, NOW())
         RETURNING id, email`,
        [email, hashedPassword]
      );
      user = insertResult.rows[0];
    } else {
      console.log("[SocialLogin] Mevcut kullanıcı ile giriş yapıldı:", email, user.id);
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: "365d",
    });

    return res.json({
      user: { id: user.id, email: user.email },
      token,
      message: "Giriş başarılı",
    });
  } catch (err) {
    console.error("[SocialLogin] Hata:", err.message);
    console.error("[SocialLogin] Stack:", err.stack);
    return res
      .status(500)
      .json({ error: "Sunucu hatası. Lütfen daha sonra tekrar deneyin." });
  }
});

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) {
    console.log("[Auth] Token eksik");
    return res.status(401).json({ error: "Session not found. Please sign in again." });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      console.log("[Auth] Geçersiz token:", err.message);
      return res.status(403).json({ error: "Session not found. Please sign in again." });
    }
    req.userId = decoded.userId;
    next();
  });
}

app.get("/api/auth/profile", authenticateToken, async (req, res) => {
  console.log("[Profile] İstek alındı, userId:", req.userId);
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.set("Pragma", "no-cache");
  try {
    const result = await pool.query(
      "SELECT id, email, age_range, credits AS credits_remaining, is_premium FROM profiles WHERE id = $1",
      [req.userId],
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: "Profil bulunamadı." });
    }
    console.log("[Profile] Gönderiliyor:", JSON.stringify(result.rows[0]));
    res.json(result.rows[0]);
  } catch (err) {
    console.error("[Profile] Hata:", err.message);
    res.status(500).json({ error: "Sunucu hatası." });
  }
});

app.put("/api/auth/profile/age", authenticateToken, async (req, res) => {
  console.log("[Profile Age] Güncelleme, userId:", req.userId);
  try {
    const { ageRange } = req.body;
    await pool.query("UPDATE profiles SET age_range = $1 WHERE id = $2", [ageRange, req.userId]);
    res.json({ message: "Güncellendi" });
  } catch (err) {
    console.error("[Profile Age] Hata:", err.message);
    res.status(500).json({ error: "Sunucu hatası." });
  }
});

app.post("/api/auth/push-token", authenticateToken, async (req, res) => {
  console.log("[Push Token] Kayıt, userId:", req.userId);
  try {
    const { pushToken } = req.body;
    if (!pushToken) {
      return res.status(400).json({ error: "pushToken gerekli." });
    }
    await pool.query("UPDATE profiles SET push_token = $1 WHERE id = $2", [pushToken, req.userId]);
    console.log("[Push Token] Başarıyla kaydedildi, userId:", req.userId);
    res.json({ message: "Push token kaydedildi." });
  } catch (err) {
    console.error("[Push Token] Hata:", err.message);
    res.status(500).json({ error: "Sunucu hatası." });
  }
});

app.get("/api/captions", authenticateToken, async (req, res) => {
  console.log("[Captions] İstek alındı, userId:", req.userId);
  try {
    const result = await pool.query(
      "SELECT id, caption_text, hashtags, created_at, post_id, image_url FROM generated_captions WHERE user_id = $1 ORDER BY created_at DESC",
      [req.userId],
    );
    res.json(result.rows);
  } catch (err) {
    console.error("[Captions] Hata:", err.message);
    res.status(500).json({ error: "Sunucu hatası." });
  }
});

app.get("/api/captions/post/:postId", authenticateToken, async (req, res) => {
  console.log("[Captions] PostID ile sorgu, userId:", req.userId, "postId:", req.params.postId);
  try {
    const result = await pool.query(
      "SELECT id, caption_text, hashtags, created_at, post_id, image_url FROM generated_captions WHERE post_id = $1 AND user_id = $2 ORDER BY id",
      [req.params.postId, req.userId],
    );
    res.json(result.rows);
  } catch (err) {
    console.error("[Captions] PostID sorgu hatası:", err.message);
    res.status(500).json({ error: "Sunucu hatası." });
  }
});

app.delete("/api/captions/:id", authenticateToken, async (req, res) => {
  console.log("[Captions] Silme isteği, userId:", req.userId, "captionId:", req.params.id);
  try {
    const result = await pool.query(
      "DELETE FROM generated_captions WHERE id = $1 AND user_id = $2 RETURNING id",
      [req.params.id, req.userId],
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: "Caption not found" });
    }
    res.json({ message: "Silindi" });
  } catch (err) {
    console.error("[Captions] Silme hatası:", err.message);
    res.status(500).json({ error: "Sunucu hatası." });
  }
});

// ─── INSTANT IN-APP PURCHASE SYNC ENDPOINT ─────────────────────────────────
app.post("/api/purchases/sync", authenticateToken, async (req, res) => {
  const { productId, isSubscription, transactionId } = req.body;
  const userId = req.userId;

  try {
    if (isSubscription) {
      await pool.query("UPDATE profiles SET is_premium = true, is_pro = true WHERE id = $1", [userId]);
      console.log(`[Purchases Sync] Kullanıcı ${userId} abonelik senkronizasyonu ile Premium yapıldı.`);
    } else if (productId) {
      // Ürün ID'sinden sayısal krediyi ayıkla (örn: "10_credits", "credits_30", "50_credits", "30")
      const match = String(productId).match(/\d+/);
      const creditsToAdd = match ? parseInt(match[0], 10) : 0;

      if (creditsToAdd > 0) {
        // Transaction ID ile mükerrer ekleme koruması
        let alreadyProcessed = false;
        if (transactionId) {
          try {
            const existing = await pool.query(
              "SELECT id FROM purchase_events WHERE raw_payload->>'transactionId' = $1",
              [String(transactionId)]
            );
            if (existing.rows.length > 0) {
              alreadyProcessed = true;
              console.log(`[Purchases Sync] İşlem ${transactionId} zaten işlenmiş, mükerrer bakiye eklenmedi.`);
            }
          } catch (tErr) {
            // purchase_events tablosu yoksa veya hata verirse akışı kesme
          }
        }

        if (!alreadyProcessed) {
          const updateResult = await pool.query(
            "UPDATE profiles SET credits = credits + $1 WHERE id = $2 RETURNING id, credits",
            [creditsToAdd, userId]
          );

          try {
            await pool.query(
              `INSERT INTO purchase_events (user_id, event_type, product_id, raw_payload, processed_at)
               VALUES ($1, $2, $3, $4, NOW())`,
              [
                userId,
                "CLIENT_SYNC_PURCHASE",
                String(productId),
                JSON.stringify({ transactionId, creditsToAdd, source: "client_sync" }),
              ]
            );
          } catch (logErr) {
            console.warn("[Purchases Sync] Denetim kaydı ekleme uyarısı (bakiye güncellendi):", logErr.message);
          }

          console.log(
            `[Purchases Sync] Kullanıcı ${userId} hesabına ${creditsToAdd} kredi eklendi (${productId}), yeni bakiye: ${updateResult.rows[0]?.credits}.`
          );
        }
      }
    }

    const finalProfile = await pool.query(
      "SELECT id, email, age_range, credits AS credits_remaining, is_premium FROM profiles WHERE id = $1",
      [userId]
    );

    res.json({ success: true, profile: finalProfile.rows[0] });
  } catch (err) {
    console.error("[Purchases Sync] Hata:", err.message);
    res.status(500).json({ error: "Satın alma senkronize edilemedi." });
  }
});

const REVENUECAT_PREMIUM_GRANT_EVENTS = ["INITIAL_PURCHASE", "RENEWAL", "NON_RENEWING_PURCHASE"];
const REVENUECAT_PREMIUM_REVOKE_EVENTS = ["EXPIRATION", "CANCELLATION"];

app.post("/api/webhooks/revenuecat", async (req, res) => {
  const rawWebhookSecret = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (rawWebhookSecret) {
    // Railway değişkenine yanlışlıkla "Bearer " önekiyle birlikte girilmiş olabilir; her durumda tek "Bearer " ile karşılaştır.
    const webhookSecret = rawWebhookSecret.trim().replace(/^Bearer\s+/i, "");
    const authHeader = req.headers["authorization"];
    if (authHeader !== `Bearer ${webhookSecret}`) {
      console.warn("[RevenueCat Webhook] Yetkisiz istek reddedildi.");
      return res.status(401).json({ error: "Unauthorized" });
    }
  } else {
    console.warn("[RevenueCat Webhook] REVENUECAT_WEBHOOK_SECRET tanımlı değil, geliştirme ortamında webhook doğrulaması atlandı.");
  }

  const event = req.body?.event;
  if (!event || !event.type || !event.app_user_id) {
    console.warn("[RevenueCat Webhook] Geçersiz payload:", JSON.stringify(req.body));
    return res.status(400).json({ error: "Geçersiz webhook payload." });
  }

  console.log(
    `[RevenueCat Webhook] Event alındı: ${event.type}, app_user_id: ${event.app_user_id}, product_id: ${event.product_id}`,
  );

  // Anonim RevenueCat kullanıcılarını atla, integer veya UUID formatındaki tüm gerçek kullanıcı ID'lerini kabul et
  if (String(event.app_user_id).startsWith("$RCAnonymousID")) {
    console.warn(
      `[RevenueCat Webhook] app_user_id anonim RevenueCat ID'si, atlanıyor: ${event.app_user_id}`,
    );
    return res.json({ received: true, skipped: "anonymous_app_user_id" });
  }

  const prodId = (event.product_id || "").toLowerCase();
  const isCredit = prodId.includes("credit") || /\d+/.test(prodId);
  const creditNumMatch = prodId.match(/(\d+)/);

  try {
    if (isCredit && creditNumMatch && !prodId.includes("sub") && !prodId.includes("monthly")) {
      const creditsToAdd = parseInt(creditNumMatch[1], 10);
      if (REVENUECAT_PREMIUM_GRANT_EVENTS.includes(event.type)) {
        const updateResult = await pool.query(
          "UPDATE profiles SET credits = credits + $1 WHERE id = $2 RETURNING id, credits",
          [creditsToAdd, event.app_user_id],
        );
        if (updateResult.rows.length === 0) {
          console.warn(`[RevenueCat Webhook] Kullanıcı bulunamadı: ${event.app_user_id}`);
        } else {
          console.log(
            `[RevenueCat Webhook] Kullanıcı ${event.app_user_id} hesabına ${creditsToAdd} kredi eklendi (${event.type}), yeni bakiye: ${updateResult.rows[0].credits}.`,
          );
        }
      } else {
        console.log(`[RevenueCat Webhook] Kredi ürünü için işlenmeyen event tipi: ${event.type}`);
      }
    } else if (REVENUECAT_PREMIUM_GRANT_EVENTS.includes(event.type)) {
      const updateResult = await pool.query(
        "UPDATE profiles SET is_premium = true WHERE id = $1 RETURNING id",
        [event.app_user_id],
      );
      if (updateResult.rows.length === 0) {
        console.warn(`[RevenueCat Webhook] Kullanıcı bulunamadı: ${event.app_user_id}`);
      } else {
        console.log(
          `[RevenueCat Webhook] Kullanıcı ${event.app_user_id} Premium yapıldı (${event.type}).`,
        );
      }
    } else if (REVENUECAT_PREMIUM_REVOKE_EVENTS.includes(event.type)) {
      const updateResult = await pool.query(
        "UPDATE profiles SET is_premium = false WHERE id = $1 RETURNING id",
        [event.app_user_id],
      );
      if (updateResult.rows.length === 0) {
        console.warn(`[RevenueCat Webhook] Kullanıcı bulunamadı: ${event.app_user_id}`);
      } else {
        console.log(
          `[RevenueCat Webhook] Kullanıcı ${event.app_user_id} Premium'dan çıkarıldı (${event.type}).`,
        );
      }
    } else {
      console.log(`[RevenueCat Webhook] İşlenmeyen event tipi: ${event.type}`);
    }
  } catch (dbErr) {
    console.error("[RevenueCat Webhook] Veritabanı güncelleme hatası:", dbErr.message);
    return res.status(500).json({ error: "Veritabanı güncellenemedi." });
  }

  res.json({ received: true });
});

// ─── MASTER SYSTEM PROMPT BUILDER ───────────────────────────────────────────
function buildSystemPrompt({ gender, tone, length, useEmojis, useHashtags, ageRange, customPrompt, isPremium, carouselMode, isPerImage, imageCount, langName }) {
  const bannedWords = "'Unleash', 'elevate', 'transformative', 'journey', 'delve', 'embrace', 'captivating', 'unlock', 'unlock the potential', 'world of', 'Dive into', 'Elevate your', 'Discover the magic', \"Let's delve\", 'Find your', \"It's time to\", 'Get ready to', 'Let your', 'Radiate confidence', 'Step into', 'Your inner', 'Channel your', 'The ultimate guide to', 'Gelin hep beraber', 'Unutmayın ki'";

  // 1. TEMEL PERSONA VE KURALLAR
  let prompt = `Sen Instagram Reels ve TikTok algoritmalarını ezbere bilen, Z kuşağının dilini konuşan viral bir içerik yazarısın. Görevin, verilen görseller için insanları kaydırmayı bırakmaya, KAYDETMEYE ve ARKADAŞINA GÖNDERMEYE zorlayan "hype" caption'lar üretmek. Algoritma kaydetme ve paylaşmayı like'tan daha çok ödüllendirir. Her satırı buna göre yaz.

KESİN KURALLAR (BUNLARA UYMAZSAN SİSTEM ÇÖKER):
1. HOOK İLE BAŞLA: İlk cümle HER ZAMAN scroll'u durduran bir kanca olmalı. Şaşırtıcı bir iddia, merak boşluğu, "POV:" kurgusu, cesur bir itiraf veya doğrudan seslenme olabilir. İlk 1,5 saniyede yakalayamazsan kaybettin. Selamlama veya giriş cümlesiyle ASLA başlama.
2. BİRİNCİ TEKİL ŞAHIS (POV): Metni her zaman paylaşan kişinin (veya markanın) ağzından yaz. Asla dışarıdan bir gözlemci gibi betimleme yapma.
3. Z KUŞAĞI DİLİ: Trend olan sosyal medya jargonunu doğal bir şekilde kullan (ör. "vibe", "slay", "main character energy", "no cap", "it's giving", "aşırı ...", "resmen ...", "kimse bundan bahsetmiyor"). Yazılan dile ve hedef yaş aralığına uyarla. Zorlama veya cringe kaçacak kadar abartma.
4. GÖRSEL RİTİM: Metni ASLA tek blok halinde yazma. Kısa satırlar kullan ve her fikir arasına boş satır bırak. Emojiler etkinse, satırları vurgulamak ve göz akışını yönlendirmek için emojileri satır başı veya sonu "bullet" olarak kullan.
5. CTA ZORUNLU: Metnin sonunda (hashtag'lerden önce) mutlaka net bir Harekete Geçirici Mesaj olmalı. Yorum yap ("Sen hangisisin? 👇"), kaydet ("Sonra lazım olacak, kaydet 📌") veya arkadaşına gönder ("Bunu görmesi gereken birini etiketle 👀") tarzında olabilir. Görsele en uygun 1-2 tanesini seç.
6. HASHTAG İLE BİTİR: Hashtag'ler etkinse metin, görselin konusuna özel 5-7 adet NİŞ ve ilgili hashtag ile bitmeli. Genel ve şişirilmiş etiketlerden (#love, #instagood) kaçın.
7. YASAKLI KELİMELER: "Yapay zeka gibi" konuşma. ${bannedWords} gibi yapay zeka klişesi olan yavan kelimeleri KESİNLİKLE kullanma.
8. DOĞALLIK: Samimi, enerjik, özgüvenli ol. Sanki en yakın arkadaşına sesli mesaj atıyormuşsun gibi yaz.`;

  // 2. CİNSİYET / ÖZNE DİNAMİĞİ
  if (gender === 'female') {
    prompt += `\n\nKİMLİK: Sen zarif, özgüvenli ve modern bir KADINSIN. Hitabetini, övgülerini ve enerjini dişil enerjiye, zarafete ve kadınsal trendlere uygun ayarla.`;
  } else if (gender === 'male') {
    prompt += `\n\nKİMLİK: Sen karizmatik, net ve özgüvenli bir ERKEKSİN. Hitabetini ve enerjini maskülen, cool ve sade bir stile uygun ayarla.`;
  } else if (gender === 'corporate') {
    prompt += `\n\nKİMLİK: Sen vizyoner ve profesyonel bir MARKASIN (Kurumsal). 'Ben' yerine 'Biz' dilini kullan. Müşterilere güven, kalite ve prestij yansıtan, satış ve pazarlama odaklı bir dil kullan. Asla kişisel fiziksel övgüler yapma.`;
  }

  // 3. TON DİNAMİĞİ
  if (tone === 'viral') {
    prompt += `\n\nTON: VIRAL & KANCA ODAKLI. İnsanları yorum yapmaya veya postu arkadaşlarına göndermeye (share) zorlayacak tartışmalı veya çok merak uyandıran bir dil kullan.`;
  } else if (tone === 'luxury') {
    prompt += `\n\nTON: ULTRA LÜKS & MİNİMAL. Metni minimalist, seçkin ve premium bir dille yaz. Çok az emoji kullan. Mesafeli ama etkileyici bir gizem yarat.`;
  } else if (tone === 'storyteller') {
    prompt += `\n\nTON: HİKAYE ANLATICI. Metni samimi bir anı veya tecrübe paylaşıyormuş gibi kurgula. Okuyucuyla duygusal bir bağ kur.`;
  } else if (tone === 'cool') {
    prompt += `\n\nTON: TRENDY & COOL. Modern argo kullan, zahmetsizce şık ve stil sahibi bir dil.`;
  } else if (tone === 'humorous') {
    prompt += `\n\nTON: ESPRİLİ & EĞLENCELİ. Zekice kelime oyunları, hafif şakalar ve oyuncu bir tavır.`;
  } else if (tone === 'minimal') {
    prompt += `\n\nTON: MİNİMALİST & ESTETİK. Temiz, sade ve görsel olarak şiirsel. Az kelime, yüksek etki.`;
  } else if (tone === 'professional') {
    prompt += `\n\nTON: PROFESYONEL & KURUMSAL. Ciddi, özgüvenli ve iş dünyasına uygun bir dil.`;
  }

  // 4. UZUNLUK, EMOJİ VE HASHTAG
  const lengthDesc = length === 'short' ? 'çok kısa ve öz (1-2 cümle)' : length === 'long' ? 'uzun, detaylı ve blog tarzı' : 'orta uzunlukta, dengeli';
  prompt += `\n\nUZUNLUK: Metin ${lengthDesc} olmalı.`;
  prompt += `\nEMOJİ: ${useEmojis !== false ? 'Emojileri satırları ayırmak, vurgu yapmak ve okunabilirliği artırmak için bolca ama yerinde kullan.' : 'KESİNLİKLE HİÇ EMOJİ KULLANMA.'}`;
  prompt += `\nHASHTAG: ${useHashtags !== false ? 'Metnin en sonuna, CTA\'dan sonra, keşfete düşmeyi sağlayacak niş ve ilgili 5-7 adet hashtag ekle.' : 'KESİNLİKLE HİÇ HASHTAG YAZMA.'}`;
  prompt += `\nYAŞ ARALIĞI: ${ageRange || 'Genel / Tüm yaş grupları'}`;

  // 5. KULLANICI ÖZEL İSTEĞİ (varsa ve premium ise)
  if (customPrompt && isPremium) {
    prompt += `\n\n🚨 KULLANICININ ÖZEL İSTEĞİ (Bu kural diğer tüm kuralları ezer, KESİNLİKLE UYGULA): "${customPrompt}"`;
  }

  // 6. CAROUSEL / PER_IMAGE MODU
  if (carouselMode) {
    prompt += `\n\n📌 FORMAT: Sana birden fazla görsel gönderildi (Carousel Post). Çıktını KESİNLİKLE şu formatta ver:
    Slide 1: [İlk görsel için vurucu bir metin]
    Slide 2: [İkinci görsel için hikayeyi devam ettiren metin]
    ...
    (Her bir görselin birbiriyle bağlantılı, kaydırdıkça merak uyandıran bir hikaye anlattığından emin ol).`;
  } else if (isPerImage) {
    prompt += `\n\n📌 FORMAT: ${imageCount} görsel var. Her görsel için BİR adet benzersiz caption yaz. Her caption farklı ve o görsele özel olmalı. image_index sırası görsellerle eşleşmeli.`;
  }

  // DİL
  const langDisplay = langName || "Türkçe";
  prompt += `\n\nDİL: ${langDisplay === "Türkçe" ? "Türkçe yaz. Günlük konuşma Türkçesi kullan, resmi olmasın." : `Write in ${langDisplay}. Use everyday ${langDisplay}, don't be formal.`}`;

  return prompt;
}

app.post("/api/captions/generate", authenticateToken, upload.array("images", 5), async (req, res) => {
  console.log("[Generate] İstek alındı, userId:", req.userId);

  try {
    const { tone, gender, ageRange, language, length, useEmojis, useHashtags, customPrompt, carouselMode } = req.body;
    const files = req.files || [];

    if (files.length === 0) {
      return res.status(400).json({ error: "En az bir görsel gereklidir." });
    }

    const userResult = await pool.query(
      "SELECT id, credits, is_premium FROM profiles WHERE id = $1",
      [req.userId],
    );
    const userRow = userResult.rows[0];

    if (!userRow) {
      return res.status(404).json({ error: "Kullanıcı bulunamadı." });
    }

    if (userRow.credits < 1) {
      console.log("[Generate] Yetersiz kredi, userId:", req.userId);
      return res.status(403).json({ error: "Yetersiz kredi. Lütfen kredi yükleyin." });
    }

    console.log("[Generate] Dosyalar base64'e çevriliyor...");
    const base64Images = await Promise.all(files.map((f) => fs.promises.readFile(f.path).then((buf) => `data:${f.mimetype};base64,${buf.toString("base64")}`)));
    // Railway gibi proxy arkasında iç PORT dışarıya açık değil; PUBLIC_BASE_URL yoksa isteğin Host başlığı kullanılır
    const baseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`;
    const imageUrls = files.map((f) => `${baseUrl}/uploads/${f.filename}`);

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const langMap = { tr: "Türkçe", en: "English", de: "Deutsch", fr: "Français", es: "Español", ar: "العربية", ru: "Русский" };
    const langName = langMap[language] || language || "Türkçe";

    const prompt = buildSystemPrompt({
      gender,
      tone,
      length,
      useEmojis: useEmojis !== false,
      useHashtags: useHashtags !== false,
      ageRange,
      customPrompt: customPrompt && userRow.is_premium ? customPrompt.trim() : "",
      isPremium: userRow.is_premium,
      carouselMode: !!carouselMode,
      isPerImage: false,
      imageCount: files.length,
      langName,
    }) + `\n\nSadece JSON formatında yanıt ver:

{
  "captions": [
    { "caption_text": "caption text (\\n ile satır arası boşluk ekle)", "hashtags": ["#tag1", "#tag2"] },
    { "caption_text": "caption text (\\n ile satır arası boşluk ekle)", "hashtags": ["#tag3", "#tag4"] }
  ]
}

En az 2, en fazla 4 caption üret.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: [{ type: "text", text: prompt }, ...base64Images.map((img) => ({ type: "image_url", image_url: { url: img } }))] }],
      response_format: { type: "json_object" },
      max_tokens: 3000,
      temperature: 0.75,
      presence_penalty: 0.4,
      frequency_penalty: 0.3,
    });

    const raw = completion.choices[0]?.message?.content || "";
    let aiCaptions = [];

    try {
      const parsed = JSON.parse(raw);
      aiCaptions = parsed.captions || parsed.data || parsed.results || parsed.output || [];
      if (!Array.isArray(aiCaptions)) aiCaptions = [aiCaptions];
      aiCaptions = aiCaptions.filter(c => c && (c.caption_text || c.text));
      aiCaptions = aiCaptions.map(c => ({ caption_text: c.caption_text || c.text || "", hashtags: Array.isArray(c.hashtags) ? c.hashtags : [] }));
    } catch {
      const jsonMatch = (raw || "").match(/{[\s\S]*}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          aiCaptions = parsed.captions || parsed.data || parsed.results || parsed.output || [];
          if (!Array.isArray(aiCaptions)) aiCaptions = [aiCaptions];
          aiCaptions = aiCaptions.filter(c => c && (c.caption_text || c.text));
          aiCaptions = aiCaptions.map(c => ({ caption_text: c.caption_text || c.text || "", hashtags: Array.isArray(c.hashtags) ? c.hashtags : [] }));
        } catch { aiCaptions = []; }
      } else { aiCaptions = []; }
    }

    if (!aiCaptions.length) {
      throw new Error("Altyazı oluşturulamadı");
    }

    const postId = crypto.randomUUID();

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      for (const caption of aiCaptions) {
        const rowId = crypto.randomUUID();
        await client.query(
          `INSERT INTO generated_captions (id, user_id, caption_text, hashtags, image_url, post_id, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [rowId, req.userId, caption.caption_text, caption.hashtags, imageUrls[0], postId],
        );
      }

      await client.query(
        "UPDATE profiles SET credits = credits - 1 WHERE id = $1",
        [req.userId],
      );

      await client.query("COMMIT");

      const remainingResult = await pool.query("SELECT credits FROM profiles WHERE id = $1", [req.userId]);
      const remainingCredits = remainingResult.rows[0].credits;

      const captions = aiCaptions.map((c) => ({ text: c.caption_text, hashtags: c.hashtags }));

      sendPushNotification(
        req.userId,
        "Başlıkların Hazır! ✨",
        "Yapay zeka harika içerikler üretti. İncelemek için dokun!",
        { screen: "history", post_id: postId }
      ).catch(err => console.error("[Push] Async error:", err.message));

      try {
        if (!res.headersSent) {
          res.status(201).json({
            success: true,
            captions,
            post_id: postId,
            image_url: imageUrls[0],
            image_urls: imageUrls,
            remainingCredits,
          });
        }
      } catch (clientErr) {
        console.log("[Backend] İstemci bağlantısı koptu ama metin başarıyla üretilip kaydedildi.");
      }
    } catch (txErr) {
      await client.query("ROLLBACK");
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("[Generate] Hata:", err.message);
    console.error("[Generate] Stack:", err.stack);
    res.status(500).json({ success: false, error: "Altyazı oluşturulamadı." });
  }
});

app.post("/api/captions/generate-json", authenticateToken, async (req, res) => {
  console.log("[Generate-JSON] İstek alındı, userId:", req.userId);

  try {
    const { images, tone, gender, ageRange, language, length, useEmojis, useHashtags, mode, customPrompt, carouselMode } = req.body;
    const isPerImage = mode === "per_image";

    if (!images || images.length === 0) {
      return res.status(400).json({ error: "En az bir görsel (base64) gereklidir." });
    }

    const userResult = await pool.query(
      "SELECT id, credits, is_premium FROM profiles WHERE id = $1",
      [req.userId],
    );
    const userRow = userResult.rows[0];

    if (!userRow) {
      return res.status(404).json({ error: "Kullanıcı bulunamadı." });
    }

    const requiredCredits = isPerImage ? images.length : 1;

    if (userRow.credits < requiredCredits) {
      return res.status(403).json({ error: `Yetersiz kredi. Gerekli: ${requiredCredits}, Mevcut: ${userRow.credits}` });
    }

    console.log(`[Generate-JSON] ${images.length} görsel, mode=${mode || "alternatives"}, AI çağrılıyor...`);

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const langMap = { tr: "Türkçe", en: "English", de: "Deutsch", fr: "Français", es: "Español", ar: "العربية", ru: "Русский" };
    const langName = langMap[language] || language || "Türkçe";

    const basePrompt = buildSystemPrompt({
      gender,
      tone,
      length,
      useEmojis: useEmojis !== false,
      useHashtags: useHashtags !== false,
      ageRange,
      customPrompt: customPrompt && userRow.is_premium ? customPrompt.trim() : "",
      isPremium: userRow.is_premium,
      carouselMode: !!carouselMode,
      isPerImage: !!isPerImage,
      imageCount: images.length,
      langName,
    });

    let prompt;
    if (isPerImage) {
      prompt = basePrompt + `\n\nSadece JSON formatında yanıt ver:

{
  "captions": [
    { "image_index": 0, "caption_text": "caption for image 1 (\\n ile satır arası boşluk ekle)", "hashtags": ["#tag1", "#tag2"] },
    { "image_index": 1, "caption_text": "caption for image 2 (\\n ile satır arası boşluk ekle)", "hashtags": ["#tag3", "#tag4"] }
  ]
}

Tam olarak ${images.length} caption üret. image_index sırası görsellerle eşleşmeli.`;
    } else {
      prompt = basePrompt + `\n\nSadece JSON formatında yanıt ver:

{
  "captions": [
    { "caption_text": "caption text (\\n ile satır arası boşluk ekle)", "hashtags": ["#tag1", "#tag2"] },
    { "caption_text": "caption text (\\n ile satır arası boşluk ekle)", "hashtags": ["#tag3", "#tag4"] }
  ]
}

En az 2, en fazla 4 caption üret.`;
    }

    const callOpenAI = async (retryPrompt) => {
      const msg = retryPrompt || prompt;
      return await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: [{ type: "text", text: msg }, ...images.map((img) => ({ type: "image_url", image_url: { url: img } }))] }],
        response_format: { type: "json_object" },
        max_tokens: 3000,
        temperature: 0.75,
        presence_penalty: 0.4,
        frequency_penalty: 0.3,
      });
    };

    let completion = await callOpenAI();
    let raw = completion.choices[0]?.message?.content || "";
    console.log(
      "[Generate-JSON] AI yanıtı alındı" + (raw ? "" : " (bos)") +
      `, finish_reason=${completion.choices[0]?.finish_reason}` +
      `, refusal=${completion.choices[0]?.message?.refusal || "yok"}`,
    );

    const retryMsg = langName === "Türkçe"
      ? "Caption'ları KESİNLİKLE birinci tekil şahıs (Ben) ağzından yaz. Boş yanıt verme. Soru cümlesi kullanma."
      : "Write captions from FIRST-PERSON (I/me/my) perspective. Do not return empty. Do NOT use question sentences.";
    const fallbackPrompt = langName === "Türkçe"
      ? `Fotoğraf için "Ben" ağzından kısa, doğal bir Instagram altyazısı yaz. Sadece şu JSON formatında yanıt ver: {"captions": [{"caption_text": "...", "hashtags": ["#tag1"]}]}. ${retryMsg}`
      : `Write a short, first-person Instagram caption for the image. Respond ONLY in this exact JSON format: {"captions": [{"caption_text": "...", "hashtags": ["#tag1"]}]}. ${retryMsg}`;

    let attempts = 0;
    let aiCaptions = [];

    while (attempts < 3 && aiCaptions.length === 0) {
      attempts++;
      if (attempts > 1) {
        console.log(`[Generate-JSON] Deneme ${attempts}...`);
        const p = attempts === 2 ? prompt + "\n\n" + retryMsg : fallbackPrompt;
        completion = await callOpenAI(p);
        raw = completion.choices[0]?.message?.content || "";
        console.log(
          "[Generate-JSON] AI yanıtı alındı" + (raw ? "" : " (bos)") +
          `, finish_reason=${completion.choices[0]?.finish_reason}` +
          `, refusal=${completion.choices[0]?.message?.refusal || "yok"}`,
        );
      }

      if (!raw) continue;

      try {
        const parsed = JSON.parse(raw);
        aiCaptions = parsed.captions || parsed.data || parsed.results || parsed.output;
        if (!aiCaptions && parsed.caption_text) aiCaptions = [parsed];
        if (!aiCaptions) {
          const firstArray = Object.values(parsed).find(v => Array.isArray(v));
          aiCaptions = firstArray || [];
        }
        if (!Array.isArray(aiCaptions)) aiCaptions = [aiCaptions];
        aiCaptions = aiCaptions.filter(c => c && (c.caption_text || c.text));
        aiCaptions = aiCaptions.map(c => ({
          caption_text: c.caption_text || c.text || "",
          hashtags: Array.isArray(c.hashtags) ? c.hashtags : [],
          image_index: c.image_index,
        }));
      } catch {
        const jsonMatch = (raw || "").match(/{[\s\S]*}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            aiCaptions = parsed.captions || parsed.data || parsed.results || parsed.output || [];
            if (!Array.isArray(aiCaptions)) aiCaptions = [aiCaptions];
            aiCaptions = aiCaptions.filter(c => c && (c.caption_text || c.text));
            aiCaptions = aiCaptions.map(c => ({
              caption_text: c.caption_text || c.text || "",
              hashtags: Array.isArray(c.hashtags) ? c.hashtags : [],
              image_index: c.image_index,
            }));
          } catch { aiCaptions = []; }
        } else { aiCaptions = []; }
      }
    }

    if (!aiCaptions.length) {
      throw new Error("Altyazı oluşturulamadı");
    }

    const postId = crypto.randomUUID();

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      for (const caption of aiCaptions) {
        const rowId = crypto.randomUUID();
        await client.query(
          `INSERT INTO generated_captions (id, user_id, caption_text, hashtags, image_url, post_id, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [rowId, req.userId, caption.caption_text, caption.hashtags, "base64", postId],
        );
      }

      await client.query(
        "UPDATE profiles SET credits = credits - $1 WHERE id = $2",
        [requiredCredits, req.userId],
      );

      await client.query("COMMIT");

      const remainingResult = await pool.query(
        "SELECT credits FROM profiles WHERE id = $1",
        [req.userId],
      );
      const remainingCredits = remainingResult.rows[0].credits;

      const captions = aiCaptions.map((c) => ({
        text: c.caption_text,
        hashtags: c.hashtags,
        image_index: c.image_index,
      }));

      sendPushNotification(
        req.userId,
        "Başlıkların Hazır! ✨",
        "Yapay zeka harika içerikler üretti. İncelemek için dokun!",
        { screen: "history", post_id: postId }
      ).catch(err => console.error("[Push] Async error:", err.message));

      try {
        if (!res.headersSent) {
          res.status(201).json({
            success: true,
            captions,
            post_id: postId,
            remainingCredits,
          });
        }
      } catch (clientErr) {
        console.log("[Backend] İstemci bağlantısı koptu ama metin başarıyla üretilip kaydedildi.");
      }
    } catch (txErr) {
      await client.query("ROLLBACK");
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("[Generate-JSON] Hata:", err.message);
    res.status(500).json({ success: false, error: "Altyazı oluşturulamadı." });
  }
});

app.get("/health", async (req, res) => {
  const dbOk = await dbHealthCheck();
  res.status(dbOk ? 200 : 503).json({ status: dbOk ? "ok" : "degraded", timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error("[Unhandled Error]", err);
  res.status(500).json({ error: "Sunucu hatası." });
});

async function sendPushNotification(userId, title, body, data = {}) {
  try {
    const userRes = await pool.query("SELECT push_token FROM profiles WHERE id = $1", [userId]);
    const pushToken = userRes.rows[0]?.push_token;

    if (!pushToken) {
      console.log(`[Push Notification] Kullanıcı ${userId} için token bulunamadı.`);
      return;
    }

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: pushToken,
        sound: "capshion_sound",
        title: title,
        body: body,
        data: data,
        channelId: "capshion_sound_v5",
      }),
    });

    const resData = await response.json();
    console.log(`[Push Notification] Gönderim durumu:`, resData);
  } catch (err) {
    console.error("[Push Notification] Hata:", err.message);
  }
}

function gracefulShutdown(signal) {
  console.log(`[Server] ${signal} alındı, kapatılıyor...`);
  pool.end(() => {
    console.log("[DB] Bağlantı kapatıldı.");
    process.exit(0);
  });
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

async function start() {
  const dbOk = await dbHealthCheck();
  if (!dbOk) {
    console.warn(
      "[Server] UYARI: Veritabanına bağlanılamadı. Sunucu yine de başlatılıyor ancak auth istekleri başarısız olacak.",
    );
  }

  try {
    await pool.query("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false");
    console.log("[DB] is_premium sütunu kontrol edildi/eklendi.");
    await pool.query("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token TEXT");
    console.log("[DB] push_token sütunu kontrol edildi/eklendi.");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS purchase_events (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        event_type TEXT NOT NULL,
        product_id TEXT,
        raw_payload JSONB,
        processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    console.log("[DB] purchase_events tablosu kontrol edildi/eklendi.");
  } catch (migErr) {
    console.warn("[DB] Migrasyon hatası (önemsiz):", migErr.message);
  }

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(
      `[Server] Express sunucu http://0.0.0.0:${PORT} adresinde çalışıyor`,
    );
    console.log(
      `[Server] Register: http://localhost:${PORT}/api/auth/register`,
    );
    console.log(`[Server] Login:    http://localhost:${PORT}/api/auth/login`);
  });
}

start();
