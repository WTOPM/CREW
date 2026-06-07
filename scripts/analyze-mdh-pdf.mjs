import fs from 'fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const pdfPath = process.argv[2] ?? 'c:/Users/wtopm/OneDrive/Desktop/MDH Hanna.pdf';
const data = new Uint8Array(fs.readFileSync(pdfPath));
const doc = await getDocument({ data, useSystemFonts: true }).promise;
const page = await doc.getPage(1);
const viewport = page.getViewport({ scale: 1 });
console.log('viewport', viewport.width, viewport.height);
const content = await page.getTextContent();
for (const item of content.items) {
  if (!('str' in item) || !item.str.trim()) continue;
  const t = item.transform;
  const x = t[4];
  const y = viewport.height - t[5];
  console.log(JSON.stringify({ x: Math.round(x), y: Math.round(y), text: item.str }));
}
