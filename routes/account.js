// ─── HESAP SİLME (App Store 5.1.1(v) + Google Play hesap silme zorunluluğu) ──
//   DELETE /api/auth/account   → oturum açık kullanıcının hesabını ve verilerini kalıcı olarak siler
//   GET    /hesap-silme        → Google Play için web'den silme talebi sayfası (/account-deletion da aynı)
//
// Apple ile giriş yapan kullanıcılar için Apple token'ları da iptal edilir (Apple zorunluluğu).
// Bunun için gerekenler (yoksa iptal atlanır, hesap yine silinir):
//   APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY (Sign in with Apple .p8 anahtarı; \n kaçışlı olabilir)
//   APPLE_BUNDLE_IDS (ilk değer client_id olarak kullanılır; varsayılan com.furkan.capshion)

const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");

// Destek e-postası yalnızca ortam değişkeninden gelir (koda kişisel adres yazılmaz)
const supportEmail = () => (process.env.SUPPORT_EMAIL || "").trim();

function appleConfig() {
  const { APPLE_TEAM_ID, APPLE_KEY_ID } = process.env;
  const key = (process.env.APPLE_PRIVATE_KEY || "").replace(/\\n/g, "\n").trim();
  const clientId = (process.env.APPLE_BUNDLE_IDS || "com.furkan.capshion").split(",")[0].trim();
  if (!APPLE_TEAM_ID || !APPLE_KEY_ID || !key) return null;
  return { teamId: APPLE_TEAM_ID, keyId: APPLE_KEY_ID, key, clientId };
}

function appleClientSecret(cfg) {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    { iss: cfg.teamId, iat: now, exp: now + 300, aud: "https://appleid.apple.com", sub: cfg.clientId },
    cfg.key,
    { algorithm: "ES256", keyid: cfg.keyId },
  );
}

// Yetkilendirme kodunu token'a çevirip Apple'da iptal eder
async function revokeAppleTokens(authorizationCode, fetchImpl = fetch) {
  const cfg = appleConfig();
  if (!cfg) return { revoked: false, reason: "not_configured" };
  const secret = appleClientSecret(cfg);
  const form = (o) => new URLSearchParams(o).toString();
  const tokenRes = await fetchImpl("https://appleid.apple.com/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({ client_id: cfg.clientId, client_secret: secret, code: authorizationCode, grant_type: "authorization_code" }),
  });
  if (!tokenRes.ok) return { revoked: false, reason: `token_exchange_${tokenRes.status}` };
  const tokens = await tokenRes.json();
  const token = tokens.refresh_token || tokens.access_token;
  const hint = tokens.refresh_token ? "refresh_token" : "access_token";
  const revokeRes = await fetchImpl("https://appleid.apple.com/auth/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({ client_id: cfg.clientId, client_secret: secret, token, token_type_hint: hint }),
  });
  return { revoked: revokeRes.ok, reason: revokeRes.ok ? "ok" : `revoke_${revokeRes.status}` };
}

