import ExcelJS from 'exceljs';
import {
  dgContainersExportTotalKg,
  dgOnboardClassSummaries,
  formatDgWeightKgDisplay,
  parseDgWeightKg,
  resolveDgMasterName,
  roundDgExportLineWeightKg,
  type DgCargoLine,
  type DgLibrarySettings,
  type DgOnboardContainer,
} from '../models/dg-manifest.models';
import type { DgManifestExportContext } from '../models/dg-manifest-export.models';
import {
  buildDgContainerDisplayLines,
  dgCargoLineHasCargo,
  mergeDgCargoLines,
  planDgInventoryWeightDisplays,
} from './dg-cargo-merge.util';
import { compareDgManifestExportRowsByClass } from './dg-inventory-sort.util';
import {
  CrewMember,
  portCode,
  resolveManifestPortName,
  ShipInfo,
  type Port,
} from '../models/crew.models';
import { formatDisplayDate } from './date.util';
import { workbookToBytes } from './crew-list-excel-layout.util';

export const DG_MANIFEST_COLS = 12;
export const DG_MANIFEST_SHEET = 'IMO list  ';

const DATA_START = 10;
const TABLE_HEAD_ROW = 9;

/** Side panel columns (after separator M). */
const COL_N = 14;
const COL_P = 16;
const COL_R = 18;
const COL_U = 21;

const COL_WIDTHS: readonly number[] = [
  4.9, 9.7, 9.7, 5.3, 18.6, 11.9, 5.7, 7.6, 9.1, 12.0, 25.7, 14.9,
];

const TIMES = 'Times New Roman';
const ARIAL = 'Arial';

const CLR = {
  gray: 'FF424242',
  brown: 'FF996633',
  cyan: 'FF00CCFF',
  red: 'FFFF0000',
  green: 'FF008000',
  navy: 'FF333399',
  muted: 'FF666699',
  white: 'FFFFFFFF',
  black: 'FF000000',
} as const;

const thinEdge = { style: 'thin' as const, color: { argb: CLR.black } };
const mediumEdge = { style: 'medium' as const, color: { argb: CLR.black } };
const THIN: Partial<ExcelJS.Borders> = { top: thinEdge, left: thinEdge, bottom: thinEdge, right: thinEdge };
const MEDIUM: Partial<ExcelJS.Borders> = {
  top: mediumEdge,
  left: mediumEdge,
  bottom: mediumEdge,
  right: mediumEdge,
};

export interface DgManifestExcelRow {
  pol: string;
  pod: string;
  type: string;
  containerNo: string;
  stowage: string;
  dgClass: string;
  unNo: string;
  mpLq: string;
  flashPoint: string;
  properShippingName: string;
  weightKg: string;
}

function mergeCells(ws: ExcelJS.Worksheet, r1: number, c1: number, r2: number, c2: number): void {
  if (r1 === r2 && c1 === c2) return;
  ws.mergeCells(r1, c1, r2, c2);
}

function setCell(
  ws: ExcelJS.Worksheet,
  row: number,
  col: number,
  value: ExcelJS.CellValue,
  style: {
    font?: Partial<ExcelJS.Font>;
    alignment?: Partial<ExcelJS.Alignment>;
    border?: Partial<ExcelJS.Borders>;
    fill?: ExcelJS.Fill;
    numFmt?: string;
  } = {},
): ExcelJS.Cell {
  const cell = ws.getCell(row, col);
  cell.value = value;
  if (style.font) cell.font = style.font as ExcelJS.Font;
  if (style.alignment) cell.alignment = style.alignment as ExcelJS.Alignment;
  if (style.border) cell.border = style.border as ExcelJS.Borders;
  if (style.fill) cell.fill = style.fill;
  if (style.numFmt) cell.numFmt = style.numFmt;
  return cell;
}

function solidFill(hex: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: hex } };
}

function addRangeBorder(
  ws: ExcelJS.Worksheet,
  r1: number,
  c1: number,
  r2: number,
  c2: number,
  edges: { top?: boolean; bottom?: boolean; left?: boolean; right?: boolean },
): void {
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      const cell = ws.getCell(r, c);
      const border = { ...(cell.border ?? {}) } as ExcelJS.Borders;
      if (edges.top && r === r1) border.top = thinEdge;
      if (edges.bottom && r === r2) border.bottom = thinEdge;
      if (edges.left && c === c1) border.left = thinEdge;
      if (edges.right && c === c2) border.right = thinEdge;
      cell.border = border;
    }
  }
}

