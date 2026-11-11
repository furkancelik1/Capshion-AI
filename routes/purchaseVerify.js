// ─── Satın alma doğrulaması (RevenueCat) ────────────────────────────────────
// İstemcinin "satın aldım" iddiasına güvenilmez. Premium ve krediler yalnızca:
//   1) RevenueCat REST API'sinden doğrulanan bilgiyle (/api/purchases/sync), ya da
//   2) imzalı RevenueCat webhook'u ile
// verilir. Her kredi satın alması mağaza işlem numarasıyla (credit_grants) en fazla BİR kez işlenir.
//
// Ortam değişkenleri:
//   REVENUECAT_SECRET_API_KEY  → RevenueCat → Project settings → API keys → Secret key (sk_...)
//   REVENUECAT_WEBHOOK_SECRET  → webhook Authorization başlığı (zorunlu)

const RC_API = "https://api.revenuecat.com/v1/subscribers/";

function creditsForProduct(productId) {
  const id = String(productId || "").toLowerCase();
  if (id.includes("sub") || id.includes("monthly") || id.includes("yearly") || id.includes("annual")) return 0;
  const m = id.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

async function fetchSubscriber(appUserId, fetchImpl = fetch) {
  const key = process.env.REVENUECAT_SECRET_API_KEY;
  if (!key) return null;
  const res = await fetchImpl(RC_API + encodeURIComponent(String(appUserId)), {
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`RevenueCat API HTTP ${res.status}`);
  return (await res.json()).subscriber || null;
}

function hasActiveEntitlement(subscriber, now = Date.now()) {
  const active = (e) => !e.expires_date || new Date(e.expires_date).getTime() > now;
  const ents = subscriber?.entitlements || {};
  if (Object.values(ents).some(active)) return true;
  // Ürün RevenueCat'te bir entitlement'a bağlı değilse de süresi dolmamış,
  // iade edilmemiş aboneliği Premium say (webhook ile aynı davranış).
  const subs = subscriber?.subscriptions || {};
  return Object.values(subs).some((s) => !s.refunded_at && s.expires_date && active(s));
}

/**
 * Bir kredi satın almasını işlem numarasıyla bir kez işler.
 * Dönen değer: { granted: boolean, credits?: number, reason }
 */
async function grantCreditsOnce(pool, { transactionId, userId, productId, source }) {
  const credits = creditsForProduct(productId);
  if (!transactionId || credits <= 0) return { granted: false, reason: "no_tx_or_credits" };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ins = await client.query(
      `INSERT INTO credit_grants (transaction_id, user_id, product_id, credits, source)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (transaction_id) DO NOTHING RETURNING transaction_id`,
      [String(transactionId), userId, String(productId), credits, source],
    );
    if (!ins.rowCount) {
      await client.query("ROLLBACK");
      return { granted: false, reason: "duplicate" };
    }
    const upd = await client.query("UPDATE profiles SET credits = credits + $1 WHERE id = $2 RETURNING credits", [credits, userId]);
    if (!upd.rowCount) {
      await client.query("ROLLBACK");
      return { granted: false, reason: "unknown_user" };
    }
    await client.query("COMMIT");
    return { granted: true, credits: upd.rows[0].credits, added: credits };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * /api/purchases/sync: kullanıcının RevenueCat kaydını sunucudan okuyup
 * Premium'u ve henüz işlenmemiş kredi alımlarını uygular.
 */
async function syncFromRevenueCat(pool, userId, { fetchImpl } = {}) {
  const subscriber = await fetchSubscriber(userId, fetchImpl);
  if (!subscriber) return { verified: false, reason: "no_secret_key" };

  const result = { verified: true, premium: false, creditsAdded: 0 };
  if (hasActiveEntitlement(subscriber)) {
    await pool.query("UPDATE profiles SET is_premium = true WHERE id = $1", [userId]);
    result.premium = true;
  }
  for (const [productId, purchases] of Object.entries(subscriber.non_subscriptions || {})) {
    for (const p of purchases || []) {
      const tx = p.store_transaction_id || p.id;
      try {
        const g = await grantCreditsOnce(pool, { transactionId: tx, userId, productId, source: "sync" });
        if (g.granted) result.creditsAdded += g.added;
      } catch (err) {
        if (err.code === "42P01") return { ...result, reason: "credit_grants_missing" }; // migration yok → kredi verme
        throw err;
      }
    }
  }
  return result;
}

module.exports = { creditsForProduct, fetchSubscriber, hasActiveEntitlement, grantCreditsOnce, syncFromRevenueCat };
