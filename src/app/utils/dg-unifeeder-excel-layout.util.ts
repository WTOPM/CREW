import ExcelJS from 'exceljs';
import { parseDgWeightKg } from '../models/dg-manifest.models';
import type { DgUnifeederRow } from '../models/dg-unifeeder.models';
import { portCode, resolveManifestPortName, type Port, type ShipInfo } from '../models/crew.models';
import type { DgPageContext } from './page-ship-context.util';
import { normalizeMfagEmsCode } from './dg-mfag-schedule.util';
import { unifeederExportWeightKg } from './dg-unifeeder-weight.util';
import { workbookToBytes } from './crew-list-excel-layout.util';

export interface UnifeederDgExcelExportOptions {
  grossTotalKg?: boolean;
}

export const UNIFEEDER_DG_EXCEL_SHEET = 'DG list';

const PAGE_HEIGHT = 39;
const TABLE_HEAD_ROW = 12;
const DATA_FIRST_ROW = 13;
const DATA_ROW_COUNT = 25;
const TOTAL_ROW = 38;
const FOOTER_ROW = 39;

function pageAbsRow(pageStart: number, localRow: number): number {
  return pageStart + localRow - 1;
}

function exportPageCount(rowCount: number): number {
  return Math.max(1, Math.ceil(rowCount / DATA_ROW_COUNT));
}

function slicePageRows(rows: readonly DgUnifeederRow[], pageIndex: number): (DgUnifeederRow | undefined)[] {
  const start = pageIndex * DATA_ROW_COUNT;
  const slice = rows.slice(start, start + DATA_ROW_COUNT);
  const page: (DgUnifeederRow | undefined)[] = [];
  for (let i = 0; i < DATA_ROW_COUNT; i++) {
    page.push(slice[i]);
  }
  return page;
}

function exportTotalKg(rows: readonly DgUnifeederRow[], grossTotalKg: boolean): number {
  let total = 0;
  for (const row of rows) {
    total += parseDgWeightKg(row.weightKg);
  }
  return grossTotalKg ? Math.round(total) : total;
}

function buildExportWeightMap(
  rows: readonly DgUnifeederRow[],
  grossTotalKg: boolean,
): Map<string, number> {
  return unifeederExportWeightKg(rows, grossTotalKg);
}

const COL_WIDTHS: readonly number[] = [
  15.43, 13.71, 10.86, 15.43, 17.29, 17.29, 15.43, 10.86, 11.86, 10.86, 10.86, 10.86,
];

const TIMES = 'Times New Roman';
const ARIAL = 'Arial';
const BLACK = 'FF000000';

const thinEdge = { style: 'thin' as const, color: { argb: BLACK } };
const thickEdge = { style: 'medium' as const, color: { argb: BLACK } };

const FONT_BLACK = { color: { argb: BLACK } };

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
    numFmt?: string;
  } = {},
): ExcelJS.Cell {
  const cell = ws.getCell(row, col);
  cell.value = value;
  if (style.font) cell.font = { ...FONT_BLACK, ...style.font } as ExcelJS.Font;
  else cell.font = { ...(cell.font ?? {}), ...FONT_BLACK } as ExcelJS.Font;
  if (style.alignment) cell.alignment = style.alignment as ExcelJS.Alignment;
  if (style.border) cell.border = style.border as ExcelJS.Borders;
  if (style.numFmt) cell.numFmt = style.numFmt;
  return cell;
}

function patchBorder(cell: ExcelJS.Cell, patch: Partial<ExcelJS.Borders>): void {
  cell.border = { ...(cell.border ?? {}), ...patch } as ExcelJS.Borders;
}

function applyHorizontalEdges(
  ws: ExcelJS.Worksheet,
  row: number,
  c1: number,
  c2: number,
  edges: { top?: ExcelJS.Border; bottom?: ExcelJS.Border },
): void {
  for (let c = c1; c <= c2; c++) {
    const cell = ws.getCell(row, c);
    if (edges.top) patchBorder(cell, { top: edges.top });
    if (edges.bottom) patchBorder(cell, { bottom: edges.bottom });
  }
}

