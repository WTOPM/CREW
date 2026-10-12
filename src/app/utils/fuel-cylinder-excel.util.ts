import ExcelJS from 'exceljs';
import {
  DEFAULT_FUEL_CYLINDER_FM_FACTOR,
  createEmptyFuelCylinderRow,
  normalizeFuelCylinderFactor,
  recomputeFuelCylinderChain,
  type FuelCylinderRow,
} from '../models/fuel.models';

export interface FuelCylinderExcelImportResult {
  rows: FuelCylinderRow[];
  factor: number;
  sheetName: string;
  warnings: string[];
}

export interface FuelCylinderExcelWriteResult {
  bytes: Uint8Array;
  written: FuelCylinderRow[];
}

/** Locate Cyl. Oil Consump. / Cylinder sheet. */
export function findCylinderWorksheet(wb: ExcelJS.Workbook): ExcelJS.Worksheet | undefined {
  return (
    wb.worksheets.find((s) => /cyl\.?\s*oil/i.test(s.name)) ??
    wb.worksheets.find((s) => /cylinder/i.test(s.name)) ??
    wb.worksheets.find((s) => /cylin/i.test(s.name))
  );
}

export async function importFuelCylinderFromExcelBytes(
  bytes: ArrayBuffer | Uint8Array,
): Promise<FuelCylinderExcelImportResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes as ExcelJS.Buffer);
  const sheet = findCylinderWorksheet(wb);
  if (!sheet) {
    return {
      rows: [],
      factor: DEFAULT_FUEL_CYLINDER_FM_FACTOR,
      sheetName: '',
      warnings: ['Sheet "Cyl. Oil Consump." not found'],
    };
  }
  const factor = detectCylinderFactor(sheet);
  const warnings: string[] = [];
  const rawRows: FuelCylinderRow[] = [];

  const lastScan = Math.max(sheet.actualRowCount || 0, sheet.rowCount || 0, 3);
  let emptyStreak = 0;
  for (let r = 3; r <= lastScan; r++) {
    const row = sheet.getRow(r);
    const { date, time } = readDateTime(row.getCell(1));
    const place = cellText(row.getCell(2));
    const flowmeter = cellNum(row.getCell(4));
    const litersUsed = cellNum(row.getCell(7));
    const receiveLiters = cellNum(row.getCell(9));
    const hours = cellNum(row.getCell(3));
    const litersCalc = cellNum(row.getCell(6));
    const robLiters = cellNum(row.getCell(8));
    // Keep rows that have any real data (skip empty template tail).
    if (!date && !place && flowmeter == null && litersUsed == null) {
      emptyStreak += 1;
      if (emptyStreak >= 8) break;
      continue;
    }
    emptyStreak = 0;
    rawRows.push(
      createEmptyFuelCylinderRow({
        id: `cyl-r${r}`,
        sourceRow: r,
        date,
        time: time || '12:00',
        place,
        hours,
        flowmeter,
        litersCalc,
        litersUsed,
        robLiters,
        receiveLiters,
        writeStatus: 'synced',
      }),
    );
  }

  if (!rawRows.length) {
    warnings.push('Cyl. Oil Consump. has no data rows');
  }

  return {
    rows: recomputeFuelCylinderChain(rawRows, factor),
    factor,
    sheetName: sheet.name.trim(),
    warnings,
  };
}

/**
 * Write ready CYL rows: inputs A/B/D/E/G/I only; refresh C/F/H formula caches.
 * Preserves shared formulas (same strategy as Fuel Log MASTER write).
 */
