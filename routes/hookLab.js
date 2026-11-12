// ─── HOOK LAB ───────────────────────────────────────────────────────────────
// Mevcut /api/captions/* uç noktalarından TAMAMEN bağımsızdır.
// server.js içinden registerHookLabRoutes(app, deps) ile bağlanır.
//
// Akış:
//   POST /api/hook-lab/generate        → 5 farklı kanca stiliyle caption üretir (1 kredi)
//   GET  /api/hook-lab/:id             → oturumu tekrar getirir (Premium'a geçildiyse kilitleri açar)
//   POST /api/hook-lab/:id/feedback    → swipe / kopyalama sinyalini kaydeder
//
// Ücretsiz kullanıcılar FREE_UNLOCKED adet varyantı tam görür; kilitli
// varyantların metni istemciye HİÇ gönderilmez (yalnızca kısa bir önizleme).

const crypto = require("crypto");
const OpenAI = require("openai");

const VARIANT_COUNT = 5;
const FREE_UNLOCKED = 2;
const MAX_IMAGES = 5;

const HOOK_STYLES = [
  { id: "question", rule: "SORU İLE AÇILIŞ: İlk satır, okurun kafasında cevap aramaya başlayacağı kısa ve somut bir soru olsun." },
  { id: "bold_claim", rule: "CESUR İDDİA: İlk satır, savunulabilir ama şaşırtıcı, net bir iddia olsun." },
  { id: "confession", rule: "İTİRAF: İlk satır, küçük ve samimi bir itirafla başlasın (\"Kabul ediyorum...\" kalıbını kullanmadan)." },
  { id: "humor", rule: "MİZAH: İlk satır, görseldeki somut bir detaydan çıkan zekice, hafif bir espri olsun." },
  { id: "curiosity", rule: "MERAK BOŞLUĞU: İlk satır, bir şeyi yarım bırakarak okuru devamını okumaya iten bir cümle olsun." },
];
const STYLE_IDS = HOOK_STYLES.map((s) => s.id);

const PLATFORM_PRESETS = {
  instagram: { length: "medium", rule: "Instagram (feed/Reels): İlk ~125 karakter kesilmeden görünür, kanca orada olmalı. 5-7 niş hashtag." },
  tiktok: { length: "short", rule: "TikTok: Çok kısa ve konuşma dilinde; ilk satır videonun kancası gibi çalışmalı. 3-5 hashtag." },
  linkedin: { length: "long", rule: "LinkedIn: Profesyonel ama kişisel; kısa paragraflar, boş satırlarla ayrılmış. Emoji çok az. EN FAZLA 3 hashtag." },
  x: { length: "short", rule: "X (Twitter): Hashtag'ler DAHİL toplam metin 280 karakteri ASLA aşmasın. EN FAZLA 2 hashtag." },
  threads: { length: "medium", rule: "Threads: Sohbet havasında, samimi ve rahat. EN FAZLA 3 hashtag (gerekmiyorsa hiç)." },
};
const PLATFORM_IDS = Object.keys(PLATFORM_PRESETS);

