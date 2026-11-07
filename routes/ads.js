// ─── ÖDÜLLÜ REKLAM (AdMob Rewarded + Sunucu Tarafı Doğrulama) ──────────────
// Kredi YALNIZCA Google'ın imzaladığı SSV bildirimiyle verilir; uygulamadan gelen
// "reklamı izledim" isteğine asla güvenilmez.
//
//   GET  /api/ads/ssv         → AdMob'un çağırdığı uç nokta (kimlik doğrulama yok, ECDSA imza var)
//   GET  /api/ads/status      → uygulama: özellik açık mı, bugün kaç hak kaldı
//   POST /api/ads/dev-reward  → YALNIZCA yerel geliştirme (ADS_DEV_REWARD=true ve production değil)
//
// Ortam değişkenleri:
//   ADS_REWARDED_ENABLED=true          → özelliği aç (varsayılan kapalı)
//   ADS_DAILY_LIMIT=3                  → kullanıcı başına günlük ödüllü reklam sayısı
//   ADS_REWARD_CREDITS=1               → reklam başına verilecek kredi
//   ADMOB_REWARDED_AD_UNIT_IDS=a,b     → (önerilir) yalnızca bu reklam birimlerinden gelen bildirimleri kabul et
//   ADS_DEV_REWARD=true                → yerelde test reklamlarıyla kredi vermeyi aç

const crypto = require("crypto");

const KEYS_URL = "https://www.gstatic.com/admob/reward/verifier-keys.json";
const KEYS_TTL_MS = 12 * 60 * 60 * 1000; // Google: 24 saatten uzun önbelleğe alma
const DAY_START_SQL = "(date_trunc('day', now() AT TIME ZONE 'Europe/Istanbul') AT TIME ZONE 'Europe/Istanbul')";

const config = () => ({
  enabled: process.env.ADS_REWARDED_ENABLED === "true",
  dailyLimit: Math.max(0, parseInt(process.env.ADS_DAILY_LIMIT || "3", 10) || 0),
  rewardCredits: Math.max(1, parseInt(process.env.ADS_REWARD_CREDITS || "1", 10) || 1),
  allowedAdUnits: (process.env.ADMOB_REWARDED_AD_UNIT_IDS || "").split(",").map((s) => s.trim()).filter(Boolean),
  devReward: process.env.ADS_DEV_REWARD === "true" && process.env.NODE_ENV !== "production",
});

// ── Google doğrulama anahtarları (önbellekli) ───────────────────────────────
let keyCache = { at: 0, keys: new Map() };
async function fetchKeys(fetchImpl) {
  const res = await fetchImpl(KEYS_URL);
  if (!res.ok) throw new Error(`verifier-keys HTTP ${res.status}`);
  const body = await res.json();
  const keys = new Map((body.keys || []).map((k) => [String(k.keyId), k.pem]));
  keyCache = { at: Date.now(), keys };
  return keys;
}
async function getKey(keyId, fetchImpl) {
  const fresh = Date.now() - keyCache.at < KEYS_TTL_MS;
  if (fresh && keyCache.keys.has(keyId)) return keyCache.keys.get(keyId);
  // Anahtar bilinmiyorsa (rotasyon) ya da önbellek eskiyse bir kez yeniden çek
  const keys = await fetchKeys(fetchImpl);
  return keys.get(keyId) || null;
}

// İmzalanan içerik: sorgu dizesinin "&signature=" öncesi, DEĞİŞTİRİLMEDEN.
// signature: web-safe base64 (DER kodlu ECDSA/SHA-256), key_id: hangi anahtar.
async function verifySsv(rawQuery, fetchImpl = fetch) {
  const idx = rawQuery.indexOf("&signature=");
  if (idx < 0) return { ok: false, reason: "imza yok" };
  const signedContent = rawQuery.slice(0, idx);
  const params = new URLSearchParams(rawQuery);
  const signature = params.get("signature");
  const keyId = params.get("key_id");
  if (!signature || !keyId) return { ok: false, reason: "imza/key_id eksik" };

  const pem = await getKey(keyId, fetchImpl);
  if (!pem) return { ok: false, reason: `bilinmeyen key_id ${keyId}` };

  let valid = false;
  try {
    valid = crypto.verify("sha256", Buffer.from(signedContent, "utf8"), pem, Buffer.from(signature, "base64url"));
  } catch (err) {
    return { ok: false, reason: `doğrulama hatası: ${err.message}` };
  }
  return valid ? { ok: true, params } : { ok: false, reason: "imza geçersiz" };
}

