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
const Iyzipay = require("iyzipay");


const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN || "http://localhost:8081,http://localhost:19006").split(",");

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false, message: { error: "Çok fazla istek. Lütfen daha sonra tekrar deneyin." } });
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });

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
app.use(helmet());
app.use(compression());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(cors({ origin: ALLOWED_ORIGINS, methods: ["GET", "POST", "PUT", "DELETE"], credentials: true }));
app.use(express.json({ limit: "10mb" }));
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
    console.error(
      "[DB] DATABASE_URL:",
      process.env.DATABASE_URL || "(kullanılmıyor, fallback aktif)",
    );
    return false;
  }
}

app.use("/api/auth", authLimiter);
app.use("/api", apiLimiter);

app.post("/api/auth/register", async (req, res) => {
  console.log("[Register] İstek alındı, body:", JSON.stringify(req.body));

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
      { expiresIn: "7d" }
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

app.post("/api/auth/login", async (req, res) => {
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
      expiresIn: "7d",
    });

    console.log("[Login] Başarılı, kullanıcı id:", user.id);
    return res.json({ user: { id: user.id }, token });
  } catch (err) {
    console.error("[Login] Hata:", err.message);
    console.error("[Login] Stack:", err.stack);
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
      "SELECT id, email, age_range, credits AS credits_remaining FROM profiles WHERE id = $1",
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

app.get("/api/captions", authenticateToken, async (req, res) => {
  console.log("[Captions] İstek alındı, userId:", req.userId);
  try {
    const result = await pool.query(
      "SELECT id, caption_text, hashtags, created_at, post_id FROM generated_captions WHERE user_id = $1 ORDER BY created_at DESC",
      [req.userId],
    );
    res.json(result.rows);
  } catch (err) {
    console.error("[Captions] Hata:", err.message);
    res.status(500).json({ error: "Sunucu hatası." });
  }
});

app.post("/api/payment/create", authenticateToken, async (req, res) => {
  console.log("[Payment] İstek alındı:", JSON.stringify(req.body));
  try {
    const { price, credits, currency } = req.body;

    const userResult = await pool.query(
      "SELECT email FROM profiles WHERE id = $1",
      [req.userId],
    );
    const userRow = userResult.rows[0];
    if (!userRow) {
      return res.status(404).json({ error: "Kullanıcı bulunamadı." });
    }

    const conversationId = `${req.userId}_${credits}_${crypto.randomUUID()}`;
    const basketId = crypto.randomUUID();

    const iyzipay = new Iyzipay({
      apiKey: process.env.IYZICO_API_KEY,
      secretKey: process.env.IYZICO_SECRET_KEY,
      uri: process.env.IYZICO_BASE_URL,
    });

    const clientIp = req.ip || req.headers["x-forwarded-for"] || "85.34.78.112";
    const priceNum = parseFloat(price);
    const priceStr = priceNum.toFixed(2);

    const request = {
      locale: Iyzipay.LOCALE.TR,
      conversationId,
      price: priceStr,
      paidPrice: priceStr,
      currency: currency === "TRY" ? Iyzipay.CURRENCY.TRY : Iyzipay.CURRENCY.USD,
      basketId,
      paymentGroup: Iyzipay.PAYMENT_GROUP.PRODUCT,
      callbackUrl: process.env.IYZICO_CALLBACK_URL,
      enabledInstallments: [1],
      buyer: {
        id: String(req.userId),
        name: "Kullanici",
        surname: "Capshion",
        gsmNumber: "+905555555555",
        email: userRow.email,
        identityNumber: process.env.IYZICO_IDENTITY_NUMBER || "11111111111",
        registrationAddress: "Capshion AI Platform",
        registrationDate: new Date().toISOString().replace("T", " ").split(".")[0],
        lastLoginDate: new Date().toISOString().replace("T", " ").split(".")[0],
        ip: clientIp,
        city: "Istanbul",
        country: "Turkey",
        zipCode: "34700",
      },
      shippingAddress: {
        contactName: "Kullanici Capshion",
        city: "Istanbul",
        country: "Turkey",
        address: "Capshion AI Platform",
        zipCode: "34700",
      },
      billingAddress: {
        contactName: "Kullanici Capshion",
        city: "Istanbul",
        country: "Turkey",
        address: "Capshion AI Platform",
        zipCode: "34700",
      },
      basketItems: [
        {
          id: basketId,
          name: `${credits} Kredi Paketi`,
          category1: "Dijital Urun",
          category2: "Sosyal Medya",
          itemType: Iyzipay.BASKET_ITEM_TYPE.VIRTUAL,
          price: priceStr,
        },
      ],
    };

    iyzipay.checkoutFormInitialize.create(request, async (err, result) => {
      if (err) {
        console.error("[Payment] Iyzico hatasi:", err);
        return res.status(500).json({ error: "Odeme baslatilamadi." });
      }
      console.log("[Payment] Iyzico checkoutFormInitialize sonucu:", JSON.stringify(result, null, 2));
      if (result?.status === "failure") {
        console.error("[Payment] Iyzico init hatasi - errorCode:", result.errorCode, "errorMessage:", result.errorMessage);
      }
      if (result?.token) {
        try {
          await pool.query(
            "INSERT INTO payment_requests (token, user_id, credits) VALUES ($1, $2, $3) ON CONFLICT (token) DO NOTHING",
            [result.token, req.userId, Number(credits)],
          );
        } catch (dbErr) {
          console.error("[Payment] DB kayit hatasi:", dbErr.message);
        }
      }
      res.json({ paymentUrl: result.paymentPageUrl });
    });
  } catch (err) {
    console.error("[Payment] Hata:", err.message);
    res.status(500).json({ error: "Odeme baslatilamadi." });
  }
});

async function handlePaymentCallback(req, res) {
  console.log('[Callback] Gelen istek body:', JSON.stringify(req.body));
  console.log('[Callback] Gelen istek query:', JSON.stringify(req.query));

  const baseUrl = `${req.protocol}://${req.get("host")}`;
  const token = req.body?.token || req.query?.token;
  if (!token) {
    return res.redirect(`${baseUrl}/payment-failure?reason=no_token`);
  }

  try {
    const iyzipay = new Iyzipay({
      apiKey: process.env.IYZICO_API_KEY,
      secretKey: process.env.IYZICO_SECRET_KEY,
      uri: process.env.IYZICO_BASE_URL,
    });

    iyzipay.checkoutForm.retrieve({ token }, async (err, result) => {
      if (err) {
        console.error("[Payment] Callback dogrulama hatasi:", err);
        return res.redirect(`${baseUrl}/payment-failure?reason=verify_error`);
      }

      console.log("[Payment] Iyzico dogrulama sonucu:", JSON.stringify(result, null, 2));

      if (result.paymentStatus === "SUCCESS") {
        const payRow = await pool.query(
          "SELECT user_id, credits FROM payment_requests WHERE token = $1",
          [token],
        );
        const userId = payRow.rows[0]?.user_id;
        const credits = payRow.rows[0]?.credits;

        if (!userId || !credits) {
          console.error("[Payment] Metadata bulunamadi, token:", token);
          return res.redirect(`${baseUrl}/payment-failure?reason=bad_meta`);
        }

        await pool.query(
          "UPDATE profiles SET credits = credits + $1 WHERE id = $2",
          [credits, userId],
        );
        await pool.query("DELETE FROM payment_requests WHERE token = $1", [token]);
        console.log(`[Payment] Kredi eklendi: userId=${userId}, credits=${credits}`);

        res.redirect(`${baseUrl}/payment-success`);
      } else {
        console.log("[Payment] Odeme basarisiz - status:", result.paymentStatus, "| errorCode:", result.errorCode, "| errorMessage:", result.errorMessage, "| mdStatus:", result.mdStatus, "| fraudStatus:", result.fraudStatus, "| phase:", result.phase, "| itemTransactions:", JSON.stringify(result.itemTransactions));
        res.redirect(`${baseUrl}/payment-failure`);
      }
    });
  } catch (err) {
    console.error("[Payment] Callback hatasi:", err.message);
    res.redirect(`${baseUrl}/payment-failure?reason=exception`);
  }
}

app.post("/api/payment/callback", (req, res, next) => {
  console.log("!!! IYZICO CALLBACK GELDI (POST) !!!", JSON.stringify(req.body));
  handlePaymentCallback(req, res).catch(next);
});

app.all("/api/payment/callback", (req, res, next) => {
  handlePaymentCallback(req, res).catch(next);
});

app.get("/payment-success", (req, res) => {
  res.send("<html><body><h1>Odeme Basarili</h1></body></html>");
});

app.get("/payment-failure", (req, res) => {
  res.send("<html><body><h1>Odeme Basarisiz</h1></body></html>");
});

app.post("/api/captions/generate", authenticateToken, upload.array("images", 5), async (req, res) => {
  console.log("[Generate] İstek alındı, userId:", req.userId);

  try {
    const { tone, gender, ageRange, language } = req.body;
    const files = req.files || [];

    if (files.length === 0) {
      return res.status(400).json({ error: "En az bir görsel gereklidir." });
    }

    const userResult = await pool.query(
      "SELECT id, credits FROM profiles WHERE id = $1",
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
    const imageUrls = files.map((f) => `${req.protocol}://${req.hostname}:${process.env.PORT || 3000}/uploads/${f.filename}`);

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const langMap = { tr: "Türkçe", en: "English", de: "Deutsch", fr: "Français", es: "Español", ar: "العربية", ru: "Русский" };
    const langName = langMap[language] || language || "Türkçe";
    const instructionLang = langName === "Türkçe" ? "Türkçe yaz. Günlük konuşma Türkçesi kullan, resmi olmasın." : `Write in ${langName}. Use everyday ${langName}, don't be formal.`;

    const prompt = `You are writing Instagram captions like a real user, not an AI or a poet.\nLook at the photo(s) and write what naturally comes to mind — like a friend sharing a moment.\n\nRules:\n- NEVER write like AI, poet, motivational speaker, or advertiser\n- NO exaggerated adjectives, deep life quotes, or generic wisdom\n- NO question sentences — write statements, opinions, or observations\n- Short, natural, everyday language\n- Emojis OK but don't overdo it\n\n${instructionLang}\nTone: ${tone || "neutral"}\nGender: ${gender || "neutral"}\nAge range: ${ageRange || "general"}\n\nAdd 2-4 hashtags per caption. Reply ONLY with this JSON format:\n\n{\n  "captions": [\n    { "caption_text": "caption text", "hashtags": ["#tag1", "#tag2"] },\n    { "caption_text": "caption text", "hashtags": ["#tag3", "#tag4"] }\n  ]\n}\n\nGenerate at least 2, at most 4 captions.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: [{ type: "text", text: prompt }, ...base64Images.map((img) => ({ type: "image_url", image_url: { url: img } }))] }],
      response_format: { type: "json_object" },
      max_tokens: 3000,
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

      await client.query(
        `INSERT INTO generated_captions (id, user_id, caption_text, hashtags, image_url, post_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [postId, req.userId, aiCaptions[0].caption_text, aiCaptions[0].hashtags, imageUrls[0], postId],
      );

      await client.query(
        "UPDATE profiles SET credits = credits - 1 WHERE id = $1",
        [req.userId],
      );

      await client.query("COMMIT");

      const remainingResult = await pool.query("SELECT credits FROM profiles WHERE id = $1", [req.userId]);
      const remainingCredits = remainingResult.rows[0].credits;

      const captions = aiCaptions.map((c) => ({ text: c.caption_text, hashtags: c.hashtags }));

      res.status(201).json({
        success: true,
        captions,
        post_id: postId,
        image_url: imageUrls[0],
        image_urls: imageUrls,
        remainingCredits,
      });
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
    const { images, tone, gender, ageRange, language } = req.body;

    if (!images || images.length === 0) {
      return res.status(400).json({ error: "En az bir görsel (base64) gereklidir." });
    }

    const userResult = await pool.query(
      "SELECT id, credits FROM profiles WHERE id = $1",
      [req.userId],
    );
    const userRow = userResult.rows[0];

    if (!userRow) {
      return res.status(404).json({ error: "Kullanıcı bulunamadı." });
    }

    if (userRow.credits < 1) {
      return res.status(403).json({ error: "Yetersiz kredi. Lütfen kredi yükleyin." });
    }

    console.log(`[Generate-JSON] ${images.length} görsel, AI çağrılıyor...`);

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const langMap = { tr: "Türkçe", en: "English", de: "Deutsch", fr: "Français", es: "Español", ar: "العربية", ru: "Русский" };
    const langName = langMap[language] || language || "Türkçe";
    const instructionLang = langName === "Türkçe"
      ? "Türkçe yaz. Günlük konuşma Türkçesi kullan, resmi olmasın."
      : `Write in ${langName}. Use everyday ${langName}, don't be formal.`;

    const prompt = `You are writing Instagram captions like a real user, not an AI or a poet.
Look at the photo(s) and write what naturally comes to mind — like a friend sharing a moment.

Rules:
- NEVER write like AI, poet, motivational speaker, or advertiser
- NO exaggerated adjectives, deep life quotes, or generic wisdom
- NO question sentences — write statements, opinions, or observations
- Short, natural, everyday language
- Emojis OK but don't overdo it

${instructionLang}
Tone: ${tone || "neutral"}
Gender: ${gender || "neutral"}
Age range: ${ageRange || "general"}

Add 2-4 hashtags per caption. Reply ONLY with this JSON format:

{
  "captions": [
    { "caption_text": "caption text", "hashtags": ["#tag1", "#tag2"] },
    { "caption_text": "caption text", "hashtags": ["#tag3", "#tag4"] }
  ]
}

Generate at least 2, at most 4 captions.`;

    const callOpenAI = async (retryPrompt) => {
      const msg = retryPrompt || prompt;
      return await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: [{ type: "text", text: msg }, ...images.map((img) => ({ type: "image_url", image_url: { url: img } }))] }],
        response_format: { type: "json_object" },
        max_tokens: 3000,
      });
    };

    let completion = await callOpenAI();
    let raw = completion.choices[0]?.message?.content || "";
    console.log("[Generate-JSON] AI yanıtı alındı" + (raw ? "" : " (bos)"));

    const retryMsg = langName === "Türkçe"
      ? "Lütfen görsel(ler) için mutlaka altyazı üret. Boş yanıt verme. Soru cümlesi kullanma."
      : "Please generate captions for the image(s). Do not return empty. Do NOT use question sentences.";
    const fallbackPrompt = langName === "Türkçe"
      ? `Görsel için kısa, doğal bir Instagram altyazısı yaz. ${retryMsg}`
      : `Write a short, natural Instagram caption for the image. ${retryMsg}`;

    let attempts = 0;
    let aiCaptions = [];

    while (attempts < 3 && aiCaptions.length === 0) {
      attempts++;
      if (attempts > 1) {
        console.log(`[Generate-JSON] Deneme ${attempts}...`);
        const p = attempts === 2 ? prompt + "\n\n" + retryMsg : fallbackPrompt;
        completion = await callOpenAI(p);
        raw = completion.choices[0]?.message?.content || "";
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

      await client.query(
        `INSERT INTO generated_captions (id, user_id, caption_text, hashtags, image_url, post_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [postId, req.userId, aiCaptions[0].caption_text, aiCaptions[0].hashtags, "base64", postId],
      );

      await client.query(
        "UPDATE profiles SET credits = credits - 1 WHERE id = $1",
        [req.userId],
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
      }));

      res.status(201).json({
        success: true,
        captions,
        post_id: postId,
        remainingCredits,
      });
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
