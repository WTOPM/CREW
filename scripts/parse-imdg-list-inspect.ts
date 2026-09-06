import fs from 'fs';

async function main() {
  const file = process.argv[2] ?? 'C:/Users/wtopm/Downloads/IMDG list.pdf';
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(fs.readFileSync(file));
  const doc = await pdfjs.getDocument({ data }).promise;
  console.log('pages', doc.numPages);
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    console.log(`\n===== PAGE ${p} w=${Math.round(vp.width)} h=${Math.round(vp.height)} =====`);
    const c = await page.getTextContent();
    const items: { str: string; x: number; y: number }[] = [];
    for (const raw of c.items as { str?: string; transform: number[] }[]) {
      const str = (raw.str ?? '').trim();
      if (!str) continue;
      items.push({
        str,
        x: Math.round(raw.transform[4] * 10) / 10,
        y: Math.round((vp.height - raw.transform[5]) * 10) / 10,
      });
    }
    items.sort((a, b) => a.y - b.y || a.x - b.x);
    for (const it of items) {
      console.log(String(it.y).padStart(6), String(it.x).padStart(6), JSON.stringify(it.str));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
