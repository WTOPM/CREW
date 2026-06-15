import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), 'un-numbers-source.xlsx');
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(file);
const ws = wb.worksheets[0];
console.log('sheet', ws.name, 'rows', ws.rowCount, 'cols', ws.columnCount);
for (let r = 1; r <= Math.min(10, ws.rowCount); r++) {
  const row = ws.getRow(r);
  const vals = [];
  for (let c = 1; c <= Math.min(8, ws.columnCount); c++) {
    vals.push(String(row.getCell(c).value ?? '').replace(/\s+/g, ' ').trim());
  }
  console.log('R' + r, vals);
}
