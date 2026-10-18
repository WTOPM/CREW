import ExcelJS from 'exceljs';
import {
  classifyFuelEvent,
  createEmptyFuelLogEvent,
  FUEL_DEFAULT_DENSITY,
  fillMissingPeriodTotals,
  inferFuelDensityFromMtM3,
  normalizeFuelDensity,
  type FuelLogEvent,
  type FuelMasterSummary,
} from '../models/fuel.models';

export interface FuelExcelImportResult {
  events: FuelLogEvent[];
  sheetName: string;
  warnings: string[];
  masterSummary: FuelMasterSummary | null;
}

/** Parse FO-VPC / SHAPOLI workbook (CENG spine + MASTER-only bunker / summary). */
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

  // Prefer CENG / CE LOG / ENGINE LOG as the event spine (kept more complete).
  // MASTER supplies bunker + S1–AC4 and fills blank shared cells when CENG is empty.
  const ceng = findCengWorksheet(wb);
  const warnings: string[] = [];
  if (!ceng) {
    warnings.push(
      'Sheet "Fuel Log CENG" / "CE LOG" / "ENGINE LOG" not found — using MASTER only (SHAPOLI / ME / AE counters skipped)',
    );
  }
  const masterSummary = readMasterSummaryBlock(master);
  const masterIndex = indexMasterRows(master);

  const events: FuelLogEvent[] =
    ceng != null
      ? importFromCengSpine(ceng, masterIndex, warnings)
      : importFromMasterOnly(master, warnings);

  // Append MASTER rows that have no matching CENG event (rare, but keep bunkers).
  if (ceng) {
    appendMasterOnlyRows(events, masterIndex, warnings);
  }

  // FO-VPC often stores G/H as shared formulas; ExcelJS may omit cached results.
  // Fill gaps from FM deltas + density so Total m³ / Total t match the sheet.
  const filled = fillMissingPeriodTotals(events);

  return { events: filled, sheetName: (ceng ?? master).name.trim(), warnings, masterSummary };
}

interface MasterFuelRow {
  sourceRow: number;
  place: string;
  rawEvent: string;
  date: string;
  time: string;
  timeUsedHours: number | null;
  fmMeAe: number | null;
  totalM3: number | null;
  totalMt: number | null;
  density: number | null;
  meMt: number | null;
  aeMt: number | null;
  robRmdMt: number | null;
  robB100Mt: number | null;
  bunkerRmdBioMt: number | null;
  bunkerDmaMt: number | null;
  robDmaMt: number | null;
  boilerMt: number | null;
  dmaConsM3: number | null;
  /** From MASTER P formula ROUND(Q×d,1) or inferred mt/m³ — separate from FO H density. */
  dmaDensity: number | null;
  boilerFm: number | null;
}

interface MasterIndex {
  byFull: Map<string, MasterFuelRow>;
  byDateTime: Map<string, MasterFuelRow>;
  rows: MasterFuelRow[];
  /** Keys consumed by CENG merge — leftover MASTER rows are appended. */
  used: Set<string>;
}

function emptyMasterIndex(): MasterIndex {
  return { byFull: new Map(), byDateTime: new Map(), rows: [], used: new Set() };
}

function masterKey(date: string, time: string, place: string, rawEvent: string): string {
  return `${date}|${time}|${place}|${rawEvent}`;
}

function indexMasterRows(ws: ExcelJS.Worksheet): MasterIndex {
  const index = emptyMasterIndex();
  for (let r = 5; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const place = cellText(row.getCell(1));
    const rawEvent = cellText(row.getCell(2));
    if (!place && !rawEvent) continue;
    const date = cellDateIso(row.getCell(3));
    const time = cellTimeHm(row.getCell(4));
    if (!date || !time) continue;

    const fmMeAe = cellNum1(row.getCell(6));
    const trustPeriodFormulas = fmMeAe != null;
    const totalM3 = periodNum(row.getCell(7), trustPeriodFormulas);
    const totalMt = periodNum(row.getCell(8), trustPeriodFormulas);
    const entry: MasterFuelRow = {
      sourceRow: r,
      place,
      rawEvent,
      date,
      time,
      timeUsedHours: cellNum1(row.getCell(5)),
      fmMeAe,
      totalM3,
      totalMt,
      density: densityFromMtFormulaCell(row.getCell(8), totalMt, totalM3),
      meMt: periodNum(row.getCell(9), trustPeriodFormulas),
      aeMt: periodNum(row.getCell(10), trustPeriodFormulas),
      robRmdMt: cellNum1(row.getCell(11)),
      robB100Mt: robNum(row.getCell(12), trustPeriodFormulas),
      bunkerRmdBioMt: cellNum1(row.getCell(13)),
      bunkerDmaMt: cellNum1(row.getCell(14)),
      robDmaMt: robNum(row.getCell(15), trustPeriodFormulas),
      boilerMt: periodNum(row.getCell(16), trustPeriodFormulas),
      dmaConsM3: periodNum(row.getCell(17), trustPeriodFormulas),
      dmaDensity: densityFromMtFormulaCell(
        row.getCell(16),
        periodNum(row.getCell(16), trustPeriodFormulas),
        periodNum(row.getCell(17), trustPeriodFormulas),
      ),
      boilerFm: cellNum1(row.getCell(18)),
    };
    index.rows.push(entry);
    index.byFull.set(masterKey(date, time, place, rawEvent), entry);
    const dt = `${date}|${time}`;
    if (!index.byDateTime.has(dt)) index.byDateTime.set(dt, entry);
  }
  return index;
}