function applyVerticalEdges(
  ws: ExcelJS.Worksheet,
  col: number,
  r1: number,
  r2: number,
  edges: { left?: ExcelJS.Border; right?: ExcelJS.Border },
): void {
  for (let r = r1; r <= r2; r++) {
    const cell = ws.getCell(r, col);
    if (edges.left) patchBorder(cell, { left: edges.left });
    if (edges.right) patchBorder(cell, { right: edges.right });
  }
}

function parseIsoDate(value: string): Date | null {
  const v = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const [y, m, d] = v.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** English date text — independent of PC/Excel locale (e.g. 21 Nov 2025). */
function formatEnglishDateText(value: string): string {
  const dt = parseIsoDate(value);
  if (!dt) return value.trim();
  return `${dt.getDate()} ${EN_MONTHS[dt.getMonth()]} ${dt.getFullYear()}`;
}

function resolvePortLabel(raw: string, ports: readonly Port[]): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const direct = portCode(trimmed, ports);
  if (direct) return direct;
  if (ports.some((p) => p.code.toLowerCase() === trimmed.toLowerCase())) {
    return trimmed.toUpperCase();
  }
  const name = resolveManifestPortName(trimmed, ports);
  if (name) {
    const fromName = portCode(name, ports);
    if (fromName) return fromName;
  }
  return trimmed;
}

function formatAmountKgValue(
  data: DgUnifeederRow | undefined,
  exportKg?: number,
): { value: ExcelJS.CellValue; numFmt?: string } {
  if (!data) return { value: '' };
  const amount = exportKg !== undefined ? exportKg : parseDgWeightKg(data.weightKg);
  if (amount > 0) {
    const wholeKg = Math.abs(amount - Math.round(amount)) <= 1e-9;
    return {
      value: wholeKg ? Math.round(amount) : amount,
      numFmt: wholeKg ? '#,##0" kg"' : '#,##0.##" kg"',
    };
  }
  const raw = data.weightKg.trim();
  if (!raw) return { value: '' };
  if (/\bkg\b/i.test(raw)) return { value: raw };
  return { value: `${raw} kg` };
}

function formatRemarksFlashPoint(value: string): string {
  const v = value.trim();
  if (!v) return '';
  return v.replace(/\s*°\s*C\s*$/i, ' C').replace(/\s*°C$/i, ' C');
}

function remarksLqLabel(value: string): string {
  const v = value.trim().toUpperCase();
  if (!v || v === 'NO' || v === 'N' || v === '—' || v === '--') return '';
  if (v === 'YES' || v === 'Y' || v === 'LQ') return 'LQ';
  return value.trim();
}

function remarksMpLabel(value: string): string {
  const v = value.trim().toUpperCase();
  if (!v || v === 'NO' || v === 'N') return '';
  if (v === 'YES' || v === 'Y' || v === 'MP') return 'MP';
  return value.trim();
}

const REMARKS_COL_K = 11;
const REMARKS_COL_L = 12;

function remarksSplitBorders(): { k: Partial<ExcelJS.Borders>; l: Partial<ExcelJS.Borders>; merged: Partial<ExcelJS.Borders> } {
  const merged = { top: thinEdge, left: thinEdge, bottom: thinEdge, right: thinEdge };
  return {
    k: { top: thinEdge, left: thinEdge, bottom: thinEdge },
    l: { top: thinEdge, right: thinEdge, bottom: thinEdge },
    merged,
  };
}

