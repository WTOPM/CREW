import fs from 'fs';

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
      const it = raw as { str?: string; transform?: number[] };
      const str = (it.str ?? '').trim();
      if (!str) continue;
      out.push({
        str,
        x: Math.round(it.transform?.[4] ?? 0),
        y: Math.round(vp.height - (it.transform?.[5] ?? 0)),
        page: p,
      });
    }
  }
  return out;
}

async function main() {
  const file = process.argv[2]!;
  const items = await extract(file);
  const container = items.find((it) => it.str === 'CMAU9429290');
  if (!container) {
    console.log('container not found');
    return;
  }
  const startPage = container.page;
  for (let p = startPage; p <= startPage + 2; p++) {
    console.log(`\n=== PAGE ${p} cargo rows ===`);
    const pageItems = items.filter((it) => it.page === p);
    const cargoRows = pageItems
      .filter(
        (it) =>
          inListCol(it.x, 'netWeight') &&
          /^[\d.]+$/.test(it.str) &&
          it.y >= 240,
      )
      .sort((a, b) => a.y - b.y);
    for (const w of cargoRows) {
      const y = w.y;
      const name = pageItems.find(
        (it) => nearY(it, y - 1, 2) && it.x >= 255 && it.x <= 450 && it.str.length > 2,
      )?.str;
      const cls = pageItems.find((it) => nearY(it, y, 2) && it.x >= 565 && it.x <= 585)?.str;
      const un = pageItems.find((it) => nearY(it, y, 2) && it.x >= 588 && it.x <= 610)?.str;
      const cont = pageItems.find(
        (it) => CONTAINER_RE.test(it.str) && it.y >= y - 5 && it.y <= y + 5,
      )?.str;
      console.log(`y=${y} cont=${cont ?? '-'} class=${cls} un=${un} net=${w.str} name=${name}`);
    }
  }
}

function inListCol(x: number, col: 'netWeight'): boolean {
  const range = col === 'netWeight' ? [538, 575] : [0, 0];
  return x >= range[0] && x <= range[1];
}

function nearY(item: { y: number }, y: number, tol = 2): boolean {
  return Math.abs(item.y - y) <= tol;
}

const CONTAINER_RE = /^[A-Z]{4}\d{7}$/;

void main();
