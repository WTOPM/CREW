import fs from 'fs';
import { parseUnifeederDangerousCargoManifest } from '../src/app/utils/dg-unifeeder-pdf.util.ts';
import { parseUnifeederGrandTotalSummary } from '../src/app/utils/dg-unifeeder-pdf-summary.util.ts';
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
  const result = parseUnifeederDangerousCargoManifest(items);
  const summary = parseUnifeederGrandTotalSummary(items);
  const byContainer = new Map<string, string>();
  for (const row of result.rows) {
    if (!byContainer.has(row.containerNo)) byContainer.set(row.containerNo, row.size);
  }
  const pdfContainers = new Set<string>();
  for (const it of items) {
    if (!/^[A-Z]{4}\s*[\d\s-]{6,12}$/i.test(it.str)) continue;
    if (it.x > 520) continue;
    const cn = it.str.trim().toUpperCase().replace(/\s+/g, '').replace(/-/g, '');
    if (cn.length >= 10) pdfContainers.add(cn);
  }
  const imported = new Set(result.rows.map((r) => r.containerNo.trim()).filter(Boolean));
  const missing = [...pdfContainers].filter((c) => !imported.has(c));
  const emptySize = [...byContainer.entries()].filter(([, s]) => !s.trim());
  let pdfKg = 0;
  const pages = [...new Set(items.map((i) => i.page))];
  for (const p of pages) {
    const pi = items.filter((i) => i.page === p);
    const imo = pi.find((i) => i.str === 'IMO Information');
    const imoY = imo?.y ?? pi.find((i) => /^Proper ship/.test(i.str))?.y;
    if (!imoY) continue;
    const unY = imoY - 63;
    const nwY = imoY - 400;
    const seen = new Set<string>();
    for (const it of pi.filter((i) => Math.abs(i.y - unY) <= 4 && /^\d{4}$/.test(i.str))) {
      const key = `${it.x}@${it.str}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const w = pi.find(
        (x) =>
          Math.abs(x.x - it.x) <= 22 &&
          Math.abs(x.y - nwY) <= 6 &&
          /^\d{1,3}(?:\.\d{3})*,\d{2}$/.test(x.str),
      );
      if (w) pdfKg += parseDgWeightKg(w.str);
    }
  }
  let importKg = 0;
  for (const row of result.rows) importKg += parseDgWeightKg(row.weightKg);
  console.log({ summary, validation: result.validation, warnings: result.warnings });
  console.log('containers pdf', pdfContainers.size, 'imported', imported.size, 'missing', missing.length);
  console.log('missing', missing);
  console.log('empty size', emptySize.length, emptySize.slice(0, 5));
  console.log('pdf kg', Math.round(pdfKg), 'import', Math.round(importKg), 'rows', result.rows.length);
}

main().catch(console.error);