export async function writeFuelCylinderToExcelBytes(
  bytes: ArrayBuffer | Uint8Array,
  events: readonly FuelCylinderRow[],
  factor: number = DEFAULT_FUEL_CYLINDER_FM_FACTOR,
): Promise<FuelCylinderExcelWriteResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes as ExcelJS.Buffer);
  const sheet = findCylinderWorksheet(wb);
  if (!sheet) {
    throw new Error('Sheet "Cyl. Oil Consump." not found');
  }
  const f = normalizeFuelCylinderFactor(factor);
  const chain = recomputeFuelCylinderChain(events, f);

  let nextRow = 3;
  for (let r = 3; r <= Math.max(sheet.actualRowCount, 3); r++) {
    const place = cellText(sheet.getRow(r).getCell(2));
    const fm = cellNum(sheet.getRow(r).getCell(4));
    const { date } = readDateTime(sheet.getRow(r).getCell(1));
    if (date || place || fm != null) nextRow = r + 1;
  }

  const written: FuelCylinderRow[] = [];
  for (const ev of chain) {
    const isNew = !(ev.sourceRow >= 3);
    const rowNum = isNew ? nextRow++ : ev.sourceRow;
    writeCylinderRow(sheet, rowNum, ev, f);
    written.push(
      createEmptyFuelCylinderRow({
        ...ev,
        sourceRow: rowNum,
        writeStatus: 'synced',
      }),
    );
  }

  // Recompute chain with assigned sourceRows for consistent ROB display.
  const recomputed = recomputeFuelCylinderChain(written, f);
  const out = await wb.xlsx.writeBuffer();
  return { bytes: new Uint8Array(out as ArrayBuffer), written: recomputed };
}

function writeCylinderRow(
  sheet: ExcelJS.Worksheet,
  rowNum: number,
  e: FuelCylinderRow,
  factor: number,
): void {
  const row = sheet.getRow(rowNum);
  setDateTime(row.getCell(1), e.date, e.time);
  setText(row.getCell(2), e.place);
  // C hours — formula or seed value
  patchOrSetNumber(row.getCell(3), e.hours);
  setNumber(row.getCell(4), e.flowmeter);
  setNumber(row.getCell(5), e.flowmeter); // merged D:E
  patchOrSetNumber(row.getCell(6), e.litersCalc);
  setNumber(row.getCell(7), e.litersUsed);
  // H ROB — prefer I-aware formula cache
  const hCell = row.getCell(8);
  if (cellHasFormula(hCell)) {
    patchFormulaResult(hCell, e.robLiters);
  } else {
    setNumber(hCell, e.robLiters);
  }
  if (e.receiveLiters != null && e.receiveLiters > 0) {
    setNumber(row.getCell(9), e.receiveLiters);
    // Ensure H formula includes +I when receive is set (Excel R71 pattern).
    ensureRobFormulaWithReceive(hCell, rowNum);
  } else if (!cellHasFormula(row.getCell(9))) {
    // Leave empty I; do not clear unrelated notes
  }
  void factor;
}

function ensureRobFormulaWithReceive(cell: ExcelJS.Cell, rowNum: number): void {
  if (rowNum <= 3) return;
  const prev = rowNum - 1;
  const wanted = `IF(A${rowNum}>0,H${prev}-G${rowNum}," ")+I${rowNum}`;
  if (cellHasFormula(cell)) {
    const cur = String(
      (cell.value as ExcelJS.CellFormulaValue)?.formula ??
        (cell.value as ExcelJS.CellSharedFormulaValue)?.sharedFormula ??
        '',
    );
    if (/I\d+/i.test(cur) || /\+\s*\d+/.test(cur)) {
      // Already has receive term (I or hardcoded) — only patch result elsewhere.
      return;
    }
    const prevResult = (cell.value as { result?: string | number | boolean | Date })?.result;
    cell.value = { formula: wanted, result: prevResult };
    return;
  }
  cell.value = { formula: wanted };
}

function detectCylinderFactor(sheet: ExcelJS.Worksheet): number {
  for (let r = 4; r <= Math.min(sheet.actualRowCount, 40); r++) {
    const v = sheet.getRow(r).getCell(6).value;
    if (v && typeof v === 'object' && 'formula' in v && typeof v.formula === 'string') {
      const m = v.formula.match(/\*\s*([0-9]+(?:\.[0-9]+)?)\s*\)\s*\/\s*1000/i);
      if (m) return normalizeFuelCylinderFactor(Number(m[1]));
    }
  }
  return DEFAULT_FUEL_CYLINDER_FM_FACTOR;
}

