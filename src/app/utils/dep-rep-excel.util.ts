import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import type { ManifestClassWeightRow } from './dg-manifest-summary.util';

export interface DepRepWriteInput {
  /** Target sheet name, e.g. "138 LVRIX". */
  sheetName: string;
  voyage: string;
  polCode: string;
  podCode: string;
  /** ISO yyyy-MM-dd. */
  departureDate: string;
  /** AFT draft (m) → B8. */
  draftAft: string;
  /** FWD draft (m) → D8. */
  draftFore: string;
  /** TOTAL CARGO tonnes → F9. */
  totalCargo: string;
  /** Water density for POL → E6 (app list). Leave empty to skip. */
  waterDensity?: string;
  /** DG CLASS / WEIGHT rows → A11:B*. */
  classRows: readonly ManifestClassWeightRow[];
  /** Keel–mast height for airdraft formula (default 46.7). */
  heightKeelToMastTop: string;
  /** Moulded depth for UKC-style formula (default 14.2). */
  mouldedDepth: string;
}

export interface DepRepWriteResult {
  created: boolean;
  sheetName: string;
}

/** Cell updates for the departure sheet only — never K:L density reference. */
export type DepRepCellUpdate =
  | { address: string; kind: 'text'; value: string }
  | { address: string; kind: 'number'; value: number }
  | { address: string; kind: 'date'; iso: string }
  | { address: string; kind: 'formula'; formula: string }
  | { address: string; kind: 'clear' };

const CLASS_START_ROW = 11;
const CLASS_END_ROW = 23;

