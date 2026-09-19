import ExcelJS from 'exceljs';
import {
  classifyFuelEvent,
  createEmptyFuelLogEvent,
  type FuelLogEvent,
} from '../models/fuel.models';

export interface FuelExcelImportResult {
  events: FuelLogEvent[];
  sheetName: string;
  warnings: string[];
}

/** Parse FO-VPC / SHAPOLI workbook (MASTER A–R + CENG machinery). */
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
  // Prefer CENG (kept up to date). VPC DRIVERS intentionally ignored.
  const cengIndex = ceng ? indexCengRows(ceng) : emptyMachIndex();

  const events: FuelLogEvent[] = [];
  const warnings: string[] = [];
  // MASTER data starts at row 5 (rows 1–4 are headers). S1–AC4 summary ignored.
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
    const mach = lookupMach(cengIndex, date, time, place, rawEvent);

    events.push(
      createEmptyFuelLogEvent({
        id: `fuel-${date}-${time.replace(':', '')}-${r}`,
        place,
        rawEvent,
        kind,
        date,
        time,
        // Excel Fuel Log uses numFmt 0.0 for hours + mt
        timeUsedHours: cellNum1(row.getCell(5)),
        fmMeAe: cellNum1(row.getCell(6)),
        totalM3: cellNum1(row.getCell(7)),
        totalMt: cellNum1(row.getCell(8)),
        meMt: cellNum1(row.getCell(9)),
        aeMt: cellNum1(row.getCell(10)),
        robRmdMt: cellNum1(row.getCell(11)),
        robB100Mt: cellNum1(row.getCell(12)),
        bunkerRmdBioMt: cellNum1(row.getCell(13)),
        bunkerDmaMt: cellNum1(row.getCell(14)),
        robDmaMt: cellNum1(row.getCell(15)),
        boilerMt: cellNum1(row.getCell(16)),
        dmaConsM3: cellNum1(row.getCell(17)),
        boilerFm: cellNum1(row.getCell(18)),
        meCounterRh: mach?.meCounterRh ?? null,
        meShapoliRev: mach?.meShapoliRev ?? null,
        meShapoliKwh: mach?.meShapoliKwh ?? null,
        meHours: mach?.meHours ?? null,
        meRpm: mach?.meRpm ?? null,
        meKw: mach?.meKw ?? null,
        ae1CounterRh: mach?.ae1CounterRh ?? null,
        ae1KwAvg: mach?.ae1KwAvg ?? null,
        ae1Hours: mach?.ae1Hours ?? null,
        ae1Kw: mach?.ae1Kw ?? null,
        ae2CounterRh: mach?.ae2CounterRh ?? null,
        ae2KwAvg: mach?.ae2KwAvg ?? null,
        ae2Hours: mach?.ae2Hours ?? null,
        ae2Kw: mach?.ae2Kw ?? null,
        ae3CounterRh: mach?.ae3CounterRh ?? null,
        ae3KwAvg: mach?.ae3KwAvg ?? null,
        ae3Hours: mach?.ae3Hours ?? null,
        ae3Kw: mach?.ae3Kw ?? null,
        boilerCounterRh: mach?.boilerCounterRh ?? null,
        boilerHours: mach?.boilerHours ?? null,
        boilerFmCeng: mach?.boilerFmCeng ?? null,
        boilerConsM3: mach?.boilerConsM3 ?? null,
        boilerConsMt: mach?.boilerConsMt ?? null,
        sourceRow: r,
      }),
    );
  }

  return { events, sheetName: master.name.trim(), warnings };
}

/**
 * Write Fuel Log MASTER (+ matching CENG rows) from in-memory events.
 * Updates existing sourceRow cells; appends new rows after the last used MASTER row.
 */
