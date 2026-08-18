import fs from 'fs';
import path from 'path';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/debug-unifeeder-pdf.mjs <pdf>');
  process.exit(1);
}

const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const data = new Uint8Array(fs.readFileSync(file));
const doc = await pdfjs.getDocument({ data }).promise;
const page = await doc.getPage(1);
const vp = page.getViewport({ scale: 1 });
const content = await page.getTextContent();
const items = content.items
  .map((raw) => ({
    str: (raw.str ?? '').trim(),
    x: Math.round(raw.transform[4]),
    y: Math.round(vp.height - raw.transform[5]),
  }))
  .filter((i) => i.str);

const imo = items.find((i) => i.str === 'IMO Information');
console.log('IMO y=', imo?.y, 'x=', imo?.x);
const imoY = imo?.y ?? 0;

const near = items
  .filter(
    (i) =>
      Math.abs(i.y - imoY) <= 35 ||
      Math.abs(i.y - (imoY - 27)) <= 10 ||
      Math.abs(i.y - (imoY - 21)) <= 10 ||
      /[A-Z]{4}[\s\d-]{6,}/i.test(i.str),
  )
  .sort((a, b) => a.y - b.y || a.x - b.x);

for (const it of near) {
  console.log(`${it.y}\t${it.x}\t${it.str}`);
}