function registerAdsRoutes(app, { pool, authenticateToken, fetchImpl = fetch }) {
  // Günlük sayaç: İstanbul saatine göre bugün verilen ödüller
  const usedToday = async (db, userId) => {
    const r = await db.query(
      `SELECT count(*)::int AS n FROM ad_rewards WHERE user_id = $1 AND granted = true AND created_at >= ${DAY_START_SQL}`,
      [userId],
    );
    return r.rows[0]?.n || 0;
  };

  // Ödülü tek bir işlemde ver: kullanıcı satırını kilitle → limit kontrol → kayıt → kredi
  async function grantReward({ transactionId, userId, adUnit }) {
    const { dailyLimit, rewardCredits } = config();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const user = await client.query("SELECT id FROM profiles WHERE id = $1 FOR UPDATE", [userId]);
      if (!user.rows[0]) {
        await client.query("ROLLBACK");
        return { status: "unknown_user" };
      }
      const used = await usedToday(client, userId);
      const granted = used < dailyLimit;
      const ins = await client.query(
        `INSERT INTO ad_rewards (transaction_id, user_id, ad_unit, reward_credits, granted, reason)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (transaction_id) DO NOTHING
         RETURNING id`,
        [transactionId, userId, adUnit || null, granted ? rewardCredits : 0, granted, granted ? "ok" : "daily_limit"],
      );
      if (ins.rowCount === 0) {
        await client.query("ROLLBACK");
        return { status: "duplicate" }; // Google'ın tekrar denemesi: zaten işlendi
      }
      let credits = null;
      if (granted) {
        const upd = await client.query("UPDATE profiles SET credits = credits + $1 WHERE id = $2 RETURNING credits", [rewardCredits, userId]);
        credits = upd.rows[0]?.credits ?? null;
      }
      await client.query("COMMIT");
      return { status: granted ? "granted" : "daily_limit", credits };
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  // ── 1. AdMob SSV bildirimi ────────────────────────────────────────────────
  app.get("/api/ads/ssv", async (req, res) => {
    const rawQuery = (req.originalUrl.split("?")[1] || "");
    // AdMob konsolundaki "Doğrula" butonu parametresiz istek atabilir
    if (!rawQuery) return res.status(200).send("ok");
    try {
      const v = await verifySsv(rawQuery, fetchImpl);
      if (!v.ok) {
        console.warn("[Ads/SSV] Reddedildi:", v.reason);
        return res.status(403).send("invalid signature");
      }
      const p = v.params;
      const transactionId = p.get("transaction_id");
      const userId = p.get("user_id");
      const adUnit = p.get("ad_unit");
      const { allowedAdUnits } = config();

      if (allowedAdUnits.length && !allowedAdUnits.includes(adUnit)) {
        console.warn("[Ads/SSV] İzin verilmeyen reklam birimi:", adUnit);
        return res.status(200).send("ignored");
      }
      if (!transactionId || !userId) {
        // İmzalı ama kullanıcısız bildirim (ör. konsol testi): kabul et, kredi verme
        console.log("[Ads/SSV] Kullanıcısız geçerli bildirim (test olabilir), transaction:", transactionId);
        return res.status(200).send("ok");
      }

      const result = await grantReward({ transactionId, userId, adUnit });
      console.log(`[Ads/SSV] ${result.status} user=${userId} tx=${transactionId}${result.credits != null ? ` credits=${result.credits}` : ""}`);
      // Google'a her durumda 200: aksi halde aynı bildirimi 5 kez tekrar gönderir
      return res.status(200).send("ok");
    } catch (err) {
      console.error("[Ads/SSV] Hata:", err.message);
      // 500 → Google tekrar dener; transaction_id UNIQUE olduğu için çift kredi riski yok
      return res.status(500).send("error");
    }
  });

  // ── 2. Uygulama için durum ────────────────────────────────────────────────
  app.get("/api/ads/status", authenticateToken, async (req, res) => {
    const { enabled, dailyLimit, rewardCredits, devReward } = config();
    if (!enabled) return res.json({ enabled: false, dailyLimit: 0, usedToday: 0, remainingToday: 0, rewardCredits, devReward: false });
    try {
      const used = await usedToday(pool, req.userId);
      res.json({ enabled: true, dailyLimit, usedToday: used, remainingToday: Math.max(0, dailyLimit - used), rewardCredits, devReward });
    } catch (err) {
      console.error("[Ads/Status] Hata:", err.message);
      res.status(500).json({ error: "Sunucu hatası." });
    }
  });

  // ── 3. Yalnızca yerel geliştirme: test reklamları SSV göndermez ─────────────
  app.post("/api/ads/dev-reward", authenticateToken, async (req, res) => {
    if (!config().devReward) return res.status(404).json({ error: "Bulunamadı." });
    try {
      const result = await grantReward({ transactionId: `dev-${crypto.randomUUID()}`, userId: req.userId, adUnit: "dev" });
      console.log(`[Ads/Dev] ${result.status} user=${req.userId}`);
      res.json({ success: result.status === "granted", ...result });
    } catch (err) {
      console.error("[Ads/Dev] Hata:", err.message);
      res.status(500).json({ error: "Sunucu hatası." });
    }
  });
}

module.exports = { registerAdsRoutes, _test: { verifySsv, resetKeyCache: () => { keyCache = { at: 0, keys: new Map() }; } } };
