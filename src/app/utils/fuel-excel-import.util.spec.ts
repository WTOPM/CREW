import { describe, expect, it } from 'vitest';
import { importFuelLogFromExcelBytes, writeFuelLogToExcelBytes } from './fuel-excel-import.util';
import ExcelJS from 'exceljs';
import { createEmptyFuelLogEvent } from '../models/fuel.models';

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

  it('reads machinery from FO-VPC sheet named ENGINE LOG', async () => {
    const wb = new ExcelJS.Workbook();
    const master = wb.addWorksheet('Fuel Log MASTER ');
    master.getCell('A5').value = 'Sea';
    master.getCell('B5').value = 'BOSP';
    master.getCell('C5').value = new Date(Date.UTC(2026, 8, 1));
    master.getCell('D5').value = '08:00';

    const ceng = wb.addWorksheet('ENGINE LOG');
    ceng.getCell('A3').value = 'Sea';
    ceng.getCell('B3').value = 'BOSP';
    ceng.getCell('C3').value = new Date(Date.UTC(2026, 8, 1));
    ceng.getCell('D3').value = '08:00';
    ceng.getCell('N3').value = 80000;
    ceng.getCell('O3').value = 123456;
    ceng.getCell('P3').value = 7890;
    ceng.getCell('W3').value = 420;

    const buf = await wb.xlsx.writeBuffer();
    const result = await importFuelLogFromExcelBytes(buf as ArrayBuffer);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].meCounterRh).toBe(80000);
    expect(result.events[0].meShapoliRev).toBe(123456);
    expect(result.events[0].meShapoliKwh).toBe(7890);
    expect(result.events[0].ae1Kw).toBe(420);
    expect(result.warnings.some((w) => /ENGINE LOG|CENG|CE LOG/i.test(w))).toBe(false);
  });

  it('reads machinery from FO-VPC sheet named CE LOG', async () => {
    const wb = new ExcelJS.Workbook();
    const master = wb.addWorksheet('Fuel Log MASTER ');
    master.getCell('A5').value = 'Sea';
    master.getCell('B5').value = 'BOSP';
    master.getCell('C5').value = new Date(Date.UTC(2026, 8, 1));
    master.getCell('D5').value = '08:00';

    const ceng = wb.addWorksheet('CE LOG');
    ceng.getCell('A3').value = 'Sea';
    ceng.getCell('B3').value = 'BOSP';
    ceng.getCell('C3').value = new Date(Date.UTC(2026, 8, 1));
    ceng.getCell('D3').value = '08:00';
    ceng.getCell('N3').value = 80000;
    ceng.getCell('O3').value = 123456;
    ceng.getCell('P3').value = 7890;
    ceng.getCell('W3').value = 420;

    const buf = await wb.xlsx.writeBuffer();
    const result = await importFuelLogFromExcelBytes(buf as ArrayBuffer);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].meCounterRh).toBe(80000);
    expect(result.events[0].meShapoliRev).toBe(123456);
    expect(result.events[0].meShapoliKwh).toBe(7890);
    expect(result.events[0].ae1Kw).toBe(420);
    expect(result.warnings.some((w) => /CE LOG|CENG/i.test(w))).toBe(false);
  });

  it('parses Excel serial date/time as UTC clock', async () => {
    const wb = new ExcelJS.Workbook();
    const master = wb.addWorksheet('Fuel Log MASTER ');
    // 2026-09-01 + 06:00 as serial (Excel day 0 = 1899-12-30)
    const day = Math.round((Date.UTC(2026, 8, 1) - Date.UTC(1899, 11, 30)) / 86400000);
    master.getCell('A5').value = 'Sea';
    master.getCell('B5').value = 'BOSP';
    master.getCell('C5').value = day;
    master.getCell('D5').value = 0.25; // 06:00

    const ceng = wb.addWorksheet('CE LOG');
    ceng.getCell('A3').value = 'Sea';
    ceng.getCell('B3').value = 'BOSP';
    ceng.getCell('C3').value = day;
    ceng.getCell('D3').value = 0.25;
    ceng.getCell('N3').value = 42;

    const buf = await wb.xlsx.writeBuffer();
    const result = await importFuelLogFromExcelBytes(buf as ArrayBuffer);
    expect(result.events[0].date).toBe('2026-09-01');
    expect(result.events[0].time).toBe('06:00');
    expect(result.events[0].meCounterRh).toBe(42);
  });

  it('skips incomplete rows and drops stale negative formula caches', async () => {
    const wb = new ExcelJS.Workbook();
    const master = wb.addWorksheet('Fuel Log MASTER ');
    // Complete prior row
    master.getCell('A5').value = 'Kopenhagen';
    master.getCell('B5').value = 'FEW';
    master.getCell('C5').value = new Date(Date.UTC(2026, 8, 27));
    master.getCell('D5').value = '10:30';
    master.getCell('F5').value = 4343.7;
    master.getCell('G5').value = 0.5;
    master.getCell('L5').value = 259.1;

    // Noon with time but no FM — Excel often caches Fₙ−Fₙ₋₁ as −FM_prev
    master.getCell('A6').value = 'Kopenhagen';
    master.getCell('B6').value = 'Noon';
    master.getCell('C6').value = new Date(Date.UTC(2026, 8, 27));
    master.getCell('D6').value = '12:00';
    master.getCell('G6').value = { formula: 'F6-F5', result: -4343.7 };
    master.getCell('H6').value = { formula: 'H5', result: -3822.5 };
    master.getCell('L6').value = { formula: 'L5', result: 4081.55 };
    master.getCell('O6').value = { formula: 'O5', result: 130.6 };

    // Draft SBE without time — must be skipped
    master.getCell('A7').value = 'Kopenhagen';
    master.getCell('B7').value = 'SBE';
    master.getCell('C7').value = new Date(Date.UTC(2026, 8, 27));
    master.getCell('L7').value = { formula: 'L6', result: 4081.55 };

    const buf = await wb.xlsx.writeBuffer();
    const result = await importFuelLogFromExcelBytes(buf as ArrayBuffer);
    expect(result.events).toHaveLength(2);
    expect(result.events[1].rawEvent).toBe('Noon');
    expect(result.events[1].fmMeAe).toBeNull();
    expect(result.events[1].totalM3).toBeNull();
    expect(result.events[1].totalMt).toBeNull();
    expect(result.events[1].robB100Mt).toBeNull();
    expect(result.events[1].robDmaMt).toBeNull();
    expect(result.warnings.some((w) => /no time/i.test(w))).toBe(true);
  });
  it('prefers CENG fuel values over MASTER when both exist; MASTER supplies bunker only', async () => {
    const wb = new ExcelJS.Workbook();
    const master = wb.addWorksheet('Fuel Log MASTER ');
    master.getCell('A5').value = 'Sea';
    master.getCell('B5').value = 'BOSP';
    master.getCell('C5').value = new Date(Date.UTC(2026, 8, 1));
    master.getCell('D5').value = '08:00';
    master.getCell('F5').value = 100; // stale MASTER FM
    master.getCell('G5').value = 1.0;
    master.getCell('M5').value = 12.5; // bunker RMD/BIO — MASTER-only
    master.getCell('N5').value = 3.2; // bunker DMA

    const ceng = wb.addWorksheet('ENGINE LOG');
    ceng.getCell('A3').value = 'Sea';
    ceng.getCell('B3').value = 'BOSP';
    ceng.getCell('C3').value = new Date(Date.UTC(2026, 8, 1));
    ceng.getCell('D3').value = '08:00';
    ceng.getCell('F3').value = 110; // authoritative CENG FM
    ceng.getCell('G3').value = 1.5;
    ceng.getCell('N3').value = 90000;

    const buf = await wb.xlsx.writeBuffer();
    const result = await importFuelLogFromExcelBytes(buf as ArrayBuffer);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].fmMeAe).toBe(110);
    expect(result.events[0].totalM3).toBe(1.5);
    expect(result.events[0].bunkerRmdBioMt).toBe(12.5);
    expect(result.events[0].bunkerDmaMt).toBe(3.2);
    expect(result.events[0].meCounterRh).toBe(90000);
  });

  it('imports CENG-only rows that MASTER does not have', async () => {
    const wb = new ExcelJS.Workbook();
    const master = wb.addWorksheet('Fuel Log MASTER ');
    master.getCell('A5').value = 'Sea';
    master.getCell('B5').value = 'BOSP';
    master.getCell('C5').value = new Date(Date.UTC(2026, 8, 1));
    master.getCell('D5').value = '08:00';
    master.getCell('F5').value = 100;

    const ceng = wb.addWorksheet('ENGINE LOG');
    ceng.getCell('A3').value = 'Sea';
    ceng.getCell('B3').value = 'BOSP';
    ceng.getCell('C3').value = new Date(Date.UTC(2026, 8, 1));
    ceng.getCell('D3').value = '08:00';
    ceng.getCell('F3').value = 100;
    ceng.getCell('A4').value = 'Sea';
    ceng.getCell('B4').value = 'Noon';
    ceng.getCell('C4').value = new Date(Date.UTC(2026, 8, 1));
    ceng.getCell('D4').value = '12:00';
    ceng.getCell('F4').value = 105;
    ceng.getCell('G4').value = 5;

    const buf = await wb.xlsx.writeBuffer();
    const result = await importFuelLogFromExcelBytes(buf as ArrayBuffer);
    expect(result.events).toHaveLength(2);
    expect(result.events.map((e) => e.rawEvent)).toEqual(['BOSP', 'Noon']);
    expect(result.events[1].fmMeAe).toBe(105);
  });
});

