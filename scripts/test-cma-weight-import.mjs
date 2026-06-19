import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdfjs = require('pdfjs-dist/legacy/build/pdf.mjs');

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/test-cma-weight-import.mjs <pdf>');
  process.exit(1);
}

const COL = {
  grossWeight: [478, 525],
  netWeight: [530, 575],
  imdgClass: [575, 598],
};

function inCol(x, range) {
  return x >= range[0] && x <= range[1];
}

const data = new Uint8Array(fs.readFileSync(file));
const doc = await pdfjs.getDocument({ data }).promise;
const page = await doc.getPage(1);
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
    page: 1,
  });
}

const classY = 257;
const gross = items.find((it) => Math.abs(it.y - classY) <= 2 && inCol(it.x, COL.grossWeight) && /^[\d.]+$/.test(it.str));
const net = items.find((it) => Math.abs(it.y - classY) <= 2 && inCol(it.x, COL.netWeight) && /^[\d.]+$/.test(it.str));
console.log('class row y', classY);
console.log('gross', gross?.str, 'x', gross?.x);
console.log('net', net?.str, 'x', net?.x);
