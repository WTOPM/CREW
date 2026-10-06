import fs from 'fs';
import { parseImdgChapter32 } from '../src/app/utils/dg-imdg-chapter32-pdf.util.ts';

const PDF = String.raw`C:\Users\wtopm\Downloads\IMDG+IMS\03-02-0_pdf.pdf`;

async function extract(filePath: string) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(fs.readFileSync(filePath));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  const out: { str: string; x: number; y: number; page: number }[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    for (const raw of content.items as { str?: string; transform?: number[] }[]) {
      const str = (raw.str ?? '').trim();
      if (!str) continue;
      out.push({
        str,
        x: Math.round(raw.transform?.[4] ?? 0),
        y: Math.round(vp.height - (raw.transform?.[5] ?? 0)),
        page: p,
      });
    }
  }
  return out;
}

function key(r: { unNo: string; packingGroup: string; description: string }) {
  return [
    String(Number(r.unNo)),
    (r.packingGroup || '').trim().toUpperCase(),
    (r.description || '').trim().toUpperCase(),
  ].join('|');
}

async function main() {
  const parsed = parseImdgChapter32(await extract(PDF));
  const pdfRows = parsed.rows;
  const byUn = new Map<string, number>();
  const exact = new Map<string, number>();
  for (const r of pdfRows) {
    byUn.set(r.unNo, (byUn.get(r.unNo) || 0) + 1);
    const k = key(r);
    exact.set(k, (exact.get(k) || 0) + 1);
  }

  console.log(
    JSON.stringify(
      {
        amendment: parsed.amendment,
        tablePages: parsed.tablePages.length,
        pdfRows: pdfRows.length,
        pdfUniqueUn: byUn.size,
        pdfMultiUn: [...byUn.values()].filter((n) => n > 1).length,
        pdfExactDupKeys: [...exact.values()].filter((n) => n > 1).length,
        minUn: Math.min(...pdfRows.map((r) => Number(r.unNo))),
        maxUn: Math.max(...pdfRows.map((r) => Number(r.unNo))),
        emptyDescription: pdfRows.filter((r) => !r.description.trim()).length,
        emptyClass: pdfRows.filter((r) => !r.dgClass.trim()).length,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