describe('writeFuelLogToExcelBytes', () => {
  it('writes over shared-formula columns without crashing', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Fuel Log MASTER');
    for (let r = 1; r <= 8; r++) ws.addRow([]);

    ws.getCell('A5').value = 'Sea';
    ws.getCell('B5').value = 'BOSP';
    ws.getCell('C5').value = new Date(Date.UTC(2026, 9, 1));
    ws.getCell('D5').value = '08:00';
    ws.getCell('P5').value = { formula: '10', result: 0.4 };

    // Shared formula clone (ExcelJS style) — accessing cell.formula used to throw.
    ws.getCell('A6').value = 'Sea';
    ws.getCell('B6').value = 'Noon';
    ws.getCell('C6').value = new Date(Date.UTC(2026, 9, 1));
    ws.getCell('D6').value = '12:00';
    ws.getCell('P6').value = { sharedFormula: 'P5', result: 0.3 };

    const buf = await wb.xlsx.writeBuffer();
    const events = [
      createEmptyFuelLogEvent({
        id: '1',
        place: 'Sea',
        rawEvent: 'BOSP',
        date: '2026-10-01',
        time: '08:00',
        boilerMt: null,
        sourceRow: 5,
      }),
      createEmptyFuelLogEvent({
        id: '2',
        place: 'Sea',
        rawEvent: 'Noon',
        date: '2026-10-01',
        time: '12:00',
        boilerMt: 0.5,
        meMt: 1,
        aeMt: 0.2,
        robB100Mt: 100,
        sourceRow: 6,
      }),
    ];

    const out = await writeFuelLogToExcelBytes(buf as ArrayBuffer, events);
    expect(out.byteLength).toBeGreaterThan(1000);

    const roundTrip = await importFuelLogFromExcelBytes(out.buffer as ArrayBuffer);
    expect(roundTrip.events.some((e) => e.rawEvent === 'Noon' && e.boilerMt === 0.5)).toBe(true);
  });
});
