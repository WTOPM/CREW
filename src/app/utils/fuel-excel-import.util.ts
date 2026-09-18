import ExcelJS from 'exceljs';
import {
  classifyFuelEvent,
  type FuelLogEvent,
} from '../models/fuel.models';

export interface FuelExcelImportResult {
  events: FuelLogEvent[];
  sheetName: string;
  warnings: string[];
}

/** Parse FO-VPC / SHAPOLI workbook (MASTER + CENG + VPC DRIVERS machinery). */
export async function importFuelLogFromExcelBytes(
  bytes: ArrayBuffer | Uint8Array,
): Promise<FuelExcelImportResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes as ExcelJS.Buffer);
  const master =
    wb.worksheets.find((s) => /fuel\s*log\s*master/i.test(s.name)) ??
    wb.worksheets.find((s) => /master/i.test(s.name));
  if (!master) {
    throw new Error('Sheet "Fuel Log MASTER" not found');
  }

  const ceng = wb.worksheets.find((s) => /fuel\s*log\s*ceng/i.test(s.name));
  const drivers = wb.worksheets.find((s) => /vpc\s*drivers/i.test(s.name));
  // Prefer CENG (kept up to date). VPC DRIVERS is a VPS-shaped mirror and may be stale / removed.
  const cengIndex = ceng ? indexCengRows(ceng) : emptyMachIndex();
  const driversIndex = drivers ? indexDriversRows(drivers) : emptyMachIndex();

  const events: FuelLogEvent[] = [];
  const warnings: string[] = [];
  // MASTER data starts at row 5 (rows 1–4 are headers).
  for (let r = 5; r <= master.rowCount; r++) {
    const row = master.getRow(r);
    const place = cellText(row.getCell(1));
    const rawEvent = cellText(row.getCell(2));
    if (!place && !rawEvent) continue;

    const date = cellDateIso(row.getCell(3));
    const time = cellTimeHm(row.getCell(4));
    if (!date) {
      warnings.push(`Row ${r}: skipped (no date)`);
      continue;
    }

    const kind = classifyFuelEvent(rawEvent);
    const mach =
      lookupMach(cengIndex, date, time, place, rawEvent) ??
      lookupMach(driversIndex, date, time, place, rawEvent);

    events.push({
      id: `fuel-${date}-${time.replace(':', '')}-${r}`,
      place,
      rawEvent,
      kind,
      date,
      time,
      // Excel Fuel Log uses numFmt 0.0 for hours + mt
      timeUsedHours: cellNum1(row.getCell(5)),
      totalMt: cellNum1(row.getCell(8)),
      meMt: cellNum1(row.getCell(9)),
      aeMt: cellNum1(row.getCell(10)),
      boilerMt: cellNum1(row.getCell(16)),
      robRmdMt: cellNum1(row.getCell(11)),
      robB100Mt: cellNum1(row.getCell(12)),
      robDmaMt: cellNum1(row.getCell(15)),
      meHours: mach?.meHours ?? null,
      meRpm: mach?.meRpm ?? null,
      meKw: mach?.meKw ?? null,
      ae1Hours: mach?.ae1Hours ?? null,
      ae1Kw: mach?.ae1Kw ?? null,
      ae2Hours: mach?.ae2Hours ?? null,
      ae2Kw: mach?.ae2Kw ?? null,
      ae3Hours: mach?.ae3Hours ?? null,
      ae3Kw: mach?.ae3Kw ?? null,
      boilerHours: mach?.boilerHours ?? null,
      sourceRow: r,
    });
  }

  return { events, sheetName: master.name.trim(), warnings };
}

interface MachExtras {
  meHours: number | null;
  meRpm: number | null;
  meKw: number | null;
  ae1Hours: number | null;
  ae1Kw: number | null;
  ae2Hours: number | null;
  ae2Kw: number | null;
  ae3Hours: number | null;
  ae3Kw: number | null;
  boilerHours: number | null;
}

interface MachIndex {
  byFull: Map<string, MachExtras>;
  byDateTime: Map<string, MachExtras>;
}

function emptyMachIndex(): MachIndex {
  return { byFull: new Map(), byDateTime: new Map() };
}

function putMach(index: MachIndex, date: string, time: string, place: string, rawEvent: string, extras: MachExtras): void {
  index.byFull.set(`${date}|${time}|${place}|${rawEvent}`, extras);
  const dt = `${date}|${time}`;
  if (!index.byDateTime.has(dt)) index.byDateTime.set(dt, extras);
}

function lookupMach(
  index: MachIndex,
  date: string,
  time: string,
  place: string,
  rawEvent: string,
): MachExtras | undefined {
  return (
    index.byFull.get(`${date}|${time}|${place}|${rawEvent}`) ??
    index.byDateTime.get(`${date}|${time}`)
  );
}