export async function writeFuelLogToExcelBytes(
  bytes: ArrayBuffer | Uint8Array,
  events: readonly FuelLogEvent[],
): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes as ExcelJS.Buffer);
  const master =
    wb.worksheets.find((s) => /fuel\s*log\s*master/i.test(s.name)) ??
    wb.worksheets.find((s) => /master/i.test(s.name));
  if (!master) {
    throw new Error('Sheet "Fuel Log MASTER" not found');
  }
  const ceng = wb.worksheets.find((s) => /fuel\s*log\s*ceng/i.test(s.name));

  let nextMasterRow = 5;
  for (let r = 5; r <= master.rowCount; r++) {
    const place = cellText(master.getRow(r).getCell(1));
    const rawEvent = cellText(master.getRow(r).getCell(2));
    if (place || rawEvent) nextMasterRow = r + 1;
  }

  for (const event of events) {
    let rowNum = event.sourceRow > 0 ? event.sourceRow : 0;
    if (rowNum < 5) {
      rowNum = nextMasterRow++;
    }
    writeMasterRow(master, rowNum, event);
    if (ceng) {
      const cengRow = findCengRow(ceng, event) ?? mirrorCengRow(ceng, rowNum);
      if (cengRow) writeCengRow(ceng, cengRow, event);
    }
  }

  const out = await wb.xlsx.writeBuffer();
  return new Uint8Array(out as ArrayBuffer);
}

interface MachExtras {
  meCounterRh: number | null;
  meShapoliRev: number | null;
  meShapoliKwh: number | null;
  meHours: number | null;
  meRpm: number | null;
  meKw: number | null;
  ae1CounterRh: number | null;
  ae1KwAvg: number | null;
  ae1Hours: number | null;
  ae1Kw: number | null;
  ae2CounterRh: number | null;
  ae2KwAvg: number | null;
  ae2Hours: number | null;
  ae2Kw: number | null;
  ae3CounterRh: number | null;
  ae3KwAvg: number | null;
  ae3Hours: number | null;
  ae3Kw: number | null;
  boilerCounterRh: number | null;
  boilerHours: number | null;
  boilerFmCeng: number | null;
  boilerConsM3: number | null;
  boilerConsMt: number | null;
}

interface MachIndex {
  byFull: Map<string, MachExtras>;
  byDateTime: Map<string, MachExtras>;
}

function emptyMachIndex(): MachIndex {
  return { byFull: new Map(), byDateTime: new Map() };
}

function putMach(
  index: MachIndex,
  date: string,
  time: string,
  place: string,
  rawEvent: string,
  extras: MachExtras,
): void {
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

/** Fuel Log CENG — ME/AE/Boiler counters + hrs/kW. */
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
      meCounterRh: cellNum1(row.getCell(14)),
      meShapoliRev: cellNum1(row.getCell(15)),
      meShapoliKwh: cellNum1(row.getCell(16)),
      meHours: cellNum1(row.getCell(17)),
      meRpm: cellNum1(row.getCell(18)),
      meKw: cellNum1(row.getCell(19)),
      ae1CounterRh: cellNum1(row.getCell(20)),
      ae1KwAvg: cellNum1(row.getCell(21)),
      ae1Hours: cellNum1(row.getCell(22)),
      ae1Kw: cellNum1(row.getCell(23)),
      ae2CounterRh: cellNum1(row.getCell(24)),
      ae2KwAvg: cellNum1(row.getCell(25)),
      ae2Hours: cellNum1(row.getCell(26)),
      ae2Kw: cellNum1(row.getCell(27)),
      ae3CounterRh: cellNum1(row.getCell(28)),
      ae3KwAvg: cellNum1(row.getCell(29)),
      ae3Hours: cellNum1(row.getCell(30)),
      ae3Kw: cellNum1(row.getCell(31)),
      boilerCounterRh: cellNum1(row.getCell(32)),
      boilerHours: cellNum1(row.getCell(33)),
      boilerFmCeng: cellNum1(row.getCell(34)),
      boilerConsM3: cellNum1(row.getCell(35)),
      boilerConsMt: cellNum1(row.getCell(36)),
    });
  }
  return index;
}

function writeMasterRow(ws: ExcelJS.Worksheet, rowNum: number, e: FuelLogEvent): void {
  const row = ws.getRow(rowNum);
  setText(row.getCell(1), e.place);
  setText(row.getCell(2), e.rawEvent);
  setDate(row.getCell(3), e.date);
  setTime(row.getCell(4), e.time);
  setNum(row.getCell(5), e.timeUsedHours);
  setNum(row.getCell(6), e.fmMeAe);
  setNum(row.getCell(7), e.totalM3);
  setNum(row.getCell(8), e.totalMt);
  setNum(row.getCell(9), e.meMt);
  setNum(row.getCell(10), e.aeMt);
  setNum(row.getCell(11), e.robRmdMt);
  setNum(row.getCell(12), e.robB100Mt);
  setNum(row.getCell(13), e.bunkerRmdBioMt);
  setNum(row.getCell(14), e.bunkerDmaMt);
  setNum(row.getCell(15), e.robDmaMt);
  setNum(row.getCell(16), e.boilerMt);
  setNum(row.getCell(17), e.dmaConsM3);
  setNum(row.getCell(18), e.boilerFm);
}

