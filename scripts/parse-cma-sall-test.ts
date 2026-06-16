import fs from 'fs';
import { parseCmaCargoList } from '../src/app/utils/dg-cma-cargo-list-pdf.util.ts';

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
      const it = raw as { str?: string; transform?: number[] };
      const str = (it.str ?? '').trim();
      if (!str) continue;
      out.push({
        str,
        x: Math.round(it.transform?.[4] ?? 0),
        y: Math.round(vp.height - (it.transform?.[5] ?? 0)),
        page: p,
      });
    }
  }
  return out;
}

async function main() {
  const file = process.argv[2]!;
  const items = await extract(file);
  const result = parseCmaCargoList(items, []);
  console.log('rows', result.rows.length);
  console.log('warnings', result.warnings);
  console.log('header', result.header);
  for (const row of result.rows) {
    console.log(
      `${row.containerNo}\t${row.type}\t${row.dgClass}\t${row.unNo}\t${row.weightKg}\t${row.properShippingName}`,
    );
  }
}

void main();
