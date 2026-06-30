import { jsPDF } from 'jspdf';
import {
  dgContainersExportTotalKg,
  formatDgWeightKgDisplay,
  formatDgWeightKgGrossDisplay,
  resolveDgMasterName,
  type DgLibrarySettings,
} from '../models/dg-manifest.models';
import type { DgManifestExportContext } from '../models/dg-manifest-export.models';
import { CrewMember, ShipInfo, type Port } from '../models/crew.models';
import { formatDisplayDate } from './date.util';
import {
  dgContainersToExcelRows,
  dgManifestHeaderPortName,
  formatDgVesselDisplay,
  type DgManifestExcelRow,
} from './dg-manifest-excel-layout.util';
import { formatDgMpLqPdfDisplay } from './dg-cargo-merge.util';

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
  /** Keep value on one line (ISO codes, UN, etc.). */
  singleLine?: boolean;
  /** Fixed header lines (e.g. FLASH / POINT stacked). */
  headerLines?: readonly string[];
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
  {
    label: '',
    w: 13,
    align: 'center',
    value: (_r, i) => (i >= 0 ? String(i + 1) : ''),
    singleLine: true,
  },
  { label: 'POL', w: 26, align: 'center', value: (r) => r.pol, singleLine: true },
  { label: 'POD', w: 26, align: 'center', value: (r) => r.pod, singleLine: true },
  { label: 'Type', w: 24, align: 'center', value: (r) => r.type, singleLine: true },
  { label: 'Container-No.', w: 50, align: 'center', value: (r) => r.containerNo, singleLine: true },
  { label: 'Stowage', w: 26, align: 'center', value: (r) => r.stowage, singleLine: true },
  { label: 'Class', w: 20, align: 'center', value: (r) => r.dgClass, singleLine: true },
  { label: 'UN-No.', w: 24, align: 'center', value: (r) => r.unNo, singleLine: true },
  {
    label: 'MP/LQ',
    w: 22,
    align: 'center',
    value: (r) => formatDgMpLqPdfDisplay(r.mpLq),
    singleLine: true,
  },
  {
    label: 'FLASH POINT',
    headerLines: ['FLASH', 'POINT'],
    w: 26,
    align: 'center',
    value: (r) => r.flashPoint,
    singleLine: true,
  },
  { label: 'PROPER SHIPPING NAME', w: 0, align: 'left', value: (r) => r.properShippingName },
  {
    label: 'Weight, kg',
    w: 30,
    align: 'center',
    singleLine: true,
    value: (r) => r.weightKg,
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
  return formatDgWeightKgDisplay(value) || '0';
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
  singleLine = false,
  fontFamily: 'times' | 'helvetica' = 'times',
  fixedLines?: readonly string[],
): void {
  doc.setFont(fontFamily, style);
  doc.setTextColor(color?.r ?? 0, color?.g ?? 0, color?.b ?? 0);

  const pad = 1.5;
  const maxW = Math.max(4, w - pad * 2);
  const content = text || '';

  let fs = fontSize;
  doc.setFontSize(fs);

  if (fixedLines?.length) {
    const lines = [...fixedLines];
    const lineH = fs + 1.2;
    let textY = y + (h - lines.length * lineH) / 2 + fs * 0.85;
    for (const line of lines) {
      let textX = x + pad;
      if (align === 'center') textX = x + w / 2;
      else if (align === 'right') textX = x + w - pad;
      doc.text(line, textX, textY, { align });
      textY += lineH;
    }
    return;
  }

  if (singleLine) {
    while (fs > 5.5 && doc.getTextWidth(content) > maxW) {
      fs -= 0.25;
      doc.setFontSize(fs);
    }
    doc.setFontSize(fs);
    const textY = y + h / 2 + fs * 0.34;
    let textX = x + pad;
    if (align === 'center') textX = x + w / 2;
    else if (align === 'right') textX = x + w - pad;
    doc.text(content, textX, textY, { align });
    return;
  }

  doc.setFontSize(fontSize);
  const lines = (doc.splitTextToSize(content, maxW) as string[]).slice(0, 2);
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
  ports: readonly Port[] = [],
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

  const depPort = dgManifestHeaderPortName(ship.portOfCall ?? '', ports);
  const arrPort = dgManifestHeaderPortName(ship.nextPortOfCall ?? '', ports);

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

  const metaEndY = MARGIN + HEADER_H;
  const totalBoxH = metaEndY - y;
  strokeRect(doc, totalX, y, totalW, totalBoxH);
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
    if (!col.label) return;
    drawTextInCell(
      doc,
      col.label,
      xs[i],
      y,
      widths[i],
      TABLE_HEAD_H,
      'center',
      5.5,
      'bold',
      undefined,
      !col.headerLines?.length,
      'helvetica',
      col.headerLines,
    );
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
    drawTextInCell(
      doc,
      text,
      xs[i],
      y,
      widths[i],
      ROW_H,
      col.align,
      6.5,
      'bolditalic',
      undefined,
      col.singleLine,
    );
  });
}

