// YALNIZCA YEREL GELİŞTİRME: bir test hesabının kredisini ayarlar.
// Kullanım: node scripts/dev-set-credits.js <email> [kredi=0]
// Güvenlik: DATABASE_URL localhost değilse çalışmaz (canlı veritabanına dokunmaz).
require("dotenv").config({ quiet: true });
const { Pool } = require("pg");

const [email, creditsArg = "0"] = process.argv.slice(2);
const credits = parseInt(creditsArg, 10);
if (!email || Number.isNaN(credits) || credits < 0) {
  console.error("Kullanım: node scripts/dev-set-credits.js <email> [kredi=0]");
  process.exit(1);
}
const host = (process.env.DATABASE_URL || "").match(/@([^:/?]+)/)?.[1];
if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
  console.error(`Reddedildi: DATABASE_URL yerel değil (${host || "tanımsız"}). Bu script yalnızca yerel veritabanında çalışır.`);
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  try {
    const r = await pool.query(
      "UPDATE profiles SET credits = $1, is_premium = false WHERE lower(email) = lower($2) RETURNING email, credits, is_premium",
      [credits, email],
    );
    if (!r.rowCount) console.error(`Bulunamadı: ${email} (önce uygulamadan bu e-postayla kayıt ol)`);
    else console.log("Güncellendi:", r.rows[0]);
    // Bugünkü reklam hakkını da sıfırla (tablo varsa)
    await pool.query("DELETE FROM ad_rewards WHERE user_id IN (SELECT id FROM profiles WHERE lower(email) = lower($1))", [email]).catch(() => {});
  } finally {
    await pool.end();
  }
})();
