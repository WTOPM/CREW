/**
 * Publish blank Ship Money template to public/.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const src = path.join(root, 'SHIP MONEY — Empty.pdf');
const out = path.join(root, 'public', 'ship-money-empty.pdf');

if (!fs.existsSync(src)) {
  console.error('Missing:', src);
  process.exit(1);
}
fs.copyFileSync(src, out);
console.log('Copied to', out);
