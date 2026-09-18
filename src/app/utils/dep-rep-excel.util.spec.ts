import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { depRepMidDraftMetres, depRepSheetName, lookupDepRepLibraryDensity, normalizeDepRepLibrary } from '../models/dep-rep.models';
import {
  buildDepRepCellUpdates,
  lookupDepRepDensity,
  parseCargoTons,
  readDepRepDensityTable,
  readDepRepSheetSnapshot,
} from './dep-rep-excel.util';

describe('dep-rep helpers', () => {
  it('builds sheet names and mid draft', () => {
    expect(depRepSheetName('138', 'LVRIX')).toBe('138 LVRIX');
    expect(depRepMidDraftMetres('9.3', '9.4')).toBe('9.4');
    expect(depRepMidDraftMetres('9.2', '9.4')).toBe('9.3');
  });

  it('parses TOTAL CARGO with unit suffixes', () => {
    expect(parseCargoTons('14719')).toBe(14719);
    expect(parseCargoTons('14719 t')).toBe(14719);
    expect(parseCargoTons('14 719t')).toBe(14719);
    expect(parseCargoTons('1.5')).toBe(1.5);
    expect(parseCargoTons('')).toBeNull();
  });
});

describe('dep-rep densities', () => {
  it('normalizes and looks up POL density from app list', () => {
    const lib = normalizeDepRepLibrary({
      densities: [
        { port: 'lvrix', density: '1,000' },
        { port: 'FIHEL', density: '1.004' },
        { port: '', density: '9' },
      ],
    });
    expect(lib.densities).toEqual([
      { port: 'FIHEL', density: '1.004' },
      { port: 'LVRIX', density: '1.000' },
    ]);
    expect(lookupDepRepLibraryDensity(lib.densities, 'LVRIX')).toBe('1.000');
    expect(lookupDepRepLibraryDensity(lib.densities, 'zzzz')).toBe('');
  });
});

describe('buildDepRepCellUpdates', () => {
  it('fills voyage data cells and never touches density K:L', () => {
    const updates = buildDepRepCellUpdates({
      sheetName: '138 LVRIX',
      voyage: '138',
      polCode: 'LVRIX',
      podCode: 'DEBRV',
      departureDate: '2026-09-19',
      draftAft: '9.4',
      draftFore: '9.3',
      totalCargo: '14719 t',
      waterDensity: '1.025',
      classRows: [
        { dgClass: '6.1', totalKg: 20000 },
        { dgClass: '9', totalKg: 100.55 },
      ],
      heightKeelToMastTop: '46.7',
      mouldedDepth: '14.2',
    });

    const byAddr = new Map(updates.map((u) => [u.address, u]));
    expect(byAddr.get('B2')).toEqual({ address: 'B2', kind: 'text', value: 'LVRIX' });
    expect(byAddr.get('D2')).toEqual({ address: 'D2', kind: 'text', value: 'DEBRV' });
    expect(byAddr.get('F2')).toEqual({ address: 'F2', kind: 'text', value: '138' });
    expect(byAddr.get('B4')).toEqual({ address: 'B4', kind: 'date', iso: '2026-09-19' });
    expect(byAddr.get('B8')).toEqual({ address: 'B8', kind: 'number', value: 9.4 });
    expect(byAddr.get('D8')).toEqual({ address: 'D8', kind: 'number', value: 9.3 });
    expect(byAddr.get('F9')).toEqual({ address: 'F9', kind: 'number', value: 14719 });
    expect(byAddr.get('E6')).toEqual({ address: 'E6', kind: 'number', value: 1.025 });
    expect(byAddr.get('A11')).toEqual({ address: 'A11', kind: 'text', value: '6.1' });
    expect(byAddr.get('B11')).toEqual({ address: 'B11', kind: 'number', value: 20000 });
    expect(byAddr.get('B12')).toEqual({ address: 'B12', kind: 'number', value: 100.6 });
    expect(byAddr.get('H14')).toEqual({
      address: 'H14',
      kind: 'formula',
      formula: '46.7-B8',
    });
    expect(byAddr.get('C18')).toEqual({
      address: 'C18',
      kind: 'formula',
      formula: '14.2-C8',
    });

    for (const u of updates) {
      expect(u.address.startsWith('K')).toBe(false);
      expect(u.address.startsWith('L')).toBe(false);
    }
  });
});

describe('readDepRepSheetSnapshot', () => {
  it('returns missing when sheet name is absent', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('100 DEHAM');
    ws.getCell('B2').value = 'DEHAM';
    ws.getCell('F9').value = 1000;
    const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
    const snap = await readDepRepSheetSnapshot(buf, '138 LVRIX');
    expect(snap.exists).toBe(false);
  });

  it('loads TOTAL CARGO and drafts from an existing sheet', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('138 LVRIX');
    ws.getCell('B2').value = 'LVRIX';
    ws.getCell('D2').value = 'DEBRV';
    ws.getCell('F2').value = '138';
    ws.getCell('B4').value = new Date(Date.UTC(2026, 8, 19));
    ws.getCell('B8').value = 9.4;
    ws.getCell('D8').value = 9.3;
    ws.getCell('F9').value = 14719;
    ws.getCell('E6').value = 1;
    const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer;

    const snap = await readDepRepSheetSnapshot(buf, '138 LVRIX');
    expect(snap.exists).toBe(true);
    expect(snap.polCode).toBe('LVRIX');
    expect(snap.podCode).toBe('DEBRV');
    expect(snap.voyage).toBe('138');
    expect(snap.totalCargo).toBe('14719');
    expect(snap.draftAft).toBe('9.4');
    expect(snap.draftFore).toBe('9.3');
    expect(snap.density).toBe('1');
  });
});

describe('readDepRepDensityTable', () => {
  it('reads PORT/DENSITY from K:L without writing', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('100 DEHAM');
    ws.getCell('K6').value = 'PORT';
    ws.getCell('L6').value = 'DENSITY';
    ws.getCell('K7').value = 'LVRIX';
    ws.getCell('L7').value = 1;
    ws.getCell('K8').value = 'DEHAM';
    ws.getCell('L8').value = 1;
    ws.getCell('K9').value = 'FIHEL';
    ws.getCell('L9').value = 1.004;
    const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer;

    const table = await readDepRepDensityTable(buf);
    expect(lookupDepRepDensity(table, 'LVRIX')).toBe(1);
    expect(lookupDepRepDensity(table, 'deham')).toBe(1);
    expect(lookupDepRepDensity(table, 'FIHEL')).toBe(1.004);
    expect(lookupDepRepDensity(table, 'ZZZZ')).toBeNull();
  });
});
