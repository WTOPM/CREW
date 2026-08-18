/** Prepare cleaned DG manifest Excel template from reference file. */
import ExcelJS from 'exceljs';
import XLSX from 'xlsx';
import fs from 'fs';

const src = 'c:/Users/wtopm/OneDrive/Desktop/DG from ITGOA.xls';
const dest = 'c:/CREW/public/dg-manifest-imo-template.xlsx';

if (!fs.existsSync(dest)) {
  const wb0 = XLSX.read(fs.readFileSync(src), { type: 'buffer', cellStyles: true });
  XLSX.writeFile(wb0, dest, { bookType: 'xlsx', cellStyles: true });
}

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(dest);
const ws = wb.getWorksheet(1) ?? wb.worksheets[0];
ws.name = 'IMO list  ';

const COLS = 12;
const DATA_START = 10;
const DATA_END = 243;

for (let r = DATA_START; r <= DATA_END; r++) {
  for (let c = 1; c <= COLS; c++) {
    ws.getCell(r, c).value = null;
  }
}

ws.getCell('K7').value = { formula: `SUM(L${DATA_START}:L${DATA_END})`, result: 0 };
ws.getCell('J2').value = 'Master:';
ws.getCell('A3').value = '';
ws.getCell('E3').value = 'Voy. No.';
ws.getCell('F3').value = '';
ws.getCell('D6').value = '';
ws.getCell('G6').value = '';
ws.getCell('H6').value = '';
ws.getCell('D7').value = '';
ws.getCell('G7').value = '';
ws.getCell('H7').value = '';

ws.pageSetup.printArea = `A1:L${DATA_END}`;
ws.pageSetup.printTitlesRow = '1:9';

await wb.xlsx.writeFile(dest);
console.log('Prepared template:', dest);
