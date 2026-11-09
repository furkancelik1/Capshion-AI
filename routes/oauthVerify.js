// ─── Sosyal giriş token doğrulaması (Google / Apple) ────────────────────────
// Kimlik YALNIZCA sağlayıcının imzaladığı ID token'dan alınır; istemcinin
// gönderdiği e-postaya asla güvenilmez.
//
// Ortam değişkenleri (isteğe bağlı):
//   GOOGLE_OAUTH_CLIENT_IDS   → kabul edilen Google client ID'leri (virgülle). Ayrıca aynı
//                               Google Cloud projesindeki (proje no öneki) tüm client'lar kabul edilir.
//   APPLE_BUNDLE_IDS          → kabul edilen Apple "aud" değerleri (varsayılan com.furkan.capshion)

const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const DEFAULT_GOOGLE_WEB_CLIENT = "155828266486-8b03t1gp1lk16irpvkkeu95vcpqk58n7.apps.googleusercontent.com";

const PROVIDERS = {
  google: { jwksUrl: "https://www.googleapis.com/oauth2/v3/certs", issuers: ["accounts.google.com", "https://accounts.google.com"] },
  apple: { jwksUrl: "https://appleid.apple.com/auth/keys", issuers: ["https://appleid.apple.com"] },
};
const KEYS_TTL_MS = 6 * 60 * 60 * 1000;
const REFETCH_COOLDOWN_MS = 60 * 1000;

const keyCache = {}; // provider → { at, keys: Map<kid, pem> }

class AuthError extends Error {
  constructor(message, status = 401) { super(message); this.status = status; }
}

async function fetchJwks(provider, fetchImpl) {
  const res = await fetchImpl(PROVIDERS[provider].jwksUrl);
  if (!res.ok) throw new Error(`${provider} JWKS HTTP ${res.status}`);
  const { keys = [] } = await res.json();
  const map = new Map();
  for (const jwk of keys) {
    if (!jwk.kid || jwk.kty !== "RSA") continue;
    map.set(jwk.kid, crypto.createPublicKey({ key: jwk, format: "jwk" }).export({ type: "spki", format: "pem" }));
  }
  keyCache[provider] = { at: Date.now(), keys: map };
  return map;
}

async function getSigningKey(provider, kid, fetchImpl) {
  const c = keyCache[provider];
  if (c && Date.now() - c.at < KEYS_TTL_MS && c.keys.has(kid)) return c.keys.get(kid);
  // Bilinmeyen kid: anahtar rotasyonu olabilir → yeniden çek (dakikada en fazla bir kez)
  if (c && c.keys.has(kid) === false && Date.now() - c.at < REFETCH_COOLDOWN_MS) return null;
  const keys = await fetchJwks(provider, fetchImpl);
  return keys.get(kid) || null;
}

async function verifyIdToken(provider, idToken, { audienceOk, fetchImpl = fetch } = {}) {
  if (typeof idToken !== "string" || idToken.split(".").length !== 3) throw new AuthError("Geçersiz token biçimi.");
  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded?.header?.kid) throw new AuthError("Token anahtar kimliği yok.");
  if (decoded.header.alg !== "RS256") throw new AuthError("Beklenmeyen imza algoritması.");

  const pem = await getSigningKey(provider, decoded.header.kid, fetchImpl);
  if (!pem) throw new AuthError("Token imza anahtarı bulunamadı.");

  let payload;
  try {
    payload = jwt.verify(idToken, pem, { algorithms: ["RS256"], issuer: PROVIDERS[provider].issuers, clockTolerance: 30 });
  } catch (err) {
    throw new AuthError(`Token doğrulanamadı: ${err.message}`);
  }
  const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!auds.some((a) => typeof a === "string" && audienceOk(a))) throw new AuthError("Token bu uygulama için verilmemiş (aud).");
  return payload;
}

