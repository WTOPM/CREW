import fs from 'fs';
import { parseCmaCargoList } from '../src/app/utils/dg-cma-cargo-list-pdf.util.ts';
import { DgManifestImportService } from '../src/app/services/dg-manifest-import.service.ts';

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
  const bytes = new Uint8Array(fs.readFileSync(file));
  const items = await extract(file);
  const joined = items.map((i) => i.str).join(' ');
  console.log('pages', new Set(items.map((i) => i.page)).size);
  console.log('has PFR0767', /PFR0767_IMDG/i.test(joined));
  console.log('has Dangerous Cargo', /Dangerous Cargo Manifest/i.test(joined));
  console.log('title snippets:', joined.slice(0, 300));

  const importer = new DgManifestImportService();
  const result = await importer.importFromPdfBytes(bytes);
  console.log('\nimport format', result.format);
  console.log('rows', result.rows.length);
  console.log('warnings', result.warnings.slice(0, 10));
  console.log('header', result.header);
  if (result.rows.length) {
    console.log('first row', result.rows[0]);
    console.log('last row', result.rows[result.rows.length - 1]);
  }

  for (const p of [1, 2, 3].filter((n) => items.some((i) => i.page === n))) {
    console.log(`\n=== PAGE ${p} ALL ===`);
    const pageItems = items
      .filter((i) => i.page === p)
      .sort((a, b) => a.y - b.y || a.x - b.x);
    for (const it of pageItems) {
      console.log(`${it.y}\t${it.x}\t${it.str}`);
    }
  }
}

void main();
