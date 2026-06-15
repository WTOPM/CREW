import { jsPDF } from 'jspdf';
import { parseDgWeightKg } from '../models/dg-manifest.models';
import type { DgUnifeederRow } from '../models/dg-unifeeder.models';
import { portCode, resolveManifestPortName, type Port, type ShipInfo } from '../models/crew.models';
import type { DgPageContext } from './page-ship-context.util';
import { normalizeMfagEmsCode } from './dg-mfag-schedule.util';
import { unifeederExportWeightKg } from './dg-unifeeder-weight.util';

export interface UnifeederDgPdfExportOptions {
  grossTotalKg?: boolean;
}

const COL_WIDTHS: readonly number[] = [
  15.43, 13.71, 10.86, 15.43, 17.29, 17.29, 15.43, 10.86, 11.86, 10.86, 10.86, 10.86,
];

const PAGE_ROWS = 39;
const TABLE_HEAD_ROW = 12;
const DATA_FIRST_ROW = 13;
const DATA_ROW_COUNT = 25;
const TOTAL_ROW = 38;
const FOOTER_ROW = 39;
const LOGO_COL_END = 2;
const COMPANY_COL_START = 3;

const TIMES = 'times';
const BODY_FONT = 'helvetica';

const ROW_HEIGHTS: Readonly<Record<number, number>> = {
  1: 37.5,
  7: 15,
  8: 12.75,
  9: 13.5,
  10: 12.75,
  11: 12.75,
  12: 31.5,
  38: 15,
  39: 15,
};

function pageRowHeight(localRow: number): number {
  if (ROW_HEIGHTS[localRow] != null) return ROW_HEIGHTS[localRow];
  if (localRow >= 2 && localRow <= 6) return 12.75;
  if (localRow >= DATA_FIRST_ROW && localRow < DATA_FIRST_ROW + DATA_ROW_COUNT) return 15;
  return 12.75;
}

interface GridMetrics {
  originX: number;
  originY: number;
  scaleX: number;
  scaleY: number;
  colLeft: readonly number[];
  rowTop: readonly number[];
}

function buildGridMetrics(pageW: number, pageH: number): GridMetrics {
  const marginLeft = 18;
  const marginRight = 18;
  const marginTop = 14;
  const marginBottom = 12;

  const totalColUnits = COL_WIDTHS.reduce((a, b) => a + b, 0);
  const rowHeights: number[] = [];
  let totalRowUnits = 0;
  for (let row = 1; row <= PAGE_ROWS; row++) {
    const h = pageRowHeight(row);
    rowHeights.push(h);
    totalRowUnits += h;
  }

  const availW = pageW - marginLeft - marginRight;
  const availH = pageH - marginTop - marginBottom;
  const scaleX = availW / totalColUnits;
  const scaleY = availH / totalRowUnits;

  const colLeft: number[] = [0];
  for (const w of COL_WIDTHS) {
    colLeft.push(colLeft[colLeft.length - 1] + w * scaleX);
  }

  const rowTop: number[] = [0];
  for (const h of rowHeights) {
    rowTop.push(rowTop[rowTop.length - 1] + h * scaleY);
  }

  return {
    originX: marginLeft,
    originY: marginTop,
    scaleX,
    scaleY,
    colLeft,
    rowTop,
  };
}