/** Fuel Log CENG — ME RPM/kW + AE1–3 hrs/kW + boiler hrs. */
function indexCengRows(ws: ExcelJS.Worksheet): MachIndex {
  const index = emptyMachIndex();
  for (let r = 3; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const place = cellText(row.getCell(1));
    const rawEvent = cellText(row.getCell(2));
    const date = cellDateIso(row.getCell(3));
    const time = cellTimeHm(row.getCell(4));
    if (!date || (!place && !rawEvent)) continue;
    putMach(index, date, time, place, rawEvent, {
      meHours: cellNum1(row.getCell(17)),
      meRpm: cellNum1(row.getCell(18)),
      meKw: cellNum1(row.getCell(19)),
      ae1Hours: cellNum1(row.getCell(22)),
      // CENG AE “kW” col is average; use kWh (= kW × hrs) — total for the event.
      ae1Kw: cellNum1(row.getCell(23)),
      ae2Hours: cellNum1(row.getCell(26)),
      ae2Kw: cellNum1(row.getCell(27)),
      ae3Hours: cellNum1(row.getCell(30)),
      ae3Kw: cellNum1(row.getCell(31)),
      boilerHours: cellNum1(row.getCell(33)),
    });
  }
  return index;
}

/**
 * VPC DRIVERS — VPS-shaped machinery columns (hrs as Excel h:mm from CENG/24).
 * Prefer this sheet when matched; falls back to CENG.
 */
function indexDriversRows(ws: ExcelJS.Worksheet): MachIndex {
  const index = emptyMachIndex();
  // Headers rows 1–3; data from row 4.
  for (let r = 4; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const place = cellText(row.getCell(1));
    const rawEvent = cellText(row.getCell(2));
    const date = cellDateIso(row.getCell(3));
    const time = cellTimeHm(row.getCell(4));
    if (!date || (!place && !rawEvent)) continue;
    putMach(index, date, time, place, rawEvent, {
      meHours: cellHoursFromExcel(row.getCell(13)),
      meRpm: cellNum1(row.getCell(15)),
      meKw: cellNum1(row.getCell(16)),
      ae1Hours: cellHoursFromExcel(row.getCell(17)),
      // Drivers AE columns are total energy for the event (kWh) — keep as-is, do not ÷ hours.
      ae1Kw: cellNum1(row.getCell(18)),
      ae2Hours: cellHoursFromExcel(row.getCell(19)),
      ae2Kw: cellNum1(row.getCell(20)),
      ae3Hours: cellHoursFromExcel(row.getCell(21)),
      ae3Kw: cellNum1(row.getCell(22)),
      boilerHours: cellHoursFromExcel(row.getCell(23)),
    });
  }
  return index;
}

function cellText(cell: ExcelJS.Cell): string {
  const v = resolveCell(cell);
  if (v == null) return '';
  if (v instanceof Date) return '';
  return String(v).replace(/\s+/g, ' ').trim();
}

/** Round to 1 decimal — matches Excel Fuel Log `0.0` display (e.g. 2.3 not 2.25). */
function cellNum1(cell: ExcelJS.Cell): number | null {
  const v = resolveCell(cell);
  if (v == null || v === '') return null;
  let n: number;
  if (typeof v === 'number') n = v;
  else if (v instanceof Date) return null;
  else n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 10) / 10;
}

/**
 * VPC DRIVERS stores work hours as Excel time (h:mm) = hours/24.
 * Also accept plain numeric hours.
 */
function cellHoursFromExcel(cell: ExcelJS.Cell): number | null {
  const v = resolveCell(cell);
  if (v == null || v === '') return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    // ExcelJS may give UTC midnight-based date for time serials
    const hours = v.getUTCHours() + v.getUTCMinutes() / 60 + v.getUTCSeconds() / 3600;
    // Days past epoch base (e.g. 1900-01-01) mean >24h — use full day offset
    const dayMs = Date.UTC(1899, 11, 30);
    const extraDays = Math.round((v.getTime() - dayMs) / 86400000);
    const total = extraDays * 24 + hours;
    if (!Number.isFinite(total) || total < 0) return null;
    return Math.round(total * 10) / 10;
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    // Fraction of day (< 1) → hours; otherwise already hours
    const n = v > 0 && v < 1 ? v * 24 : v;
    return Math.round(n * 10) / 10;
  }
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : null;
}

function cellDateIso(cell: ExcelJS.Cell): string {
  const v = resolveCell(cell);
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    if (y < 1970) return '';
    return `${y}-${m}-${d}`;
  }
  const s = String(v ?? '').trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

function cellTimeHm(cell: ExcelJS.Cell): string {
  const v = resolveCell(cell);
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const hh = String(v.getHours()).padStart(2, '0');
    const mm = String(v.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }
  const s = String(v ?? '').trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
  return '';
}

function resolveCell(cell: ExcelJS.Cell): unknown {
  const v = cell?.value;
  if (v == null) return null;
  if (typeof v === 'object' && !(v instanceof Date)) {
    const o = v as {
      result?: unknown;
      text?: string;
      richText?: { text: string }[];
      formula?: string;
      sharedFormula?: string;
      error?: string;
    };
    if (o.result !== undefined) {
      if (o.result && typeof o.result === 'object' && 'error' in (o.result as object)) {
        return null;
      }
      return o.result;
    }
    if (o.richText) return o.richText.map((t) => t.text).join('');
    if (o.text) return o.text;
  }
  return v;
}