function lookupMaster(index: MasterIndex, date: string, time: string, place: string, rawEvent: string): MasterFuelRow | undefined {
  return (
    index.byFull.get(masterKey(date, time, place, rawEvent)) ??
    index.byDateTime.get(`${date}|${time}`)
  );
}

/** Prefer non-null CENG value; fall back to MASTER for blank shared cells. */
function preferCeng<T>(cengVal: T | null, masterVal: T | null | undefined): T | null {
  return cengVal != null ? cengVal : (masterVal ?? null);
}

function importFromCengSpine(
  ceng: ExcelJS.Worksheet,
  masterIndex: MasterIndex,
  warnings: string[],
): FuelLogEvent[] {
  const events: FuelLogEvent[] = [];
  for (let r = 3; r <= ceng.rowCount; r++) {
    const row = ceng.getRow(r);
    const place = cellText(row.getCell(1));
    const rawEvent = cellText(row.getCell(2));
    if (!place && !rawEvent) continue;

    const date = cellDateIso(row.getCell(3));
    const time = cellTimeHm(row.getCell(4));
    if (!date) {
      warnings.push(`CENG row ${r}: skipped (no date)`);
      continue;
    }
    if (!time) {
      warnings.push(`CENG row ${r}: skipped incomplete (no time) — ${place} / ${rawEvent}`);
      continue;
    }

    const m = lookupMaster(masterIndex, date, time, place, rawEvent);
    if (m) masterIndex.used.add(masterKey(m.date, m.time, m.place, m.rawEvent));

    const fmMeAe = preferCeng(cellNum1(row.getCell(6)), m?.fmMeAe);
    const trustPeriodFormulas = fmMeAe != null;
    const totalM3 = preferCeng(periodNum(row.getCell(7), trustPeriodFormulas), m?.totalM3);
    const totalMt = preferCeng(periodNum(row.getCell(8), trustPeriodFormulas), m?.totalMt);
    const density =
      densityFromMtFormulaCell(row.getCell(8), totalMt, totalM3) ??
      m?.density ??
      inferFuelDensityFromMtM3(totalMt, totalM3);
    const boilerMt = preferCeng(periodNum(row.getCell(36), trustPeriodFormulas), m?.boilerMt);
    const boilerFmCeng = cellNum1(row.getCell(34));
    const boilerConsM3 = periodNum(row.getCell(35), trustPeriodFormulas);
    // CENG boiler FM / m³ / t are the same as MASTER Boiler FM / DMA m³ / DMA t — prefer one set.
    const dmaConsM3 = m?.dmaConsM3 ?? boilerConsM3;
    const dmaDensity =
      m?.dmaDensity ??
      densityFromMtFormulaCell(row.getCell(36), boilerMt, dmaConsM3) ??
      inferFuelDensityFromMtM3(boilerMt, dmaConsM3);

    events.push(
      createEmptyFuelLogEvent({
        id: `fuel-${date}-${time.replace(':', '')}-c${r}`,
        place: place || m?.place || '',
        rawEvent: rawEvent || m?.rawEvent || '',
        kind: classifyFuelEvent(rawEvent || m?.rawEvent || ''),
        date,
        time,
        timeUsedHours: preferCeng(cellNum1(row.getCell(5)), m?.timeUsedHours),
        fmMeAe,
        totalM3,
        totalMt,
        density,
        meMt: preferCeng(periodNum(row.getCell(9), trustPeriodFormulas), m?.meMt),
        aeMt: preferCeng(periodNum(row.getCell(10), trustPeriodFormulas), m?.aeMt),
        robRmdMt: preferCeng(cellNum1(row.getCell(11)), m?.robRmdMt),
        robB100Mt: preferCeng(robNum(row.getCell(12), trustPeriodFormulas), m?.robB100Mt),
        // MASTER-only: bunker + DMA total cons / boiler FM
        bunkerRmdBioMt: m?.bunkerRmdBioMt ?? null,
        bunkerDmaMt: m?.bunkerDmaMt ?? null,
        robDmaMt: preferCeng(robNum(row.getCell(13), trustPeriodFormulas), m?.robDmaMt),
        boilerMt,
        dmaDensity,
        dmaConsM3,
        boilerFm: m?.boilerFm ?? boilerFmCeng,
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
        boilerFmCeng,
        boilerConsM3,
        boilerConsMt: boilerMt,
        sourceRow: m?.sourceRow ?? 0,
        cengSourceRow: r,
      }),
    );
  }
  return events;
}