function exportClassTotalKg(rows: readonly DgManifestExcelRow[], dgClass: string): number {
  const key = dgClass.trim();
  const sum = rows
    .filter((r) => r.dgClass.trim() === key)
    .reduce((total, r) => total + parseDgWeightKg(r.weightKg), 0);
  return Math.round(sum);
}

function uniqueUnNumbersForClass(
  rows: readonly DgManifestExcelRow[],
  dgClass: string,
): string {
  const key = dgClass.trim();
  const set = new Set<string>();
  for (const row of rows) {
    if (row.dgClass.trim() !== key) continue;
    const un = row.unNo.trim();
    if (un) set.add(un);
  }
  return sortUnNumbers([...set]).join(' ');
}

function sortUnNumbers(values: string[]): string[] {
  return values.sort((a, b) => {
    const cmp = parseInt(a, 10) - parseInt(b, 10);
    return cmp || a.localeCompare(b, undefined, { numeric: true });
  });
}

function applyColumnWidths(ws: ExcelJS.Worksheet): void {
  COL_WIDTHS.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
  ws.getColumn(13).width = 8.43;
  ws.getColumn(COL_N).width = 12.9;
  ws.getColumn(15).width = 10;
  ws.getColumn(COL_P).width = 14.3;
  for (let c = 17; c <= COL_U; c++) {
    ws.getColumn(c).width = 10;
  }
}

function buildReadinessBlock(ws: ExcelJS.Worksheet, ready: boolean): void {
  mergeCells(ws, 1, COL_N, 1, COL_P);
  setCell(ws, 1, COL_N, 'RED - NOT READY', {
    font: { name: TIMES, size: 20, bold: true, color: { argb: CLR.white } },
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    fill: solidFill(CLR.red),
    border: MEDIUM,
  });

  mergeCells(ws, 1, 17, 1, COL_U);
  setCell(ws, 1, 17, 'GREEN - READY', {
    font: { name: TIMES, size: 21, bold: true, color: { argb: CLR.white } },
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    fill: solidFill(CLR.green),
    border: MEDIUM,
  });

  mergeCells(ws, 3, COL_N, 5, COL_U);
  const statusLabel = ready ? 'READY' : 'NOT READY';
  const statusFill = ready ? CLR.green : CLR.red;
  setCell(ws, 3, COL_N, statusLabel, {
    font: {
      name: TIMES,
      size: 36,
      bold: true,
      color: { argb: ready ? CLR.black : CLR.white },
    },
    alignment: { horizontal: 'center', vertical: 'middle' },
    fill: solidFill(statusFill),
    border: MEDIUM,
  });
}