/** Flash point (K left), LQ (K/L center), MP (L right). Split K+L when multiple parts. */
function writeRemarksRow(
  ws: ExcelJS.Worksheet,
  row: number,
  data: DgUnifeederRow | undefined,
  bodyFont: Partial<ExcelJS.Font>,
): void {
  const borders = remarksSplitBorders();
  const valign = { vertical: 'middle' as const };

  if (!data) {
    mergeCells(ws, row, REMARKS_COL_K, row, REMARKS_COL_L);
    setCell(ws, row, REMARKS_COL_K, '', {
      font: bodyFont,
      alignment: { horizontal: 'center', ...valign },
      border: borders.merged,
    });
    return;
  }

  const left = formatRemarksFlashPoint(data.flashPoint);
  const center = remarksLqLabel(data.lq);
  const right = remarksMpLabel(data.marinePollutant);
  const hasLeft = !!left;
  const hasCenter = !!center;
  const hasRight = !!right;

  if (!hasLeft && !hasCenter && !hasRight) {
    mergeCells(ws, row, REMARKS_COL_K, row, REMARKS_COL_L);
    setCell(ws, row, REMARKS_COL_K, '', {
      font: bodyFont,
      alignment: { horizontal: 'center', ...valign },
      border: borders.merged,
    });
    return;
  }

  const partCount = [hasLeft, hasCenter, hasRight].filter(Boolean).length;
  if (partCount === 1) {
    mergeCells(ws, row, REMARKS_COL_K, row, REMARKS_COL_L);
    const text = left || center || right;
    const horizontal = hasLeft ? 'left' : hasCenter ? 'center' : 'right';
    setCell(ws, row, REMARKS_COL_K, text, {
      font: bodyFont,
      alignment: { horizontal, ...valign },
      border: borders.merged,
    });
    return;
  }

  if (hasLeft && hasRight && !hasCenter) {
    setCell(ws, row, REMARKS_COL_K, left, {
      font: bodyFont,
      alignment: { horizontal: 'left', ...valign },
      border: borders.k,
    });
    setCell(ws, row, REMARKS_COL_L, right, {
      font: bodyFont,
      alignment: { horizontal: 'right', ...valign },
      border: borders.l,
    });
    return;
  }

  if (hasLeft && hasCenter && !hasRight) {
    setCell(ws, row, REMARKS_COL_K, left, {
      font: bodyFont,
      alignment: { horizontal: 'left', ...valign },
      border: borders.k,
    });
    setCell(ws, row, REMARKS_COL_L, center, {
      font: bodyFont,
      alignment: { horizontal: 'center', ...valign },
      border: borders.l,
    });
    return;
  }

  if (!hasLeft && hasCenter && hasRight) {
    setCell(ws, row, REMARKS_COL_K, center, {
      font: bodyFont,
      alignment: { horizontal: 'center', ...valign },
      border: borders.k,
    });
    setCell(ws, row, REMARKS_COL_L, right, {
      font: bodyFont,
      alignment: { horizontal: 'right', ...valign },
      border: borders.l,
    });
    return;
  }

  setCell(ws, row, REMARKS_COL_K, `${left}  ${center}`, {
    font: bodyFont,
    alignment: { horizontal: 'left', ...valign },
    border: borders.k,
  });
  setCell(ws, row, REMARKS_COL_L, right, {
    font: bodyFont,
    alignment: { horizontal: 'right', ...valign },
    border: borders.l,
  });
}

function formatEms(fire: string, spillage: string): string {
  const f = normalizeMfagEmsCode(fire);
  const s = normalizeMfagEmsCode(spillage);
  if (f && s) return `${f} ${s}`;
  return f || s;
}

function formatMfagPages(fireSchedule: string, spillageSchedule: string): string {
  return [fireSchedule.trim(), spillageSchedule.trim()].filter(Boolean).join(' ');
}

function prepareExportRows(rows: readonly DgUnifeederRow[]): DgUnifeederRow[] {
  return rows.filter((row) => row.containerNo.trim());
}

const LOGO_COL_END = 2;
const COMPANY_COL_START = 3;

async function tryLoadRambowFlag(wb: ExcelJS.Workbook): Promise<number | null> {
  try {
    const res = await fetch('/rambow-flag.png');
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    if (!buffer.byteLength) return null;
    return wb.addImage({ buffer, extension: 'png' });
  } catch {
    return null;
  }
}

