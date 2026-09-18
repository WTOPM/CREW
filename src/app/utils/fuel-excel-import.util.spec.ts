import { describe, expect, it } from 'vitest';
import { importFuelLogFromExcelBytes } from './fuel-excel-import.util';
import ExcelJS from 'exceljs';

describe('importFuelLogFromExcelBytes', () => {
  it('reads MASTER rows and classifies kinds', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Fuel Log MASTER ');
    ws.getCell('A1').value = 'hdr';
    ws.getCell('A5').value = 'Sea';
    ws.getCell('B5').value = 'BOSP';
    ws.getCell('C5').value = new Date(Date.UTC(2026, 8, 1));
    ws.getCell('D5').value = '08:00';
    ws.getCell('E5').value = 1;
    ws.getCell('H5').value = 0.4;
    ws.getCell('I5').value = 0.2;
    ws.getCell('J5').value = 0.2;
    ws.getCell('A6').value = 'Hamburg';
    ws.getCell('B6').value = 'FEW';
    ws.getCell('C6').value = new Date(Date.UTC(2026, 8, 2));
    ws.getCell('D6').value = '22:12';
    ws.getCell('I6').value = 0.1;
    ws.getCell('J6').value = 0.1;
    const buf = await wb.xlsx.writeBuffer();
    const result = await importFuelLogFromExcelBytes(buf as ArrayBuffer);
    expect(result.events.length).toBe(2);
    expect(result.events[0].kind).toBe('start_sea');
    expect(result.events[1].kind).toBe('arrival');
    expect(result.events[0].meMt).toBe(0.2);
  });

  it('keeps Drivers AE kWh as event total (does not divide by hours)', async () => {
    const wb = new ExcelJS.Workbook();
    const master = wb.addWorksheet('Fuel Log MASTER ');
    master.getCell('A5').value = 'Sea';
    master.getCell('B5').value = 'BOSP';
    master.getCell('C5').value = new Date(Date.UTC(2026, 8, 1));
    master.getCell('D5').value = '08:00';

    const drivers = wb.addWorksheet('VPC DRIVERS');
    drivers.getCell('A4').value = 'Sea';
    drivers.getCell('B4').value = 'BOSP';
    drivers.getCell('C4').value = new Date(Date.UTC(2026, 8, 1));
    drivers.getCell('D4').value = '08:00';
    // Col Q = AE1 hrs (Excel day fraction for 2.0 h), Col R = AE1 kWh total
    drivers.getCell('Q4').value = 2 / 24;
    drivers.getCell('R4').value = 400;
    drivers.getCell('S4').value = 1 / 24;
    drivers.getCell('T4').value = 150;
    drivers.getCell('U4').value = 0.5 / 24;
    drivers.getCell('V4').value = 80;

    const buf = await wb.xlsx.writeBuffer();
    const result = await importFuelLogFromExcelBytes(buf as ArrayBuffer);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].ae1Kw).toBe(400);
    expect(result.events[0].ae2Kw).toBe(150);
    expect(result.events[0].ae3Kw).toBe(80);
    expect(result.events[0].ae1Hours).toBe(2);
  });

  it('reads CENG AE kWh totals (not average kW columns)', async () => {
    const wb = new ExcelJS.Workbook();
    const master = wb.addWorksheet('Fuel Log MASTER ');
    master.getCell('A5').value = 'Sea';
    master.getCell('B5').value = 'BOSP';
    master.getCell('C5').value = new Date(Date.UTC(2026, 8, 1));
    master.getCell('D5').value = '08:00';

    const ceng = wb.addWorksheet('Fuel Log CENG');
    ceng.getCell('A3').value = 'Sea';
    ceng.getCell('B3').value = 'BOSP';
    ceng.getCell('C3').value = new Date(Date.UTC(2026, 8, 1));
    ceng.getCell('D3').value = '08:00';
    // AE1: U=kW avg, V=hrs, W=kWh total; AE2 Y/Z/AA; AE3 AC/AD/AE
    ceng.getCell('U3').value = 300;
    ceng.getCell('V3').value = 1.4;
    ceng.getCell('W3').value = 420;
    ceng.getCell('Y3').value = 300;
    ceng.getCell('Z3').value = 1.4;
    ceng.getCell('AA3').value = 420;
    ceng.getCell('AC3').value = 400;
    ceng.getCell('AD3').value = 24;
    ceng.getCell('AE3').value = 9600;

    const buf = await wb.xlsx.writeBuffer();
    const result = await importFuelLogFromExcelBytes(buf as ArrayBuffer);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].ae1Kw).toBe(420);
    expect(result.events[0].ae2Kw).toBe(420);
    expect(result.events[0].ae3Kw).toBe(9600);
    expect(result.events[0].ae1Hours).toBe(1.4);
  });
});