function googleAudienceOk(aud) {
  const allowed = new Set([DEFAULT_GOOGLE_WEB_CLIENT, ...(process.env.GOOGLE_OAUTH_CLIENT_IDS || "").split(",").map((s) => s.trim()).filter(Boolean)]);
  if (process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) allowed.add(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID);
  if (allowed.has(aud)) return true;
  // Aynı Google Cloud projesinin diğer client'ları (Android / iOS): "<proje no>-....apps.googleusercontent.com"
  const projectPrefixes = new Set([...allowed].map((id) => id.split("-")[0] + "-"));
  return aud.endsWith(".apps.googleusercontent.com") && [...projectPrefixes].some((p) => aud.startsWith(p));
}

function appleAudienceOk(aud) {
  const allowed = (process.env.APPLE_BUNDLE_IDS || "com.furkan.capshion").split(",").map((s) => s.trim()).filter(Boolean);
  return allowed.includes(aud);
}

async function verifyGoogleIdToken(idToken, opts = {}) {
  const p = await verifyIdToken("google", idToken, { ...opts, audienceOk: googleAudienceOk });
  if (!p.email || !(p.email_verified === true || p.email_verified === "true")) throw new AuthError("Google e-postası doğrulanmamış.");
  return { email: String(p.email).toLowerCase().trim(), subject: p.sub };
}

async function verifyAppleIdToken(idToken, opts = {}) {
  const p = await verifyIdToken("apple", idToken, { ...opts, audienceOk: appleAudienceOk });
  if (!p.sub) throw new AuthError("Apple kullanıcı kimliği yok.");
  // Apple e-postayı her token'da vermeyebilir; verirse doğrulanmış kabul edilir
  const email = p.email && p.email_verified !== false && p.email_verified !== "false" ? String(p.email).toLowerCase().trim() : null;
  return { email, subject: p.sub };
}

/**
 * Sosyal girişten doğrulanmış e-postayı döndürür.
 * Apple: "sub" ↔ kullanıcı eşleşmesi oauth_identities tablosunda tutulur
 * (tablo yoksa yalnızca e-posta ile devam edilir).
 */
async function resolveSocialEmail({ provider, idToken, pool, fetchImpl }) {
  if (!idToken) throw new AuthError("Kimlik token'ı eksik.", 400);
  if (provider === "google") return (await verifyGoogleIdToken(idToken, { fetchImpl })).email;
  if (provider !== "apple") throw new AuthError("Desteklenmeyen giriş sağlayıcısı.", 400);

  const { email, subject } = await verifyAppleIdToken(idToken, { fetchImpl });
  let linkedEmail = null;
  try {
    const r = await pool.query(
      `SELECT pr.email FROM oauth_identities oi JOIN profiles pr ON pr.id = oi.user_id
        WHERE oi.provider = 'apple' AND oi.subject = $1`,
      [subject],
    );
    linkedEmail = r.rows[0]?.email || null;
  } catch (err) {
    if (err.code !== "42P01") throw err; // tablo yok → e-posta ile devam
  }
  const finalEmail = linkedEmail || email;
  if (!finalEmail) throw new AuthError("Apple hesabından e-posta alınamadı. Lütfen Ayarlar → Apple Kimliği → Apple ile Giriş'ten Capshion'u kaldırıp tekrar deneyin.", 400);
  return { email: finalEmail, appleSubject: subject, needsLink: !linkedEmail };
}

async function linkAppleIdentity(pool, subject, userId) {
  try {
    await pool.query(
      `INSERT INTO oauth_identities (provider, subject, user_id) VALUES ('apple', $1, $2)
       ON CONFLICT (provider, subject) DO NOTHING`,
      [subject, userId],
    );
  } catch (err) {
    if (err.code !== "42P01") console.warn("[SocialLogin] Apple kimliği bağlanamadı:", err.message);
  }
}

module.exports = {
  AuthError, resolveSocialEmail, linkAppleIdentity, verifyGoogleIdToken, verifyAppleIdToken,
  _test: { resetCache: () => { for (const k of Object.keys(keyCache)) delete keyCache[k]; }, googleAudienceOk, appleAudienceOk },
};
