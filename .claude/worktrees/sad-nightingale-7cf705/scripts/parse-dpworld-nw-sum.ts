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

  let nwSum = 0;
  let gwSum = 0;
  let pkg = 0;

  for (const p of [...new Set(items.map((i) => i.page))].sort((a, b) => a - b)) {
    const pi = items.filter((i) => i.page === p);
    if (pi.some((i) => /Grand Total/i.test(i.str))) continue;
    const imo = pi.find((i) => i.str === 'IMO Information');
    if (!imo) continue;

    const dataYs = [
      ...new Set(
        pi
          .filter(
            (i) =>
              /^\d{4}$/.test(i.str) &&
              i.x >= 90 &&
              i.x <= 200 &&
              i.y > imo.y + 10 &&
              i.y < imo.y + 400,
          )
          .map((i) => i.y),
      ),
    ].sort((a, b) => a - b);

    for (const dataY of dataYs) {
      pkg++;
      const ws = pi.filter(
        (i) => Math.abs(i.y - dataY) <= 4 && EU_WEIGHT_RE.test(i.str) && i.x >= 380,
      );
      const nw = ws.find((w) => w.x >= 450);
      const gw = ws.find((w) => w.x >= 400 && w.x < 450);
      if (nw) nwSum += parseDgWeightKg(nw.str);
      if (gw) gwSum += parseDgWeightKg(gw.str);
    }
  }

  console.log({ pkg, nwSum: Math.round(nwSum), gwSum: Math.round(gwSum) });
}

main().catch(console.error);
