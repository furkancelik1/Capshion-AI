// ─── GÜNLÜK RİTİM: günün fikri + seri + sabah/akşam bildirimi ───────────────
// Mevcut üretim uç noktalarına DOKUNMAZ: seri, generated_captions'taki günlük
// üretimlerden (İstanbul saatine göre) hesaplanır.
//
//   GET  /api/daily/today         → günün fikri (kullanıcının nişi), seri, tercihler
//   PUT  /api/daily/preferences   → niş / saat / açık-kapalı
//   POST /api/daily/run           → zamanlayıcıyı elle tetikle (x-cron-secret başlığı gerekir)
//
// Ortam değişkenleri:
//   DAILY_PUSH_ENABLED=true   → sabah fikir + akşam seri bildirimlerini gönder (varsayılan kapalı)
//   DAILY_STREAK_HOUR=20      → akşam "serin bozulmasın" bildirim saati
//   DAILY_CRON_SECRET=...     → /api/daily/run için gizli anahtar
//   DAILY_IDEA_MODEL=gpt-4o   → fikir üretim modeli

const OpenAI = require("openai");

const TZ = "Europe/Istanbul";
const NICHES = {
  genel: "Genel / günlük yaşam",
  moda: "Moda & stil",
  yemek: "Yemek & kafe",
  seyahat: "Seyahat & şehir",
  fitness: "Spor & fitness",
  guzellik: "Güzellik & bakım",
  is: "İş & kariyer",
  sanat: "Sanat & fotoğraf",
  ev: "Ev & dekorasyon",
  evcil: "Evcil hayvan",
};
const NICHE_IDS = Object.keys(NICHES);
const LANGS = new Set(["tr", "en"]);

// ── Tarih yardımcıları (İstanbul) ─────────────────────────────────────────
function istanbulNow(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23", weekday: "short" })
      .formatToParts(date).map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: parseInt(parts.hour, 10), year: +parts.year, month: +parts.month, day: +parts.day };
}
function addDays(isoDate, n) {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
// Ayın N. haftasının belirli günü (0=Pazar). nth=-1 → son
function nthWeekday(year, month, weekday, nth) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return 1 + offset + (nth - 1) * 7;
}

// Türkiye'de sosyal medyada öne çıkan günler (dini bayramlar her yıl kaydığı için dahil değil)
function specialDaysAround(today) {
  const { year } = istanbulNow(new Date(`${today}T12:00:00Z`));
  const fixed = {
    "01-01": "Yılbaşı", "02-14": "Sevgililer Günü", "03-08": "Dünya Kadınlar Günü",
    "03-14": "Tıp Bayramı", "04-23": "23 Nisan Ulusal Egemenlik ve Çocuk Bayramı", "05-01": "Emek ve Dayanışma Günü",
    "05-19": "19 Mayıs Atatürk'ü Anma, Gençlik ve Spor Bayramı", "08-30": "30 Ağustos Zafer Bayramı",
    "10-29": "29 Ekim Cumhuriyet Bayramı", "11-10": "10 Kasım Atatürk'ü Anma Günü (SAYGILI TON, eğlence/satış önerme)",
    "11-24": "Öğretmenler Günü", "12-31": "Yılbaşı gecesi",
  };
  const pad = (n) => String(n).padStart(2, "0");
  fixed[`05-${pad(nthWeekday(year, 5, 0, 2))}`] = "Anneler Günü";
  fixed[`06-${pad(nthWeekday(year, 6, 0, 3))}`] = "Babalar Günü";
  fixed[`11-${pad(nthWeekday(year, 11, 5, 4))}`] = "Black Friday / Efsane Cuma";
  const out = [];
  for (let i = 0; i <= 3; i++) {
    const d = addDays(today, i);
    const name = fixed[d.slice(5)];
    // Anma günleri yalnızca o gün önerilir; önceden "hazırlık" içeriği uygun değil
    if (name && (i === 0 || !/Anma Günü/.test(name))) out.push(i === 0 ? `BUGÜN: ${name}` : `${i} gün sonra: ${name}`);
  }
  return out;
}

