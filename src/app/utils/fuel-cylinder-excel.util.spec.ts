import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import {
  DEFAULT_FUEL_CYLINDER_FM_FACTOR,
  recomputeFuelCylinderChain,
  createEmptyFuelCylinderRow,
} from '../models/fuel.models';
import {
  importFuelCylinderFromExcelBytes,
  writeFuelCylinderToExcelBytes,
} from './fuel-cylinder-excel.util';

async function buildSampleWorkbook(): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Cyl. Oil Consump.');
  ws.getCell('A1').value = 'DATE and TIME';
  ws.getCell('B1').value = 'Ship';
  ws.getCell('C1').value = 'HR';
  ws.getCell('D1').value = 'Cyl Oil';
  ws.getCell('G1').value = 'Ltrs';
  ws.getCell('H1').value = 'Cyl Oil';
  ws.getCell('A3').value = new Date(Date.UTC(2026, 1, 1, 12, 0));
  ws.getCell('B3').value = 'Riga';
  ws.getCell('C3').value = 24;
  ws.getCell('D3').value = 1000;
  ws.getCell('E3').value = 1000;
  ws.getCell('F3').value = 0;
  ws.getCell('G3').value = 0.1;
  ws.getCell('H3').value = 5000;
  ws.getCell('A4').value = new Date(Date.UTC(2026, 1, 2, 12, 0));
  ws.getCell('B4').value = 'Sea';
  ws.getCell('C4').value = {
    formula: 'IF(A4>0,((A4-A3)*24)," ")',
    result: 24,
  };
  ws.getCell('D4').value = 1000 + 10000;
  ws.getCell('E4').value = 1000 + 10000;
  ws.getCell('F4').value = {
    formula: 'IF(D4-D3>0,((D4-D3)*0.5345379)/1000," ")',
    result: (10000 * 0.5345379) / 1000,
  };
  ws.getCell('G4').value = 5;
  ws.getCell('H4').value = {
    formula: 'IF(A4>0,H3-G4," ")',
    result: 4995,
  };
  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer);
}

describe('fuel-cylinder-excel.util', () => {
  it('recomputes hours / calc liters / ROB like Excel', () => {
    const rows = recomputeFuelCylinderChain(
      [
        createEmptyFuelCylinderRow({
          id: 'a',
          sourceRow: 3,
          date: '2026-02-01',
          time: '12:00',
          place: 'Riga',
          flowmeter: 1000,
          litersUsed: 0.1,
          robLiters: 5000,
        }),
        createEmptyFuelCylinderRow({
          id: 'b',
          sourceRow: 4,
          date: '2026-02-02',
          time: '12:00',
          place: 'Sea',
          flowmeter: 11000,
          litersUsed: 5,
        }),
      ],
      DEFAULT_FUEL_CYLINDER_FM_FACTOR,
    );
    expect(rows[1]!.hours).toBe(24);
    expect(rows[1]!.litersCalc).toBeCloseTo((10000 * DEFAULT_FUEL_CYLINDER_FM_FACTOR) / 1000, 5);
    expect(rows[1]!.robLiters).toBe(4995);
  });

  it('imports Cyl. Oil Consump. and preserves factor', async () => {
    const bytes = await buildSampleWorkbook();
    const result = await importFuelCylinderFromExcelBytes(bytes);
    expect(result.warnings).toEqual([]);
    expect(result.factor).toBe(DEFAULT_FUEL_CYLINDER_FM_FACTOR);
    expect(result.rows.length).toBe(2);
    expect(result.rows[0]!.place).toBe('Riga');
    expect(result.rows[1]!.place).toBe('Sea');
    expect(result.rows[1]!.flowmeter).toBe(11000);
    expect(result.rows[1]!.litersUsed).toBe(5);
  });

  it('writes inputs without destroying F formula', async () => {
    const bytes = await buildSampleWorkbook();
    const imported = await importFuelCylinderFromExcelBytes(bytes);
    const ready = imported.rows.map((r) =>
      createEmptyFuelCylinderRow({
        ...r,
        litersUsed: (r.litersUsed ?? 0) + 1,
        writeStatus: 'ready',
      }),
    );
    const written = await writeFuelCylinderToExcelBytes(bytes, ready, imported.factor);
    expect(written.written).toHaveLength(2);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(written.bytes.buffer as ExcelJS.Buffer);
    const ws = wb.getWorksheet('Cyl. Oil Consump.')!;
    const f4 = ws.getCell('F4').value as ExcelJS.CellFormulaValue;
    expect(f4.formula).toMatch(/0\.5345379/);
    expect(ws.getCell('G4').value).toBe(6);
    expect(ws.getCell('B4').value).toBe('Sea');
  });
});
