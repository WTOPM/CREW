import type { ReeferLibrarySettings, ReeferOnboardUnit } from '../models/reefer.models';
import { reeferMonitoringDayCount, reeferMonitoringDayOffset } from '../models/reefer.models';
import { reeferVisibleOnboardUnits } from './reefer-inventory-sort.util';
import { formatDisplayDate } from './date.util';
import { reeferMonitoringYear } from './reefer-monitoring.util';

export const REEFER_LOG_DATA_ROWS = 30;
export const REEFER_LOG_DATA_START = 8;
export const REEFER_LOG_DATA_END = 37;
export const REEFER_LOG_LAST_ROW = 42;
export const REEFER_LOG_STD_COL_WIDTH = 8.43;

/** Default 5-day template width (7 fixed + 10 monitoring columns). */
export const REEFER_LOG_LAST_COL = 17;

export const REEFER_FIXED_HEADERS: readonly { col: number; label: string; wrap?: boolean }[] = [
  { col: 1, label: 'No.' },
  { col: 2, label: 'Reefer number' },
  { col: 3, label: 'POL' },
  { col: 4, label: 'POD' },
  { col: 5, label: 'Set point', wrap: true },
  { col: 6, label: 'Load temp.', wrap: true },
  { col: 7, label: 'Position' },
];

export interface ReeferMonitoringDateBlock {
  isoDate: string;
  label: string;
  times: readonly string[];
}

export interface ReeferLogGridMetrics {
  originX: number;
  originY: number;
  /** Row-height scale (Excel row heights are pt). Used for font sizing. */
  scale: number;
  scaleX: number;
  scaleY: number;
  colLeft: readonly number[];
  rowTop: readonly number[];
  contentW: number;
  contentH: number;
}

export interface ReeferLogLayout {
  dayCount: number;
  dayOffset: number;
  lastCol: number;
  colWidths: readonly number[];
  dateMergeStarts: readonly number[];
  timeRow7: readonly { col: number; time: string }[];
  dateFormulas: readonly string[];
}

