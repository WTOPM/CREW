import { jsPDF } from 'jspdf';
import {
  dgOnboardInventoryStats,
  parseDgWeightKg,
  resolveDgMasterName,
  type DgLibrarySettings,
} from '../models/dg-manifest.models';
import { CrewMember, ShipInfo } from '../models/crew.models';
import { formatDisplayDate } from './date.util';
import {
  dgOnboardToExcelRows,
  formatDgVesselDisplay,
  type DgManifestExcelRow,
} from './dg-manifest-excel-layout.util';

/** Portrait A4, pt */
const MARGIN = 11;
const PAGE_W = 595;
const PAGE_H = 842;
const FOOTER_H = 16;
const CONTENT_W = PAGE_W - MARGIN * 2;

const PORT_RED = { r: 185, g: 28, b: 28 };
const TOTAL_BLUE = { r: 2, g: 132, b: 199 };

const TITLE_H = 20;
const SHIP_ROW_H = 15;
const META_H = 30;
const TABLE_HEAD_H = 24;
const ROW_H = 16.2;

const HEADER_H = TITLE_H + SHIP_ROW_H + META_H + 3;
const TABLE_TOP = MARGIN + HEADER_H;
const TABLE_BOTTOM = PAGE_H - MARGIN - FOOTER_H;
const ROWS_PER_PAGE = Math.floor((TABLE_BOTTOM - TABLE_TOP - TABLE_HEAD_H) / ROW_H);

interface PdfCol {
  label: string;
  w: number;
  align: 'left' | 'center' | 'right';
  value: (row: DgManifestExcelRow, index: number) => string;
}

const EMPTY_ROW: DgManifestExcelRow = {
  pol: '',
  pod: '',
  type: '',
  containerNo: '',
  stowage: '',
  dgClass: '',
  unNo: '',
  mpLq: '',
  flashPoint: '',
  properShippingName: '',
  weightKg: '',
};

const COLS: PdfCol[] = [
  { label: '', w: 13, align: 'center', value: (_r, i) => (i >= 0 ? String(i + 1) : '') },
  { label: 'POL', w: 26, align: 'center', value: (r) => r.pol },
  { label: 'POD', w: 26, align: 'center', value: (r) => r.pod },
  { label: 'Type', w: 17, align: 'center', value: (r) => r.type },
  { label: 'Container-No.', w: 50, align: 'center', value: (r) => r.containerNo },
  { label: 'Stowage', w: 26, align: 'center', value: (r) => r.stowage },
  { label: 'Class', w: 20, align: 'center', value: (r) => r.dgClass },
  { label: 'UN-No.', w: 24, align: 'center', value: (r) => r.unNo },
  { label: 'MP/LQ', w: 18, align: 'center', value: (r) => r.mpLq },
  { label: 'FLASH POINT', w: 26, align: 'center', value: (r) => r.flashPoint },
  { label: 'PROPER SHIPPING NAME', w: 0, align: 'left', value: (r) => r.properShippingName },
  {
    label: 'Weight, kg',
    w: 30,
    align: 'center',
    value: (r) => {
      if (!r.weightKg) return '';
      const n = parseDgWeightKg(r.weightKg);
      return n ? String(Math.round(n * 10) / 10) : r.weightKg;
    },
  },
];

function resolveColWidths(): number[] {
  const fixed = COLS.reduce((sum, c) => sum + (c.w || 0), 0);
  const psnIndex = COLS.findIndex((c) => c.label === 'PROPER SHIPPING NAME');
  const psnW = Math.max(80, CONTENT_W - fixed);
  return COLS.map((c, i) => (i === psnIndex ? psnW : c.w));
}

function colXs(widths: number[]): number[] {
  const xs: number[] = [];
  let x = MARGIN;
  for (const w of widths) {
    xs.push(x);
    x += w;
  }
  return xs;
}

