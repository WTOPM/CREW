import fs from 'fs';
import { parseUnifeederDangerousCargoManifest } from '../src/app/utils/dg-unifeeder-pdf.util.ts';
import { parseDgWeightKg } from '../src/app/models/dg-manifest.models.ts';

const IMO = { unNo: -63, nweight: -400 };

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

  const rawPkgs: { page: number; un: string; x: number; kg: number }[] = [];
  for (const p of [...new Set(items.map((i) => i.page))].sort((a, b) => a - b)) {
    const pi = items.filter((i) => i.page === p);
    const imoYs = [
      ...new Set(
        pi
          .filter((i) => i.str === 'IMO Information' || /^Proper ship/.test(i.str))
          .map((i) => i.y),
      ),
    ].sort((a, b) => a - b);
    for (const imoY of imoYs) {
      const unY = imoY + IMO.unNo;
      const nwY = imoY + IMO.nweight;
      const seen = new Set<string>();
      for (const it of pi.filter((i) => Math.abs(i.y - unY) <= 4 && /^\d{4}$/.test(i.str))) {
        const key = `${p}@${it.x}@${it.str}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const w = pi.find(
          (x) =>
            Math.abs(x.x - it.x) <= 22 &&
            Math.abs(x.y - nwY) <= 6 &&
            /^\d{1,3}(?:\.\d{3})*,\d{2}$/.test(x.str),
        );
        rawPkgs.push({
          page: p,
          un: it.str,
          x: it.x,
          kg: w ? parseDgWeightKg(w.str) : 0,
        });
      }
    }
  }

  console.log('raw', rawPkgs.length, 'import', result.rows.length);
  const used = new Set<number>();
  for (const row of result.rows) {
    const kg = parseDgWeightKg(row.weightKg);
    const idx = rawPkgs.findIndex(
      (x, i) => !used.has(i) && x.un === row.unNo && Math.abs(x.kg - kg) < 1,
    );
    if (idx >= 0) used.add(idx);
    else console.log('EXTRA', row.containerNo, row.unNo, row.weightKg, kg);
  }
  for (let i = 0; i < rawPkgs.length; i++) {
    if (!used.has(i)) console.log('MISSING', rawPkgs[i]);
  }
}

main().catch(console.error);