function importFromMasterOnly(master: ExcelJS.Worksheet, warnings: string[]): FuelLogEvent[] {
  const events: FuelLogEvent[] = [];
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
    if (!time) {
      warnings.push(`Row ${r}: skipped incomplete (no time) — ${place} / ${rawEvent}`);
      continue;
    }

    const kind = classifyFuelEvent(rawEvent);
    const fmMeAe = cellNum1(row.getCell(6));
    const trustPeriodFormulas = fmMeAe != null;
    const totalM3 = periodNum(row.getCell(7), trustPeriodFormulas);
    const totalMt = periodNum(row.getCell(8), trustPeriodFormulas);
    const boilerMt = periodNum(row.getCell(16), trustPeriodFormulas);
    const dmaConsM3 = periodNum(row.getCell(17), trustPeriodFormulas);

    events.push(
      createEmptyFuelLogEvent({
        id: `fuel-${date}-${time.replace(':', '')}-${r}`,
        place,
        rawEvent,
        kind,
        date,
        time,
        timeUsedHours: cellNum1(row.getCell(5)),
        fmMeAe,
        totalM3,
        totalMt,
        density: densityFromMtFormulaCell(row.getCell(8), totalMt, totalM3),
        meMt: periodNum(row.getCell(9), trustPeriodFormulas),
        aeMt: periodNum(row.getCell(10), trustPeriodFormulas),
        robRmdMt: cellNum1(row.getCell(11)),
        robB100Mt: robNum(row.getCell(12), trustPeriodFormulas),
        bunkerRmdBioMt: cellNum1(row.getCell(13)),
        bunkerDmaMt: cellNum1(row.getCell(14)),
        robDmaMt: robNum(row.getCell(15), trustPeriodFormulas),
        boilerMt,
        dmaDensity: densityFromMtFormulaCell(row.getCell(16), boilerMt, dmaConsM3),
        dmaConsM3,
        boilerFm: cellNum1(row.getCell(18)),
        sourceRow: r,
      }),
    );
  }
  return events;
}

function appendMasterOnlyRows(
  events: FuelLogEvent[],
  masterIndex: MasterIndex,
  warnings: string[],
): void {
  for (const m of masterIndex.rows) {
    const key = masterKey(m.date, m.time, m.place, m.rawEvent);
    if (masterIndex.used.has(key)) continue;
    // Also skip if date|time already present from CENG (matched via byDateTime).
    if (events.some((e) => e.date === m.date && e.time === m.time)) continue;
    warnings.push(
      `MASTER row ${m.sourceRow}: no CENG match — imported from MASTER only (${m.place} / ${m.rawEvent})`,
    );
    events.push(
      createEmptyFuelLogEvent({
        id: `fuel-${m.date}-${m.time.replace(':', '')}-m${m.sourceRow}`,
        place: m.place,
        rawEvent: m.rawEvent,
        kind: classifyFuelEvent(m.rawEvent),
        date: m.date,
        time: m.time,
        timeUsedHours: m.timeUsedHours,
        fmMeAe: m.fmMeAe,
        totalM3: m.totalM3,
        totalMt: m.totalMt,
        density: m.density,
        meMt: m.meMt,
        aeMt: m.aeMt,
        robRmdMt: m.robRmdMt,
        robB100Mt: m.robB100Mt,
        bunkerRmdBioMt: m.bunkerRmdBioMt,
        bunkerDmaMt: m.bunkerDmaMt,
        robDmaMt: m.robDmaMt,
        boilerMt: m.boilerMt,
        dmaDensity: m.dmaDensity,
        dmaConsM3: m.dmaConsM3,
        boilerFm: m.boilerFm,
        sourceRow: m.sourceRow,
      }),
    );
  }
}

export interface FuelExcelWriteResult {
  bytes: Uint8Array;
  /** Events as written, with sourceRow assigned for new appends. */
  written: FuelLogEvent[];
}

/**
 * Write Fuel Log MASTER (+ keep ENGINE LOG in sync).
 *
 * FO-VPC layout (verified on ship file):
 * - MASTER is the source of truth for place / event / date / time / FM / fuel cols.
 * - ENGINE LOG A–D, F–M (and some others) are formulas → `'Fuel Log MASTER '!Xn`.
 * - Empty MASTER/ENGINE rows below the log already carry shared / link formulas.
 *
 * Therefore we:
 * - write values only into non-formula MASTER cells (never flatten whole sheets);
 * - find the ENGINE row that references this MASTER row and patch formula caches
 *   + write machinery value columns only (never destroy MASTER links).
 *
 * Caller should pass only `writeStatus === 'ready'` rows.
 */
