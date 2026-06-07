import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

async function dump(name) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const file = path.join(root, name);
  const data = new Uint8Array(fs.readFileSync(file));
  const doc = await pdfjs.getDocument({ data }).promise;
  const page = await doc.getPage(1);
  const vp = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const items = content.items
    .map((it) => ({
      str: it.str.trim(),
      x: Math.round(it.transform[4]),
      y: Math.round(vp.height - it.transform[5]),
    }))
    .filter((it) => it.str);
  items.sort((a, b) => a.y - b.y || a.x - b.x);
  console.log(`\n=== ${name} (${vp.width}x${vp.height}) ===`);
  for (const it of items) {
    console.log(`y=${String(it.y).padStart(4)} x=${String(it.x).padStart(4)} | ${it.str}`);
  }
}

for (const f of process.argv.slice(2)) {
  await dump(f);
}
