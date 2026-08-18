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

const CONTAINER_RE = /^[A-Z]{4}\d{7}$/;

async function main() {
  const file = process.argv[2]!;
  const items = await extract(file);
  for (let p = 1; p <= 8; p++) {
    const conts = items.filter((i) => i.page === p && i.x >= 12 && i.x <= 78 && CONTAINER_RE.test(i.str));
  const weights = items.filter((i) => i.page === p && i.x >= 538 && i.x <= 575 && /^[\d.]+$/.test(i.str) && i.y >= 240);
    if (!conts.length && !weights.length) continue;
    console.log(`page ${p}: containers=${conts.map((c) => `${c.str}@${c.y}`).join(', ') || 'none'}, weights=${weights.map((w) => `${w.str}@${w.y}`).join(', ')}`);
  }
}

void main();