function buildHeaderBlock(
  ws: ExcelJS.Worksheet,
  pageStart: number,
  pageNumber: number,
  ship: ShipInfo,
  ctx: DgPageContext,
  ports: readonly Port[],
): void {
  const r = (local: number) => pageAbsRow(pageStart, local);

  ws.getRow(r(1)).height = 37.5;
  for (let local = 2; local <= 6; local++) ws.getRow(r(local)).height = 12.75;

  mergeCells(ws, r(1), 1, r(6), LOGO_COL_END);
  mergeCells(ws, r(1), COMPANY_COL_START, r(6), 12);
  setCell(ws, r(1), COMPANY_COL_START, 'Rambow Bereederungs GmbH & Co.KG', {
    font: { name: TIMES, size: 24, bold: true },
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
  });

  applyHorizontalEdges(ws, r(1), 1, 12, { top: thickEdge });
  applyVerticalEdges(ws, 1, r(1), r(6), { left: thickEdge });
  applyVerticalEdges(ws, 12, r(1), r(6), { right: thickEdge });
  applyHorizontalEdges(ws, r(6), 1, 12, { bottom: thinEdge });

  ws.getRow(r(7)).height = 15;
  mergeCells(ws, r(7), 1, r(7), 10);
  setCell(ws, r(7), 1, 'Dangerous Goods', {
    font: { name: TIMES, size: 10 },
    alignment: { horizontal: 'center', vertical: 'middle' },
  });
  setCell(ws, r(7), 11, 'Page »', {
    font: { name: TIMES, size: 8 },
    alignment: { horizontal: 'right', vertical: 'middle' },
  });
  setCell(ws, r(7), 12, pageNumber, {
    font: { name: TIMES, size: 8 },
    alignment: { horizontal: 'center', vertical: 'middle' },
  });

  applyHorizontalEdges(ws, r(7), 1, 10, { top: thinEdge, bottom: thickEdge });
  applyVerticalEdges(ws, 1, r(7), r(7), { left: thickEdge });
  applyVerticalEdges(ws, 10, r(7), r(7), { right: thinEdge });
  applyHorizontalEdges(ws, r(7), 11, 11, { top: thinEdge, bottom: thickEdge });
  applyHorizontalEdges(ws, r(7), 12, 12, { top: thinEdge, bottom: thickEdge });
  patchBorder(ws.getCell(r(7), 12), { right: thickEdge });

  ws.getRow(r(8)).height = 12.75;

  ws.getRow(r(9)).height = 13.5;
  setCell(ws, r(9), 1, "Ship's Name:", {
    font: { name: ARIAL, size: 10 },
    alignment: { horizontal: 'left', vertical: 'middle' },
  });
  setCell(ws, r(9), 2, ship.name.trim(), {
    font: { name: ARIAL, size: 11, bold: true },
    alignment: { horizontal: 'center', vertical: 'middle' },
  });
  setCell(ws, r(9), 4, 'Date:', {
    font: { name: ARIAL, size: 10 },
    alignment: { horizontal: 'right', vertical: 'middle' },
  });
  setCell(ws, r(9), 5, formatEnglishDateText(ctx.dateOfDeparture || ship.dateOfDeparture), {
    font: { name: ARIAL, size: 11, bold: true },
    alignment: { horizontal: 'center', vertical: 'middle' },
  });
  setCell(ws, r(9), 7, 'Voyage No.:', {
    font: { name: ARIAL, size: 10 },
    alignment: { horizontal: 'left', vertical: 'middle' },
  });
  mergeCells(ws, r(9), 8, r(9), 9);
  setCell(ws, r(9), 8, ship.voyageNumber.trim(), {
    font: { name: ARIAL, size: 10, bold: true },
    alignment: { horizontal: 'center', vertical: 'middle', shrinkToFit: true },
  });
  setCell(ws, r(9), 10, 'from:', {
    font: { name: ARIAL, size: 10 },
    alignment: { horizontal: 'left', vertical: 'middle' },
  });
  setCell(ws, r(9), 11, resolvePortLabel(ctx.portOfCall || ship.portOfCall, ports), {
    font: { name: ARIAL, size: 11, bold: true },
    alignment: { horizontal: 'center', vertical: 'middle' },
  });
  setCell(ws, r(9), 12, `to: ${resolvePortLabel(ctx.nextPortOfCall || ship.nextPortOfCall, ports)}`, {
    font: { name: ARIAL, size: 10, bold: true },
    alignment: { horizontal: 'center', vertical: 'middle', shrinkToFit: true },
  });

  ws.getRow(r(10)).height = 12.75;

  ws.getRow(r(11)).height = 12.75;
  setCell(ws, r(11), 1, 'EmS and MFAG enter chapter no. / relevant pages', {
    font: { name: TIMES, size: 12 },
    alignment: { horizontal: 'left', vertical: 'middle' },
  });
}

