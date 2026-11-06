// ─── Capshion caption karşılaştırma aracı ───────────────────────────────────
// Aynı fotoğraflar için prompt sürümlerini (v1, v2, ...) çalıştırır ve yan yana
// karşılaştırma raporu üretir. Canlı sisteme / veritabanına DOKUNMAZ; yalnızca OpenAI'yi çağırır.
//
// Kullanım:
//   1) Fotoğrafları eval/photos/ klasörüne koy (jpg, png, webp).
//      Dosya adı öneki ile kimlik verebilirsin: kadin_..., erkek_..., marka_...
//   2) node scripts/caption-eval.js
//      Seçenekler: --tones cool,humorous,storyteller   (fotoğraflara sırayla dağıtılır)
//                  --length medium                     (short | medium | long)
//                  --versions v1,v2                    (prompts/captionPrompt<V>.js)
//                  --model gpt-4o
//   3) eval/out/<tarih>/report.html dosyasını tarayıcıda aç.

require("dotenv").config({ quiet: true });
const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");

const ROOT = path.join(__dirname, "..");
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith("--") ? [...acc, [a.slice(2), arr[i + 1]]] : acc), []),
);
const PHOTOS_DIR = path.resolve(ROOT, args.photos || "eval/photos");
const TONES = (args.tones || "cool,humorous,storyteller,viral").split(",").map((s) => s.trim()).filter(Boolean);
const LENGTH = args.length || "medium";
const VERSIONS = (args.versions || "v1,v2").split(",").map((s) => s.trim());
const MODEL = args.model || "gpt-4o";
const CONCURRENCY = 3;

const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
const EN_CLICHES = ["unleash", "elevate", "transformative", "journey", "delve", "embrace", "captivating", "unlock", "vibe", "pov"];

function loadPrompt(v) {
  const file = path.join(ROOT, "prompts", `captionPrompt${v.toUpperCase()}.js`);
  if (!fs.existsSync(file)) throw new Error(`Prompt bulunamadı: ${file}`);
  return require(file);
}

// server.js /api/captions/generate-json ile aynı JSON eki (alternatives modu)
const JSON_SUFFIX = `\n\nSadece JSON formatında yanıt ver:

{
  "captions": [
    { "caption_text": "caption text (\\n ile satır arası boşluk ekle)", "hashtags": ["#tag1", "#tag2"] },
    { "caption_text": "caption text (\\n ile satır arası boşluk ekle)", "hashtags": ["#tag3", "#tag4"] }
  ]
}

En az 2, en fazla 4 caption üret.`;

function identityFromName(name) {
  const n = name.toLowerCase();
  if (n.startsWith("kadin") || n.startsWith("kadın")) return "female";
  if (n.startsWith("erkek")) return "male";
  if (n.startsWith("marka")) return "corporate";
  return undefined;
}

function flagsFor(text, hashtags, { useHashtags = true } = {}) {
  const t = String(text || "");
  const low = t.toLocaleLowerCase("tr");
  const flags = [];
  const { TR_CLICHES = [] } = (() => { try { return require(path.join(ROOT, "prompts", fs.existsSync(path.join(ROOT, "prompts", "captionPromptV3.js")) ? "captionPromptV3.js" : "captionPromptV2.js")); } catch { return {}; } })();
  for (const c of TR_CLICHES) if (low.includes(c.toLocaleLowerCase("tr"))) flags.push(`klişe: "${c}"`);
  for (const c of EN_CLICHES) if (new RegExp(`\\b${c}`, "i").test(t)) flags.push(`ing. klişe: "${c}"`);
  if (/^\s*bugün/i.test(t)) flags.push('"Bugün" ile başlıyor');
  if (/fotoğrafta|bu kadın|bu adam/i.test(low)) flags.push("3. şahıs betimleme");
  if (/\bçünkü\b|\bbu nedenle\b|\bancak\b/i.test(low)) flags.push("yazı dili bağlacı");
  if (/\b(siz|sizin|sizce|kaydedin|paylaşın|etiketleyin)\b/i.test(low)) flags.push('"siz" hitabı');
  if (/kaydet|lazım olur/i.test(low)) flags.push("kaydet CTA'sı");
  if (/\S+\s+ve\s+ben\b/i.test(low)) flags.push('"X ve ben" kalıbı');
  if (/\(boş\)|^\s*$/.test(t)) flags.push("boş");
  const excl = (t.match(/!/g) || []).length;
  if (excl > 1) flags.push(`${excl} ünlem`);
  if (useHashtags) {
    const n = (hashtags || []).length;
    if (n < 5 || n > 7) flags.push(`${n} hashtag`);
    const long = (hashtags || []).filter((h) => h.replace("#", "").length > 18);
    if (long.length) flags.push(`uzun/uydurma olabilir: ${long.join(" ")}`);
  }
  return flags;
}

