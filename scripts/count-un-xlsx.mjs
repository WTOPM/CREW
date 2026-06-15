import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), 'un-numbers-source.xlsx');
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(file);
const ws = wb.worksheets[0];

let count = 0;
const samples = new Map();
for (let r = 2; r <= ws.rowCount; r++) {
  const un = String(ws.getRow(r).getCell(1).value ?? '').trim();
  if (!un || !/^\d{4}$/.test(un)) continue;
  count++;
  if (samples.size < 5 || un === '3171') {
    samples.set(un, {
      description: String(ws.getRow(r).getCell(2).value ?? '').trim(),
      dgClass: String(ws.getRow(r).getCell(3).value ?? '').trim(),
      packingGroup: String(ws.getRow(r).getCell(4).value ?? '').trim(),
      subRisk: String(ws.getRow(r).getCell(5).value ?? '').trim(),
      fire: String(ws.getRow(r).getCell(6).value ?? '').trim(),
      spillage: String(ws.getRow(r).getCell(7).value ?? '').trim(),
    });
  }
}
console.log('valid4digit', count);
console.log('3171', samples.get('3171'));
console.log('samples', [...samples.entries()].slice(0, 3));
