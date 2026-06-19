import fs from 'fs';

const COL = {
  containerNo: [120, 190],
  carriageTemp: [395, 442],
  loadPort: [100, 220],
  transhipmentPort: [100, 220],
  dischargePort: [380, 500],
  etd: [340, 400],
  voyage: [435, 520],
  vessel: [435, 520],
};

const CONTAINER_RE = /^[A-Z]{4}\d{7}$/;
const TEMP_RE = /^-?\d+(?:\.\d+)?\s*°?\s*C$/i;

function inCol(x, range) {
  return x >= range[0] && x <= range[1];
}

function nearY(item, y, tol = 2) {
  return Math.abs(item.y - y) <= tol;
}

async function extract(filePath) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(fs.readFileSync(filePath));
  const doc = await pdfjs.getDocument({ data }).promise;
  const out = [];
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

function parseRows(items) {
  const anchors = items
    .filter((it) => inCol(it.x, COL.containerNo) && CONTAINER_RE.test(it.str.trim()))
    .sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);

  const seenRows = new Set();
  const rows = [];

  for (const anchor of anchors) {
    const rowKey = `${anchor.page}:${anchor.y}`;
    if (seenRows.has(rowKey)) continue;
    seenRows.add(rowKey);

    const band = items.filter((it) => it.page === anchor.page && nearY(it, anchor.y, 2));
    const containerNo = anchor.str.trim();
    const carriageRaw =
      band.find((it) => inCol(it.x, COL.carriageTemp) && TEMP_RE.test(it.str.trim()))?.str.trim() ??
      band.find((it) => inCol(it.x, COL.carriageTemp) && /^-?\d/.test(it.str.trim()))?.str.trim() ??
      '';

    rows.push({ containerNo, setPointTemp: carriageRaw, page: anchor.page, y: anchor.y, band });
  }

  return rows;
}

function parseHeader(items) {
  const headerItems = items.filter((it) => it.page === 1);
  const voyage =
    headerItems.find((it) => nearY(it, 103, 1) && inCol(it.x, COL.voyage))?.str.trim() ?? '';
  const vessel =
    headerItems.find((it) => nearY(it, 116, 1) && inCol(it.x, COL.vessel))?.str.trim() ?? '';
  const etd =
    headerItems.find((it) => nearY(it, 175, 1) && inCol(it.x, COL.etd))?.str.trim() ?? '';
  return { voyage, vessel, etd };
}

function findPortAtY(items, col, y) {
  for (const it of items) {
    if (!nearY(it, y, 1)) continue;
    if (!inCol(it.x, col)) continue;
    const v = it.str.trim();
    if (!v || v === '-' || v === '—') continue;
    if (/^:/.test(v)) continue;
    return v;
  }
  return '';
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node scripts/inspect-reefer-manifest.mjs <pdf>');
    process.exit(1);
  }

  const items = await extract(file);
  const joined = items.map((i) => i.str).join(' ');
  console.log('file:', file);
  console.log('pages:', new Set(items.map((i) => i.page)).size);
  console.log('has REEFER MANIFEST:', /REEFER MANIFEST/i.test(joined));
  console.log('has PFR0777:', /PFR0777/i.test(joined));
  console.log('title snippet:', joined.slice(0, 400));

  const header = parseHeader(items);
  const loadPort = findPortAtY(items.filter((i) => i.page === 1), COL.loadPort, 175);
  const transPort = findPortAtY(items.filter((i) => i.page === 1), COL.transhipmentPort, 227);
  const disPort = findPortAtY(items.filter((i) => i.page === 1), COL.dischargePort, 227);
  console.log('\nheader:', header);
  console.log('ports:', { loadPort, transPort, disPort });

  const rows = parseRows(items);
  console.log('\nrows parsed:', rows.length);
  if (rows.length) {
    console.log('first 5:');
    for (const r of rows.slice(0, 5)) {
      console.log(`  ${r.containerNo}  temp=${r.setPointTemp || '(missing)'}  p${r.page} y${r.y}`);
    }
    console.log('last 3:');
    for (const r of rows.slice(-3)) {
      console.log(`  ${r.containerNo}  temp=${r.setPointTemp || '(missing)'}  p${r.page} y${r.y}`);
    }
    const missingTemp = rows.filter((r) => !r.setPointTemp);
    if (missingTemp.length) {
      console.log('\nmissing temp:', missingTemp.length, 'rows');
      const sample = missingTemp[0];
      console.log('sample band for', sample.containerNo, ':');
      for (const it of sample.band.sort((a, b) => a.x - b.x)) {
        console.log(`  x=${it.x}  ${it.str}`);
      }
    }
  } else {
    console.log('\nNo container rows — dumping page 1 container-like tokens:');
    const page1 = items.filter((i) => i.page === 1);
    for (const it of page1.filter((i) => CONTAINER_RE.test(i.str.trim())).slice(0, 10)) {
      console.log(`  y=${it.y} x=${it.x} ${it.str}`);
    }
  }

  console.log('\n=== PAGE 1 HEADER AREA (y 95-240) ===');
  for (const it of items
    .filter((i) => i.page === 1 && i.y >= 95 && i.y <= 240)
    .sort((a, b) => a.y - b.y || a.x - b.x)) {
    console.log(`${it.y}\t${it.x}\t${it.str}`);
  }

  console.log('\n=== PAGE 1 FIRST DATA ROW BAND ===');
  const firstAnchor = items.find((i) => i.page === 1 && CONTAINER_RE.test(i.str.trim()));
  if (firstAnchor) {
    for (const it of items
      .filter((i) => i.page === 1 && nearY(i, firstAnchor.y, 2))
      .sort((a, b) => a.x - b.x)) {
      console.log(`${it.y}\t${it.x}\t${it.str}`);
    }
  }
}

void main();
