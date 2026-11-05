// Kullanım: node scripts/run-migration.js migrations/2026-11-05_hook_lab.sql
// .env içindeki DATABASE_URL'e bağlanır ve verilen SQL dosyasını çalıştırır.
require("dotenv").config();
const fs = require("fs");
const { Pool } = require("pg");

const file = process.argv[2];
if (!file) {
  console.error("Kullanım: node scripts/run-migration.js <sql-dosyası>");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL tanımlı değil (.env dosyasını kontrol et).");
  process.exit(1);
}

const host = (process.env.DATABASE_URL.match(/@([^:/]+)/) || [])[1] || "?";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.on("connect", (c) => c.on("notice", (n) => console.log("[Migration] Not:", n.message)));

(async () => {
  console.log(`[Migration] ${file} → ${host}`);
  try {
    await pool.query(fs.readFileSync(file, "utf8"));
    console.log("[Migration] Başarılı ✅");
  } catch (err) {
    console.error("[Migration] HATA:", err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