function buildTableHeader(ws: ExcelJS.Worksheet, pageStart: number): void {
  const headRow = pageAbsRow(pageStart, TABLE_HEAD_ROW);
  ws.getRow(headRow).height = 31.5;
  const headFont = { name: TIMES, size: 12 };
  const headAlign = { horizontal: 'center' as const, vertical: 'top' as const, wrapText: true };
  const headBorder = { top: thinEdge, left: thinEdge, bottom: thinEdge, right: thinEdge };

  const headers: { col: number; text: string; wrap?: boolean; merge?: [number, number] }[] = [
    { col: 1, text: 'IMO Class' },
    { col: 2, text: 'UN No.' },
    { col: 3, text: 'Packing Group', wrap: true },
    { col: 4, text: 'Amount' },
    { col: 5, text: 'Bay / Position', wrap: true },
    { col: 6, text: 'Cont. ID' },
    { col: 7, text: 'Loaded in' },
    { col: 8, text: 'Destination' },
    { col: 9, text: 'EmS' },
    { col: 10, text: 'MFAG' },
    { col: 11, text: 'Remarks', merge: [11, 12] },
  ];

  for (const h of headers) {
    if (h.merge) mergeCells(ws, headRow, h.merge[0], headRow, h.merge[1]);
    setCell(ws, headRow, h.col, h.text, {
      font: headFont,
      alignment: { ...headAlign, wrapText: h.wrap ?? false },
      border: headBorder,
    });
  }
  patchBorder(ws.getCell(headRow, 12), headBorder);
}

function writeDataRow(
  ws: ExcelJS.Worksheet,
  row: number,
  data: DgUnifeederRow | undefined,
  ports: readonly Port[],
  exportWeights: Map<string, number>,
): void {
  const thinAll = { top: thinEdge, left: thinEdge, bottom: thinEdge, right: thinEdge };
  const bodyFont = { name: ARIAL, size: 10, bold: true };
  const center = { horizontal: 'center' as const, vertical: 'middle' as const };
  const amountCell = formatAmountKgValue(data, data ? exportWeights.get(data.id) : undefined);

  const values: {
    col: number;
    value: ExcelJS.CellValue;
    font?: Partial<ExcelJS.Font>;
    align?: Partial<ExcelJS.Alignment>;
    numFmt?: string;
  }[] = [
    { col: 1, value: data?.dgClass ?? '' },
    { col: 2, value: data?.unNo ?? '' },
    { col: 3, value: data?.packingGroup ?? '' },
    { col: 4, value: amountCell.value, numFmt: amountCell.numFmt },
    { col: 5, value: data?.stow ?? '' },
    { col: 6, value: data?.containerNo ?? '', align: { horizontal: 'left', vertical: 'middle' } },
    {
      col: 7,
      value: data ? resolvePortLabel(data.loadPort, ports) : '',
    },
    {
      col: 8,
      value: data ? resolvePortLabel(data.dischargePort, ports) : '',
    },
    {
      col: 9,
      value: data ? formatEms(data.fire, data.spillage) : '',
      font: { name: ARIAL, size: 9, bold: true },
    },
    {
      col: 10,
      value: data ? formatMfagPages(data.fireSchedule, data.spillageSchedule) : '',
      font: { name: ARIAL, size: 6, bold: true },
    },
  ];

  for (const item of values) {
    setCell(ws, row, item.col, item.value, {
      font: item.font ?? bodyFont,
      alignment: item.align ?? center,
      border: thinAll,
      numFmt: item.numFmt,
    });
  }

  writeRemarksRow(ws, row, data, bodyFont);
}

function buildPageDataRows(
  ws: ExcelJS.Worksheet,
  pageStart: number,
  pageRows: readonly (DgUnifeederRow | undefined)[],
  ports: readonly Port[],
  exportWeights: Map<string, number>,
): void {
  for (let i = 0; i < DATA_ROW_COUNT; i++) {
    writeDataRow(ws, pageAbsRow(pageStart, DATA_FIRST_ROW + i), pageRows[i], ports, exportWeights);
  }
}

