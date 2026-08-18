import fs from 'fs';
import { parseUnifeederDangerousCargoManifest } from '../src/app/utils/dg-unifeeder-pdf.util.ts';
import {
  parseUnifeederGrandTotalSummary,
  validateUnifeederImportAgainstSummary,
} from '../src/app/utils/dg-unifeeder-pdf-summary.util.ts';
import { parseDgWeightKg } from '../src/app/models/dg-manifest.models.ts';

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
    'd:/Vessel/JUDITH/CH OFF/02 DG/2025/109/3.FIHEL/EX DANGEROUS CARGO MANIFEST.9090389.251105160942_468_3_0.pdf';
  const { items } = await extractItems(file);
  const result = parseUnifeederDangerousCargoManifest(items);
  const summary = parseUnifeederGrandTotalSummary(items);
  const validation = validateUnifeederImportAgainstSummary(result.rows, summary);
  let sum = 0;
  for (const r of result.rows) sum += parseDgWeightKg(r.weightKg);
  console.log({
    format: result.format,
    rows: result.rows.length,
    containers: new Set(result.rows.map((r) => r.containerNo)).size,
    sum: Math.round(sum),
    warnings: result.warnings,
    validation,
  });
}

main().catch(console.error);
