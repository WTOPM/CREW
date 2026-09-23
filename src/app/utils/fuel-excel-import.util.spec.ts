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

  it('reads MASTER S1–AC4 summary block', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Fuel Log MASTER ');
    ws.getCell('S1').value = 'AUX';
    ws.getCell('T1').value = 'KW';
    ws.getCell('U1').value = 'RH';
    ws.getCell('V1').value = 'KG';
    ws.getCell('W1').value = 'MT';
    ws.getCell('X1').value = 'ULSFO';
    ws.getCell('Y1').value = 'DMA';
    ws.getCell('Z1').value = 'Sludge';
    ws.getCell('AA1').value = 'Bilge';
    ws.getCell('AB1').value = 'SEW';
    ws.getCell('AC1').value = 'LO';
    ws.getCell('S2').value = 'AE 1';
    ws.getCell('T2').value = 200;
    ws.getCell('U2').value = 1.2;
    ws.getCell('V2').value = 55.2;
    ws.getCell('W2').value = 0.17;
    ws.getCell('X2').value = 439.5;
    ws.getCell('Y2').value = 73.9;
    ws.getCell('Z2').value = 14.6;
    ws.getCell('AA2').value = 1.6;
    ws.getCell('AB2').value = 2.0;
    ws.getCell('AC2').value = 36982;
    ws.getCell('S3').value = 'AE 2';
    ws.getCell('T3').value = 200;
    ws.getCell('U3').value = 1.2;
    ws.getCell('V3').value = 55.2;
    ws.getCell('X3').value = 'Updated';
    ws.getCell('S4').value = 'AE 3';
    ws.getCell('T4').value = 200;
    ws.getCell('U4').value = 1.2;
    ws.getCell('V4').value = 55.2;
    ws.getCell('X4').value = '13.09.2026 - HAMBURG';
    ws.mergeCells('W2:W4');
    ws.mergeCells('X3:AC3');
    ws.mergeCells('X4:AC4');
    ws.getCell('A5').value = 'Sea';
    ws.getCell('B5').value = 'BOSP';
    ws.getCell('C5').value = new Date(Date.UTC(2026, 8, 1));
    ws.getCell('D5').value = '08:00';

    const buf = await wb.xlsx.writeBuffer();
    const result = await importFuelLogFromExcelBytes(buf as ArrayBuffer);
    expect(result.masterSummary?.heading).toBe('AUX');
    expect(result.masterSummary?.aeRows[0]).toMatchObject({
      label: 'AE 1',
      kw: '200',
      rh: '1,2',
      kg: '55,2',
    });
    expect(result.masterSummary?.mt).toBe('0,17');
    expect(result.masterSummary?.tankHeaders).toEqual([
      'ULSFO',
      'DMA',
      'Sludge',
      'Bilge',
      'SEW',
      'LO',
    ]);
    expect(result.masterSummary?.tankValues[0]).toBe('439,5');
    expect(result.masterSummary?.tankValues[5]).toBe('36982');
    expect(result.masterSummary?.tankStatus).toBe('Updated');
    expect(result.masterSummary?.tankNote).toBe('13.09.2026 - HAMBURG');
  });

  it('reads CENG AE kWh totals and counters', async () => {
    const wb = new ExcelJS.Workbook();
    const master = wb.addWorksheet('Fuel Log MASTER ');
    master.getCell('A5').value = 'Sea';
    master.getCell('B5').value = 'BOSP';
    master.getCell('C5').value = new Date(Date.UTC(2026, 8, 1));
    master.getCell('D5').value = '08:00';
    master.getCell('F5').value = 100;
    master.getCell('G5').value = 1.2;

    const ceng = wb.addWorksheet('Fuel Log CENG');
    ceng.getCell('A3').value = 'Sea';
    ceng.getCell('B3').value = 'BOSP';
    ceng.getCell('C3').value = new Date(Date.UTC(2026, 8, 1));
    ceng.getCell('D3').value = '08:00';
    ceng.getCell('N3').value = 80000;
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
    expect(result.events[0].fmMeAe).toBe(100);
    expect(result.events[0].totalM3).toBe(1.2);
    expect(result.events[0].meCounterRh).toBe(80000);
    expect(result.events[0].ae1Kw).toBe(420);
    expect(result.events[0].ae2Kw).toBe(420);
    expect(result.events[0].ae3Kw).toBe(9600);
    expect(result.events[0].ae1Hours).toBe(1.4);
  });
});