export async function writeFuelLogToExcelBytes(
  bytes: ArrayBuffer | Uint8Array,
  events: readonly FuelLogEvent[],
): Promise<FuelExcelWriteResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes as ExcelJS.Buffer);
  const master =
    wb.worksheets.find((s) => /fuel\s*log\s*master/i.test(s.name)) ??
    wb.worksheets.find((s) => /master/i.test(s.name));
  if (!master) {
    throw new Error('Sheet "Fuel Log MASTER" not found');
  }
  const ceng = findCengWorksheet(wb);

  let nextMasterRow = 5;
  for (let r = 5; r <= master.rowCount; r++) {
    const place = cellText(master.getRow(r).getCell(1));
    const rawEvent = cellText(master.getRow(r).getCell(2));
    if (place || rawEvent) nextMasterRow = r + 1;
  }

  const written: FuelLogEvent[] = [];

  for (const event of events) {
    const isNew = !(event.sourceRow >= 5);
    const rowNum = isNew ? nextMasterRow++ : event.sourceRow;
    writeMasterRow(master, rowNum, event);
    let cengRowWritten = event.cengSourceRow;
    if (ceng) {
      const cengRow = resolveCengRowForWrite(ceng, event, rowNum, isNew);
      if (cengRow != null) {
        syncEngineLogRow(ceng, cengRow, rowNum, event, quoteSheetName(master.name));
        cengRowWritten = cengRow;
      }
    }
    written.push(
      createEmptyFuelLogEvent({
        ...event,
        sourceRow: rowNum,
        cengSourceRow: cengRowWritten,
        writeStatus: 'synced',
      }),
    );
  }

  const out = await wb.xlsx.writeBuffer();
  return { bytes: new Uint8Array(out as ArrayBuffer), written };
}

/** Match "Fuel Log CENG", FO-VPC "CE LOG" / "ENGINE LOG", or bare "CENG". */
function findCengWorksheet(wb: ExcelJS.Workbook): ExcelJS.Worksheet | undefined {
  return (
    wb.worksheets.find((s) => /fuel\s*log\s*ceng/i.test(s.name)) ??
    wb.worksheets.find((s) => /\bce\s*log\b/i.test(s.name)) ??
    wb.worksheets.find((s) => /\bengine\s*log\b/i.test(s.name)) ??
    wb.worksheets.find((s) => /^ceng$/i.test(s.name.trim()))
  );
}

/**
 * Write MASTER identity + entered values. Formula cells (Time Used / G / H / ROB…)
 * are left intact; we only refresh their cached result when we have a number.
 */
function writeMasterRow(ws: ExcelJS.Worksheet, rowNum: number, e: FuelLogEvent): void {
  const row = ws.getRow(rowNum);
  setCellValue(row.getCell(1), e.place.trim() || null);
  setCellValue(row.getCell(2), e.rawEvent.trim() || null);
  setDate(row.getCell(3), e.date);
  setTime(row.getCell(4), e.time);
  // E Time Used — FO-VPC formula; patch cache only.
  patchFormulaResult(row.getCell(5), e.timeUsedHours);
  setCellValue(row.getCell(6), e.fmMeAe);
  patchFormulaResult(row.getCell(7), e.totalM3);
  patchFormulaResult(row.getCell(8), e.totalMt);
  // Prefer keeping shared ME/AE/ROB formulas; write value only when cell is plain.
  setCellValue(row.getCell(9), e.meMt);
  setCellValue(row.getCell(10), e.aeMt);
  setCellValue(row.getCell(11), e.robRmdMt);
  setCellValue(row.getCell(12), e.robB100Mt);
  setCellValue(row.getCell(13), e.bunkerRmdBioMt);
  setCellValue(row.getCell(14), e.bunkerDmaMt);
  setCellValue(row.getCell(15), e.robDmaMt);
  setCellValue(row.getCell(16), e.boilerMt);
  setCellValue(row.getCell(17), e.dmaConsM3);
  setCellValue(row.getCell(18), e.boilerFm);
}

/** Wipe a MASTER data row so re-import skips it (deleted in the UI). */
function clearMasterRow(ws: ExcelJS.Worksheet, rowNum: number): void {
  const row = ws.getRow(rowNum);
  for (let c = 1; c <= 18; c++) {
    row.getCell(c).value = null;
  }
}

/** Wipe a CENG data row so re-import skips it. */
function clearCengRow(ws: ExcelJS.Worksheet, rowNum: number): void {
  const row = ws.getRow(rowNum);
  for (let c = 1; c <= 36; c++) {
    row.getCell(c).value = null;
  }
}

/** True when CENG row `r` is the sheet match for event `e` (same rules as findCengRow). */
function cengRowMatchesEvent(
  ws: ExcelJS.Worksheet,
  r: number,
  e: FuelLogEvent,
): boolean {
  const row = ws.getRow(r);
  const date = cellDateIso(row.getCell(3));
  const time = cellTimeHm(row.getCell(4));
  if (date !== e.date || time !== e.time) return false;
  const place = cellText(row.getCell(1));
  const raw = cellText(row.getCell(2));
  if ((!e.place || place === e.place) && (!e.rawEvent || raw === e.rawEvent)) return true;
  return place === e.place || raw === e.rawEvent;
}