function formatTotalKg(value: number): string {
  if (!value) return '';
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function strokeRect(doc: jsPDF, x: number, y: number, w: number, h: number, lineWidth = 0.4): void {
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(lineWidth);
  doc.rect(x, y, w, h, 'S');
}

function drawTextInCell(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  align: 'left' | 'center' | 'right',
  fontSize = 7,
  style: 'normal' | 'bold' | 'italic' | 'bolditalic' = 'bolditalic',
  color?: { r: number; g: number; b: number },
): void {
  doc.setFont('times', style);
  doc.setFontSize(fontSize);
  if (color) doc.setTextColor(color.r, color.g, color.b);
  else doc.setTextColor(0, 0, 0);

  const pad = 1.5;
  const maxW = Math.max(4, w - pad * 2);
  const lines = (doc.splitTextToSize(text || '', maxW) as string[]).slice(0, 2);
  const lineH = fontSize + 1.5;
  let textY = y + (h - lines.length * lineH) / 2 + fontSize;

  for (const line of lines) {
    let textX = x + pad;
    if (align === 'center') textX = x + w / 2;
    else if (align === 'right') textX = x + w - pad;
    doc.text(line, textX, textY, { align });
    textY += lineH;
  }
}

function drawManifestHeader(
  doc: jsPDF,
  ship: ShipInfo,
  crew: readonly CrewMember[],
  totalKg: number,
): void {
  const y0 = MARGIN;
  strokeRect(doc, MARGIN, y0, CONTENT_W, HEADER_H, 0.6);

  let y = y0 + 4;
  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  const title = 'DANGEROUS GOODS MANIFEST';
  doc.text(title, PAGE_W / 2, y + 10, { align: 'center' });
  const tw = doc.getTextWidth(title);
  doc.setLineWidth(0.5);
  doc.line(PAGE_W / 2 - tw / 2, y + 12, PAGE_W / 2 + tw / 2, y + 12);
  y += TITLE_H;

  doc.setFont('times', 'bolditalic');
  doc.setFontSize(8.5);
  doc.text(formatDgVesselDisplay(ship), MARGIN + 4, y + 9);
  doc.text(`Voy. No. ${ship.voyageNumber?.trim() ?? ''}`, PAGE_W / 2, y + 9, { align: 'center' });
  doc.text(`Master: ${resolveDgMasterName(crew)}`, PAGE_W - MARGIN - 4, y + 9, { align: 'right' });
  y += SHIP_ROW_H;

  const leftW = CONTENT_W * 0.36;
  const midW = CONTENT_W * 0.28;
  const totalX = MARGIN + leftW + midW;
  const totalW = CONTENT_W - leftW - midW;
  const rowH = META_H / 2;

  const depPort = ship.portOfCall?.trim().toUpperCase() ?? '';
  const arrPort = ship.nextPortOfCall?.trim().toUpperCase() ?? '';

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  doc.text('Port of departure:', MARGIN + 4, y + 9);
  doc.setFont('times', 'bolditalic');
  doc.setTextColor(PORT_RED.r, PORT_RED.g, PORT_RED.b);
  doc.text(depPort, MARGIN + 72, y + 9);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text('Dep. Date:', MARGIN + leftW + 2, y + 9);
  doc.setFont('times', 'bolditalic');
  doc.text(formatDisplayDate(ship.dateOfDeparture), MARGIN + leftW + 46, y + 9);

  strokeRect(doc, totalX, y, totalW, META_H);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  doc.text('Total, kg:', totalX + totalW / 2, y + 9, { align: 'center' });

  y += rowH;

  doc.setFont('helvetica', 'normal');
  doc.text('Port of arrival:', MARGIN + 4, y + 9);
  doc.setFont('times', 'bolditalic');
  doc.setTextColor(PORT_RED.r, PORT_RED.g, PORT_RED.b);
  doc.text(arrPort, MARGIN + 72, y + 9);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text('Arr. Date:', MARGIN + leftW + 2, y + 9);
  doc.setFont('times', 'bolditalic');
  doc.text(formatDisplayDate(ship.dateOfArrival), MARGIN + leftW + 46, y + 9);

  doc.setFont('times', 'bolditalic');
  doc.setFontSize(12);
  doc.setTextColor(TOTAL_BLUE.r, TOTAL_BLUE.g, TOTAL_BLUE.b);
  doc.text(formatTotalKg(totalKg), totalX + totalW / 2, y + 10, { align: 'center' });
  doc.setTextColor(0, 0, 0);
}

function drawContinuationBanner(doc: jsPDF): void {
  const y0 = MARGIN;
  strokeRect(doc, MARGIN, y0, CONTENT_W, 18, 0.6);
  doc.setFont('times', 'bold');
  doc.setFontSize(10);
  doc.text('DANGEROUS GOODS MANIFEST', PAGE_W / 2, y0 + 12, { align: 'center' });
}

function drawTableHeader(doc: jsPDF, y: number, widths: number[], xs: number[]): void {
  COLS.forEach((col, i) => {
    strokeRect(doc, xs[i], y, widths[i], TABLE_HEAD_H);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(0, 0, 0);
    const labelLines = (doc.splitTextToSize(col.label, widths[i] - 3) as string[]).slice(0, 3);
    let ly = y + 7;
    for (const line of labelLines) {
      doc.text(line, xs[i] + widths[i] / 2, ly, { align: 'center' });
      ly += 6;
    }
  });
}

function drawDataRow(
  doc: jsPDF,
  row: DgManifestExcelRow,
  globalIndex: number,
  y: number,
  widths: number[],
  xs: number[],
  hasData: boolean,
): void {
  COLS.forEach((col, i) => {
    strokeRect(doc, xs[i], y, widths[i], ROW_H, 0.35);
    let text = '';
    if (col.label === '') {
      text = hasData ? String(globalIndex + 1) : '';
    } else if (hasData) {
      text = col.value(row, globalIndex);
    }
    drawTextInCell(doc, text, xs[i], y, widths[i], ROW_H, col.align, 6.5);
  });
}

function drawPageFooter(doc: jsPDF, pageNum: number, totalPages: number): void {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  const label = totalPages > 1 ? `Page ${pageNum}` : 'Page 1';
  doc.text(label, PAGE_W - MARGIN, PAGE_H - 6, { align: 'right' });
}

function drawTablePage(
  doc: jsPDF,
  pageIndex: number,
  totalPages: number,
  allRows: DgManifestExcelRow[],
  widths: number[],
  xs: number[],
  ship: ShipInfo,
  crew: readonly CrewMember[],
  totalKg: number,
  fullHeader: boolean,
): void {
  if (pageIndex > 0) {
    drawContinuationBanner(doc);
  } else {
    drawManifestHeader(doc, ship, crew, totalKg);
  }

  const tableY = fullHeader ? TABLE_TOP : MARGIN + 21;
  drawTableHeader(doc, tableY, widths, xs);

  const start = pageIndex * ROWS_PER_PAGE;
  let y = tableY + TABLE_HEAD_H;

  for (let r = 0; r < ROWS_PER_PAGE; r++) {
    const globalIndex = start + r;
    const hasData = globalIndex < allRows.length;
    const row = hasData ? allRows[globalIndex] : EMPTY_ROW;
    drawDataRow(doc, row, globalIndex, y, widths, xs, hasData);
    y += ROW_H;
  }

  strokeRect(doc, MARGIN, tableY, CONTENT_W, TABLE_HEAD_H + ROWS_PER_PAGE * ROW_H, 0.6);
  drawPageFooter(doc, pageIndex + 1, totalPages);
}

export function buildDgManifestPdf(
  ship: ShipInfo,
  crew: readonly CrewMember[],
  library: DgLibrarySettings,
): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const allRows = dgOnboardToExcelRows(library.onboard);
  const stats = dgOnboardInventoryStats(library.onboard, false);
  const widths = resolveColWidths();
  const xs = colXs(widths);

  const totalPages = Math.max(1, Math.ceil(allRows.length / ROWS_PER_PAGE) || 1);

  for (let page = 0; page < totalPages; page++) {
    if (page > 0) doc.addPage();
    drawTablePage(doc, page, totalPages, allRows, widths, xs, ship, crew, stats.totalKg, page === 0);
  }

  return doc;
}

export function buildDgManifestPdfBytes(
  ship: ShipInfo,
  crew: readonly CrewMember[],
  library: DgLibrarySettings,
): Uint8Array {
  const doc = buildDgManifestPdf(ship, crew, library);
  return new Uint8Array(doc.output('arraybuffer') as ArrayBuffer);
}