function seasonOf(month) {
  return month <= 2 || month === 12 ? "kış" : month <= 5 ? "ilkbahar" : month <= 8 ? "yaz" : "sonbahar";
}

// ── Seri hesabı ───────────────────────────────────────────────────────────
// Aktif gün = en az bir caption üretilen gün (İstanbul). Seri bugünden ya da dünden geriye sayılır.
function computeStreak(activeDays, today) {
  const set = new Set(activeDays);
  const activeToday = set.has(today);
  let current = 0;
  let cursor = activeToday ? today : addDays(today, -1);
  while (set.has(cursor)) { current++; cursor = addDays(cursor, -1); }
  let longest = 0;
  let run = 0;
  let prev = null;
  for (const d of [...set].sort()) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  return { current, longest, activeToday };
}

async function activeDaysFor(db, userId) {
  const r = await db.query(
    `SELECT DISTINCT to_char((created_at AT TIME ZONE '${TZ}')::date, 'YYYY-MM-DD') AS day
       FROM generated_captions
      WHERE user_id = $1 AND created_at > now() - interval '400 days'`,
    [userId],
  );
  return r.rows.map((x) => x.day);
}

// ── Günün fikri (niş + gün + dil başına bir kez üretilir) ─────────────────
function buildIdeaPrompt({ niche, today, language }) {
  const { month } = istanbulNow(new Date(`${today}T12:00:00Z`));
  const weekday = new Intl.DateTimeFormat("tr-TR", { timeZone: TZ, weekday: "long" }).format(new Date(`${today}T12:00:00Z`));
  const special = specialDaysAround(today);
  let cliches = [];
  try { cliches = require("../prompts/captionPromptV3").TR_CLICHES || []; } catch { /* yoksa listesiz devam */ }
  const langLine = language === "en"
    ? "Write all fields in natural, everyday English."
    : `Tüm alanları doğal, günlük konuşma Türkçesiyle yaz. Şu klişeleri kullanma: ${cliches.slice(0, 30).map((c) => `"${c}"`).join(", ")}.`;

  const langHead = language === "en"
    ? "IMPORTANT: The user's app is in ENGLISH. Write every JSON field in English only, even though these instructions are in Turkish.\n\n"
    : "";
  return `${langHead}Sosyal medyada içerik üreten birine BUGÜN telefonuyla çekip paylaşabileceği TEK bir içerik fikri öner.

BAĞLAM:
- Niş: ${NICHES[niche] || NICHES.genel}
- Tarih: ${today} (${weekday}), mevsim: ${seasonOf(month)}
${special.length ? `- Yakındaki özel günler: ${special.join("; ")}` : "- Yakında özel bir gün yok; mevsime ve haftanın gününe uygun bir fikir ver."}

KURALLAR:
- Fikir somut ve bugün yapılabilir olsun (ne çekilecek, hangi açıdan, hangi detay öne çıkacak). "Kendini ifade et" gibi soyut fikir yok.
- Pahalı ekipman, seyahat ya da başka birinin yardımı gerektirmesin.
- Özel gün varsa ve nişe uyuyorsa ona bağla; uymuyorsa zorlama. Anma günlerinde saygılı ol, eğlence/satış önerme.
- ${langLine}

Sadece şu JSON'u döndür:
{
  "title": "en fazla 40 karakterlik başlık, en fazla 1 emoji",
  "idea": "1-2 cümle: ne çekip paylaşacağı",
  "tip": "1 cümle: çekimle ilgili pratik bir ipucu (ışık, açı, kompozisyon)",
  "hook": "bu paylaşım için örnek bir caption ilk satırı, en fazla 90 karakter"
}${language === "en" ? "\n\nReminder: all four fields in ENGLISH." : ""}`;
}

