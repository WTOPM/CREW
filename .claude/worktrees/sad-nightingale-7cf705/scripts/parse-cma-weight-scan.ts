import fs from 'fs';
import { parseDgWeightKg } from '../src/app/models/dg-manifest.models.ts';

async function extract(filePath: string) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(fs.readFileSync(filePath));
  const doc = await pdfjs.getDocument({ data }).promise;
  const out: { str: string; x: number; y: number; page: number }[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const c = await page.getTextContent();
    for (const raw of c.items) {
      const str = (raw.str ?? '').trim();
      if (!str) continue;
      out.push({
        str,
        x: Math.round(raw.transform[4]),
        y: Math.round(vp.height - raw.transform[5]),
        page: p,
      });
    }
  }
  return out;
}

async function main() {
  const file = process.argv[2]!;
  const items = await extract(file);
  const weights = items.filter(
    (it) => it.x >= 528 && it.x <= 572 && /^\d+\.\d{3}$/.test(it.str),
  );
  const twoDigit = weights.filter((w) => /^\d{1,2}\.\d{3}$/.test(w.str));
  console.log('total weights', weights.length, 'two-digit int part', twoDigit.length);
  for (const w of twoDigit.slice(0, 20)) {
    console.log(w.str, '->', parseDgWeightKg(w.str));
  }
}

main().catch(console.error);
