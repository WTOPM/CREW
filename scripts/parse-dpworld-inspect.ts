import fs from 'fs';
import { parseUnifeederDangerousCargoManifest } from '../src/app/utils/dg-unifeeder-pdf.util.ts';
import { parseUnifeederGrandTotalSummary } from '../src/app/utils/dg-unifeeder-pdf-summary.util.ts';

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
  const result = parseUnifeederDangerousCargoManifest(items);
  const summary = parseUnifeederGrandTotalSummary(items);

  console.log('format', result.format, 'rows', result.rows.length, 'warnings', result.warnings.length);
  console.log('header', result.header);
  console.log('summary', summary);

  for (const p of [1, 2, 3]) {
    const pi = items.filter((i) => i.page === p);
    const imo = pi.find((i) => i.str === 'IMO Information');
    console.log(`\n=== page ${p} IMO at`, imo?.x, imo?.y);
    for (const it of pi) {
      if (
        it.str === 'IMO Information' ||
        /^[A-Z]{4}\s*[\d-]/.test(it.str) ||
        /^\d{4}$/.test(it.str) ||
        /^\d{1,3}(?:\.\d{3})*,\d{2}$/.test(it.str) ||
        /^Proper ship/.test(it.str)
      ) {
        if (imo && Math.abs(it.y - imo.y) < 320) {
          console.log(' ', it.y, it.x, it.str);
        }
      }
    }
  }
}

main().catch(console.error);