function readDateTime(cell: ExcelJS.Cell): { date: string; time: string } {
  const v = resolveCell(cell);
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    // Excel stores noon as UTC midday often — use UTC components for ISO date.
    const y = v.getUTCFullYear();
    const mo = String(v.getUTCMonth() + 1).padStart(2, '0');
    const d = String(v.getUTCDate()).padStart(2, '0');
    const hh = String(v.getUTCHours()).padStart(2, '0');
    const mm = String(v.getUTCMinutes()).padStart(2, '0');
    return { date: `${y}-${mo}-${d}`, time: `${hh}:${mm}` };
  }
  const s = String(v ?? '').trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (iso) {
    const time =
      iso[4] != null ? `${String(iso[4]).padStart(2, '0')}:${iso[5]}` : '12:00';
    return { date: `${iso[1]}-${iso[2]}-${iso[3]}`, time };
  }
  const dmy = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (dmy) {
    const date = `${dmy[3]}-${String(dmy[2]).padStart(2, '0')}-${String(dmy[1]).padStart(2, '0')}`;
    const time =
      dmy[4] != null ? `${String(dmy[4]).padStart(2, '0')}:${dmy[5]}` : '12:00';
    return { date, time };
  }
  return { date: '', time: '' };
}

function resolveCell(cell: ExcelJS.Cell): unknown {
  const v = cell.value;
  if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
    if ('result' in v) return (v as { result: unknown }).result;
    if ('richText' in v) {
      return (v as ExcelJS.CellRichTextValue).richText.map((t) => t.text).join('');
    }
    if ('text' in v) return (v as ExcelJS.CellHyperlinkValue).text;
  }
  return v;
}

function cellText(cell: ExcelJS.Cell): string {
  const v = resolveCell(cell);
  if (v == null || v instanceof Date) return '';
  if (typeof v === 'object') return '';
  return String(v).replace(/\s+/g, ' ').trim();
}

function cellNum(cell: ExcelJS.Cell): number | null {
  const v = resolveCell(cell);
  if (v == null || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (v instanceof Date) return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function cellHasFormula(cell: ExcelJS.Cell): boolean {
  const v = cell.value;
  return !!(
    v &&
    typeof v === 'object' &&
    ('formula' in v || 'sharedFormula' in v)
  );
}

function patchFormulaResult(cell: ExcelJS.Cell, result: unknown): void {
  const v = cell.value;
  if (!v || typeof v !== 'object') return;
  if ('formula' in v) {
    cell.value = { formula: (v as ExcelJS.CellFormulaValue).formula!, result: result as never };
  } else if ('sharedFormula' in v) {
    cell.value = {
      sharedFormula: (v as ExcelJS.CellSharedFormulaValue).sharedFormula!,
      result: result as never,
    };
  }
}

function patchOrSetNumber(cell: ExcelJS.Cell, n: number | null): void {
  if (cellHasFormula(cell)) {
    patchFormulaResult(cell, n);
    return;
  }
  setNumber(cell, n);
}

function setNumber(cell: ExcelJS.Cell, n: number | null | undefined): void {
  if (cellHasFormula(cell)) {
    patchFormulaResult(cell, n ?? null);
    return;
  }
  cell.value = n == null || !Number.isFinite(n) ? null : n;
}

function setText(cell: ExcelJS.Cell, text: string): void {
  if (cellHasFormula(cell)) {
    patchFormulaResult(cell, text || null);
    return;
  }
  cell.value = text?.trim() ? text.trim() : null;
}

function setDateTime(cell: ExcelJS.Cell, dateIso: string, timeHm: string): void {
  const m = String(dateIso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    if (cellHasFormula(cell)) patchFormulaResult(cell, dateIso || null);
    else cell.value = dateIso?.trim() ? dateIso : null;
    return;
  }
  const tm = String(timeHm ?? '').match(/^(\d{1,2}):(\d{2})$/);
  const hh = tm ? Number(tm[1]) : 12;
  const mm = tm ? Number(tm[2]) : 0;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), hh, mm, 0));
  if (cellHasFormula(cell)) {
    patchFormulaResult(cell, d);
    return;
  }
  cell.value = d;
  cell.numFmt = 'dd.mm.yyyy hh:mm';
}
