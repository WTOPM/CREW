import fs from 'fs';
import { createRequire } from 'module';
import { pickCmaManifestProperShippingName } from '../src/app/utils/dg-cma-proper-name.util.ts';

const require = createRequire(import.meta.url);
const pdfjs = require('pdfjs-dist/legacy/build/pdf.mjs');

const file = process.argv[2];
const pageNum = Number(process.argv[3] || 1);
const anchorY = Number(process.argv[4] || 257);
if (!file) {
  console.error('Usage: npx tsx scripts/inspect-cma-proper-name.mjs <pdf> [page] [anchorY]');
  process.exit(1);
}

const data = new Uint8Array(fs.readFileSync(file));
const doc = await pdfjs.getDocument({ data }).promise;
const page = await doc.getPage(pageNum);
const vp = page.getViewport({ scale: 1 });
const c = await page.getTextContent();
const items = [];
for (const raw of c.items) {
  const str = (raw.str ?? '').trim();
  if (!str) continue;
  items.push({
    str,
    x: Math.round(raw.transform[4]),
    y: Math.round(vp.height - raw.transform[5]),
    page: pageNum,
  });
}

const nameCol = [305, 488] as const;
console.log(pickCmaManifestProperShippingName(items, anchorY, pageNum, nameCol));