function drawPageFooter(doc: jsPDF, pageNum: number, totalPages: number): void {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  const label = totalPages > 1 ? `Page ${pageNum}` : 'Page 1';
  doc.text(label, PAGE_W - MARGIN, PAGE_H - 6, { align: 'right' });
}

function drawNoImdgCargoOverlay(doc: jsPDF, tableY: number): void {
  const bodyTop = tableY + TABLE_HEAD_H;
  const bodyH = ROWS_PER_PAGE * ROW_H;
  const rect = { x: MARGIN, y: bodyTop, w: CONTENT_W, h: bodyH };

  doc.setFont('helvetica', 'bold');
  let fs = 96;
  doc.setFontSize(fs);
  doc.setTextColor(128, 128, 128);
  const maxW = rect.w - 12;
  while (fs > 42 && doc.getTextWidth('NO IMDG CARGO') > maxW) {
    fs -= 1;
    doc.setFontSize(fs);
  }
  doc.text('NO IMDG CARGO', rect.x + rect.w / 2, rect.y + rect.h / 2, {
    align: 'center',
    baseline: 'middle',
  });
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
  ports: readonly Port[],
): void {
  if (pageIndex > 0) {
    drawContinuationBanner(doc);
  } else {
    drawManifestHeader(doc, ship, crew, totalKg, ports);
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
  if (!allRows.length) {
    drawNoImdgCargoOverlay(doc, tableY);
  }
  drawPageFooter(doc, pageIndex + 1, totalPages);
}

export function buildDgManifestPdf(
  ship: ShipInfo,
  crew: readonly CrewMember[],
  library: DgLibrarySettings,
  ports: readonly Port[] = [],
  exportContext?: DgManifestExportContext,
): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const containers =
    exportContext?.containers ?? library.onboard.filter((c) => c.status === 'onboard');
  const mergeLines = exportContext?.mergeLines ?? true;
  const useGrossWeight = exportContext?.useGrossWeight !== false;
  const roundWeights = exportContext?.grossTotalKg === true;
  const allRows = dgContainersToExcelRows(containers, ports, {
    mergeLines,
    useGrossWeight,
    roundWeights,
  });
  const exportTotalKg = dgContainersExportTotalKg(
    containers,
    useGrossWeight,
    roundWeights,
    mergeLines,
  );
  const widths = resolveColWidths();
  const xs = colXs(widths);
  const totalPages = Math.max(1, Math.ceil(allRows.length / ROWS_PER_PAGE) || 1);

  for (let page = 0; page < totalPages; page++) {
    if (page > 0) doc.addPage();
    drawTablePage(
      doc,
      page,
      totalPages,
      allRows,
      widths,
      xs,
      ship,
      crew,
      exportTotalKg,
      page === 0,
      ports,
    );
  }

  return doc;
}

export function buildDgManifestPdfBytes(
  ship: ShipInfo,
  crew: readonly CrewMember[],
  library: DgLibrarySettings,
  ports: readonly Port[] = [],
  exportContext?: DgManifestExportContext,
): Uint8Array {
  const doc = buildDgManifestPdf(ship, crew, library, ports, exportContext);
  return new Uint8Array(doc.output('arraybuffer') as ArrayBuffer);
}