function parseCaptions(raw) {
  let parsed;
  try { parsed = JSON.parse(raw); } catch { const m = String(raw || "").match(/{[\s\S]*}/); parsed = m ? JSON.parse(m[0]) : {}; }
  const list = Array.isArray(parsed.captions) ? parsed.captions : [];
  return {
    gozlemler: Array.isArray(parsed.gozlemler) ? parsed.gozlemler : null,
    captions: list.filter((c) => c && (c.caption_text || c.text)).map((c) => ({
      text: String(c.caption_text || c.text || ""),
      hashtags: Array.isArray(c.hashtags) ? c.hashtags.map(String) : [],
    })),
  };
}

async function runOne(openai, prompt, opts, dataUrl) {
  const started = Date.now();
  const res = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: [{ type: "text", text: prompt.buildSystemPrompt(opts) + (prompt.buildJsonSuffix ? prompt.buildJsonSuffix(opts) : JSON_SUFFIX) }, { type: "image_url", image_url: { url: dataUrl } }] }],
    response_format: { type: "json_object" },
    max_tokens: 3000,
    temperature: 0.75,
    presence_penalty: 0.4,
    frequency_penalty: 0.3,
  });
  const out = parseCaptions(res.choices[0]?.message?.content || "");
  out.captions = out.captions.map((c) => ({ ...c, flags: flagsFor(c.text, c.hashtags, opts) }));
  out.ms = Date.now() - started;
  out.tokens = res.usage?.total_tokens;
  return out;
}

