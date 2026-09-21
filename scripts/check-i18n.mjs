// Run: node scripts/check-i18n.mjs
// Checks that every t('key') exists in vi + en, that every {{placeholder}} in a string is passed at the call site,
// that vi and en define the same keys, and lists text that looks hard-coded in the UI.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const files = walk('src').filter((f) => /\.tsx?$/.test(f));
const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? flat(v, `${p}${k}.`) : [[`${p}${k}`, v]]));
const load = (l) => Object.fromEntries(flat(JSON.parse(readFileSync(`src/locales/${l}.json`, 'utf8'))));
const vi = load('vi');
const en = load('en');
const base = (k) => k.replace(/_(one|other|zero|two|few|many)$/, '');
const keys = (o) => new Set(Object.keys(o).map(base));
let problems = 0;
const bad = (msg) => {
  problems++;
  console.log('✗', msg);
};

// same keys in both languages (ios-*.json are OS permission strings, not app text)
for (const k of keys(vi)) if (!keys(en).has(k)) bad(`en is missing "${k}"`);
for (const k of keys(en)) if (!keys(vi).has(k)) bad(`vi is missing "${k}"`);

const ph = (s) => new Set([...String(s).matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]));
const used = new Set();
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/\bt\(\s*(['"`])([\w.]+)\1\s*(?:,\s*(\{[^)]*\}))?\s*\)/g)) {
    const key = m[2];
    used.add(key);
    const arg = m[3] ?? '';
    const strings = [vi, en].flatMap((L) => Object.entries(L).filter(([k]) => base(k) === key).map(([, v]) => v));
    if (!strings.length) {
      bad(`${f}: unknown key "${key}"`);
      continue;
    }
    for (const p of new Set(strings.flatMap((s) => [...ph(s)]))) {
      if (p === 'count' && /count/.test(arg)) continue;
      if (!new RegExp(`\\b${p}\\b`).test(arg)) bad(`${f}: t('${key}') needs {{${p}}} but the call doesn't pass it`);
    }
  }
}
for (const k of keys(vi)) if (!used.has(k) && !/^(widget|status|account\.(male|female|other))/.test(k)) console.log('· unused key (may be built dynamically):', k);

// text in JSX / Alert / placeholder that never goes through t()
const skip = /\b(className|style|name|icon|key|testID|source|uri|type|mode|behavior)=/;
for (const f of files.filter((x) => /\.tsx$/.test(x))) {
  const lines = readFileSync(f, 'utf8').split('\n');
  lines.forEach((line, i) => {
    const m = line.match(/>\s*([A-Za-zÀ-ỹ][^<>{}]{2,})\s*</) || line.match(/(?:placeholder|label|title)=["']([A-Za-zÀ-ỹ][^"']{2,})["']/) || line.match(/Alert\.alert\(\s*['"]([^'"]+)['"]/);
    if (m && !skip.test(line) && !/My Parking|Apple Maps|Google Maps|Waze/.test(m[1])) console.log(`? ${f}:${i + 1} hard-coded text: "${m[1].trim()}"`);
  });
}
console.log(problems ? `\n${problems} problem(s)` : '\ni18n OK');
process.exit(problems ? 1 : 0);
