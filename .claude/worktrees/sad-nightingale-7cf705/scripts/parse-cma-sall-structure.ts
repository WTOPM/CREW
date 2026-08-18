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
const UN_NO_RE = /^\d{4}$/;
const CLASS_RE = /^\d+(?:\.\d+)?$/;
const ISO_RE = /^[0-9]{2}[A-Z0-9]{2,3}$/i;

async function main() {
  const file = process.argv[2]!;
  const items = await extract(file);
  
  const containers = items.filter(it => CONTAINER_RE.test(it.str));
  const unNos = items.filter(it => UN_NO_RE.test(it.str) && it.x >= 590 && it.x <= 610);
  const classes = items.filter(it => CLASS_RE.test(it.str) && it.x >= 565 && it.x <= 585);
  const isos = items.filter(it => ISO_RE.test(it.str) && it.x >= 80 && it.x <= 100);
  
  console.log('Containers found:', containers.length);
  console.log('UN numbers found:', unNos.length);
  console.log('IMDG classes found:', classes.length);
  console.log('ISO types found:', isos.length);
  
  console.log('\n=== Containers (first 10) ===');
  for (const it of containers.slice(0, 10)) {
    console.log(`page ${it.page}, y=${it.y}, x=${it.x}: ${it.str}`);
  }
  
  console.log('\n=== UN numbers (first 10) ===');
  for (const it of unNos.slice(0, 10)) {
    console.log(`page ${it.page}, y=${it.y}, x=${it.x}: ${it.str}`);
  }
  
  console.log('\n=== IMDG classes (first 10) ===');
  for (const it of classes.slice(0, 10)) {
    console.log(`page ${it.page}, y=${it.y}, x=${it.x}: ${it.str}`);
  }
  
  console.log('\n=== Sample cargo blocks ===');
  for (const container of containers.slice(0, 3)) {
    console.log(`\n--- ${container.str} (page ${container.page}, y=${container.y}) ---`);
    const pageItems = items.filter(i => i.page === container.page && i.y >= container.y - 10 && i.y <= container.y + 100);
    for (const it of pageItems) {
      console.log(`  ${it.y}\t${it.x}\t${it.str}`);
    }
  }
}

void main();