function buildManifestHeader(
  ws: ExcelJS.Worksheet,
  ship: ShipInfo,
  crew: readonly CrewMember[],
  ports: readonly Port[],
  totalKg: number,
): void {
  mergeCells(ws, 1, 1, 1, 12);
  setCell(ws, 1, 1, 'DANGEROUS GOODS MANIFEST', {
    font: { name: TIMES, size: 20, bold: true, color: { argb: CLR.gray } },
    alignment: { horizontal: 'center', vertical: 'bottom' },
    border: THIN,
  });

  mergeCells(ws, 3, 1, 3, 4);
  setCell(ws, 3, 1, formatDgVesselDisplay(ship), {
    font: { name: ARIAL, size: 14, color: { argb: CLR.gray } },
    alignment: { horizontal: 'center', vertical: 'middle' },
  });

  setCell(ws, 3, 5, 'Voy. No.', {
    font: { name: ARIAL, size: 14, color: { argb: CLR.gray } },
    alignment: { horizontal: 'right', vertical: 'middle' },
  });

  mergeCells(ws, 3, 6, 3, 9);
  setCell(ws, 3, 6, ship.voyageNumber?.trim() ?? '', {
    font: { name: ARIAL, size: 16, bold: true, italic: true, color: { argb: CLR.gray } },
    alignment: { horizontal: 'center', vertical: 'middle' },
  });

  mergeCells(ws, 2, 10, 3, 12);
  setCell(ws, 2, 10, `Master: ${resolveDgMasterName(crew)}`, {
    font: { name: ARIAL, size: 14, color: { argb: CLR.black } },
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    border: THIN,
  });

  mergeCells(ws, 6, 1, 6, 3);
  setCell(ws, 6, 1, 'Port of departure:', {
    font: { name: ARIAL, size: 12, color: { argb: CLR.black } },
    alignment: { horizontal: 'right', vertical: 'middle' },
  });
  setCell(ws, 6, 4, dgManifestHeaderPortName(ship.portOfCall ?? '', ports), {
    font: { name: ARIAL, size: 12, bold: true, color: { argb: CLR.brown } },
    alignment: { horizontal: 'left', vertical: 'middle' },
  });
  setCell(ws, 6, 6, 'Dep. Date:', {
    font: { name: ARIAL, size: 11, color: { argb: CLR.gray } },
    alignment: { horizontal: 'center', vertical: 'middle' },
  });
  const dep = splitDgManifestExcelDate(ship.dateOfDeparture);
  setCell(ws, 6, 7, dep.day, {
    font: { name: ARIAL, size: 14, bold: true, color: { argb: CLR.brown } },
    alignment: { horizontal: 'right', vertical: 'middle' },
  });
  setCell(ws, 6, 8, dep.rest, {
    font: { name: ARIAL, size: 14, bold: true, color: { argb: CLR.brown } },
    alignment: { horizontal: 'left', vertical: 'middle' },
  });

  mergeCells(ws, 7, 1, 7, 3);
  setCell(ws, 7, 1, 'Port of arrival:', {
    font: { name: ARIAL, size: 12, color: { argb: CLR.black } },
    alignment: { horizontal: 'right', vertical: 'middle' },
  });
  setCell(ws, 7, 4, dgManifestHeaderPortName(ship.nextPortOfCall ?? '', ports), {
    font: { name: ARIAL, size: 12, bold: true, color: { argb: CLR.brown } },
    alignment: { horizontal: 'left', vertical: 'middle' },
  });
  setCell(ws, 7, 6, 'Arr. Date:', {
    font: { name: ARIAL, size: 11, color: { argb: CLR.gray } },
    alignment: { horizontal: 'center', vertical: 'middle' },
  });
  const arr = splitDgManifestExcelDate(ship.dateOfArrival);
  setCell(ws, 7, 7, arr.day, {
    font: { name: ARIAL, size: 14, bold: true, color: { argb: CLR.brown } },
    alignment: { horizontal: 'right', vertical: 'middle' },
  });
  setCell(ws, 7, 8, arr.rest, {
    font: { name: ARIAL, size: 14, bold: true, color: { argb: CLR.brown } },
    alignment: { horizontal: 'left', vertical: 'middle' },
  });

  setCell(ws, 6, 11, 'Total, kg:', {
    font: { name: ARIAL, size: 16, color: { argb: CLR.black } },
    alignment: { horizontal: 'center', vertical: 'middle' },
  });
  setCell(ws, 7, 11, totalKg ? formatDgWeightKgDisplay(totalKg) : null, {
    font: { name: ARIAL, size: 20, bold: true, color: { argb: CLR.cyan } },
    alignment: { horizontal: 'center', vertical: 'middle' },
  });

  addRangeBorder(ws, 7, 1, 7, 12, { bottom: true });
  addRangeBorder(ws, 1, 12, 8, 12, { right: true });
  addRangeBorder(ws, 2, 4, 3, 4, { right: true });
  addRangeBorder(ws, 3, 1, 3, 9, { bottom: true });
}

function buildTableHeaderRow(ws: ExcelJS.Worksheet): void {
  const headers: { col: number; text: string; size?: number }[] = [
    { col: 1, text: 'NO.' },
    { col: 2, text: 'POL' },
    { col: 3, text: 'POD' },
    { col: 4, text: 'Type' },
    { col: 5, text: 'Container-No.' },
    { col: 6, text: 'Stowage' },
    { col: 7, text: 'Class' },
    { col: 8, text: 'UN-No.' },
    { col: 9, text: 'MP/LQ' },
    { col: 10, text: 'FLASH POINT', size: 8 },
    { col: 11, text: 'PROPER SHIPPING NAME' },
    { col: 12, text: 'Weight, kg' },
  ];
  ws.getRow(TABLE_HEAD_ROW).height = 19.5;
  for (const h of headers) {
    setCell(ws, TABLE_HEAD_ROW, h.col, h.text, {
      font: { name: TIMES, size: h.size ?? 10, bold: false, color: { argb: CLR.black } },
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border: THIN,
    });
  }
}

