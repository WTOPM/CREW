import fs from 'fs';

async function extract(filePath: string) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(fs.readFileSync(filePath));
  const doc = await pdfjs.getDocument({ data }).promise;
  const out: { str: string; x: number; y: number; page: number }[] = [];
  for (let p = 1; p <= Math.min(3, doc.numPages); p++) {
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
  
  console.log('Total pages processed:', Math.max(...items.map(i => i.page)));
  console.log('Total items:', items.length);
  
  const joined = items.map(i => i.str).join(' ');
  console.log('\nFormat detection:');
  console.log('  Has "Dangerous Cargo Manifest":', /Dangerous Cargo Manifest/i.test(joined));
  console.log('  Has "PFR0767_IMDG":', /PFR0767_IMDG/i.test(joined));
  console.log('  Has "Dangerous Cargo List":', /Dangerous Cargo List/i.test(joined));
  console.log('  Has "PFR0767 v":', /PFR0767 v/i.test(joined));
  
  console.log('\n=== PAGE 1 (first 100 items) ===');
  const page1 = items.filter(i => i.page === 1).sort((a, b) => a.y - b.y || a.x - b.x);
  for (const it of page1.slice(0, 100)) {
    console.log(`${it.y}\t${it.x}\t${it.str}`);
  }
}

void main();
