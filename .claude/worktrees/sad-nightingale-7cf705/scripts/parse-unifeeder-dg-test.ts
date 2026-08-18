/**
 * Test UNIFEEDER PDF parser (run: npx tsx scripts/parse-unifeeder-dg-test.ts [pdf])
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseUnifeederDangerousCargoManifest } from '../src/app/utils/dg-unifeeder-pdf.util.ts';

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
  return out;
}

async function main() {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const file = process.argv[2] ?? path.join(root, 'unifeeder-dg-sample.pdf');
  const abs = path.isAbsolute(file) ? file : path.join(root, file);
  const items = await extractItems(abs);
  const result = parseUnifeederDangerousCargoManifest(items);

  console.log(
    JSON.stringify(
      {
        format: result.format,
        header: result.header,
        rowCount: result.rows.length,
        warningCount: result.warnings.length,
        containers: new Set(result.rows.map((r) => r.containerNo)).size,
        rows: result.rows.map((r) => ({
          containerNo: r.containerNo,
          stow: r.stow,
          size: r.size,
          unNo: r.unNo,
        })),
        first: result.rows[0],
        multiCargo: result.rows.filter((r) => r.containerNo === 'CIPU5122415'),
      },
      null,
      2,
    ),
  );
}

main().catch(console.error);
