/**
 * Publish blank Crew Effect template to public/.
 * Usage: node scripts/create-crew-effect-empty.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const src = path.join(root, 'Crew effect - empty.pdf');
const out = path.join(root, 'public', 'crew-effect-empty.pdf');

if (!fs.existsSync(src)) {
  console.error('Missing:', src);
  process.exit(1);
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.copyFileSync(src, out);
console.log('Copied to', out);