function writeCengRow(ws: ExcelJS.Worksheet, rowNum: number, e: FuelLogEvent): void {
  const row = ws.getRow(rowNum);
  setText(row.getCell(1), e.place);
  setText(row.getCell(2), e.rawEvent);
  setDate(row.getCell(3), e.date);
  setTime(row.getCell(4), e.time);
  setNum(row.getCell(5), e.timeUsedHours);
  setNum(row.getCell(6), e.fmMeAe);
  setNum(row.getCell(7), e.totalM3);
  setNum(row.getCell(8), e.totalMt);
  setNum(row.getCell(9), e.meMt);
  setNum(row.getCell(10), e.aeMt);
  setNum(row.getCell(11), e.robRmdMt);
  setNum(row.getCell(12), e.robB100Mt);
  setNum(row.getCell(13), e.robDmaMt);
  setNum(row.getCell(14), e.meCounterRh);
  setNum(row.getCell(15), e.meShapoliRev);
  setNum(row.getCell(16), e.meShapoliKwh);
  setNum(row.getCell(17), e.meHours);
  setNum(row.getCell(18), e.meRpm);
  setNum(row.getCell(19), e.meKw);
  setNum(row.getCell(20), e.ae1CounterRh);
  setNum(row.getCell(21), e.ae1KwAvg);
  setNum(row.getCell(22), e.ae1Hours);
  setNum(row.getCell(23), e.ae1Kw);
  setNum(row.getCell(24), e.ae2CounterRh);
  setNum(row.getCell(25), e.ae2KwAvg);
  setNum(row.getCell(26), e.ae2Hours);
  setNum(row.getCell(27), e.ae2Kw);
  setNum(row.getCell(28), e.ae3CounterRh);
  setNum(row.getCell(29), e.ae3KwAvg);
  setNum(row.getCell(30), e.ae3Hours);
  setNum(row.getCell(31), e.ae3Kw);
  setNum(row.getCell(32), e.boilerCounterRh);
  setNum(row.getCell(33), e.boilerHours);
  setNum(row.getCell(34), e.boilerFmCeng);
  setNum(row.getCell(35), e.boilerConsM3);
  setNum(row.getCell(36), e.boilerConsMt);
}

function findCengRow(ws: ExcelJS.Worksheet, e: FuelLogEvent): number | null {
  for (let r = 3; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const date = cellDateIso(row.getCell(3));
    const time = cellTimeHm(row.getCell(4));
    if (date === e.date && time === e.time) {
      const place = cellText(row.getCell(1));
      const raw = cellText(row.getCell(2));
      if ((!e.place || place === e.place) && (!e.rawEvent || raw === e.rawEvent)) return r;
      if (place === e.place || raw === e.rawEvent) return r;
    }
  }
  return null;
}

/** Prefer aligning CENG row number with MASTER when sheets stay in sync. */
function mirrorCengRow(ws: ExcelJS.Worksheet, masterRow: number): number {
  // CENG data starts at row 3; MASTER at 5 → offset −2 is typical for aligned logs.
  const guess = Math.max(3, masterRow - 2);
  return guess;
}

function setText(cell: ExcelJS.Cell, value: string): void {
  cell.value = value.trim() || null;
}

function setNum(cell: ExcelJS.Cell, value: number | null): void {
  if (value == null || !Number.isFinite(value)) {
    // Keep existing formula cells when clearing would wipe auto-calcs.
    if (cell.formula || (cell.value && typeof cell.value === 'object' && 'formula' in (cell.value as object))) {
      return;
    }
    cell.value = null;
    return;
  }
  cell.value = value;
}

function setDate(cell: ExcelJS.Cell, iso: string): void {
  if (!iso) {
    cell.value = null;
    return;
  }
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    cell.value = iso;
    return;
  }
  cell.value = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  cell.numFmt = 'dd.mm.yyyy';
}

function setTime(cell: ExcelJS.Cell, hm: string): void {
  if (!hm) {
    cell.value = null;
    return;
  }
  const m = hm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) {
    cell.value = hm;
    return;
  }
  const d = new Date(Date.UTC(1899, 11, 30, Number(m[1]), Number(m[2]), 0));
  cell.value = d;
  cell.numFmt = 'hh:mm';
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
