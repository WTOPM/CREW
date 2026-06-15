import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const file = process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'unifeeder-dg-sample.pdf');

async function main() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(fs.readFileSync(file));
  const doc = await pdfjs.getDocument({ data }).promise;
  console.log('pages:', doc.numPages);

  for (let pageNum = 1; pageNum <= Math.min(3, doc.numPages); pageNum++) {
    const page = await doc.getPage(pageNum);
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
    console.log(`\n=== page ${pageNum} (${vp.width}x${vp.height}) items=${items.length} ===`);
    for (const it of items) {
      if (it.y < 0 || it.y > vp.height + 50) continue;
      console.log(`y=${String(it.y).padStart(4)} x=${String(it.x).padStart(4)} | ${it.str}`);
    }
  }
}

main().catch(console.error);