/**
 * ENGINE LOG mirrors MASTER via formulas. Refresh cached results for linked
 * columns and write only plain machinery value cells (counters / kW / …).
 */
function syncEngineLogRow(
  ws: ExcelJS.Worksheet,
  engineRow: number,
  masterRow: number,
  e: FuelLogEvent,
  masterSheetRef: string,
): void {
  const row = ws.getRow(engineRow);
  const link = (cell: ExcelJS.Cell, col: string, result: string | number | Date | null) =>
    ensureEngineMasterLink(cell, col, masterRow, result, masterSheetRef);
  // Ensure A points at this MASTER row (pre-seeded empty rows already do).
  link(row.getCell(1), 'A', e.place.trim() || null);
  link(row.getCell(2), 'B', e.rawEvent.trim() || null);
  link(row.getCell(3), 'C', excelDateFromIso(e.date));
  link(row.getCell(4), 'D', e.time.trim() || null);
  patchFormulaResult(row.getCell(5), e.timeUsedHours);
  link(row.getCell(6), 'F', e.fmMeAe);
  link(row.getCell(7), 'G', e.totalM3);
  link(row.getCell(8), 'H', e.totalMt);
  link(row.getCell(9), 'I', e.meMt);
  link(row.getCell(10), 'J', e.aeMt);
  link(row.getCell(11), 'K', e.robRmdMt);
  link(row.getCell(12), 'L', e.robB100Mt);
  link(row.getCell(13), 'O', e.robDmaMt);
  // Machinery — values only (never replace formulas).
  setCellValue(row.getCell(14), e.meCounterRh);
  setCellValue(row.getCell(15), e.meShapoliRev);
  setCellValue(row.getCell(16), e.meShapoliKwh);
  setCellValue(row.getCell(17), e.meHours);
  setCellValue(row.getCell(18), e.meRpm);
  setCellValue(row.getCell(19), e.meKw);
  setCellValue(row.getCell(20), e.ae1CounterRh);
  setCellValue(row.getCell(21), e.ae1KwAvg);
  setCellValue(row.getCell(22), e.ae1Hours);
  setCellValue(row.getCell(23), e.ae1Kw);
  setCellValue(row.getCell(24), e.ae2CounterRh);
  setCellValue(row.getCell(25), e.ae2KwAvg);
  setCellValue(row.getCell(26), e.ae2Hours);
  setCellValue(row.getCell(27), e.ae2Kw);
  setCellValue(row.getCell(28), e.ae3CounterRh);
  setCellValue(row.getCell(29), e.ae3KwAvg);
  setCellValue(row.getCell(30), e.ae3Hours);
  setCellValue(row.getCell(31), e.ae3Kw);
  setCellValue(row.getCell(32), e.boilerCounterRh);
  setCellValue(row.getCell(33), e.boilerHours);
  link(row.getCell(34), 'R', e.boilerFmCeng ?? e.boilerFm);
  link(row.getCell(35), 'Q', e.boilerConsM3 ?? e.dmaConsM3);
  link(row.getCell(36), 'P', e.boilerConsMt ?? e.boilerMt);
}