function parseMetres(raw: string, fallback: number): number {
  const n = Number(String(raw ?? '').trim().replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Parse tonnes from UI/Excel — strips spaces and unit suffixes like "t" / "tons". */
export function parseCargoTons(raw: string): number | null {
  const m = String(raw ?? '')
    .trim()
    .replace(/\s/g, '')
    .replace(',', '.')
    .match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

function parseDraft(raw: string): number | null {
  const trimmed = String(raw ?? '').trim().replace(',', '.');
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/**
 * Build data-cell updates for a DEP REP sheet.
 * Does not include density table (K:L) or E6 VLOOKUP — those stay as in the template.
 */
export function buildDepRepCellUpdates(input: DepRepWriteInput): DepRepCellUpdate[] {
  const updates: DepRepCellUpdate[] = [];

  updates.push({ address: 'B2', kind: 'text', value: input.polCode.trim().toUpperCase() });
  updates.push({
    address: 'D2',
    kind: 'text',
    value: input.podCode.trim().toUpperCase() || '',
  });
  updates.push({ address: 'F2', kind: 'text', value: input.voyage.trim() });

  const iso = String(input.departureDate ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(iso)) {
    updates.push({ address: 'B4', kind: 'date', iso: iso.slice(0, 10) });
  } else if (iso) {
    updates.push({ address: 'B4', kind: 'text', value: iso });
  }

  const aft = parseDraft(input.draftAft);
  const fore = parseDraft(input.draftFore);
  if (aft != null) updates.push({ address: 'B8', kind: 'number', value: aft });
  if (fore != null) updates.push({ address: 'D8', kind: 'number', value: fore });

  // MID / TRIM stay as template formulas (B8/D8 driven).
  // TOTAL CARGO lives in merged F9:G9 (sometimes read as G9) — write F9 (merge top-left).
  const cargo = parseCargoTons(input.totalCargo);
  if (cargo != null) {
    updates.push({ address: 'F9', kind: 'number', value: cargo });
  }

  // App density for POL → E6 (do not rewrite K:L reference table).
  const densRaw = String(input.waterDensity ?? '').trim().replace(',', '.');
  const dens = densRaw ? Number(densRaw) : NaN;
  if (Number.isFinite(dens) && dens > 0) {
    updates.push({ address: 'E6', kind: 'number', value: dens });
  }

  const height = parseMetres(input.heightKeelToMastTop, 46.7);
  const depth = parseMetres(input.mouldedDepth, 14.2);
  updates.push({ address: 'H14', kind: 'formula', formula: `${height}-B8` });
  updates.push({ address: 'C18', kind: 'formula', formula: `${depth}-C8` });

  for (let r = CLASS_START_ROW; r <= CLASS_END_ROW; r++) {
    updates.push({ address: `A${r}`, kind: 'clear' });
    updates.push({ address: `B${r}`, kind: 'clear' });
  }
  const rows = input.classRows.slice(0, CLASS_END_ROW - CLASS_START_ROW + 1);
  rows.forEach((row, i) => {
    const r = CLASS_START_ROW + i;
    updates.push({ address: `A${r}`, kind: 'text', value: row.dgClass });
    updates.push({
      address: `B${r}`,
      kind: 'number',
      value: Math.round(row.totalKg * 10) / 10,
    });
  });

  return updates;
}

function findSheet(wb: ExcelJS.Workbook, name: string): ExcelJS.Worksheet | undefined {
  const key = name.trim().toLowerCase();
  return wb.worksheets.find((s) => s.name.trim().toLowerCase() === key);
}

/**
 * Excel date cells are calendar days (no timezone). Never use toISOString() —
 * local midnight in UTC+1/+2 becomes the previous UTC day.
 */
function dateOnlyToIso(d: Date): string {
  if (Number.isNaN(d.getTime())) return '';
  // ExcelJS often gives UTC midnight; SheetJS cellDates often gives local midnight.
  const useUtc =
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0;
  const y = useUtc ? d.getUTCFullYear() : d.getFullYear();
  const m = (useUtc ? d.getUTCMonth() : d.getMonth()) + 1;
  const day = useUtc ? d.getUTCDate() : d.getDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseDisplayDateToIso(text: string): string {
  const t = text.trim();
  if (!t) return '';
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = t.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  return '';
}

function cellText(ws: ExcelJS.Worksheet, addr: string): string {
  const v = ws.getCell(addr).value;
  if (v == null || v === '') return '';
  if (typeof v === 'number') return String(v);
  if (v instanceof Date) return dateOnlyToIso(v);
  if (typeof v === 'object' && 'result' in v) {
    const res = (v as { result?: unknown }).result;
    if (res instanceof Date) return dateOnlyToIso(res);
    if (res == null) return '';
    return String(res);
  }
  if (typeof v === 'object' && 'text' in v) return String((v as { text?: unknown }).text ?? '');
  if (typeof v === 'object' && 'richText' in v) {
    const parts = (v as { richText?: Array<{ text?: string }> }).richText ?? [];
    return parts.map((p) => p.text ?? '').join('');
  }
  return String(v);
}

function cellNumberString(ws: ExcelJS.Worksheet, addr: string): string {
  const raw = cellText(ws, addr);
  const n = parseCargoTons(raw) ?? parseDraft(raw);
  return n != null ? String(n) : raw.trim();
}

function excelDateToIso(ws: ExcelJS.Worksheet, addr: string): string {
  const v = ws.getCell(addr).value;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return dateOnlyToIso(v);
  }
  if (v && typeof v === 'object' && 'result' in v) {
    const res = (v as { result?: unknown }).result;
    if (res instanceof Date && !Number.isNaN(res.getTime())) {
      return dateOnlyToIso(res);
    }
  }
  const fromText = parseDisplayDateToIso(cellText(ws, addr));
  return fromText || cellText(ws, addr).trim();
}

export interface DepRepSheetSnapshot {
  exists: boolean;
  sheetName: string;
  polCode: string;
  podCode: string;
  voyage: string;
  departureDate: string;
  draftAft: string;
  draftFore: string;
  totalCargo: string;
  density: string;
  /** DG CLASS / WEIGHT from A11:B23 (empty when sheet has none). */
  classRows: ManifestClassWeightRow[];
}

function emptySnapshot(sheetName = ''): DepRepSheetSnapshot {
  return {
    exists: false,
    sheetName,
    polCode: '',
    podCode: '',
    voyage: '',
    departureDate: '',
    draftAft: '',
    draftFore: '',
    totalCargo: '',
    density: '',
    classRows: [],
  };
}

function readSnapshotFromWorksheet(ws: ExcelJS.Worksheet): DepRepSheetSnapshot {
  const cargoRaw = cellText(ws, 'F9') || cellText(ws, 'G9') || cellText(ws, 'H9');
  const cargo = parseCargoTons(cargoRaw);
  return {
    exists: true,
    sheetName: ws.name,
    polCode: cellText(ws, 'B2').trim().toUpperCase(),
    podCode: cellText(ws, 'D2').trim().toUpperCase(),
    voyage: cellText(ws, 'F2').trim(),
    departureDate: excelDateToIso(ws, 'B4'),
    draftAft: cellNumberString(ws, 'B8'),
    draftFore: cellNumberString(ws, 'D8'),
    totalCargo: cargo != null ? String(cargo) : cargoRaw.replace(/\s*t\s*$/i, '').trim(),
    density: cellNumberString(ws, 'E6') || cellNumberString(ws, 'D6'),
    classRows: readClassRowsFromWorksheet(ws),
  };
}

function readClassRowsFromWorksheet(ws: ExcelJS.Worksheet): ManifestClassWeightRow[] {
  const rows: ManifestClassWeightRow[] = [];
  for (let r = CLASS_START_ROW; r <= CLASS_END_ROW; r++) {
    const dgClass = cellText(ws, `A${r}`).trim();
    if (!dgClass) continue;
    const kgRaw = cellText(ws, `B${r}`);
    const kg = parseCargoTons(kgRaw);
    rows.push({ dgClass, totalKg: kg != null ? kg : 0 });
  }
  return rows;
}

/** Read voyage data from a named sheet (if present). Does not modify the file. */
export async function readDepRepSheetSnapshot(
  bytes: ArrayBuffer | Uint8Array,
  sheetName: string,
): Promise<DepRepSheetSnapshot> {
  const name = sheetName.trim();
  if (!name) return emptySnapshot();

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes as unknown as ExcelJS.Buffer);
  const ws = findSheet(wb, name);
  if (!ws) return emptySnapshot(name);
  return readSnapshotFromWorksheet(ws);
}

/**
 * Fast Refresh path: parse ONLY the leftmost sheet (SheetJS skips drawings / other tabs).
 * One pass → snapshot + K:L densities.
 */
export function readDepRepLatestRefreshData(
  bytes: ArrayBuffer | Uint8Array,
): { snapshot: DepRepSheetSnapshot; densities: Map<string, number> } {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const wb = XLSX.read(data, {
    type: 'array',
    cellDates: true,
    /** First sheet only — DEP REP “latest” is always index 0 after Create/Write. */
    sheets: 0,
  });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { snapshot: emptySnapshot(), densities: new Map() };
  }
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    return { snapshot: emptySnapshot(sheetName), densities: new Map() };
  }
  return {
    snapshot: readSnapshotFromXlsxSheet(ws, sheetName),
    densities: readDensityTableFromXlsxSheet(ws),
  };
}

/**
 * Latest departure tab = leftmost worksheet (new sheets are moved to index 1 on write).
 */
export async function readDepRepLatestSheetSnapshot(
  bytes: ArrayBuffer | Uint8Array,
): Promise<DepRepSheetSnapshot> {
  return readDepRepLatestRefreshData(bytes).snapshot;
}

/** Read PORT→density map from columns K/L (header + data). Read-only — never writes. */
export function readDepRepDensityTable(
  bytes: ArrayBuffer | Uint8Array,
  sheetName?: string,
): Promise<Map<string, number>> {
  return (async () => {
    const name = String(sheetName ?? '').trim();
    // Default / latest: fast SheetJS path (first sheet only).
    if (!name) {
      return readDepRepLatestRefreshData(bytes).densities;
    }

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bytes as unknown as ExcelJS.Buffer);
    const ws = findSheet(wb, name);
    const map = new Map<string, number>();
    if (!ws) return map;
    for (let r = 1; r <= Math.min(ws.rowCount || 50, 80); r++) {
      const port = String(ws.getCell(r, 11).value ?? '')
        .trim()
        .toUpperCase();
      const densRaw = ws.getCell(r, 12).value;
      let dens: number | null = null;
      if (typeof densRaw === 'number') dens = densRaw;
      else if (densRaw && typeof densRaw === 'object' && 'result' in densRaw) {
        const res = (densRaw as { result?: unknown }).result;
        dens = typeof res === 'number' ? res : Number(res);
      } else if (densRaw != null && densRaw !== '') {
        dens = Number(String(densRaw).replace(',', '.'));
      }
      if (!port || port === 'PORT' || dens == null || !Number.isFinite(dens)) continue;
      map.set(port, dens);
    }
    return map;
  })();
}

