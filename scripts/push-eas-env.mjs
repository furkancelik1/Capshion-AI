// .env.production içindeki EXPO_PUBLIC_* değişkenlerini EAS "production" ortamına yazar.
// Kullanım: npm run eas:env:push   (önce `eas login` gerekir)
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const FILE = '.env.production';
const REQUIRED = [
  'EXPO_PUBLIC_API_URL',
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_RC_GOOGLE_KEY',
];
// iOS yayını sonraya kaldı; boşsa yalnızca uyarılır
const IOS_ONLY = ['EXPO_PUBLIC_RC_APPLE_KEY'];

const vars = Object.fromEntries(
  readFileSync(FILE, 'utf8')
    .split(/\r?\n/)
    .filter((line) => /^EXPO_PUBLIC_[A-Z0-9_]+=/.test(line))
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i), line.slice(i + 1).trim()];
    }),
);

const missing = REQUIRED.filter((k) => !vars[k]);
if (missing.length) {
  console.error(`[eas-env] ${FILE} içinde eksik değer(ler): ${missing.join(', ')}`);
  process.exit(1);
}
for (const k of IOS_ONLY.filter((k) => !vars[k])) {
  console.warn(`[eas-env] ${k} boş — iOS build'inden önce doldurulmalı`);
}

for (const [name, value] of Object.entries(vars)) {
  if (!value) continue;
  // URL'ler loglarda görünebilir; anahtarlar EAS panelinde ve build loglarında maskelenir
  const visibility = name.endsWith('_KEY') ? 'sensitive' : 'plaintext';
  execFileSync(
    'npx',
    ['eas-cli', 'env:create', '--environment', 'production', '--name', name, '--value', value,
      '--visibility', visibility, '--force', '--non-interactive'],
    { stdio: ['ignore', 'ignore', 'inherit'], shell: process.platform === 'win32' },
  );
  console.log(`[eas-env] ${name} (${visibility}) yazıldı`);
}
