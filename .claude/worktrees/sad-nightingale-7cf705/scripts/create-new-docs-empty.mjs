import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const pairs = [
  ['Cash Advance — empty.pdf', 'cash-advance-empty.pdf'],
  ['Crew Money — empty.pdf', 'crew-money-empty.pdf'],
  ['Narcotic List — empty.pdf', 'narcotic-list-empty.pdf'],
];

for (const [srcName, outName] of pairs) {
  const src = path.join(root, srcName);
  const out = path.join(root, 'public', outName);
  if (!fs.existsSync(src)) {
    console.error('Missing:', src);
    process.exit(1);
  }
  fs.copyFileSync(src, out);
  console.log('Copied', outName);
}

if (process.argv.includes('--strip-narcotic-sample')) {
  const { spawnSync } = await import('node:child_process');
  const strip = path.join(path.dirname(fileURLToPath(import.meta.url)), 'strip-narcotic-template-sample.mjs');
  const r = spawnSync(process.execPath, [strip], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
