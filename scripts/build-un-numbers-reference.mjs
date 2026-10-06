import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Build bundled UN reference JSON from an Excel UN list.
 * Keeps ALL list variants (same UN + different PG / description).
 *
 * Usage:
 *   node scripts/build-un-numbers-reference.mjs [xlsx]
 * Default source: scripts/un-numbers-source.xlsx
 * Or pass the refreshed IMDG_list_optimized.xlsx and use sheet "UN list".
 */
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(root, 'scripts/un-numbers-source.xlsx');
const out = path.join(root, 'src/app/data/un-numbers-reference.json');

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(file);
const ws =
  wb.getWorksheet('UN list') ||
  wb.worksheets.find((sheet) => /un\s*list/i.test(sheet.name)) ||
  wb.worksheets[0];

const rows = [];
const seen = new Set();
let skipped = 0;

for (let r = 2; r <= ws.rowCount; r++) {
  const rawUn = ws.getRow(r).getCell(1).value;
  const unDigits = String(rawUn ?? '').replace(/\D/g, '');
  if (!unDigits) continue;
  const un = unDigits.padStart(4, '0').slice(-4);
  if (!/^\d{4}$/.test(un) || un === '0000') continue;

  const entry = {
    unNo: un,
    description: clean(ws.getRow(r).getCell(2).value),
    dgClass: clean(ws.getRow(r).getCell(3).value),
    packingGroup: clean(ws.getRow(r).getCell(4).value).replace(/^-$/, ''),
    subRisk: clean(ws.getRow(r).getCell(5).value),
    fire: clean(ws.getRow(r).getCell(6).value),
    spillage: clean(ws.getRow(r).getCell(7).value),
  };

  if (!entry.description) {
    skipped++;
    continue;
  }

  const key = `${entry.unNo}|${entry.packingGroup}|${entry.description.toUpperCase()}`;
  if (seen.has(key)) continue;
  seen.add(key);
  rows.push(entry);
}

rows.sort((a, b) => {
  const un = a.unNo.localeCompare(b.unNo, undefined, { numeric: true });
  if (un) return un;
  const pgRank = (pg) => {
    if (pg === 'I') return 1;
    if (pg === 'II') return 2;
    if (pg === 'III') return 3;
    if (!pg) return 9;
    return 5;
  };
  const pg = pgRank(a.packingGroup) - pgRank(b.packingGroup);
  if (pg) return pg;
  return a.description.localeCompare(b.description);
});

fs.writeFileSync(out, JSON.stringify(rows) + '\n', 'utf8');

const uniqueUn = new Set(rows.map((r) => r.unNo));
const multi = [...uniqueUn].filter((u) => rows.filter((r) => r.unNo === u).length > 1).length;
const bytes = fs.statSync(out).size;
console.log('written', out);
console.log('list entries', rows.length, 'unique UN', uniqueUn.size, 'multi-variant UN', multi);
console.log('skipped', skipped, 'bytes', bytes);

function clean(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}
