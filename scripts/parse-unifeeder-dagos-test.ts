import fs from 'fs';
import {
  isUnifeederDagosPositionsPdf,
  parseUnifeederDagosPositions,
} from '../src/app/utils/dg-unifeeder-dagos-pdf.util.ts';

async function main() {
  const file = process.argv[2] ?? 'C:/Users/wtopm/Downloads/IMDG list.pdf';
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(fs.readFileSync(file));
  const doc = await pdfjs.getDocument({ data }).promise;
  const items: { str: string; x: number; y: number; page: number }[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const c = await page.getTextContent();
    for (const raw of c.items as { str?: string; transform: number[] }[]) {
      const str = (raw.str ?? '').trim();
      if (!str) continue;
      items.push({
        str,
        x: Math.round(raw.transform[4] * 10) / 10,
        y: Math.round((vp.height - raw.transform[5]) * 10) / 10,
        page: p,
      });
    }
  }
  console.log('detect', isUnifeederDagosPositionsPdf(items));
  const rows = parseUnifeederDagosPositions(items);
  console.log('rows', rows.length);
  for (const r of rows) console.log(r.containerNo, r.position);
}

main().catch(console.error);