// İngilizce istenip Türkçe gelen fikri yakala (ğ, ş, ı gibi harfler İngilizcede geçmez)
function languageMismatch(idea, language) {
  if (language !== "en" || !idea) return false;
  return /[ğĞşŞıİ]/.test(`${idea.title} ${idea.idea} ${idea.tip} ${idea.hook}`);
}

function normalizeIdea(raw) {
  let p;
  try { p = JSON.parse(raw); } catch { const m = String(raw || "").match(/{[\s\S]*}/); p = m ? JSON.parse(m[0]) : null; }
  if (!p || !p.idea) return null;
  const s = (v, n) => String(v || "").trim().slice(0, n);
  return { title: s(p.title, 60) || "Bugünün fikri", idea: s(p.idea, 300), tip: s(p.tip, 200), hook: s(p.hook, 120) };
}

const inflight = new Map(); // aynı anda gelen isteklerde tek OpenAI çağrısı

function createIdeaService({ pool, openaiFactory }) {
  return async function getOrCreateIdea(niche, today, language = "tr") {
    const key = `${niche}|${today}|${language}`;
    const existing = await pool.query("SELECT idea FROM daily_ideas WHERE niche = $1 AND idea_date = $2 AND language = $3", [niche, today, language]);
    if (existing.rows[0] && !languageMismatch(existing.rows[0].idea, language)) return existing.rows[0].idea;
    if (existing.rows[0]) {
      await pool.query("DELETE FROM daily_ideas WHERE niche = $1 AND idea_date = $2 AND language = $3", [niche, today, language]);
    }
    if (inflight.has(key)) return inflight.get(key);

    const job = (async () => {
      const openai = openaiFactory();
      let idea = null;
      for (let attempt = 1; attempt <= 2 && (!idea || languageMismatch(idea, language)); attempt++) {
        const completion = await openai.chat.completions.create({
          model: process.env.DAILY_IDEA_MODEL || "gpt-4o",
          messages: [{ role: "user", content: buildIdeaPrompt({ niche, today, language }) }],
          response_format: { type: "json_object" },
          max_tokens: 500,
          temperature: attempt === 1 ? 0.9 : 0.6,
        });
        idea = normalizeIdea(completion.choices[0]?.message?.content);
      }
      if (!idea) throw new Error("Günün fikri üretilemedi");
      await pool.query(
        `INSERT INTO daily_ideas (niche, idea_date, language, idea) VALUES ($1, $2, $3, $4)
         ON CONFLICT (niche, idea_date, language) DO NOTHING`,
        [niche, today, language, JSON.stringify(idea)],
      );
      const saved = await pool.query("SELECT idea FROM daily_ideas WHERE niche = $1 AND idea_date = $2 AND language = $3", [niche, today, language]);
      return saved.rows[0]?.idea || idea;
    })().finally(() => inflight.delete(key));

    inflight.set(key, job);
    return job;
  };
}