async function deleteRevenueCatCustomer(userId, fetchImpl = fetch) {
  const key = process.env.REVENUECAT_SECRET_API_KEY;
  if (!key) return false;
  const res = await fetchImpl(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(String(userId))}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${key}` },
  });
  return res.ok;
}

const tolerateMissing = (p) => p.catch((err) => { if (err.code !== "42P01" && err.code !== "42703") throw err; return { rows: [], rowCount: 0 }; });

function registerAccountRoutes(app, { pool, authenticateToken, uploadsDir = path.join(process.cwd(), "uploads"), fetchImpl = fetch }) {
  app.delete("/api/auth/account", authenticateToken, async (req, res) => {
    const userId = req.userId;
    const { appleAuthorizationCode } = req.body || {};
    try {
      const exists = await pool.query("SELECT id FROM profiles WHERE id = $1", [userId]);
      if (!exists.rows[0]) return res.status(404).json({ error: "Hesap bulunamadı." });

      // 1) Apple ile bağlı hesap → önce Apple token'larını iptal et
      const apple = await tolerateMissing(pool.query("SELECT subject FROM oauth_identities WHERE provider = 'apple' AND user_id = $1", [userId]));
      if (apple.rows.length && appleConfig()) {
        if (!appleAuthorizationCode) {
          return res.status(409).json({ error: "Apple ile yeniden doğrulama gerekiyor.", requiresAppleReauth: true });
        }
        const r = await revokeAppleTokens(appleAuthorizationCode, fetchImpl).catch((e) => ({ revoked: false, reason: e.message }));
        console.log(`[Account] Apple token iptali: ${r.revoked ? "ok" : r.reason}`);
      }

      // 2) Sunucuya yüklenmiş görselleri topla (silme sonrası diskten kaldırılacak)
      const imgs = await tolerateMissing(pool.query(
        "SELECT DISTINCT image_url FROM generated_captions WHERE user_id = $1 AND image_url LIKE '%/uploads/%'",
        [userId],
      ));

      // 3) Veritabanı: tek işlemde sil (bağlı tablolar ON DELETE CASCADE ile temizlenir)
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await tolerateMissing(client.query("DELETE FROM generated_captions WHERE user_id = $1", [userId]));
        await tolerateMissing(client.query("UPDATE purchase_events SET user_id = NULL WHERE user_id = $1", [userId])); // mali denetim kaydı anonim kalır
        await client.query("DELETE FROM profiles WHERE id = $1", [userId]);
        await client.query("COMMIT");
      } catch (txErr) {
        await client.query("ROLLBACK").catch(() => {});
        throw txErr;
      } finally {
        client.release();
      }

      // 4) Diskteki görseller ve RevenueCat kaydı (en iyi çaba; hata silmeyi engellemez)
      let removedFiles = 0;
      for (const { image_url } of imgs.rows) {
        const name = path.basename(String(image_url).split("?")[0]);
        if (!name || name.includes("..")) continue;
        try { await fs.promises.unlink(path.join(uploadsDir, name)); removedFiles++; } catch { /* yoksa geç */ }
      }
      const rcDeleted = await deleteRevenueCatCustomer(userId, fetchImpl).catch(() => false);

      console.log(`[Account] Hesap silindi user=${userId} dosya=${removedFiles} revenuecat=${rcDeleted}`);
      res.json({ success: true });
    } catch (err) {
      console.error("[Account] Silme hatası:", err.message);
      res.status(500).json({ error: "Hesap silinemedi. Lütfen tekrar dene." });
    }
  });

  const page = (req, res) => {
    const SUPPORT_EMAIL = supportEmail();
    res.set("Content-Type", "text/html; charset=utf-8");
    res.set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'");
    res.send(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Capshion AI — Hesap Silme / Account Deletion</title>
<style>
:root{--bg:#f2f2f7;--panel:#fff;--text:#1c1c1e;--muted:#6e6e73;--accent:#34c759}
@media(prefers-color-scheme:dark){:root{--bg:#000;--panel:#1c1c1e;--text:#f2f2f7;--muted:#98989f}}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.6 -apple-system,system-ui,Segoe UI,Roboto,sans-serif}
main{max-width:680px;margin:0 auto;padding:32px 16px}
section{background:var(--panel);border-radius:16px;padding:20px 22px;margin:16px 0}
h1{font-size:26px;margin:0 0 4px}h2{font-size:18px;margin:0 0 8px}p,li{color:var(--muted)}a{color:var(--accent)}
</style></head><body><main>
<h1>Capshion AI — Hesap Silme</h1><p>Hesabını ve verilerini kalıcı olarak silebilirsin.</p>
<section><h2>1. Uygulama içinden (önerilen, anında)</h2>
<ol><li>Capshion AI uygulamasını aç ve giriş yap.</li><li><b>Profil</b> sekmesine git.</li><li>En alttaki <b>Hesabımı sil</b> seçeneğine dokun ve onayla.</li></ol></section>
${SUPPORT_EMAIL ? `<section><h2>2. Uygulamaya erişemiyorsan</h2>
<p>Hesabının bağlı olduğu e-posta adresinden <a href="mailto:${SUPPORT_EMAIL}?subject=Hesap%20silme%20talebi">${SUPPORT_EMAIL}</a> adresine
<b>"Hesap silme talebi"</b> konulu bir e-posta gönder. Talebin en geç 30 gün içinde işlenir ve sana bilgi verilir.</p></section>` : ""}
<section><h2>Neler silinir?</h2>
<ul><li>Hesap bilgilerin (e-posta, yaş aralığı), kredi bakiyen ve Premium durumun</li>
<li>Oluşturduğun tüm açıklamalar, Hook Lab oturumları ve yüklediğin görseller</li>
<li>Bildirim tercihlerin ve reklam ödülü kayıtların</li></ul>
<p>Satın alma kayıtları yasal muhasebe yükümlülükleri nedeniyle kimliksizleştirilerek saklanabilir.
<b>Aktif aboneliğin varsa</b>, ücretlendirmenin durması için aboneliği Google Play veya App Store'dan ayrıca iptal etmen gerekir.</p></section>
<hr style="border:none;border-top:1px solid rgba(128,128,128,.2);margin:28px 0">
<h1>Account Deletion</h1>
<section><p><b>In the app:</b> Profile → Delete my account → confirm. Deletion is immediate.<br>
${SUPPORT_EMAIL ? `<b>Without the app:</b> email <a href="mailto:${SUPPORT_EMAIL}?subject=Account%20deletion%20request">${SUPPORT_EMAIL}</a> from your account's email address with the subject "Account deletion request". We process requests within 30 days.` : ""}</p>
<p>Deleted: account info, credits, Premium status, all captions, Hook Lab sessions, uploaded images, notification preferences and ad reward records. Purchase records may be kept in anonymized form for legal accounting. Cancel any active subscription in Google Play / App Store separately.</p></section>
</main></body></html>`);
  };
  app.get("/hesap-silme", page);
  app.get("/account-deletion", page);
}

module.exports = { registerAccountRoutes, _test: { appleConfig, appleClientSecret, revokeAppleTokens } };
