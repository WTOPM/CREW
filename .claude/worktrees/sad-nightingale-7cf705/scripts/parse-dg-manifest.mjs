/**
 * CLI check for CMA CGM DG manifest PDF parsing.
 * Usage: node scripts/parse-dg-manifest.mjs path/to/manifest.pdf
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const COL = {
  containerNo: [8, 78],
  isoType: [80, 112],
  properName: [305, 488],
  netWeight: [528, 572],
  imdgClass: [582, 592],
  unNo: [600, 628],
  loadPort: [484, 560],
  transhipmentPort: [684, 770],
  vessel: [64, 130],
  voyage: [64, 170],
  callSign: [254, 295],
  etd: [484, 545],
};

async function extractItems(filePath) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(fs.readFileSync(filePath));
  const doc = await pdfjs.getDocument({ data }).promise;
  const out = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const vp = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    for (const raw of content.items) {
      const str = (raw.str ?? '').trim();
      if (!str) continue;
      out.push({
        str,
        x: Math.round(raw.transform[4]),
        y: Math.round(vp.height - raw.transform[5]),
        page: pageNum,
      });
    }
  }
  return out;
}

function inCol(x, range) {
  return x >= range[0] && x <= range[1];
}

function pickAtY(items, y, col, page, pred, yTol = 2) {
  for (const it of items) {
    if (it.page !== page) continue;
    if (Math.abs(it.y - y) > yTol || !inCol(it.x, COL[col])) continue;
    if (pred && !pred(it.str)) continue;
    return it.str.trim();
  }
  return '';
}

function pickNearY(items, y, col, page, pred) {
  for (const delta of [0, -1, 1, -2, 2]) {
    const v = pickAtY(items, y + delta, col, page, pred);
    if (v) return v;
  }
  return '';
}

function parse(filePath) {
  return extractItems(filePath).then((items) => {
    const classes = items.filter((it) => inCol(it.x, COL.imdgClass) && /^\d+(?:\.\d+)?$/.test(it.str) && it.y >= 200);
    let lastContainer = '';
    let lastType = '';
    const rows = [];
    for (const c of classes.sort((a, b) => a.page - b.page || a.y - b.y)) {
      const y = c.y;
      const page = c.page;
      const container =
        pickNearY(items, y, 'containerNo', page, (s) => /^[A-Z]{4}\d{7}$/.test(s)) || lastContainer;
      const type =
        pickNearY(items, y, 'isoType', page, (s) => /^[0-9]{2}[A-Z0-9]{2,3}$/i.test(s)) || lastType;
      if (container) lastContainer = container;
      if (type) lastType = type;
      rows.push({
        container,
        type,
        class: c.str.replace('.', ','),
        un: pickNearY(items, y, 'unNo', page, (s) => /^\d{4}$/.test(s)),
        net: pickNearY(items, y, 'netWeight', page, (s) => /[\d,]/.test(s)),
        name: pickNearY(items, y, 'properName', page, (s) => s.length > 2 && !/^\(\d\)$/.test(s)),
      });
    }
    const loadPort = items.find((it) => it.str === 'NAPOLI' || (inCol(it.x, COL.loadPort) && it.str.length > 3));
    return { rows, loadPort: loadPort?.str };
  });
}

const file = process.argv[2] ?? path.join(root, '123-dg-sample.pdf');
parse(path.isAbsolute(file) ? file : path.join(root, file)).then((r) => {
  console.log(JSON.stringify(r, null, 2));
});