// ── Zamanlayıcı ───────────────────────────────────────────────────────────
function createScheduler({ pool, sendPushNotification, getOrCreateIdea, now = () => new Date() }) {
  const streakHour = parseInt(process.env.DAILY_STREAK_HOUR || "20", 10);

  async function morning(today, hour) {
    const due = await pool.query(
      `SELECT p.user_id, p.niche, p.language
         FROM user_preferences p JOIN profiles pr ON pr.id = p.user_id
        WHERE p.daily_enabled AND p.notify_hour = $1 AND pr.push_token IS NOT NULL
          AND (p.last_idea_push_date IS NULL OR p.last_idea_push_date < $2::date)
        LIMIT 1000`,
      [hour, today],
    );
    let sent = 0;
    for (const row of due.rows) {
      // Atomik "sahiplenme": birden fazla örnek/tik aynı kullanıcıya iki kez göndermesin
      const claim = await pool.query(
        `UPDATE user_preferences SET last_idea_push_date = $2::date
          WHERE user_id = $1 AND (last_idea_push_date IS NULL OR last_idea_push_date < $2::date)
          RETURNING user_id`,
        [row.user_id, today],
      );
      if (!claim.rowCount) continue;
      try {
        const idea = await getOrCreateIdea(row.niche, today, row.language);
        await sendPushNotification(row.user_id, `☀️ ${idea.title}`, idea.idea, { type: "daily_idea", screen: "home" });
        sent++;
      } catch (err) {
        console.error("[Daily] Sabah bildirimi hatası:", err.message);
      }
    }
    return sent;
  }

  async function evening(today) {
    const yesterday = addDays(today, -1);
    const candidates = await pool.query(
      `SELECT p.user_id, p.language
         FROM user_preferences p JOIN profiles pr ON pr.id = p.user_id
        WHERE p.daily_enabled AND pr.push_token IS NOT NULL
          AND (p.last_streak_push_date IS NULL OR p.last_streak_push_date < $1::date)
          AND EXISTS (SELECT 1 FROM generated_captions g WHERE g.user_id = p.user_id
                       AND (g.created_at AT TIME ZONE '${TZ}')::date = $2::date)
          AND NOT EXISTS (SELECT 1 FROM generated_captions g WHERE g.user_id = p.user_id
                       AND (g.created_at AT TIME ZONE '${TZ}')::date = $1::date)
        LIMIT 1000`,
      [today, yesterday],
    );
    let sent = 0;
    for (const row of candidates.rows) {
      const streak = computeStreak(await activeDaysFor(pool, row.user_id), today);
      if (streak.current < 2) continue; // 1 günlük "seri" için rahatsız etme
      const claim = await pool.query(
        `UPDATE user_preferences SET last_streak_push_date = $2::date
          WHERE user_id = $1 AND (last_streak_push_date IS NULL OR last_streak_push_date < $2::date)
          RETURNING user_id`,
        [row.user_id, today],
      );
      if (!claim.rowCount) continue;
      const en = row.language === "en";
      await sendPushNotification(
        row.user_id,
        en ? `🔥 Keep your ${streak.current}-day streak` : `🔥 ${streak.current} günlük serin bozulmasın`,
        en ? `One post today makes it ${streak.current + 1}.` : `Bugün bir paylaşım hazırla, serin ${streak.current + 1} olsun.`,
        { type: "streak_reminder", screen: "home" },
      ).then(() => sent++).catch((err) => console.error("[Daily] Akşam bildirimi hatası:", err.message));
    }
    return sent;
  }

  // hourOverride: test için belirli bir saati simüle et (yalnızca /api/daily/run üzerinden)
  async function tick({ hourOverride } = {}) {
    const clock = istanbulNow(now());
    const today = clock.date;
    const hour = Number.isInteger(hourOverride) ? hourOverride : clock.hour;
    const result = { today, hour, morning: 0, evening: 0 };
    result.morning = await morning(today, hour);
    if (hour === streakHour) result.evening = await evening(today);
    if (result.morning || result.evening) console.log("[Daily] Bildirimler:", JSON.stringify(result));
    return result;
  }

  let timer = null;
  return {
    tick,
    start(intervalMs = 5 * 60 * 1000) {
      if (timer) return;
      setTimeout(() => tick().catch((e) => console.error("[Daily] tick hatası:", e.message)), 30 * 1000);
      timer = setInterval(() => tick().catch((e) => console.error("[Daily] tick hatası:", e.message)), intervalMs);
      timer.unref?.();
      console.log("[Daily] Zamanlayıcı başladı (5 dk aralık).");
    },
  };
}

