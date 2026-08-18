import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdfjs = require('pdfjs-dist/legacy/build/pdf.mjs');

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/inspect-cma-weights.mjs <pdf>');
  process.exit(1);
}

const data = new Uint8Array(fs.readFileSync(file));
const doc = await pdfjs.getDocument({ data }).promise;
console.log('pages', doc.numPages);

for (let p = 1; p <= Math.min(3, doc.numPages); p++) {
  const page = await doc.getPage(p);
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
    });
  }

  console.log(`--- page ${p} ---`);
  const headers = items
    .filter((it) => /Gross|Net|Weight|UN|Class|Container|IMDG/i.test(it.str))
    .sort((a, b) => a.y - b.y || a.x - b.x);
  for (const h of headers.slice(0, 50)) console.log(h.y, h.x, h.str);

  const nums = items
    .filter((it) => /^[\d.]+$/.test(it.str) && it.x > 450 && it.x < 620 && it.y > 180 && it.y < 400)
    .sort((a, b) => a.y - b.y || a.x - b.x);
  console.log('numeric weight candidates:');
  for (const n of nums.slice(0, 40)) console.log(n.y, n.x, n.str);
}