function parseExportLineWeightKg(value: string, grossTotalKg: boolean): number | null {
  const raw = value.trim();
  if (!raw) return null;
  return grossTotalKg ? roundDgExportLineWeightKg(raw) : parseDgWeightKg(raw) || null;
}

function writeDataRow(
  ws: ExcelJS.Worksheet,
  rowIndex: number,
  row: DgManifestExcelRow,
  rowNo: number | '',
  grossTotalKg: boolean,
): void {
  ws.getRow(rowIndex).height = 30;
  const weight = parseExportLineWeightKg(row.weightKg, grossTotalKg);
  const values: { col: number; value: ExcelJS.CellValue; size?: number }[] = [
    { col: 1, value: rowNo === '' ? null : rowNo },
    { col: 2, value: row.pol },
    { col: 3, value: row.pod },
    { col: 4, value: row.type },
    { col: 5, value: row.containerNo },
    { col: 6, value: row.stowage },
    { col: 7, value: row.dgClass },
    { col: 8, value: row.unNo },
    { col: 9, value: row.mpLq },
    { col: 10, value: formatFlashPointExcel(row.flashPoint) },
    { col: 11, value: row.properShippingName, size: 8 },
    { col: 12, value: weight != null ? formatDgWeightKgDisplay(weight) : null },
  ];
  for (const v of values) {
    setCell(ws, rowIndex, v.col, v.value, {
      font: { name: ARIAL, size: v.size ?? 10, color: { argb: CLR.black } },
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border: THIN,
      fill: solidFill(CLR.white),
    });
  }
}

