import fs from 'fs';
import { parseDgWeightKg } from '../src/app/models/dg-manifest.models.ts';

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

  let pages = 0;
  let multiImo = 0;
  let multiUn = 0;
  let cargoKg = 0;
  let pkgCount = 0;
  const noWeight: { page: number; imoY: number; dataY: number; un: string }[] = [];

  for (const p of [...new Set(items.map((i) => i.page))].sort((a, b) => a - b)) {
    const pi = items.filter((i) => i.page === p);
    if (pi.some((i) => /Grand Total/i.test(i.str))) continue;
    const imos = pi.filter((i) => i.str === 'IMO Information');
    if (!imos.length) continue;
    pages++;
    if (imos.length > 1) multiImo++;

    for (const imo of imos) {
      const unItems = pi.filter(
        (i) =>
          /^\d{4}$/.test(i.str) &&
          i.x >= 90 &&
          i.x <= 200 &&
          i.y > imo.y + 10 &&
          i.y < imo.y + 120,
      );
      const dataYs = [...new Set(unItems.map((i) => i.y))].sort((a, b) => a - b);
      if (dataYs.length > 1) multiUn++;

      for (const dataY of dataYs) {
        pkgCount++;
        const un = unItems.find((i) => i.y === dataY)?.str ?? '';
        const weights = pi.filter(
          (i) => Math.abs(i.y - dataY) <= 4 && EU_WEIGHT_RE.test(i.str) && i.x >= 350,
        );
        if (!weights.length) {
          noWeight.push({ page: p, imoY: imo.y, dataY, un });
          continue;
        }
        const nw = weights.find((w) => w.x >= 440) ?? weights[weights.length - 1];
        cargoKg += parseDgWeightKg(nw.str);
      }
    }
  }

  console.log({
    pages,
    multiImo,
    multiUn,
    pkgCount,
    cargoKg: Math.round(cargoKg),
    noWeight: noWeight.length,
    noWeightSample: noWeight.slice(0, 15),
  });
}

main().catch(console.error);