// ── Rotalar ───────────────────────────────────────────────────────────────
function registerDailyRoutes(app, { pool, authenticateToken, sendPushNotification, openaiFactory = () => new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) }) {
  const getOrCreateIdea = createIdeaService({ pool, openaiFactory });
  const scheduler = createScheduler({ pool, sendPushNotification, getOrCreateIdea });

  app.get("/api/daily/today", authenticateToken, async (req, res) => {
    try {
      const { date: today } = istanbulNow();
      const prefRes = await pool.query(
        "SELECT niche, language, notify_hour, daily_enabled FROM user_preferences WHERE user_id = $1",
        [req.userId],
      );
      const pref = prefRes.rows[0];
      const reqLang = LANGS.has(req.query.lang) ? req.query.lang : null;
      const niche = NICHE_IDS.includes(req.query.niche) ? req.query.niche : pref?.niche || "genel";
      const language = reqLang || pref?.language || "tr";

      const [idea, days] = await Promise.all([
        getOrCreateIdea(niche, today, language).catch((err) => {
          console.error("[Daily] Fikir hatası:", err.message);
          return null;
        }),
        activeDaysFor(pool, req.userId),
      ]);

      res.json({
        date: today,
        idea,
        niche,
        streak: computeStreak(days, today),
        preferences: pref
          ? { optedIn: true, niche: pref.niche, notifyHour: pref.notify_hour, enabled: pref.daily_enabled }
          : { optedIn: false, niche: "genel", notifyHour: 10, enabled: false },
        niches: NICHE_IDS,
      });
    } catch (err) {
      console.error("[Daily] today hatası:", err.message);
      res.status(500).json({ error: "Sunucu hatası." });
    }
  });

  app.put("/api/daily/preferences", authenticateToken, async (req, res) => {
    const { niche, notifyHour, enabled, language } = req.body || {};
    const hour = Number(notifyHour);
    if (!NICHE_IDS.includes(niche) || !Number.isInteger(hour) || hour < 0 || hour > 23 || typeof enabled !== "boolean") {
      return res.status(400).json({ error: "Geçersiz tercih." });
    }
    const lang = LANGS.has(language) ? language : "tr";
    try {
      const r = await pool.query(
        `INSERT INTO user_preferences (user_id, niche, language, notify_hour, daily_enabled)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id) DO UPDATE
           SET niche = EXCLUDED.niche, language = EXCLUDED.language, notify_hour = EXCLUDED.notify_hour,
               daily_enabled = EXCLUDED.daily_enabled, updated_at = now()
         RETURNING niche, notify_hour, daily_enabled`,
        [req.userId, niche, lang, hour, enabled],
      );
      const p = r.rows[0];
      res.json({ success: true, preferences: { optedIn: true, niche: p.niche, notifyHour: p.notify_hour, enabled: p.daily_enabled } });
    } catch (err) {
      console.error("[Daily] preferences hatası:", err.message);
      res.status(500).json({ error: "Sunucu hatası." });
    }
  });

  app.post("/api/daily/run", async (req, res) => {
    const secret = process.env.DAILY_CRON_SECRET;
    if (!secret || req.get("x-cron-secret") !== secret) return res.status(404).json({ error: "Bulunamadı." });
    try {
      const hour = req.query.hour !== undefined ? parseInt(req.query.hour, 10) : undefined;
      if (hour !== undefined && (!Number.isInteger(hour) || hour < 0 || hour > 23)) {
        return res.status(400).json({ error: "hour 0-23 olmalı" });
      }
      // Yerel testte aynı gün tekrar denemek için "bugün gönderildi" işaretlerini sıfırla
      if (req.query.reset === "1" && process.env.NODE_ENV !== "production") {
        await pool.query("UPDATE user_preferences SET last_idea_push_date = NULL, last_streak_push_date = NULL");
      }
      res.json(await scheduler.tick({ hourOverride: hour }));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  if (process.env.DAILY_PUSH_ENABLED === "true") scheduler.start();
  return { scheduler, getOrCreateIdea };
}

module.exports = {
  registerDailyRoutes,
  _test: { languageMismatch, istanbulNow, addDays, computeStreak, specialDaysAround, nthWeekday, buildIdeaPrompt, normalizeIdea, createScheduler, createIdeaService, activeDaysFor },
};
