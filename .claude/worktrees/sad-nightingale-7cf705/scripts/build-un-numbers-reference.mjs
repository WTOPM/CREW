import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'scripts/un-numbers-source.xlsx');
const out = path.join(root, 'src/app/data/un-numbers-reference.json');

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(file);
const ws = wb.worksheets[0];

const map = new Map();
let skipped = 0;

for (let r = 2; r <= ws.rowCount; r++) {
  const un = String(ws.getRow(r).getCell(1).value ?? '').trim();
  if (!/^\d{4}$/.test(un)) continue;

  const entry = {
    description: clean(ws.getRow(r).getCell(2).value),
    dgClass: clean(ws.getRow(r).getCell(3).value),
    packingGroup: clean(ws.getRow(r).getCell(4).value),
    subRisk: clean(ws.getRow(r).getCell(5).value),
    fire: clean(ws.getRow(r).getCell(6).value),
    spillage: clean(ws.getRow(r).getCell(7).value),
  };

  if (!entry.description) {
    skipped++;
    continue;
  }

  if (map.has(un) && map.get(un).description !== entry.description) {
    console.warn('duplicate UN', un);
  }
  map.set(un, entry);
}

const sorted = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
const payload = Object.fromEntries(sorted);

fs.writeFileSync(
  out,
  JSON.stringify(payload) +
    '\n',
  'utf8',
);

const bytes = fs.statSync(out).size;
console.log('written', out);
console.log('entries', sorted.length, 'skipped', skipped, 'bytes', bytes);

function clean(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}