function buildClassSideBlock(
  ws: ExcelJS.Worksheet,
  containers: readonly DgOnboardContainer[],
  dataRows: readonly DgManifestExcelRow[],
  totalKg: number,
): void {
  const classes = dgOnboardClassSummaries(containers, true);

  mergeCells(ws, 7, COL_N, 8, COL_N);
  setCell(ws, 7, COL_N, 'CLASS', {
    font: { name: TIMES, size: 18, bold: true, color: { argb: CLR.red } },
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: MEDIUM,
  });

  mergeCells(ws, 7, COL_P, 8, COL_P);
  setCell(ws, 7, COL_P, totalKg ? formatDgWeightKgDisplay(totalKg) : null, {
    font: { name: ARIAL, size: 20, bold: true, color: { argb: CLR.cyan } },
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: MEDIUM,
  });

  let row = DATA_START;
  for (const entry of classes) {
    const classKg = exportClassTotalKg(dataRows, entry.dgClass);

    setCell(ws, row, COL_N, entry.dgClass, {
      font: { name: ARIAL, size: 24, bold: true, color: { argb: CLR.red } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: THIN,
    });
    setCell(ws, row, COL_P, classKg ? formatDgWeightKgDisplay(classKg) : null, {
      font: { name: ARIAL, size: 20, bold: true, color: { argb: CLR.navy } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: THIN,
      fill: solidFill(CLR.white),
    });
    row += 1;
  }
}

function buildUnReportBlock(
  ws: ExcelJS.Worksheet,
  dataRows: readonly DgManifestExcelRow[],
  classes: readonly { dgClass: string }[],
): void {
  mergeCells(ws, 8, COL_R, 8, COL_U);
  setCell(ws, 8, COL_R, 'UN numbers for operation report', {
    font: { name: ARIAL, size: 12, color: { argb: CLR.muted } },
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    border: MEDIUM,
  });

  let row = DATA_START;
  for (const entry of classes) {
    const unText = uniqueUnNumbersForClass(dataRows, entry.dgClass);
    mergeCells(ws, row, COL_R, row, COL_U);
    setCell(ws, row, COL_R, unText || null, {
      font: { name: ARIAL, size: 11, color: { argb: CLR.navy } },
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border: THIN,
    });
    row += 1;
  }
}

export function formatDgVesselDisplay(ship: ShipInfo): string {
  const name = ship.name?.trim();
  const cs = ship.callSign?.trim();
  if (name && cs) return `m/v "${name}" / ${cs}`;
  if (name) return `m/v "${name}"`;
  return cs ?? '';
}

/** POL/POD in manifest exports — port code, not full name. */
export function dgManifestPortCode(ref: string, ports: readonly Port[] = []): string {
  const code = portCode(ref, ports).trim();
  if (code) return code.toUpperCase();
  const v = ref.trim();
  if (!v) return '';
  const byCode = ports.find((p) => p.code && p.code.toLowerCase() === v.toLowerCase());
  return (byCode?.code ?? v).toUpperCase();
}

function mergeDgExportRowsInContainer(
  base: Pick<DgManifestExcelRow, 'pol' | 'pod' | 'type' | 'containerNo' | 'stowage'>,
  lines: readonly DgCargoLine[],
): DgManifestExcelRow[] {
  return mergeDgCargoLines(lines).map((row) => ({
    ...base,
    dgClass: row.dgClass,
    unNo: row.unNo,
    mpLq: row.mpLq,
    flashPoint: row.flashPoint,
    properShippingName: row.properShippingName,
    weightKg: formatDgWeightKgDisplay(row.weightSum) || String(row.weightSum),
  }));
}

function dgUnmergedExportRowsInContainer(
  base: Pick<DgManifestExcelRow, 'pol' | 'pod' | 'type' | 'containerNo' | 'stowage'>,
  lines: readonly DgCargoLine[],
): DgManifestExcelRow[] {
  const rows: DgManifestExcelRow[] = [];
  for (const line of lines) {
    if (!dgCargoLineHasCargo(line)) continue;
    rows.push({
      ...base,
      dgClass: line.dgClass.trim(),
      unNo: line.unNo.trim(),
      mpLq: line.mpLq.trim(),
      flashPoint: line.flashPoint.trim(),
      properShippingName: line.properShippingName.trim(),
      weightKg: line.weightKg.trim(),
    });
  }
  return rows;
}

export function dgContainersToExcelRows(
  containers: readonly DgOnboardContainer[],
  ports: readonly Port[] = [],
  options?: { mergeLines?: boolean; grossTotalKg?: boolean },
): DgManifestExcelRow[] {
  const mergeLines = options?.mergeLines !== false;
  const grossTotalKg = options?.grossTotalKg === true;
  const viewOptions = { manifestMergeLines: mergeLines, manifestGrossTotalKg: grossTotalKg };
  const weightPlan = planDgInventoryWeightDisplays(containers, viewOptions);
  const rows: DgManifestExcelRow[] = [];

  for (const container of containers) {
    const base = {
      pol: dgManifestPortCode(container.loadPort, ports),
      pod: dgManifestPortCode(container.dischargePort, ports),
      type: container.type.trim().toUpperCase(),
      containerNo: container.containerNo.trim(),
      stowage: container.stowage.trim(),
    };
    const displayLines = buildDgContainerDisplayLines(container, viewOptions, weightPlan);
    if (!displayLines.length) {
      rows.push({
        ...base,
        dgClass: '',
        unNo: '',
        mpLq: '',
        flashPoint: '',
        properShippingName: '',
        weightKg: '',
      });
      continue;
    }
    for (const line of displayLines) {
      if (
        !line.dgClass &&
        !line.unNo &&
        !line.properShippingName &&
        !line.weightKgDisplay &&
        !line.mpLq &&
        !line.flashPoint
      ) {
        continue;
      }
      rows.push({
        ...base,
        dgClass: line.dgClass,
        unNo: line.unNo,
        mpLq: line.mpLq,
        flashPoint: line.flashPoint,
        properShippingName: line.properShippingName,
        weightKg: line.weightKgDisplay,
      });
    }
  }
  return rows;
}

export function dgOnboardToExcelRows(
  onboard: readonly import('../models/dg-manifest.models').DgOnboardContainer[],
  ports: readonly Port[] = [],
): DgManifestExcelRow[] {
  const containers = onboard.filter((c) => c.status === 'onboard');
  return dgContainersToExcelRows(containers, ports).sort(compareDgManifestExportRowsByClass);
}

function formatDgManifestExcelDate(value: string | undefined | null): string {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-');
    return `${d}.${m}. ${y}`;
  }
  return formatDisplayDate(value);
}

function splitDgManifestExcelDate(value: string | undefined | null): { day: string; rest: string } {
  const formatted = formatDgManifestExcelDate(value);
  if (!formatted) return { day: '', rest: '' };
  const m = formatted.match(/^(\d{1,2})(\.\d{2}\.\s*\d{4})$/);
  if (m) return { day: m[1], rest: m[2] };
  return { day: formatted, rest: '' };
}

/** Port name in manifest header (PDF/Excel meta) — uppercase, not UN/LOC code. */
export function dgManifestHeaderPortName(ref: string, ports: readonly Port[] = []): string {
  const name = resolveManifestPortName(ref, ports);
  if (name) return name.toUpperCase();
  const v = ref.trim();
  return v ? v.toUpperCase() : '';
}

function formatFlashPointExcel(value: string): string {
  const v = value.trim();
  if (!v) return '';
  return v.replace(/\s*°C$/i, '').trim();
}

export async function buildDgManifestWorksheet(
  ws: ExcelJS.Worksheet,
  ship: ShipInfo,
  crew: readonly CrewMember[],
  library: DgLibrarySettings,
  ports: readonly Port[] = [],
  exportContext?: DgManifestExportContext,
): Promise<number> {
  const containers = exportContext?.containers ?? library.onboard.filter((c) => c.status === 'onboard');
  const mergeLines = exportContext?.mergeLines ?? true;
  const grossTotalKg = exportContext?.grossTotalKg === true;
  const dataRows = dgContainersToExcelRows(containers, ports, { mergeLines, grossTotalKg });
  const totalKg = dgContainersExportTotalKg(containers, grossTotalKg);
  const hasExportData = dataRows.some(
    (r) => r.dgClass || r.unNo || r.weightKg || r.properShippingName || r.containerNo,
  );

  applyColumnWidths(ws);
  buildReadinessBlock(ws, hasExportData);
  buildManifestHeader(ws, ship, crew, ports, totalKg);
  buildTableHeaderRow(ws);

  let lastDataRow = DATA_START - 1;
  if (!hasExportData) {
    const endRow = DATA_START + 18;
    mergeCells(ws, DATA_START, 1, endRow, 12);
    setCell(ws, DATA_START, 1, 'NO IMDG CARGO', {
      font: { name: TIMES, size: 84, bold: true, color: { argb: CLR.gray } },
      alignment: { horizontal: 'center', vertical: 'middle' },
    });
    lastDataRow = endRow;
  } else {
    let rowNo = 0;
    let lastContainer = '';

    dataRows.forEach((row, index) => {
      const r = DATA_START + index;
      const showNo = row.containerNo !== lastContainer;
      if (showNo) {
        rowNo += 1;
        lastContainer = row.containerNo;
      }
      writeDataRow(ws, r, row, showNo ? rowNo : '', grossTotalKg);
      lastDataRow = r;
    });
  }

  if (lastDataRow < DATA_START) lastDataRow = DATA_START;

  const classes = dgOnboardClassSummaries(containers, true);
  buildClassSideBlock(ws, containers, dataRows, totalKg);
  buildUnReportBlock(ws, dataRows, classes);

  const printLast = Math.max(lastDataRow + 2, 44);
  ws.pageSetup.printArea = `A1:U${printLast}`;
  ws.pageSetup.printTitlesRow = '1:9';
  ws.pageSetup.orientation = 'landscape';
  ws.pageSetup.paperSize = 9;
  ws.pageSetup.fitToPage = false;
  ws.views = [{ showGridLines: false, state: 'frozen', ySplit: 9 }];

  return lastDataRow;
}

export async function buildDgManifestExcelBytes(
  ship: ShipInfo,
  crew: readonly CrewMember[],
  library: DgLibrarySettings,
  ports: readonly Port[] = [],
  exportContext?: DgManifestExportContext,
): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CREW Documents';
  const ws = wb.addWorksheet(DG_MANIFEST_SHEET);
  await buildDgManifestWorksheet(ws, ship, crew, library, ports, exportContext);
  return workbookToBytes(wb);
}
