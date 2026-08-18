import fs from 'fs';
import { parseUnifeederDangerousCargoManifest } from '../src/app/utils/dg-unifeeder-pdf.util.ts';
import { parseDgWeightKg } from '../src/app/models/dg-manifest.models.ts';

const DP_IMO = { dataRow: 28 };
const EU_WEIGHT_RE = /^\d{1,3}(?:\.\d{3})*,\d{2}$/;

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

  let importKg = 0;
  const emptyWeight: number[] = [];
  for (const row of result.rows) {
    const kg = parseDgWeightKg(row.weightKg);
    importKg += kg;
    if (!row.weightKg.trim() || kg <= 0) emptyWeight.push(0);
  }

  const rawPkgs: { page: number; un: string; nw: string; kg: number }[] = [];
  for (const p of [...new Set(items.map((i) => i.page))].sort((a, b) => a - b)) {
    const pi = items.filter((i) => i.page === p);
    if (pi.some((i) => /Grand Total Summary/i.test(i.str))) continue;
    const imo = pi.find((i) => i.str === 'IMO Information');
    if (!imo) continue;
    const dataY = imo.y + DP_IMO.dataRow;
    const un = pi.find(
      (i) => Math.abs(i.y - dataY) <= 4 && /^\d{4}$/.test(i.str) && i.x >= 90 && i.x <= 200,
    );
    if (!un) continue;
    const weights = pi.filter(
      (i) =>
        Math.abs(i.y - dataY) <= 4 &&
        EU_WEIGHT_RE.test(i.str) &&
        i.x >= 380,
    );
    const nw =
      weights.find((w) => w.x >= 440)?.str ??
      weights.find((w) => w.x >= 400)?.str ??
      weights[0]?.str ??
      '';
    rawPkgs.push({ page: p, un: un.str, nw, kg: nw ? parseDgWeightKg(nw) : 0 });
  }

  let rawKg = 0;
  for (const p of rawPkgs) rawKg += p.kg;

  console.log('format', result.format);
  console.log('rows', result.rows.length, 'containers', new Set(result.rows.map((r) => r.containerNo)).size);
  console.log('import kg', Math.round(importKg), 'raw kg', Math.round(rawKg));
  console.log('validation', result.validation);
  console.log('empty weight rows', result.rows.filter((r) => !parseDgWeightKg(r.weightKg)).length);

  const used = new Set<number>();
  for (const row of result.rows) {
    const kg = parseDgWeightKg(row.weightKg);
    const idx = rawPkgs.findIndex(
      (x, i) => !used.has(i) && x.un === row.unNo && Math.abs(x.kg - kg) < 1,
    );
    if (idx >= 0) used.add(idx);
    else console.log('MISMATCH import', row.containerNo, row.unNo, row.weightKg, kg);
  }
  for (let i = 0; i < rawPkgs.length; i++) {
    if (!used.has(i)) console.log('MISSING raw', rawPkgs[i]);
  }
}

main().catch(console.error);