function parseIsoDate(value: string): Date | null {
  const v = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatMonitoringDateLabel(iso: string): string {
  return formatDisplayDate(iso);
}

export function excelColumnLetter(col: number): string {
  let n = col;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function buildReeferLogColWidths(dayCount: number): number[] {
  const monitoringCols = dayCount * 2;
  const widths = [
    3.7,
    14.85,
    8.28,
    REEFER_LOG_STD_COL_WIDTH,
    REEFER_LOG_STD_COL_WIDTH,
    REEFER_LOG_STD_COL_WIDTH,
    14.7,
  ];
  for (let i = 0; i < monitoringCols; i++) {
    widths.push(i === 0 ? 9.7 : REEFER_LOG_STD_COL_WIDTH);
  }
  return widths;
}

export function buildReeferDateMergeStarts(dayCount: number): number[] {
  return Array.from({ length: dayCount }, (_, i) => 8 + i * 2);
}

export function buildReeferTimeRow7(dayCount: number): { col: number; time: string }[] {
  const rows: { col: number; time: string }[] = [];
  for (let i = 0; i < dayCount; i++) {
    const startCol = 8 + i * 2;
    const times = i === dayCount - 1 ? ['0800', '1655'] : ['0830', '1655'];
    rows.push({ col: startCol, time: times[0] });
    rows.push({ col: startCol + 1, time: times[1] });
  }
  return rows;
}

export function buildReeferDateFormulas(
  dayCount: number,
  lastCol: number,
  dayOffset: number,
): string[] {
  const depRef = `${excelColumnLetter(lastCol - 1)}2`;
  const firstFormula = dayOffset > 0 ? `${depRef}+${dayOffset}` : depRef;
  const formulas = [firstFormula];
  for (let i = 1; i < dayCount; i++) {
    const prevStart = 8 + (i - 1) * 2;
    formulas.push(`${excelColumnLetter(prevStart)}6+1`);
  }
  return formulas;
}

export function buildReeferLogLayout(library: ReeferLibrarySettings): ReeferLogLayout {
  const dayCount = reeferMonitoringDayCount(library);
  const dayOffset = reeferMonitoringDayOffset(library);
  const colWidths = buildReeferLogColWidths(dayCount);
  const lastCol = colWidths.length;
  return {
    dayCount,
    dayOffset,
    lastCol,
    colWidths,
    dateMergeStarts: buildReeferDateMergeStarts(dayCount),
    timeRow7: buildReeferTimeRow7(dayCount),
    dateFormulas: buildReeferDateFormulas(dayCount, lastCol, dayOffset),
  };
}

export const REEFER_LOG_ROW_HEIGHTS: Readonly<Record<number, number>> = {
  1: 15,
  2: 15,
  3: 9,
  4: 12.75,
  5: 6.75,
  6: 15,
  7: 15,
  37: 15.75,
  38: 20.1,
  39: 20.1,
  40: 15,
  41: 15,
  42: 2.25,
};

export function reeferLogRowHeight(row: number): number {
  if (REEFER_LOG_ROW_HEIGHTS[row] != null) return REEFER_LOG_ROW_HEIGHTS[row];
  if (row >= REEFER_LOG_DATA_START && row <= 36) return 15;
  return 15;
}

export function buildReeferMonitoringDateBlocks(
  departureIso: string,
  dayCount: number,
  dayOffset = 0,
): ReeferMonitoringDateBlock[] {
  const start = parseIsoDate(departureIso) ?? new Date();
  const blocks: ReeferMonitoringDateBlock[] = [];
  for (let i = 0; i < dayCount; i++) {
    const cursor = addDays(start, dayOffset + i);
    const isoDate = toIsoDate(cursor);
    blocks.push({
      isoDate,
      label: formatMonitoringDateLabel(isoDate),
      times: i === dayCount - 1 ? ['0800', '1655'] : ['0830', '1655'],
    });
  }
  return blocks;
}

export function reeferExportOnboardUnits(
  library: ReeferLibrarySettings,
  unitsOverride?: readonly ReeferOnboardUnit[],
): ReeferOnboardUnit[] {
  const units = unitsOverride ? [...unitsOverride] : reeferVisibleOnboardUnits(library);
  return units.slice(0, REEFER_LOG_DATA_ROWS);
}

export function padReeferExportUnits(
  units: readonly ReeferOnboardUnit[],
): (ReeferOnboardUnit | null)[] {
  const padded: (ReeferOnboardUnit | null)[] = [...units];
  while (padded.length < REEFER_LOG_DATA_ROWS) padded.push(null);
  return padded.slice(0, REEFER_LOG_DATA_ROWS);
}

export function parseReeferSetPointNumber(value: string): number | string {
  const v = value.trim();
  if (!v) return '';
  const n = Number(v);
  return Number.isFinite(n) ? n : v;
}

export function reeferLogTitleYear(departureIso: string): string {
  return reeferMonitoringYear(departureIso);
}

export function buildReeferLogGridMetrics(
  pageW: number,
  pageH: number,
  colWidths: readonly number[],
): ReeferLogGridMetrics {
  const marginLeft = 18;
  const marginRight = 18;
  const marginTop = 14;
  const marginBottom = 12;

  const totalColUnits = colWidths.reduce((a, b) => a + b, 0);
  const rowHeights: number[] = [];
  let totalRowUnits = 0;
  for (let row = 1; row <= REEFER_LOG_LAST_ROW; row++) {
    const h = reeferLogRowHeight(row);
    rowHeights.push(h);
    totalRowUnits += h;
  }

  const availW = pageW - marginLeft - marginRight;
  const availH = pageH - marginTop - marginBottom;

  const scaleX = availW / totalColUnits;
  const scaleY = availH / totalRowUnits;

  const colLeft: number[] = [0];
  for (const w of colWidths) {
    colLeft.push(colLeft[colLeft.length - 1] + w * scaleX);
  }

  const rowTop: number[] = [0];
  for (const h of rowHeights) {
    rowTop.push(rowTop[rowTop.length - 1] + h * scaleY);
  }

  return {
    originX: marginLeft,
    originY: marginTop,
    scale: scaleY,
    scaleX,
    scaleY,
    colLeft,
    rowTop,
    contentW: availW,
    contentH: availH,
  };
}

export function reeferLogCellRect(
  metrics: ReeferLogGridMetrics,
  row1: number,
  col1: number,
  row2 = row1,
  col2 = col1,
): { x: number; y: number; w: number; h: number } {
  const x = metrics.originX + metrics.colLeft[col1 - 1];
  const y = metrics.originY + metrics.rowTop[row1 - 1];
  const w = metrics.colLeft[col2] - metrics.colLeft[col1 - 1];
  const h = metrics.rowTop[row2] - metrics.rowTop[row1 - 1];
  return { x, y, w, h };
}

export function reeferLogFontSize(metrics: ReeferLogGridMetrics, basePt: number): number {
  return Math.max(5.5, basePt * metrics.scaleY);
}
