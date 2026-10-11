import ExcelJS from 'exceljs';
import {
  classifyFuelEvent,
  createEmptyFuelLogEvent,
  FUEL_DEFAULT_DENSITY,
  fillMissingPeriodTotals,
  inferFuelDensityFromMtM3,
  normalizeFuelDensity,
  recomputeFuelTotalMtFromM3,
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
      density: densityFromTotalMtCell(row.getCell(8), totalMt, totalM3),
      meMt: periodNum(row.getCell(9), trustPeriodFormulas),
      aeMt: periodNum(row.getCell(10), trustPeriodFormulas),
      robRmdMt: cellNum1(row.getCell(11)),
      robB100Mt: robNum(row.getCell(12), trustPeriodFormulas),
      bunkerRmdBioMt: cellNum1(row.getCell(13)),
      bunkerDmaMt: cellNum1(row.getCell(14)),
      robDmaMt: robNum(row.getCell(15), trustPeriodFormulas),
      boilerMt: periodNum(row.getCell(16), trustPeriodFormulas),
      dmaConsM3: periodNum(row.getCell(17), trustPeriodFormulas),
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
      densityFromTotalMtCell(row.getCell(8), totalMt, totalM3) ??
      m?.density ??
      inferFuelDensityFromMtM3(totalMt, totalM3);

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
        boilerMt: preferCeng(periodNum(row.getCell(36), trustPeriodFormulas), m?.boilerMt),
        dmaConsM3: m?.dmaConsM3 ?? null,
        boilerFm: m?.boilerFm ?? null,
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
        boilerConsM3: periodNum(row.getCell(35), trustPeriodFormulas),
        boilerConsMt: periodNum(row.getCell(36), trustPeriodFormulas),
        sourceRow: m?.sourceRow ?? 0,
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
        density: densityFromTotalMtCell(row.getCell(8), totalMt, totalM3),
        meMt: periodNum(row.getCell(9), trustPeriodFormulas),
        aeMt: periodNum(row.getCell(10), trustPeriodFormulas),
        robRmdMt: cellNum1(row.getCell(11)),
        robB100Mt: robNum(row.getCell(12), trustPeriodFormulas),
        bunkerRmdBioMt: cellNum1(row.getCell(13)),
        bunkerDmaMt: cellNum1(row.getCell(14)),
        robDmaMt: robNum(row.getCell(15), trustPeriodFormulas),
        boilerMt: periodNum(row.getCell(16), trustPeriodFormulas),
        dmaConsM3: periodNum(row.getCell(17), trustPeriodFormulas),
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
 * Write Fuel Log MASTER (+ matching CENG rows) from in-memory events.
 * - Existing Excel rows: update editable cells; never overwrite Total m³ / Total t
 *   formulas (G/H) so FO-VPC formulas stay intact.
 * - New events (sourceRow 0): append after the last used MASTER row.
 * - Does not clear historical Excel rows (old data left untouched).
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

  // Never flatten/overwrite G (Total m³) / H (Total t) on existing rows —
  // those hold FO-VPC formulas (Fₙ−Fₙ₋₁ and ROUND(G×density,1)).
  const preservePeriodCols = new Set([7, 8]);
  const written: FuelLogEvent[] = [];

  for (const event of events) {
    const isNew = !(event.sourceRow >= 5);
    const rowNum = isNew ? nextMasterRow++ : event.sourceRow;
    flattenSharedFormulasOnRow(master, rowNum, 1, 18, isNew ? undefined : preservePeriodCols);
    writeMasterRow(master, rowNum, event, { isNew });
    if (ceng) {
      const cengRow = isNew
        ? (findCengRow(ceng, event) ?? mirrorCengRow(ceng, rowNum))
        : findCengRow(ceng, event);
      if (cengRow) {
        flattenSharedFormulasOnRow(ceng, cengRow, 1, 36, isNew ? undefined : preservePeriodCols);
        writeCengRow(ceng, cengRow, event, { isNew });
      }
    }
    written.push(
      createEmptyFuelLogEvent({
        ...event,
        sourceRow: rowNum,
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

function writeMasterRow(
  ws: ExcelJS.Worksheet,
  rowNum: number,
  e: FuelLogEvent,
  opts: { isNew: boolean },
): void {
  const row = ws.getRow(rowNum);
  setText(row.getCell(1), e.place);
  setText(row.getCell(2), e.rawEvent);
  setDate(row.getCell(3), e.date);
  setTime(row.getCell(4), e.time);
  setNum(row.getCell(5), e.timeUsedHours);
  setNum(row.getCell(6), e.fmMeAe);
  // G Total m³ / H Total t — keep Excel formulas on existing rows.
  writePeriodCell(row.getCell(7), e.totalM3, opts.isNew);
  writeTotalMtCell(row.getCell(8), rowNum, e, opts.isNew);
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

/** G: write value only when new or cell has no formula. */
function writePeriodCell(cell: ExcelJS.Cell, value: number | null, isNew: boolean): void {
  if (!isNew && cellHasFormula(cell)) return;
  setNum(cell, value);
}

/** H: ROUND(G×density,1) for new rows; never overwrite existing formulas. */
function writeTotalMtCell(
  cell: ExcelJS.Cell,
  rowNum: number,
  e: FuelLogEvent,
  isNew: boolean,
): void {
  if (!isNew && cellHasFormula(cell)) return;
  const density = normalizeFuelDensity(e.density) ?? FUEL_DEFAULT_DENSITY;
  const result = recomputeFuelTotalMtFromM3(e.totalM3, density);
  cell.value = {
    formula: `ROUND(G${rowNum}*${density},1)`,
    result: result ?? undefined,
  };
  cell.numFmt = '0.0';
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

function writeCengRow(
  ws: ExcelJS.Worksheet,
  rowNum: number,
  e: FuelLogEvent,
  opts: { isNew: boolean },
): void {
  const row = ws.getRow(rowNum);
  setText(row.getCell(1), e.place);
  setText(row.getCell(2), e.rawEvent);
  setDate(row.getCell(3), e.date);
  setTime(row.getCell(4), e.time);
  setNum(row.getCell(5), e.timeUsedHours);
  setNum(row.getCell(6), e.fmMeAe);
  writePeriodCell(row.getCell(7), e.totalM3, opts.isNew);
  writeTotalMtCell(row.getCell(8), rowNum, e, opts.isNew);
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

function setText(cell: ExcelJS.Cell, value: string | null | undefined): void {
  cell.value = String(value ?? '').trim() || null;
}

function setNum(cell: ExcelJS.Cell, value: number | null): void {
  if (value == null || !Number.isFinite(value)) {
    // Keep existing formula cells when clearing would wipe auto-calcs.
    // Do NOT read cell.formula — ExcelJS shared-formula getter calls slideFormula
    // and throws when the master formula string is missing.
    if (cellHasFormula(cell)) return;
    cell.value = null;
    return;
  }
  cell.value = value;
}

function setDate(cell: ExcelJS.Cell, iso: string | null | undefined): void {
  if (!iso) {
    cell.value = null;
    return;
  }
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    cell.value = iso;
    return;
  }
  cell.value = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  cell.numFmt = 'dd.mm.yyyy';
}

function setTime(cell: ExcelJS.Cell, hm: string | null | undefined): void {
  if (!hm) {
    cell.value = null;
    return;
  }
  const m = String(hm).match(/^(\d{1,2}):(\d{2})$/);
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
 * Parse density from Excel H formula `ROUND(G1094*0,88;1)` / `ROUND(G5*0.88,1)`,
 * else infer from mt/m³.
 */
function densityFromTotalMtCell(
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
  if (typeof v === 'number' && Number.isFinite(v)) {
    const frac = v >= 1 ? v % 1 : v;
    const totalMinutes = Math.round(frac * 24 * 60) % (24 * 60);
    const hh = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
    const mm = String(totalMinutes % 60).padStart(2, '0');
    return `${hh}:${mm}`;
  }
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const hh = String(v.getUTCHours()).padStart(2, '0');
    const mm = String(v.getUTCMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
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