function quoteSheetName(name: string): string {
  return `'${String(name).replace(/'/g, "''")}'`;
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

/**
 * Prefer ENGINE row whose A-column formula points at this MASTER row (FO-VPC).
 * Fallbacks: remembered cengSourceRow, exact/relaxed identity, then mirror offset.
 */
function resolveCengRowForWrite(
  ws: ExcelJS.Worksheet,
  e: FuelLogEvent,
  masterRow: number,
  isNewMasterRow: boolean,
): number | null {
  const byRef = findCengRowByMasterRef(ws, masterRow);
  if (byRef != null) return byRef;

  const exact = findCengRow(ws, e);
  if (exact != null) return exact;

  if (e.cengSourceRow >= 3) {
    const row = ws.getRow(e.cengSourceRow);
    const place = cellText(row.getCell(1));
    const raw = cellText(row.getCell(2));
    if ((!place && !raw) || place === e.place || raw === e.rawEvent) {
      return e.cengSourceRow;
    }
  }

  const relaxed = findCengRowByIdentity(ws, e);
  if (relaxed != null) return relaxed;

  if (isNewMasterRow) return mirrorCengRow(masterRow);
  return null;
}

/** ENGINE row with `…MASTER…!A{masterRow}` (or any col) formula. */
function findCengRowByMasterRef(ws: ExcelJS.Worksheet, masterRow: number): number | null {
  if (!(masterRow >= 5)) return null;
  const re = new RegExp(`MASTER\\s*'?!\\$?[A-Z]+\\$?${masterRow}\\b`, 'i');
  const max = Math.min(ws.rowCount, masterRow + 80);
  const min = Math.max(3, masterRow - 80);
  for (let r = min; r <= max; r++) {
    const f = cellFormulaText(ws.getRow(r).getCell(1));
    if (f && re.test(f)) return r;
  }
  // Slow fallback — pre-seeded formula rows may sit far from MASTER index.
  for (let r = 3; r <= ws.rowCount; r++) {
    const f = cellFormulaText(ws.getRow(r).getCell(1));
    if (f && re.test(f)) return r;
  }
  return null;
}

/** Same date + place + rawEvent (ignore time) — only if unique. */
function findCengRowByIdentity(ws: ExcelJS.Worksheet, e: FuelLogEvent): number | null {
  const place = (e.place ?? '').trim();
  const rawEvent = (e.rawEvent ?? '').trim();
  if (!e.date || (!place && !rawEvent)) return null;
  const hits: number[] = [];
  for (let r = 3; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    if (cellDateIso(row.getCell(3)) !== e.date) continue;
    const p = cellText(row.getCell(1));
    const raw = cellText(row.getCell(2));
    if (place && p !== place) continue;
    if (rawEvent && raw !== rawEvent) continue;
    if (!place && !rawEvent) continue;
    hits.push(r);
  }
  return hits.length === 1 ? hits[0]! : null;
}

/** Legacy fallback when ENGINE has no MASTER formula link yet. */
function mirrorCengRow(masterRow: number): number {
  return Math.max(3, masterRow - 2);
}

function ensureEngineMasterLink(
  cell: ExcelJS.Cell,
  colLetter: string,
  masterRow: number,
  result: string | number | Date | null,
  masterSheetRef: string,
): void {
  const formula = `${masterSheetRef}!${colLetter}${masterRow}`;
  if (cellHasFormula(cell)) {
    const existing = cellFormulaText(cell);
    // Keep FO-VPC MASTER links; only refresh cached result for display.
    if (/MASTER/i.test(existing)) {
      patchFormulaResult(cell, result);
      return;
    }
  }
  // Plain value or empty — install the FO-VPC link so both sheets stay coupled.
  cell.value = { formula, result: normalizeFormulaResult(result) };
}

/** Write a plain value, or refresh formula cache — never destroy formulas. */
function setCellValue(cell: ExcelJS.Cell, value: string | number | null): void {
  if (cellHasFormula(cell)) {
    patchFormulaResult(cell, value);
    return;
  }
  if (value == null || (typeof value === 'number' && !Number.isFinite(value))) {
    cell.value = null;
    return;
  }
  if (typeof value === 'string') {
    cell.value = value.trim() || null;
    return;
  }
  cell.value = value;
}

function patchFormulaResult(cell: ExcelJS.Cell, result: unknown): void {
  if (!cellHasFormula(cell)) return;
  const v = cell.value as {
    formula?: string;
    sharedFormula?: string;
    result?: unknown;
    ref?: string;
    shareType?: string;
  };
  const nextResult = normalizeFormulaResult(result);
  if (v.formula != null) {
    cell.value = {
      formula: v.formula,
      result: nextResult,
      ...(v.ref ? { ref: v.ref, shareType: v.shareType ?? 'shared' } : {}),
    };
  } else if (v.sharedFormula != null) {
    cell.value = { sharedFormula: v.sharedFormula, result: nextResult };
  }
}

function normalizeFormulaResult(
  result: unknown,
): string | number | boolean | Date | undefined {
  if (result == null) return undefined;
  if (typeof result === 'number') return Number.isFinite(result) ? result : undefined;
  if (typeof result === 'string' || typeof result === 'boolean') return result;
  if (result instanceof Date && !Number.isNaN(result.getTime())) return result;
  return undefined;
}

function excelDateFromIso(iso: string | null | undefined): Date | null {
  const m = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function setDate(cell: ExcelJS.Cell, iso: string | null | undefined): void {
  if (cellHasFormula(cell)) {
    patchFormulaResult(cell, excelDateFromIso(iso));
    return;
  }
  const d = excelDateFromIso(iso);
  if (!d) {
    cell.value = iso?.trim() ? iso : null;
    return;
  }
  cell.value = d;
  cell.numFmt = 'dd.mm.yyyy';
}

function setTime(cell: ExcelJS.Cell, hm: string | null | undefined): void {
  if (cellHasFormula(cell)) {
    const m = String(hm ?? '').match(/^(\d{1,2}):(\d{2})$/);
    if (m) {
      patchFormulaResult(
        cell,
        new Date(Date.UTC(1899, 11, 30, Number(m[1]), Number(m[2]), 0)),
      );
    } else {
      patchFormulaResult(cell, hm?.trim() || null);
    }
    return;
  }
  if (!hm) {
    cell.value = null;
    return;
  }
  const m = String(hm).match(/^(\d{1,2}):(\d{2})$/);
  if (!m) {
    cell.value = hm;
    return;
  }
  // FO-VPC MASTER stores time as text "hh:mm" on many rows — keep that shape.
  cell.value = `${String(m[1]).padStart(2, '0')}:${m[2]}`;
  cell.numFmt = '@';
}

function cellText(cell: ExcelJS.Cell): string {
  const v = resolveCell(cell);
  if (v == null) return '';
  if (v instanceof Date) return '';
  if (typeof v === 'object') return '';
  return String(v).replace(/\s+/g, ' ').trim();
}

/** Round to 1 decimal — matches Excel Fuel Log `0.0` display (e.g. 2.3 not 2.25). */
function cellNum1(cell: ExcelJS.Cell): number | null {
  const v = resolveCell(cell);
  if (v == null || v === '') return null;
  let n: number;
  if (typeof v === 'number') n = v;
  else if (v instanceof Date) return null;
  else if (typeof v === 'object') return null;
  else n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 10) / 10;
}

/**
 * Period consumption (Total m³ / Total t / ME / AE …).
 * Always drop negatives (stale Fₙ−Fₙ₋₁ when FM blank).
 * Keep non-negative formula results even when FM is blank — FO-VPC G/H are
 * almost always formulas; discarding them wiped Total m³/t on import.
 */
function periodNum(cell: ExcelJS.Cell, _trustFormulas: boolean): number | null {
  const n = cellNum1(cell);
  if (n == null) return null;
  if (n < 0) return null;
  return n;
}

/** ROB from shared formulas blow up when period deltas are stale. */
function robNum(cell: ExcelJS.Cell, trustFormulas: boolean): number | null {
  if (!trustFormulas && cellHasFormula(cell)) return null;
  const n = cellNum1(cell);
  if (n == null) return null;
  if (n < 0) return null;
  return n;
}

function cellHasFormula(cell: ExcelJS.Cell): boolean {
  const v = cell?.value;
  if (v == null || typeof v !== 'object' || v instanceof Date) return false;
  const o = v as { formula?: string; sharedFormula?: string };
  return o.formula != null || o.sharedFormula != null;
}

/**
 * Replace formula / sharedFormula cells with their cached results so ExcelJS can
 * serialize after we overwrite individual cells (avoids "Shared Formula master
 * must exist" and slideFormula `.replace` crashes).
 */
function flattenSharedFormulas(ws: ExcelJS.Worksheet, colFrom: number, colTo: number): void {
  ws.eachRow({ includeEmpty: false }, (row) => {
    flattenSharedFormulasOnRow(ws, row.number, colFrom, colTo);
  });
}

/** Flatten shared/normal formulas on one row; optionally skip columns (e.g. G/H). */
function flattenSharedFormulasOnRow(
  ws: ExcelJS.Worksheet,
  rowNum: number,
  colFrom: number,
  colTo: number,
  skipCols?: ReadonlySet<number>,
): void {
  const row = ws.getRow(rowNum);
  for (let c = colFrom; c <= colTo; c++) {
    if (skipCols?.has(c)) continue;
    const cell = row.getCell(c);
    if (!cellHasFormula(cell)) continue;
    const v = cell.value as { result?: unknown };
    const result = v?.result;
    if (typeof result === 'number' && Number.isFinite(result)) {
      cell.value = result;
    } else if (typeof result === 'string' || typeof result === 'boolean') {
      cell.value = result;
    } else if (result instanceof Date && !Number.isNaN(result.getTime())) {
      cell.value = result;
    } else {
      cell.value = null;
    }
  }
}

/**
 * Parse density from Excel mt formula `ROUND(G×0.88,1)` / `ROUND(Q×0.88,1)`
 * (FO Total t H, or DMA TOTAL CONS P), else infer from mt/m³.
 */
function densityFromMtFormulaCell(
  cell: ExcelJS.Cell,
  totalMt: number | null,
  totalM3: number | null,
): number | null {
  const formula = cellFormulaText(cell);
  if (formula) {
    const m = formula.match(/\*\s*(\d+[.,]\d+)/);
    if (m) return normalizeFuelDensity(m[1].replace(',', '.'));
  }
  return inferFuelDensityFromMtM3(totalMt, totalM3);
}

/** Safe formula string — never use ExcelJS `cell.formula` (throws on broken shared). */
function cellFormulaText(cell: ExcelJS.Cell): string {
  const v = cell?.value;
  if (v == null || typeof v !== 'object' || v instanceof Date) return '';
  const o = v as { formula?: string; sharedFormula?: string };
  return String(o.formula ?? o.sharedFormula ?? '').trim();
}

function cellDateIso(cell: ExcelJS.Cell): string {
  const v = resolveCell(cell);
  // Excel serials / ExcelJS Dates are timezone-naive → read as UTC.
  if (typeof v === 'number' && Number.isFinite(v) && v >= 1) {
    const d = excelSerialToUtcDate(v);
    return formatUtcYmd(d);
  }
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return formatUtcYmd(v);
  }
  const s = String(v ?? '').trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

function cellTimeHm(cell: ExcelJS.Cell): string {
  const v = resolveCell(cell);
  if (v == null || v === '') return '';
  if (typeof v === 'number' && Number.isFinite(v)) {
    // Date-only serial pasted into the time column (no clock fraction).
    if (v >= 1 && Math.abs(v % 1) < 1e-9) return '';
    // Empty time-formatted cells are often stored as 0 — not text "00:00".
    // Real midnight must be written as text "00:00" / "0:00" (FO-VPC style).
    if (Math.abs(v) < 1e-12) return '';
    const frac = v >= 1 ? v % 1 : v;
    if (Math.abs(frac) < 1e-12) return '';
    const totalMinutes = Math.round(frac * 24 * 60) % (24 * 60);
    if (totalMinutes === 0) return '';
    const hh = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
    const mm = String(totalMinutes % 60).padStart(2, '0');
    return `${hh}:${mm}`;
  }
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const hh = v.getUTCHours();
    const mm = v.getUTCMinutes();
    const ss = v.getUTCSeconds();
    // Midnight Date in the time column is usually a date paste / empty datetime.
    if (hh === 0 && mm === 0 && ss === 0) return '';
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }
  const s = String(v ?? '').trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
  return '';
}

