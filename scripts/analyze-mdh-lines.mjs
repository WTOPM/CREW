import fs from 'fs';
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';

const pdfPath = process.argv[2] ?? 'c:/CREW/public/mdh-template.pdf';
const data = new Uint8Array(fs.readFileSync(pdfPath));
const doc = await getDocument({ data }).promise;
const page = await doc.getPage(1);
const viewport = page.getViewport({ scale: 1 });
const h = viewport.height;
const ops = await page.getOperatorList();
const lines = [];
let cx = 0;
let cy = 0;
for (let i = 0; i < ops.fnArray.length; i++) {
  const fn = ops.fnArray[i];
  const args = ops.argsArray[i];
  if (fn === OPS.moveTo) {
    cx = args[0];
    cy = args[1];
  } else if (fn === OPS.lineTo) {
    const x2 = args[0];
    const y2 = args[1];
    if (Math.abs(y2 - cy) < 0.5 && Math.abs(x2 - cx) > 40) {
      const yTop = Math.round(h - cy);
      lines.push({ yTop, x1: Math.round(Math.min(cx, x2)), x2: Math.round(Math.max(cx, x2)) });
    }
    cx = x2;
    cy = y2;
  }
}
lines.sort((a, b) => a.yTop - b.yTop || a.x1 - b.x1);
const seen = new Set();
for (const l of lines) {
  const key = `${l.yTop}-${l.x1}-${l.x2}`;
  if (seen.has(key)) continue;
  seen.add(key);
  console.log(JSON.stringify(l));
}
