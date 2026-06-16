import fs from 'fs';
import { parseUnifeederDangerousCargoManifest } from '../src/app/utils/dg-unifeeder-pdf.util.ts';
import {
  parseUnifeederGrandTotalSummary,
  validateUnifeederImportAgainstSummary,
} from '../src/app/utils/dg-unifeeder-pdf-summary.util.ts';

async function extractItems(filePath: string) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(fs.readFileSync(filePath));
  const doc = await pdfjs.getDocument({ data }).promise;
  const out: { str: string; x: number; y: number; page: number }[] = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const vp = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    for (const raw of content.items) {
      const str = (raw.str ?? '').trim();
      if (!str) continue;
      out.push({
        str,
        x: Math.round(raw.transform[4]),
        y: Math.round(vp.height - raw.transform[5]),
        page: pageNum,
      });
    }
  }
  return { items: out, numPages: doc.numPages };
}

async function main() {
  const file =
    process.argv[2] ??
    'd:/Vessel/JUDITH/CH OFF/02 DG/2025/109/2.DEHAM/EX DANGEROUS CARGO MANIFEST.9089624.251031120035_309_25_0.pdf';
  const { items, numPages } = await extractItems(file);
  const result = parseUnifeederDangerousCargoManifest(items);
  const summary = parseUnifeederGrandTotalSummary(items);

  console.log('header', result.header);
  console.log('rows', result.rows.length);
  for (const r of result.rows) {
    console.log([r.containerNo, r.size, r.stow, r.loadPort, r.dischargePort, r.weightKg].join(' | '));
  }
  console.log('summary', summary);
  console.log('validation', validateUnifeederImportAgainstSummary(result.rows, summary));

  for (const p of [1, 2, 3]) {
    const pageItems = items.filter((i) => i.page === p);
    console.log(`\n--- page ${p} container/size ---`);
    for (const it of pageItems.sort((a, b) => a.y - b.y || a.x - b.x)) {
      if (/VTGU|DHIU|EMT|20G|22G|45G|IMO Information|\/|HAMB|HELS/i.test(it.str) || (it.x >= 160 && it.x <= 175 && it.y >= 500 && it.y <= 540)) {
        console.log(`y=${it.y} x=${it.x} "${it.str}"`);
      }
    }
  }
}

main().catch(console.error);