/** Excel day 0 = 1899-12-30 (ExcelJS convention). */
function excelSerialToUtcDate(serial: number): Date {
  const whole = Math.floor(serial);
  return new Date(Date.UTC(1899, 11, 30) + whole * 86400000);
}

function formatUtcYmd(d: Date): string {
  const y = d.getUTCFullYear();
  if (y < 1970) return '';
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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
    // Bare Excel error cells (#VALUE! / #ЗНАЧ!)
    if (typeof o.error === 'string') return null;
    if (o.result !== undefined) {
      if (o.result && typeof o.result === 'object' && 'error' in (o.result as object)) {
        return null;
      }
      return o.result;
    }
    if (o.richText) return o.richText.map((t) => t.text).join('');
    if (o.text) return o.text;
    // ExcelJS sometimes keeps the cached result on the Cell, not in value.
    if (o.formula != null || o.sharedFormula != null) {
      const cellResult = (cell as ExcelJS.Cell & { result?: unknown }).result;
      if (cellResult !== undefined && cellResult !== null) {
        if (typeof cellResult === 'object' && 'error' in (cellResult as object)) return null;
        return cellResult;
      }
      return null;
    }
  }
  return v;
}

/** MASTER S1:AC4 — same grid as Excel (merged MT + Updated + note). */
function readMasterSummaryBlock(ws: ExcelJS.Worksheet): FuelMasterSummary | null {
  const heading = cellDisplay(ws.getRow(1).getCell(19)) || 'AUX';
  const aeMetricHeaders = [20, 21, 22, 23]
    .map((c) => cellDisplay(ws.getRow(1).getCell(c)))
    .map((h, i) => h || ['KW', 'RH', 'KG', 'MT'][i]!);
  const tankHeaders = [24, 25, 26, 27, 28, 29]
    .map((c) => cellDisplay(ws.getRow(1).getCell(c)))
    .filter(Boolean);

  const aeRows = [2, 3, 4]
    .map((r) => {
      const row = ws.getRow(r);
      return {
        label: cellDisplay(row.getCell(19)),
        kw: cellDisplay(row.getCell(20)),
        rh: cellDisplay(row.getCell(21)),
        kg: cellDisplay(row.getCell(22)),
      };
    })
    .filter((r) => r.label);

  // W2:W4 merged — read master cell once
  const mt = cellDisplay(mergedMasterCell(ws, 2, 23));
  const tankValues = [24, 25, 26, 27, 28, 29].map((c) => cellDisplay(ws.getRow(2).getCell(c)));
  // X3:AC3 / X4:AC4 merged banners
  const tankStatus = cellDisplay(mergedMasterCell(ws, 3, 24));
  const tankNote = cellDisplay(mergedMasterCell(ws, 4, 24));

  if (!aeRows.length && !tankHeaders.length) return null;
  return {
    heading,
    aeMetricHeaders,
    tankHeaders,
    aeRows,
    mt,
    tankValues: tankValues.slice(0, tankHeaders.length),
    tankStatus,
    tankNote,
  };
}

/** Prefer the merge master so shared banners / MT read once. */
function mergedMasterCell(ws: ExcelJS.Worksheet, row: number, col: number): ExcelJS.Cell {
  const cell = ws.getRow(row).getCell(col);
  if (cell.isMerged && cell.master) return cell.master;
  return cell;
}

/** Display text for summary cells (numbers, dates, formula results). */
function cellDisplay(cell: ExcelJS.Cell): string {
  const v = resolveCell(cell);
  if (v == null || v === '') return '';
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    if (v.getFullYear() < 1970) return '';
    const d = String(v.getDate()).padStart(2, '0');
    const m = String(v.getMonth() + 1).padStart(2, '0');
    return `${d}.${m}.${v.getFullYear()}`;
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    // Match Excel FO-VPC locale display (comma decimals).
    if (Number.isInteger(v)) return String(v);
    const rounded = Math.round(v * 10000) / 10000;
    return String(rounded).replace('.', ',');
  }
  return String(v).replace(/\s+/g, ' ').trim();
}