async function pool(items, n, fn) {
  const results = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const idx = i++; results[idx] = await fn(items[idx], idx); }
  }));
  return results;
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function renderReport(rows, meta) {
  const data = JSON.stringify({ rows, meta }).replace(/</g, "\\u003c");
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Caption Karşılaştırma</title>
<style>
:root{--bg:#f2f2f7;--panel:#fff;--text:#1c1c1e;--muted:#8e8e93;--border:rgba(0,0,0,.08);--green:#34c759;--red:#ff3b30;--blue:#007aff;--chip:#fff1f0}
@media (prefers-color-scheme:dark){:root{--bg:#000;--panel:#1c1c1e;--text:#f2f2f7;--muted:#98989f;--border:rgba(255,255,255,.12);--chip:#3a1d1b}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 -apple-system,system-ui,Segoe UI,Roboto,sans-serif}
header{position:sticky;top:0;z-index:2;background:var(--bg);border-bottom:1px solid var(--border);padding:14px 20px;display:flex;flex-wrap:wrap;gap:12px;align-items:center}
h1{font-size:18px;margin:0 auto 0 0}.meta{color:var(--muted);font-size:13px}
button{font:inherit;border:1px solid var(--border);background:var(--panel);color:var(--text);border-radius:999px;padding:6px 14px;cursor:pointer}
button.on{background:var(--text);color:var(--bg)}
main{max-width:1200px;margin:0 auto;padding:20px;display:grid;gap:20px}
.row{background:var(--panel);border:1px solid var(--border);border-radius:16px;padding:16px;display:grid;grid-template-columns:200px 1fr 1fr;gap:16px}
@media (max-width:860px){.row{grid-template-columns:1fr}}
.photo img{width:100%;border-radius:12px;display:block}.photo .s{color:var(--muted);font-size:13px;margin-top:8px}
.col h3{margin:0 0 8px;font-size:14px;display:flex;justify-content:space-between;align-items:center}
.cap{border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:10px;white-space:pre-wrap}
.tags{color:var(--blue);font-size:13px;margin-top:6px}
.flag{display:inline-block;background:var(--chip);color:var(--red);font-size:12px;border-radius:6px;padding:1px 6px;margin:6px 4px 0 0}
details{color:var(--muted);font-size:13px;margin-bottom:8px}
.vote{grid-column:1/-1;display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
.vote button.sel{background:var(--green);color:#fff;border-color:var(--green)}
#summary{max-width:1200px;margin:16px auto 0;padding:0 20px}
.sum{background:var(--panel);border:1px solid var(--border);border-radius:16px;padding:16px;display:flex;gap:24px;flex-wrap:wrap}
.sum b{font-size:22px;display:block}
</style></head><body>
<header><h1>Caption Karşılaştırma</h1><span class="meta" id="meta"></span>
<button id="blind" class="on">Kör mod</button><button id="reset">Oyları sıfırla</button></header>
<div id="summary"></div><main id="main"></main>
<script>
const D=${data};
const KEY="capshion-eval-"+D.meta.runId;
let votes={};try{votes=JSON.parse(localStorage.getItem(KEY)||"{}")}catch{}
let blind=true;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
document.getElementById("meta").textContent=D.meta.model+" · "+D.rows.length+" fotoğraf · "+D.meta.date;
function col(r,label){const v=r.results[label.v];if(!v)return'<div class="col"><h3>'+label.name+'</h3>—</div>';
 if(v.error)return'<div class="col"><h3>'+label.name+'</h3><div class="cap">Hata: '+esc(v.error)+'</div></div>';
 return'<div class="col"><h3><span>'+label.name+(blind?'':' · '+label.v)+'</span><span class="meta">'+(v.ms/1000).toFixed(1)+' sn</span></h3>'
 +(v.gozlemler&&!blind?'<details><summary>Gözlemler</summary>'+v.gozlemler.map(esc).join(' · ')+'</details>':'')
 +v.captions.map(c=>'<div class="cap">'+esc(c.text)+(c.hashtags.length?'<div class="tags">'+esc(c.hashtags.join(' '))+'</div>':'')+c.flags.map(f=>'<span class="flag">'+esc(f)+'</span>').join('')+'</div>').join('')+'</div>'}
function render(){
 const vs=D.meta.versions;const m=document.getElementById("main");
 m.innerHTML=D.rows.map((r,i)=>{const order=r.order.map((v,k)=>({v,name:"Taraf "+"AB"[k]}));
  const sel=votes[i];
  return'<section class="row"><div class="photo"><img src="'+esc(r.src)+'" alt=""><div class="s">'+esc(r.file)+'<br>ton: '+esc(r.opts.tone)+' · '+esc(r.opts.length)+(r.opts.gender?' · '+esc(r.opts.gender):'')+'</div></div>'
  +order.map(o=>col(r,o)).join('')
  +'<div class="vote">'+order.map(o=>'<button data-i="'+i+'" data-v="'+o.v+'" class="'+(sel===o.v?'sel':'')+'">'+o.name+' daha iyi</button>').join('')
  +'<button data-i="'+i+'" data-v="tie" class="'+(sel==="tie"?'sel':'')+'">Eşit</button></div></section>'}).join('');
 const tally={};vs.forEach(v=>tally[v]=0);tally.tie=0;Object.values(votes).forEach(v=>tally[v]=(tally[v]||0)+1);
 const flagCount={};vs.forEach(v=>{flagCount[v]=0;D.rows.forEach(r=>(r.results[v]?.captions||[]).forEach(c=>flagCount[v]+=c.flags.length))});
 const done=Object.keys(votes).length;
 document.getElementById("summary").innerHTML='<div class="sum"><div><b>'+done+'/'+D.rows.length+'</b>oylandı</div>'
  +(blind&&done<D.rows.length?'<div class="meta" style="align-self:center">Sonuçlar tüm fotoğraflar oylanınca ya da kör mod kapatılınca görünür.</div>'
  :vs.map(v=>'<div><b>'+tally[v]+'</b>'+v+' kazandı</div>').join('')+'<div><b>'+tally.tie+'</b>eşit</div>'+vs.map(v=>'<div><b>'+flagCount[v]+'</b>'+v+' otomatik uyarı</div>').join(''))+'</div>';
}
document.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;
 if(b.id==="blind"){blind=!blind;b.classList.toggle("on",blind);return render()}
 if(b.id==="reset"){votes={};try{localStorage.removeItem(KEY)}catch{};return render()}
 if(b.dataset.i){votes[b.dataset.i]=b.dataset.v;try{localStorage.setItem(KEY,JSON.stringify(votes))}catch{};render()}});
render();
</script></body></html>`;
}

(async () => {
  if (!process.env.OPENAI_API_KEY) { console.error("OPENAI_API_KEY tanımlı değil (.env)."); process.exit(1); }
  if (!fs.existsSync(PHOTOS_DIR)) { fs.mkdirSync(PHOTOS_DIR, { recursive: true }); }
  const files = fs.readdirSync(PHOTOS_DIR).filter((f) => MIME[path.extname(f).toLowerCase()]).sort();
  const skipped = fs.readdirSync(PHOTOS_DIR).filter((f) => !MIME[path.extname(f).toLowerCase()] && !f.startsWith("."));
  if (skipped.length) console.log(`[Eval] Atlanan (desteklenmeyen format, ör. HEIC): ${skipped.join(", ")}`);
  if (!files.length) { console.error(`[Eval] ${path.relative(ROOT, PHOTOS_DIR)} klasöründe fotoğraf yok. jpg/png/webp ekleyip tekrar çalıştır.`); process.exit(1); }

  const prompts = Object.fromEntries(VERSIONS.map((v) => [v, loadPrompt(v)]));
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const runId = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outDir = path.join(ROOT, "eval", "out", runId);
  fs.mkdirSync(outDir, { recursive: true });
  console.log(`[Eval] ${files.length} fotoğraf × ${VERSIONS.length} sürüm = ${files.length * VERSIONS.length} OpenAI çağrısı (${MODEL})`);

  const jobs = files.flatMap((file, i) => VERSIONS.map((v) => ({ file, i, v })));
  const rows = files.map((file, i) => {
    const buf = fs.readFileSync(path.join(PHOTOS_DIR, file));
    if (buf.length > 8 * 1024 * 1024) console.log(`[Eval] Uyarı: ${file} ${(buf.length / 1048576).toFixed(1)} MB, küçültmek maliyeti düşürür.`);
    return {
      file,
      src: path.relative(outDir, path.join(PHOTOS_DIR, file)).split(path.sep).join("/"),
      dataUrl: `data:${MIME[path.extname(file).toLowerCase()]};base64,${buf.toString("base64")}`,
      opts: { tone: TONES[i % TONES.length], length: LENGTH, gender: identityFromName(file), useEmojis: true, useHashtags: true, langName: "Türkçe", isPremium: false },
      order: [...VERSIONS].sort(() => Math.random() - 0.5), // kör karşılaştırma için taraflar karışık
      results: {},
    };
  });

  let done = 0;
  await pool(jobs, CONCURRENCY, async ({ i, v }) => {
    const row = rows[i];
    for (let attempt = 1; attempt <= 2; attempt++) {
      try { row.results[v] = await runOne(openai, prompts[v], row.opts, row.dataUrl); break; }
      catch (err) { if (attempt === 2) row.results[v] = { error: err.message, captions: [] }; }
    }
    done++;
    process.stdout.write(`\r[Eval] ${done}/${jobs.length} tamamlandı`);
  });
  console.log("");

  const clean = rows.map(({ dataUrl, ...r }) => r);
  // Aynı sürümde farklı fotoğraflarda birebir tekrar eden cümle → muhtemelen prompt'taki örnek kopyalanmış
  for (const v of VERSIONS) {
    const seen = new Map();
    clean.forEach((r, ri) => (r.results[v]?.captions || []).forEach((c) => c.text.split(/\n+/).map((l) => l.trim().toLocaleLowerCase("tr")).filter((l) => l.length > 20).forEach((l) => {
      if (!seen.has(l)) seen.set(l, new Set());
      seen.get(l).add(ri);
    })));
    clean.forEach((r) => (r.results[v]?.captions || []).forEach((c) => {
      const dup = c.text.split(/\n+/).map((l) => l.trim().toLocaleLowerCase("tr")).find((l) => seen.get(l)?.size > 1);
      if (dup) c.flags.push(`başka fotoğrafta da var: "${dup.slice(0, 40)}…"`);
    }));
  }
  fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify({ meta: { runId, model: MODEL, versions: VERSIONS, tones: TONES, length: LENGTH }, rows: clean }, null, 2));
  fs.writeFileSync(path.join(outDir, "report.html"), renderReport(clean, { runId, model: MODEL, versions: VERSIONS, date: new Date().toLocaleString("tr-TR") }));

  for (const v of VERSIONS) {
    const caps = clean.flatMap((r) => r.results[v]?.captions || []);
    const flagged = caps.reduce((n, c) => n + c.flags.length, 0);
    const errors = clean.filter((r) => r.results[v]?.error).length;
    const empty = clean.filter((r) => !r.results[v]?.error && !(r.results[v]?.captions || []).length).length;
    const tags = caps.map((c) => c.hashtags.length);
    const avgTags = tags.length ? (tags.reduce((a, b) => a + b, 0) / tags.length).toFixed(1) : "0";
    console.log(`[Eval] ${v}: ${caps.length} caption, ${empty} boş yanıt, ort. ${avgTags} hashtag, ${flagged} otomatik uyarı${errors ? `, ${errors} hata` : ""}`);
  }
  console.log(`[Eval] Rapor: ${path.relative(ROOT, path.join(outDir, "report.html"))}`);
})();