function buildTotalRow(ws: ExcelJS.Worksheet, pageStart: number, totalKg: number, grossTotalKg: boolean): void {
  const totalRow = pageAbsRow(pageStart, TOTAL_ROW);
  mergeCells(ws, totalRow, 2, totalRow, 3);
  setCell(ws, totalRow, 2, 'TOTAL WEIGHT:', {
    font: { name: ARIAL, size: 10, bold: true },
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: { top: thinEdge },
  });
  patchBorder(ws.getCell(totalRow, 3), { top: thinEdge });
  setCell(ws, totalRow, 4, totalKg, {
    font: { name: ARIAL, size: 10, bold: true },
    alignment: { horizontal: 'center', vertical: 'middle' },
    numFmt: grossTotalKg ? '#,##0" kg"' : '#,##0.0" kg"',
  });
}

function buildFooterRow(ws: ExcelJS.Worksheet, pageStart: number): void {
  const footerRow = pageAbsRow(pageStart, FOOTER_ROW);
  mergeCells(ws, footerRow, 1, footerRow, 5);
  setCell(ws, footerRow, 1, 'This list is in compliance with ISPS Code regulation B 9.7.7', {
    font: { name: ARIAL, size: 10 },
    alignment: { horizontal: 'center', vertical: 'middle' },
  });
}

function buildPageBlock(
  ws: ExcelJS.Worksheet,
  pageStart: number,
  pageNumber: number,
  pageRows: readonly (DgUnifeederRow | undefined)[],
  ship: ShipInfo,
  ctx: DgPageContext,
  ports: readonly Port[],
  exportWeights: Map<string, number>,
  options: { showTotal: boolean; totalKg: number; grossTotalKg: boolean },
): void {
  buildHeaderBlock(ws, pageStart, pageNumber, ship, ctx, ports);
  buildTableHeader(ws, pageStart);
  buildPageDataRows(ws, pageStart, pageRows, ports, exportWeights);
  if (options.showTotal) {
    buildTotalRow(ws, pageStart, options.totalKg, options.grossTotalKg);
  }
  buildFooterRow(ws, pageStart);
}

function applyColumnWidths(ws: ExcelJS.Worksheet): void {
  COL_WIDTHS.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
}

function configurePrint(ws: ExcelJS.Worksheet, pageCount: number): void {
  const lastRow = pageCount * PAGE_HEIGHT;
  ws.pageSetup = {
    paperSize: 9,
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    margins: {
      left: 0.2,
      right: 0.2,
      top: 0.3,
      bottom: 0.3,
      header: 0,
      footer: 0,
    },
    printArea: `A1:L${lastRow}`,
  };
  ws.views = [{ showGridLines: false }];
}

export async function buildUnifeederDgListExcelBytes(
  ship: ShipInfo,
  ctx: DgPageContext,
  rows: readonly DgUnifeederRow[],
  ports: readonly Port[] = [],
  options: UnifeederDgExcelExportOptions = {},
): Promise<Uint8Array> {
  const grossTotalKg = options.grossTotalKg === true;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CREW Documents';
  const ws = wb.addWorksheet(UNIFEEDER_DG_EXCEL_SHEET);
  applyColumnWidths(ws);

  const exportRows = prepareExportRows(rows);
  const exportWeights = buildExportWeightMap(exportRows, grossTotalKg);
  const pageCount = exportPageCount(exportRows.length);
  const totalKg = exportTotalKg(exportRows, grossTotalKg);

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
    const pageStart = pageIndex * PAGE_HEIGHT + 1;
    buildPageBlock(
      ws,
      pageStart,
      pageIndex + 1,
      slicePageRows(exportRows, pageIndex),
      ship,
      ctx,
      ports,
      exportWeights,
      {
        showTotal: pageIndex === pageCount - 1,
        totalKg,
        grossTotalKg,
      },
    );
    if (pageIndex < pageCount - 1) {
      ws.getRow(pageAbsRow(pageStart, FOOTER_ROW)).addPageBreak();
    }
  }

  configurePrint(ws, pageCount);

  const imageId = await tryLoadRambowFlag(wb);
  if (imageId != null) {
    for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
      const rowOffset = pageIndex * PAGE_HEIGHT;
      ws.addImage(imageId, {
        tl: { col: 0, row: rowOffset } as ExcelJS.Anchor,
        br: { col: LOGO_COL_END, row: rowOffset + 6 } as ExcelJS.Anchor,
        editAs: 'oneCell',
      });
    }
  }

  return workbookToBytes(wb);
}