function xlsxCellText(ws: XLSX.WorkSheet, addr: string): string {
  const c = ws[addr] as XLSX.CellObject | undefined;
  if (!c) return '';
  if (c.t === 'd' && c.v instanceof Date && !Number.isNaN(c.v.getTime())) {
    return dateOnlyToIso(c.v);
  }
  if (c.w != null && String(c.w).trim() !== '') return String(c.w);
  if (c.v == null || c.v === '') return '';
  if (c.v instanceof Date && !Number.isNaN(c.v.getTime())) {
    return dateOnlyToIso(c.v);
  }
  return String(c.v);
}

function xlsxCellNumberString(ws: XLSX.WorkSheet, addr: string): string {
  const c = ws[addr] as XLSX.CellObject | undefined;
  if (!c) return '';
  if (typeof c.v === 'number' && Number.isFinite(c.v)) return String(c.v);
  const raw = xlsxCellText(ws, addr);
  const n = parseCargoTons(raw) ?? parseDraft(raw);
  return n != null ? String(n) : raw.trim();
}

function xlsxDateToIso(ws: XLSX.WorkSheet, addr: string): string {
  const c = ws[addr] as XLSX.CellObject | undefined;
  // Prefer Excel display text — matches what the user sees in the sheet (e.g. 30.09.2026).
  if (c?.w != null) {
    const fromDisplay = parseDisplayDateToIso(String(c.w));
    if (fromDisplay) return fromDisplay;
  }
  if (typeof c?.v === 'number' && Number.isFinite(c.v)) {
    const parsed = XLSX.SSF.parse_date_code(c.v);
    if (parsed) {
      const y = parsed.y;
      const m = String(parsed.m).padStart(2, '0');
      const d = String(parsed.d).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
  if (c?.v instanceof Date && !Number.isNaN(c.v.getTime())) {
    return dateOnlyToIso(c.v);
  }
  return parseDisplayDateToIso(xlsxCellText(ws, addr)) || xlsxCellText(ws, addr).trim();
}

function readSnapshotFromXlsxSheet(
  ws: XLSX.WorkSheet,
  sheetName: string,
): DepRepSheetSnapshot {
  const cargoRaw =
    xlsxCellText(ws, 'F9') || xlsxCellText(ws, 'G9') || xlsxCellText(ws, 'H9');
  const cargo = parseCargoTons(cargoRaw);
  const classRows: ManifestClassWeightRow[] = [];
  for (let r = CLASS_START_ROW; r <= CLASS_END_ROW; r++) {
    const dgClass = xlsxCellText(ws, `A${r}`).trim();
    if (!dgClass) continue;
    const kgRaw = xlsxCellText(ws, `B${r}`);
    const kg = parseCargoTons(kgRaw);
    classRows.push({ dgClass, totalKg: kg != null ? kg : 0 });
  }
  return {
    exists: true,
    sheetName,
    polCode: xlsxCellText(ws, 'B2').trim().toUpperCase(),
    podCode: xlsxCellText(ws, 'D2').trim().toUpperCase(),
    voyage: xlsxCellText(ws, 'F2').trim(),
    departureDate: xlsxDateToIso(ws, 'B4'),
    draftAft: xlsxCellNumberString(ws, 'B8'),
    draftFore: xlsxCellNumberString(ws, 'D8'),
    totalCargo: cargo != null ? String(cargo) : cargoRaw.replace(/\s*t\s*$/i, '').trim(),
    density: xlsxCellNumberString(ws, 'E6') || xlsxCellNumberString(ws, 'D6'),
    classRows,
  };
}

function readDensityTableFromXlsxSheet(ws: XLSX.WorkSheet): Map<string, number> {
  const map = new Map<string, number>();
  for (let r = 1; r <= 80; r++) {
    const port = xlsxCellText(ws, `K${r}`).trim().toUpperCase();
    const densRaw = xlsxCellNumberString(ws, `L${r}`);
    const dens = densRaw ? Number(String(densRaw).replace(',', '.')) : NaN;
    if (!port || port === 'PORT' || !Number.isFinite(dens)) continue;
    map.set(port, dens);
  }
  return map;
}

export function lookupDepRepDensity(
  table: ReadonlyMap<string, number>,
  polCode: string,
): number | null {
  const key = polCode.trim().toUpperCase();
  if (!key) return null;
  return table.get(key) ?? null;
}