function cellRect(
  metrics: GridMetrics,
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

function fontSize(metrics: GridMetrics, basePt: number): number {
  return Math.max(5, basePt * metrics.scaleY);
}

function strokeRect(
  doc: jsPDF,
  rect: { x: number; y: number; w: number; h: number },
  lineWidth = 0.35,
): void {
  doc.setDrawColor(0);
  doc.setLineWidth(lineWidth);
  doc.rect(rect.x, rect.y, rect.w, rect.h);
}

function drawTextInRect(
  doc: jsPDF,
  text: string,
  rect: { x: number; y: number; w: number; h: number },
  opts: {
    font?: string;
    size: number;
    align?: 'left' | 'center' | 'right';
    bold?: boolean;
    pad?: number;
  },
): void {
  const label = text.trim();
  if (!label) return;
  const font = opts.font ?? BODY_FONT;
  doc.setFont(font, opts.bold ? 'bold' : 'normal');
  doc.setFontSize(opts.size);
  doc.setTextColor(0);
  const pad = opts.pad ?? 2;
  const align = opts.align ?? 'center';
  const maxW = Math.max(2, rect.w - pad * 2);
  const lines =
    doc.getTextWidth(label) > maxW ? (doc.splitTextToSize(label, maxW) as string[]) : [label];

  if (lines.length === 1) {
    const x =
      align === 'left'
        ? rect.x + pad
        : align === 'right'
          ? rect.x + rect.w - pad
          : rect.x + rect.w / 2;
    doc.text(lines[0], x, rect.y + rect.h / 2, {
      align: align === 'left' ? 'left' : align === 'right' ? 'right' : 'center',
      baseline: 'middle',
    });
    return;
  }

  const lineH = opts.size * 1.12;
  const blockH = lines.length * lineH;
  let y = rect.y + (rect.h - blockH) / 2 + opts.size * 0.35;
  for (const line of lines) {
    const x =
      align === 'left'
        ? rect.x + pad
        : align === 'right'
          ? rect.x + rect.w - pad
          : rect.x + rect.w / 2;
    doc.text(line, x, y, {
      align: align === 'left' ? 'left' : align === 'right' ? 'right' : 'center',
      baseline: 'alphabetic',
    });
    y += lineH;
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

function formatAmountKgText(data: DgUnifeederRow | undefined, exportKg?: number): string {
  if (!data) return '';
  const amount = exportKg !== undefined ? exportKg : parseDgWeightKg(data.weightKg);
  if (amount > 0) {
    const wholeKg = Math.abs(amount - Math.round(amount)) <= 1e-9;
    const value = wholeKg ? Math.round(amount) : amount;
    return `${value.toLocaleString('en-US', { maximumFractionDigits: wholeKg ? 0 : 2 })} kg`;
  }
  const raw = data.weightKg.trim();
  if (!raw) return '';
  if (/\bkg\b/i.test(raw)) return raw;
  return `${raw} kg`;
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

interface RemarksLayout {
  merged: boolean;
  kText: string;
  lText: string;
  kAlign: 'left' | 'center' | 'right';
  lAlign: 'left' | 'center' | 'right';
  mergedAlign?: 'left' | 'center' | 'right';
}

function resolveRemarksLayout(data: DgUnifeederRow | undefined): RemarksLayout {
  const empty: RemarksLayout = {
    merged: true,
    kText: '',
    lText: '',
    kAlign: 'center',
    lAlign: 'center',
    mergedAlign: 'center',
  };
  if (!data) return empty;

  const left = formatRemarksFlashPoint(data.flashPoint);
  const center = remarksLqLabel(data.lq);
  const right = remarksMpLabel(data.marinePollutant);
  const hasLeft = !!left;
  const hasCenter = !!center;
  const hasRight = !!right;

  if (!hasLeft && !hasCenter && !hasRight) return empty;

  const partCount = [hasLeft, hasCenter, hasRight].filter(Boolean).length;
  if (partCount === 1) {
    const text = left || center || right;
    const align = hasLeft ? 'left' : hasCenter ? 'center' : 'right';
    return { merged: true, kText: text, lText: '', mergedAlign: align, kAlign: 'center', lAlign: 'center' };
  }

  if (hasLeft && hasRight && !hasCenter) {
    return { merged: false, kText: left, lText: right, kAlign: 'left', lAlign: 'right' };
  }
  if (hasLeft && hasCenter && !hasRight) {
    return { merged: false, kText: left, lText: center, kAlign: 'left', lAlign: 'center' };
  }
  if (!hasLeft && hasCenter && hasRight) {
    return { merged: false, kText: center, lText: right, kAlign: 'center', lAlign: 'right' };
  }
  return { merged: false, kText: `${left}  ${center}`, lText: right, kAlign: 'left', lAlign: 'right' };
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

function formatTotalKg(totalKg: number, grossTotalKg: boolean): string {
  if (grossTotalKg) {
    return `${Math.round(totalKg).toLocaleString('en-US')} kg`;
  }
  return `${totalKg.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`;
}

async function loadRambowFlagDataUrl(): Promise<string | null> {
  try {
    const res = await fetch('/rambow-flag.png');
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.size) return null;
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function drawHeaderBlock(
  doc: jsPDF,
  metrics: GridMetrics,
  pageNumber: number,
  ship: ShipInfo,
  ctx: DgPageContext,
  ports: readonly Port[],
  logoDataUrl: string | null,
): void {
  const thick = 1.1;
  const thin = 0.35;
  const titleSize = fontSize(metrics, 24);
  const metaLabelSize = fontSize(metrics, 10);
  const metaValueSize = fontSize(metrics, 11);
  const subSize = fontSize(metrics, 10);
  const pageLabelSize = fontSize(metrics, 8);
  const noteSize = fontSize(metrics, 12);

  const logoRect = cellRect(metrics, 1, 1, 6, LOGO_COL_END);
  const companyRect = cellRect(metrics, 1, COMPANY_COL_START, 6, 12);
  strokeRect(doc, cellRect(metrics, 1, 1, 6, 12), thick);
  strokeRect(doc, logoRect, thin);
  strokeRect(doc, companyRect, thin);

  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', logoRect.x + 1, logoRect.y + 1, logoRect.w - 2, logoRect.h - 2);
    } catch {
      // skip logo when image decode fails
    }
  }

  drawTextInRect(doc, 'Rambow Bereederungs GmbH & Co.KG', companyRect, {
    font: TIMES,
    size: titleSize,
    bold: true,
  });

  const titleRow = cellRect(metrics, 7, 1, 7, 10);
  const pageLabelRect = cellRect(metrics, 7, 11);
  const pageNumRect = cellRect(metrics, 7, 12);
  strokeRect(doc, titleRow, thin);
  strokeRect(doc, pageLabelRect, thin);
  strokeRect(doc, pageNumRect, thick);

  drawTextInRect(doc, 'Dangerous Goods', titleRow, { font: TIMES, size: subSize });
  drawTextInRect(doc, 'Page »', pageLabelRect, { font: TIMES, size: pageLabelSize, align: 'right', pad: 3 });
  drawTextInRect(doc, String(pageNumber), pageNumRect, { font: TIMES, size: pageLabelSize });

  const shipRow = 9;
  drawTextInRect(doc, "Ship's Name:", cellRect(metrics, shipRow, 1), {
    size: metaLabelSize,
    align: 'left',
    pad: 3,
  });
  drawTextInRect(doc, ship.name.trim(), cellRect(metrics, shipRow, 2), {
    size: metaValueSize,
    bold: true,
  });
  drawTextInRect(doc, 'Date:', cellRect(metrics, shipRow, 4), {
    size: metaLabelSize,
    align: 'right',
    pad: 3,
  });
  drawTextInRect(doc, formatEnglishDateText(ctx.dateOfDeparture || ship.dateOfDeparture), cellRect(metrics, shipRow, 5), {
    size: metaValueSize,
    bold: true,
  });
  drawTextInRect(doc, 'Voyage No.:', cellRect(metrics, shipRow, 7), {
    size: metaLabelSize,
    align: 'left',
    pad: 3,
  });
  drawTextInRect(doc, ship.voyageNumber.trim(), cellRect(metrics, shipRow, 8, shipRow, 9), {
    size: metaLabelSize,
    bold: true,
  });
  drawTextInRect(doc, 'from:', cellRect(metrics, shipRow, 10), {
    size: metaLabelSize,
    align: 'left',
    pad: 3,
  });
  drawTextInRect(doc, resolvePortLabel(ctx.portOfCall || ship.portOfCall, ports), cellRect(metrics, shipRow, 11), {
    size: metaValueSize,
    bold: true,
  });
  drawTextInRect(
    doc,
    `to: ${resolvePortLabel(ctx.nextPortOfCall || ship.nextPortOfCall, ports)}`,
    cellRect(metrics, shipRow, 12),
    { size: metaLabelSize, bold: true },
  );

  drawTextInRect(doc, 'EmS and MFAG enter chapter no. / relevant pages', cellRect(metrics, 11, 1, 11, 12), {
    font: TIMES,
    size: noteSize,
    align: 'left',
    pad: 4,
  });
}

function drawTableHeader(doc: jsPDF, metrics: GridMetrics): void {
  const headSize = fontSize(metrics, 12);
  const headRow = TABLE_HEAD_ROW;
  const headers: { col: number; text: string; col2?: number }[] = [
    { col: 1, text: 'IMO Class' },
    { col: 2, text: 'UN No.' },
    { col: 3, text: 'Packing Group' },
    { col: 4, text: 'Amount' },
    { col: 5, text: 'Bay / Position' },
    { col: 6, text: 'Cont. ID' },
    { col: 7, text: 'Loaded in' },
    { col: 8, text: 'Destination' },
    { col: 9, text: 'EmS' },
    { col: 10, text: 'MFAG' },
    { col: 11, text: 'Remarks', col2: 12 },
  ];

  for (const h of headers) {
    const rect = cellRect(metrics, headRow, h.col, headRow, h.col2 ?? h.col);
    strokeRect(doc, rect);
    drawTextInRect(doc, h.text, rect, { font: TIMES, size: headSize });
  }
}

function drawDataRow(
  doc: jsPDF,
  metrics: GridMetrics,
  row: number,
  data: DgUnifeederRow | undefined,
  ports: readonly Port[],
  exportWeights: Map<string, number>,
): void {
  const bodySize = fontSize(metrics, 10);
  const emsSize = fontSize(metrics, 9);
  const mfagSize = fontSize(metrics, 6);

  const values: { col: number; text: string; align?: 'left' | 'center' | 'right'; size?: number }[] = [
    { col: 1, text: data?.dgClass ?? '' },
    { col: 2, text: data?.unNo ?? '' },
    { col: 3, text: data?.packingGroup ?? '' },
    {
      col: 4,
      text: formatAmountKgText(data, data ? exportWeights.get(data.id) : undefined),
    },
    { col: 5, text: data?.stow ?? '' },
    { col: 6, text: data?.containerNo ?? '', align: 'left' },
    { col: 7, text: data ? resolvePortLabel(data.loadPort, ports) : '' },
    { col: 8, text: data ? resolvePortLabel(data.dischargePort, ports) : '' },
    { col: 9, text: data ? formatEms(data.fire, data.spillage) : '', size: emsSize },
    {
      col: 10,
      text: data ? formatMfagPages(data.fireSchedule, data.spillageSchedule) : '',
      size: mfagSize,
    },
  ];

  for (const item of values) {
    const rect = cellRect(metrics, row, item.col);
    strokeRect(doc, rect);
    drawTextInRect(doc, item.text, rect, {
      size: item.size ?? bodySize,
      align: item.align ?? 'center',
      bold: true,
      pad: item.align === 'left' ? 3 : 2,
    });
  }

  const remarks = resolveRemarksLayout(data);
  const remarksRect = cellRect(metrics, row, 11, row, 12);
  strokeRect(doc, remarksRect);
  if (remarks.merged) {
    drawTextInRect(doc, remarks.kText, remarksRect, {
      size: bodySize,
      align: remarks.mergedAlign ?? 'center',
      bold: true,
      pad: 3,
    });
    return;
  }

  const kRect = cellRect(metrics, row, 11);
  const lRect = cellRect(metrics, row, 12);
  drawTextInRect(doc, remarks.kText, kRect, { size: bodySize, align: remarks.kAlign, bold: true, pad: 3 });
  drawTextInRect(doc, remarks.lText, lRect, { size: bodySize, align: remarks.lAlign, bold: true, pad: 3 });
}

function drawTotalRow(doc: jsPDF, metrics: GridMetrics, totalKg: number, grossTotalKg: boolean): void {
  const bodySize = fontSize(metrics, 10);
  const labelRect = cellRect(metrics, TOTAL_ROW, 2, TOTAL_ROW, 3);
  const amountRect = cellRect(metrics, TOTAL_ROW, 4);
  strokeRect(doc, labelRect);
  strokeRect(doc, amountRect);
  drawTextInRect(doc, 'TOTAL WEIGHT:', labelRect, { size: bodySize, bold: true });
  drawTextInRect(doc, formatTotalKg(totalKg, grossTotalKg), amountRect, { size: bodySize, bold: true });
}

function drawFooterRow(doc: jsPDF, metrics: GridMetrics): void {
  const bodySize = fontSize(metrics, 10);
  const rect = cellRect(metrics, FOOTER_ROW, 1, FOOTER_ROW, 5);
  drawTextInRect(doc, 'This list is in compliance with ISPS Code regulation B 9.7.7', rect, {
    size: bodySize,
    align: 'center',
  });
}

function drawPageBlock(
  doc: jsPDF,
  metrics: GridMetrics,
  pageNumber: number,
  pageRows: readonly (DgUnifeederRow | undefined)[],
  ship: ShipInfo,
  ctx: DgPageContext,
  ports: readonly Port[],
  exportWeights: Map<string, number>,
  options: { showTotal: boolean; totalKg: number; grossTotalKg: boolean },
  logoDataUrl: string | null,
): void {
  drawHeaderBlock(doc, metrics, pageNumber, ship, ctx, ports, logoDataUrl);
  drawTableHeader(doc, metrics);
  for (let i = 0; i < DATA_ROW_COUNT; i++) {
    drawDataRow(doc, metrics, DATA_FIRST_ROW + i, pageRows[i], ports, exportWeights);
  }
  if (options.showTotal) {
    drawTotalRow(doc, metrics, options.totalKg, options.grossTotalKg);
  }
  drawFooterRow(doc, metrics);
}

export async function buildUnifeederDgListPdfBytes(
  ship: ShipInfo,
  ctx: DgPageContext,
  rows: readonly DgUnifeederRow[],
  ports: readonly Port[] = [],
  options: UnifeederDgPdfExportOptions = {},
): Promise<Uint8Array> {
  const grossTotalKg = options.grossTotalKg === true;
  const exportRows = prepareExportRows(rows);
  const exportWeights = unifeederExportWeightKg(exportRows, grossTotalKg);
  const pageCount = exportPageCount(exportRows.length);
  const totalKg = exportTotalKg(exportRows, grossTotalKg);
  const logoDataUrl = await loadRambowFlagDataUrl();

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const metrics = buildGridMetrics(pageW, pageH);

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
    if (pageIndex > 0) doc.addPage();
    drawPageBlock(
      doc,
      metrics,
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
      logoDataUrl,
    );
  }

  return new Uint8Array(doc.output('arraybuffer'));
}
