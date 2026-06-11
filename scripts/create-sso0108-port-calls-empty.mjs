/**
 * Publishes SSO-0108 Port Calls empty PDF to public/ from repo-root 123.pdf.
 * Usage: node scripts/create-sso0108-port-calls-empty.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, '123.pdf');
const out = path.join(root, 'public', 'sso-0108-port-calls-empty.pdf');

if (!fs.existsSync(src)) {
  console.error('Missing:', src);
  process.exit(1);
}

fs.copyFileSync(src, out);
console.log('Wrote', out);