const LANG_MAP = { tr: "Türkçe", en: "English", de: "Deutsch", fr: "Français", es: "Español", ar: "العربية", ru: "Русский" };
const FEEDBACK_ACTIONS = new Set(["like", "skip", "copy", "edit_copy"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function previewOf(text) {
  const words = String(text || "").replace(/\s+/g, " ").trim().split(" ");
  return words.slice(0, 3).join(" ") + (words.length > 3 ? "…" : "");
}

// AI bazen kancayı tırnak içine alıyor ("...", “...”, «...»); kopyalanan metinde istenmez.
const QUOTE_PAIRS = [['"', '"'], ["“", "”"], ["„", "“"], ["«", "»"], ["'", "'"], ["‘", "’"]];
function stripWrappingQuotes(line) {
  const t = String(line || "").trim();
  for (const [open, close] of QUOTE_PAIRS) {
    if (t.length > 2 && t.startsWith(open) && t.endsWith(close)) {
      const inner = t.slice(open.length, t.length - close.length);
      if (!inner.includes(open) && !inner.includes(close)) return inner.trim();
    }
  }
  return t;
}

function cleanCaption(text) {
  const lines = String(text || "").trim().split("\n");
  const i = lines.findIndex((l) => l.trim());
  if (i >= 0) lines[i] = stripWrappingQuotes(lines[i]);
  return lines.join("\n");
}

// Model hashtag'leri hem caption_text'in sonuna hem "hashtags" alanına yazabiliyor;
// metnin sonundaki hashtag dizisini ayırıp tek yerde (hashtags) tutar.
const TRAILING_TAGS = /(?:\s*#[\p{L}\p{N}_]+)+\s*$/u;
function splitTrailingHashtags(text, hashtags) {
  const m = String(text || "").match(TRAILING_TAGS);
  if (!m || m.index === 0) return { text, hashtags };
  const found = m[0].match(/#[\p{L}\p{N}_]+/gu) || [];
  const merged = [...hashtags];
  for (const t of found) if (!merged.some((h) => h.toLowerCase() === t.toLowerCase())) merged.push(t);
  return { text: text.slice(0, m.index).replace(/\s+$/, ""), hashtags: merged.slice(0, 10) };
}

function firstLine(text) {
  return String(text || "").split("\n").map((l) => l.trim()).find(Boolean) || "";
}

// AI çıktısını { style, hook, caption_text, hashtags } dizisine normalize eder.
function parseVariants(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const m = String(raw || "").match(/{[\s\S]*}/);
    if (!m) return [];
    try { parsed = JSON.parse(m[0]); } catch { return []; }
  }
  let list = parsed?.variants || parsed?.captions || Object.values(parsed || {}).find(Array.isArray) || [];
  if (!Array.isArray(list)) return [];

  const used = new Set();
  return list
    .filter((v) => v && (v.caption_text || v.text))
    .slice(0, VARIANT_COUNT)
    .map((v, i) => {
      const split = splitTrailingHashtags(
        cleanCaption(v.caption_text || v.text || ""),
        Array.isArray(v.hashtags) ? v.hashtags.map(String) : [],
      );
      const text = split.text;
      let style = STYLE_IDS.includes(v.style) && !used.has(v.style) ? v.style : STYLE_IDS.find((s) => !used.has(s)) || STYLE_IDS[i % STYLE_IDS.length];
      used.add(style);
      return {
        style,
        hook: stripWrappingQuotes(v.hook) || firstLine(text),
        caption_text: text,
        hashtags: split.hashtags.slice(0, 10),
      };
    });
}

// Oturumu istemciye uygun hale getirir. Kilitli varyantların tam metni GÖNDERİLMEZ.
function toPublicSession(row) {
  const variants = row.variants || [];
  return {
    session_id: row.id,
    platform: row.platform,
    unlocked_count: row.unlocked_count,
    variants: variants.map((v, index) => {
      if (index < row.unlocked_count) {
        return { index, style: v.style, hook: v.hook, caption_text: v.caption_text, hashtags: v.hashtags, locked: false };
      }
      return { index, style: v.style, hook_preview: previewOf(v.hook), locked: true };
    }),
  };
}

function buildHookLabPrompt(basePrompt, platform) {
  const preset = PLATFORM_PRESETS[platform];
  const styles = HOOK_STYLES.map((s, i) => `${i + 1}. style="${s.id}" → ${s.rule}`).join("\n");
  return `${basePrompt}

🎯 HOOK LAB MODU:
Aynı görsel için TAM OLARAK ${VARIANT_COUNT} farklı caption yaz. Her biri aşağıdaki kanca stillerinden BİRİNİ kullanmalı ve hepsi birbirinden belirgin şekilde farklı olmalı:
${styles}

PLATFORM KURALI (hashtag sayısı ve uzunluk konusunda yukarıdaki genel kuralları ezer): ${preset.rule}

"hook" alanı, caption_text'in İLK SATIRI ile birebir aynı olmalı.

Sadece JSON formatında yanıt ver:
{
  "variants": [
    { "style": "question", "hook": "ilk satır", "caption_text": "tam metin (\\n ile satır arası boşluk)", "hashtags": ["#tag1", "#tag2"] }
  ]
}`;
}

function registerHookLabRoutes(app, { pool, authenticateToken, buildSystemPrompt }) {
  // ── 1. ÜRETİM ────────────────────────────────────────────────────────────
  app.post("/api/hook-lab/generate", authenticateToken, async (req, res) => {
    const { images, tone, gender, ageRange, language, useEmojis, useHashtags } = req.body || {};
    const platform = PLATFORM_IDS.includes(req.body?.platform) ? req.body.platform : "instagram";

    if (!Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: "En az bir görsel gereklidir." });
    }
    if (images.length > MAX_IMAGES || !images.every((img) => typeof img === "string" && img.startsWith("data:image/"))) {
      return res.status(400).json({ error: "Geçersiz görsel verisi." });
    }

    try {
      const userResult = await pool.query("SELECT id, credits, is_premium FROM profiles WHERE id = $1", [req.userId]);
      const userRow = userResult.rows[0];
      if (!userRow) return res.status(404).json({ error: "Kullanıcı bulunamadı." });
      if (!userRow.is_premium && userRow.credits < 1) {
        return res.status(403).json({ error: "Yetersiz kredi. Lütfen kredi yükleyin.", code: "OUT_OF_CREDITS" });
      }

      const langName = LANG_MAP[language] || language || "Türkçe";
      const basePrompt = buildSystemPrompt({
        gender,
        tone,
        length: PLATFORM_PRESETS[platform].length,
        useEmojis: useEmojis !== false,
        useHashtags: useHashtags !== false,
        ageRange,
        customPrompt: "",
        isPremium: userRow.is_premium,
        carouselMode: false,
        isPerImage: false,
        imageCount: images.length,
        langName,
      });
      const prompt = buildHookLabPrompt(basePrompt, platform);

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      let variants = [];
      for (let attempt = 1; attempt <= 2 && variants.length < VARIANT_COUNT; attempt++) {
        const completion = await openai.chat.completions.create({
          model: process.env.HOOK_LAB_MODEL || "gpt-4o",
          messages: [{
            role: "user",
            content: [
              { type: "text", text: attempt === 1 ? prompt : `${prompt}\n\nÖNEMLİ: TAM OLARAK ${VARIANT_COUNT} varyant döndür, boş yanıt verme.` },
              ...images.map((img) => ({ type: "image_url", image_url: { url: img } })),
            ],
          }],
          response_format: { type: "json_object" },
          max_tokens: 3000,
          temperature: 0.85,
          presence_penalty: 0.5,
          frequency_penalty: 0.3,
        });
        const parsed = parseVariants(completion.choices[0]?.message?.content || "");
        if (parsed.length > variants.length) variants = parsed;
        console.log(`[HookLab] Deneme ${attempt}: ${parsed.length} varyant`);
      }

      if (variants.length < 2) throw new Error("Hook Lab varyantları üretilemedi");

      // Ücretsiz kullanıcıya hep aynı stiller açık kalmasın diye sıralama karıştırılır.
      variants = shuffle(variants);
      const unlockedCount = userRow.is_premium ? variants.length : Math.min(FREE_UNLOCKED, variants.length);
      const sessionId = crypto.randomUUID();

      const client = await pool.connect();
      let remainingCredits = userRow.credits;
      try {
        await client.query("BEGIN");

        if (!userRow.is_premium) {
          // Atomik düşüm: eşzamanlı isteklerde kredi eksiye düşemez.
          const dec = await client.query(
            "UPDATE profiles SET credits = credits - 1 WHERE id = $1 AND credits >= 1 RETURNING credits",
            [req.userId],
          );
          if (dec.rowCount === 0) {
            await client.query("ROLLBACK");
            return res.status(403).json({ error: "Yetersiz kredi. Lütfen kredi yükleyin.", code: "OUT_OF_CREDITS" });
          }
          remainingCredits = dec.rows[0].credits;
        }

        await client.query(
          `INSERT INTO hook_lab_sessions (id, user_id, platform, tone, language, variants, unlocked_count)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [sessionId, req.userId, platform, tone || null, language || null, JSON.stringify(variants), unlockedCount],
        );

        // Açık varyantlar Geçmiş ekranında da görünsün (mevcut tabloya, mevcut formatta).
        for (const v of variants.slice(0, unlockedCount)) {
          await client.query(
            `INSERT INTO generated_captions (id, user_id, caption_text, hashtags, image_url, post_id, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
            [crypto.randomUUID(), req.userId, v.caption_text, v.hashtags, "base64", sessionId],
          );
        }

        await client.query("COMMIT");
      } catch (txErr) {
        await client.query("ROLLBACK").catch(() => {});
        throw txErr;
      } finally {
        client.release();
      }

      const session = toPublicSession({ id: sessionId, platform, variants, unlocked_count: unlockedCount });
      return res.status(201).json({ success: true, ...session, is_premium: userRow.is_premium, remainingCredits });
    } catch (err) {
      console.error("[HookLab] Hata:", err.message);
      if (!res.headersSent) res.status(500).json({ success: false, error: "Şu anda açıklama oluşturulamadı. Lütfen tekrar dene." });
    }
  });

  // ── 2. OTURUMU GETİR (Premium'a geçildiyse kilitleri aç) ────────────────
  app.get("/api/hook-lab/:id", authenticateToken, async (req, res) => {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: "Geçersiz oturum." });
    try {
      const [sessionResult, userResult] = await Promise.all([
        pool.query("SELECT id, platform, variants, unlocked_count FROM hook_lab_sessions WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]),
        pool.query("SELECT is_premium FROM profiles WHERE id = $1", [req.userId]),
      ]);
      const row = sessionResult.rows[0];
      if (!row) return res.status(404).json({ error: "Oturum bulunamadı." });
      const isPremium = !!userResult.rows[0]?.is_premium;

      if (isPremium && row.unlocked_count < row.variants.length) {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          for (const v of row.variants.slice(row.unlocked_count)) {
            await client.query(
              `INSERT INTO generated_captions (id, user_id, caption_text, hashtags, image_url, post_id, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
              [crypto.randomUUID(), req.userId, v.caption_text, v.hashtags, "base64", row.id],
            );
          }
          await client.query("UPDATE hook_lab_sessions SET unlocked_count = $1 WHERE id = $2", [row.variants.length, row.id]);
          await client.query("COMMIT");
          row.unlocked_count = row.variants.length;
        } catch (txErr) {
          await client.query("ROLLBACK").catch(() => {});
          throw txErr;
        } finally {
          client.release();
        }
      }

      res.json({ success: true, ...toPublicSession(row), is_premium: isPremium });
    } catch (err) {
      console.error("[HookLab] Oturum getirme hatası:", err.message);
      res.status(500).json({ error: "Sunucu hatası." });
    }
  });

  // ── 3. GERİ BİLDİRİM (swipe / kopyalama) ─────────────────────────────────
  app.post("/api/hook-lab/:id/feedback", authenticateToken, async (req, res) => {
    if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: "Geçersiz oturum." });
    const { index, action, editedText } = req.body || {};
    const idx = Number(index);
    if (!FEEDBACK_ACTIONS.has(action) || !Number.isInteger(idx) || idx < 0 || idx >= VARIANT_COUNT) {
      return res.status(400).json({ error: "Geçersiz geri bildirim." });
    }
    try {
      const sessionResult = await pool.query(
        "SELECT platform, variants FROM hook_lab_sessions WHERE id = $1 AND user_id = $2",
        [req.params.id, req.userId],
      );
      const row = sessionResult.rows[0];
      if (!row) return res.status(404).json({ error: "Oturum bulunamadı." });

      await pool.query(
        `INSERT INTO caption_feedback (user_id, session_id, variant_index, hook_style, platform, action, edited_text)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [req.userId, req.params.id, idx, row.variants[idx]?.style || null, row.platform, action,
          action === "edit_copy" && typeof editedText === "string" ? editedText.slice(0, 5000) : null],
      );
      res.status(201).json({ success: true });
    } catch (err) {
      console.error("[HookLab] Geri bildirim hatası:", err.message);
      res.status(500).json({ error: "Sunucu hatası." });
    }
  });
}

module.exports = { registerHookLabRoutes, PLATFORM_IDS, STYLE_IDS, _test: { parseVariants, toPublicSession, previewOf, stripWrappingQuotes } };
