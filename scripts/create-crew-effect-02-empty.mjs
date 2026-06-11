/**
 * Publish blank Crew Effect 02 (Germany) template to public/.
 * Usage: node scripts/create-crew-effect-02-empty.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const src = path.join(root, '1234.pdf');
const out = path.join(root, 'public', 'crew-effect-02-empty.pdf');

if (!fs.existsSync(src)) {
  console.error('Missing:', src);
  process.exit(1);
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.copyFileSync(src, out);
console.log('Copied to', out);
