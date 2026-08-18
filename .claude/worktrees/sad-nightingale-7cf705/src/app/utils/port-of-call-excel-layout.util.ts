import ExcelJS from 'exceljs';
import {
  POC_DATA_ROW_COUNT,
  POC_FRAME_LABELS,
  POC_STATIC_LABELS,
} from '../services/port-of-call-coordinates';
import { PortCallHistoryEntry, ShipInfo, formatPortCallPortName } from '../models/crew.models';
import { formatDisplayDate } from './date.util';

export const POC_EXCEL_SHEET = 'Port of Call List';
export const POC_EXCEL_COLS = 7;

/** Matches import script row 10 (0-based index 9) for first data row. */
export const POC_EXCEL_DATA_START = 10;

const FONT = 'Arial';
const BORDER_COLOR = 'FF000000';

const thin = { style: 'thin' as const, color: { argb: BORDER_COLOR } };
const medium = { style: 'medium' as const, color: { argb: BORDER_COLOR } };

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: thin,
  left: thin,
  bottom: thin,
  right: thin,
};

const MEDIUM_BORDER: Partial<ExcelJS.Borders> = {
  top: medium,
  left: medium,
  bottom: medium,
  right: medium,
};

/** Relative column widths from POC_COL_BOUNDS (voy…depTime). */
const COL_WIDTHS = [5.5, 28, 22, 13, 14, 14, 14];

export interface PocExcelLayout {
  titleRow: number;
  formTop: number;
  formBottom: number;
  dataStart: number;
  signatureRow: number;
}

function setBorder(cell: ExcelJS.Cell, border: Partial<ExcelJS.Borders>): void {
  cell.border = border as ExcelJS.Borders;
}

function styleLabel(cell: ExcelJS.Cell, align: 'left' | 'center' = 'left'): void {
  cell.font = { name: FONT, size: 8 };
  cell.alignment = { horizontal: align, vertical: 'top', wrapText: true };
  setBorder(cell, THIN_BORDER);
}

function styleValue(cell: ExcelJS.Cell, align: 'left' | 'center' = 'center'): void {
  cell.font = { name: FONT, size: 10, bold: true };
  cell.alignment = { horizontal: align, vertical: 'bottom', wrapText: true };
  setBorder(cell, THIN_BORDER);
}

function styleTableHead(cell: ExcelJS.Cell, align: 'left' | 'center' = 'left'): void {
  cell.font = { name: FONT, size: 8 };
  cell.alignment = { horizontal: align, vertical: 'middle', wrapText: true };
  setBorder(cell, THIN_BORDER);
}

function styleData(cell: ExcelJS.Cell, align: 'left' | 'center' = 'left'): void {
  cell.font = { name: FONT, size: 10 };
  cell.alignment = { horizontal: align, vertical: 'middle', wrapText: true };
  setBorder(cell, THIN_BORDER);
}

function merge(ws: ExcelJS.Worksheet, r1: number, c1: number, r2: number, c2: number): void {
  if (r1 === r2 && c1 === c2) return;
  ws.mergeCells(r1, c1, r2, c2);
}

function isoToExcelDate(iso: string): Date | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function writeDateCell(cell: ExcelJS.Cell, iso: string): void {
  const date = isoToExcelDate(iso);
  if (date) {
    cell.value = date;
    cell.numFmt = 'dd.mm.yyyy';
  } else {
    cell.value = formatDisplayDate(iso);
  }
  styleData(cell, 'center');
}

/** Draw static form (labels, borders, column headers) — identical grid to PDF. */
export function buildPocFormLayout(ws: ExcelJS.Worksheet): PocExcelLayout {
  COL_WIDTHS.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  const titleRow = 2;
  const formTop = 4;
  const headerValue1 = 5;
  const headerValue2 = 7;
  const tableHead1 = 8;
  const tableHead2 = 9;
  const dataStart = POC_EXCEL_DATA_START;
  const dataEnd = dataStart + POC_DATA_ROW_COUNT - 1;
  const signatureRow = dataEnd + 2;

  ws.mergeCells(titleRow, 1, titleRow, POC_EXCEL_COLS);
  const titleCell = ws.getCell(titleRow, 1);
  titleCell.value = POC_FRAME_LABELS.title;
  titleCell.font = { name: FONT, size: 14, bold: true, underline: true };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(titleRow).height = 22;

  // Row 4 — ship header labels
  ws.getCell(formTop, 2).value = POC_STATIC_LABELS.shipName;
  styleLabel(ws.getCell(formTop, 2));
  ws.getCell(formTop, 3).value = POC_STATIC_LABELS.callSign;
  styleLabel(ws.getCell(formTop, 3));
  merge(ws, formTop, 4, formTop, 5);
  ws.getCell(formTop, 4).value = POC_STATIC_LABELS.portOfArrival;
  styleLabel(ws.getCell(formTop, 4));
  merge(ws, formTop, 6, formTop, 7);
  ws.getCell(formTop, 6).value = POC_STATIC_LABELS.dateOfArrival;
  styleLabel(ws.getCell(formTop, 6));
  ws.getCell(formTop, 1).value = '';
  styleLabel(ws.getCell(formTop, 1));

  // Row 5 — ship header values (filled later)
  for (let c = 1; c <= POC_EXCEL_COLS; c++) {
    styleValue(ws.getCell(headerValue1, c), c === 1 ? 'center' : 'center');
  }
  merge(ws, headerValue1, 4, headerValue1, 5);
  merge(ws, headerValue1, 6, headerValue1, 7);

  // Row 6 — voyage labels
  ws.getCell(formTop + 2, 2).value = POC_STATIC_LABELS.nationality;
  styleLabel(ws.getCell(formTop + 2, 2));
  ws.getCell(formTop + 2, 3).value = POC_STATIC_LABELS.homeport;
  styleLabel(ws.getCell(formTop + 2, 3));
  merge(ws, formTop + 2, 4, formTop + 2, 5);
  ws.getCell(formTop + 2, 4).value = POC_STATIC_LABELS.arrivedFrom;
  styleLabel(ws.getCell(formTop + 2, 4));
  merge(ws, formTop + 2, 6, formTop + 2, 7);
  ws.getCell(formTop + 2, 6).value = POC_STATIC_LABELS.sailingTo;
  styleLabel(ws.getCell(formTop + 2, 6));
  ws.getCell(formTop + 2, 1).value = '';
  styleLabel(ws.getCell(formTop + 2, 1));

  // Row 7 — voyage values (filled later)
  for (let c = 1; c <= POC_EXCEL_COLS; c++) {
    styleValue(ws.getCell(headerValue2, c));
  }
  merge(ws, headerValue2, 4, headerValue2, 5);
  merge(ws, headerValue2, 6, headerValue2, 7);

  // Rows 8–9 — table column headers
  merge(ws, tableHead1, 1, tableHead2, 1);
  const voyCell = ws.getCell(tableHead1, 1);
  voyCell.value = '8.\nVoy.\nNo.';
  styleTableHead(voyCell, 'center');

  merge(ws, tableHead1, 2, tableHead2, 2);
  ws.getCell(tableHead1, 2).value = POC_STATIC_LABELS.lastPort;
  styleTableHead(ws.getCell(tableHead1, 2));

  merge(ws, tableHead1, 3, tableHead2, 3);
  ws.getCell(tableHead1, 3).value = POC_STATIC_LABELS.country;
  styleTableHead(ws.getCell(tableHead1, 3));

  merge(ws, tableHead1, 4, tableHead2, 4);
  ws.getCell(tableHead1, 4).value = POC_STATIC_LABELS.arrDate;
  styleTableHead(ws.getCell(tableHead1, 4));

  ws.getCell(tableHead1, 5).value = POC_STATIC_LABELS.arrTime;
  styleTableHead(ws.getCell(tableHead1, 5));
  ws.getCell(tableHead2, 5).value = POC_STATIC_LABELS.arrTimeSub;
  styleTableHead(ws.getCell(tableHead2, 5), 'center');

  merge(ws, tableHead1, 6, tableHead2, 6);
  ws.getCell(tableHead1, 6).value = POC_STATIC_LABELS.depDate;
  styleTableHead(ws.getCell(tableHead1, 6));

  ws.getCell(tableHead1, 7).value = POC_STATIC_LABELS.depTime;
  styleTableHead(ws.getCell(tableHead1, 7));
  ws.getCell(tableHead2, 7).value = POC_STATIC_LABELS.depTimeSub;
  styleTableHead(ws.getCell(tableHead2, 7), 'center');

  ws.getRow(formTop).height = 18;
  ws.getRow(headerValue1).height = 20;
  ws.getRow(formTop + 2).height = 18;
  ws.getRow(headerValue2).height = 20;
  ws.getRow(tableHead1).height = 16;
  ws.getRow(tableHead2).height = 14;

  // Data rows — empty grid
  for (let r = dataStart; r <= dataEnd; r++) {
    ws.getRow(r).height = 22;
    for (let c = 1; c <= POC_EXCEL_COLS; c++) {
      styleData(ws.getCell(r, c), c === 1 ? 'center' : 'left');
    }
  }

  // Signature row
  merge(ws, signatureRow, 1, signatureRow, POC_EXCEL_COLS);
  const sigCell = ws.getCell(signatureRow, 1);
  sigCell.value = POC_FRAME_LABELS.signature;
  sigCell.font = { name: FONT, size: 8 };
  sigCell.alignment = { horizontal: 'right', vertical: 'bottom', wrapText: true };
  setBorder(sigCell, THIN_BORDER);
  ws.getRow(signatureRow).height = 36;

  // Outer medium border + thick line above data (matches PDF line 05)
  for (let r = formTop; r <= signatureRow; r++) {
    for (let c = 1; c <= POC_EXCEL_COLS; c++) {
      const cell = ws.getCell(r, c);
      const border = { ...cell.border } as ExcelJS.Borders;
      if (r === formTop) border.top = medium;
      if (r === signatureRow) border.bottom = medium;
      if (c === 1) border.left = medium;
      if (c === POC_EXCEL_COLS) border.right = medium;
      if (r === tableHead2) border.bottom = medium;
      cell.border = border;
    }
  }

  ws.views = [{ showGridLines: false }];

  return {
    titleRow,
    formTop,
    formBottom: signatureRow,
    dataStart,
    signatureRow,
  };
}

export function fillPocHeaderValues(ws: ExcelJS.Worksheet, ship: ShipInfo): void {
  const set = (row: number, col: number, text: string) => {
    const cell = ws.getCell(row, col);
    cell.value = text;
    styleValue(cell);
  };

  set(5, 2, ship.name);
  set(5, 3, ship.callSign);
  set(5, 4, ship.portOfCall);
  set(5, 6, formatDisplayDate(ship.dateOfArrival));

  set(7, 2, ship.nationality);
  set(7, 3, ship.homeport);
  set(7, 4, ship.lastPortOfCall);
  set(7, 6, ship.nextPortOfCall);
}

export function fillPocDataRows(
  ws: ExcelJS.Worksheet,
  entries: PortCallHistoryEntry[],
  voyOffset: number,
  dataStart = POC_EXCEL_DATA_START,
): void {
  for (let i = 0; i < POC_DATA_ROW_COUNT; i++) {
    const row = dataStart + i;
    const entry = entries[i];
    if (!entry) continue;

    const voyCell = ws.getCell(row, 1);
    voyCell.value = voyOffset + i + 1;
    styleData(voyCell, 'center');

    ws.getCell(row, 2).value = formatPortCallPortName(entry.portName);
    styleData(ws.getCell(row, 2));

    ws.getCell(row, 3).value = entry.country;
    styleData(ws.getCell(row, 3));

    writeDateCell(ws.getCell(row, 4), entry.arrivalDate);

    ws.getCell(row, 5).value = entry.arrivalTime;
    styleData(ws.getCell(row, 5), 'center');

    writeDateCell(ws.getCell(row, 6), entry.departureDate);

    ws.getCell(row, 7).value = entry.departureTime;
    styleData(ws.getCell(row, 7), 'center');
  }
}

export function configurePocPrint(ws: ExcelJS.Worksheet, lastRow: number): void {
  const lastCell = `${ws.getColumn(POC_EXCEL_COLS).letter}${lastRow}`;
  ws.pageSetup = {
    paperSize: 9,
    orientation: 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    horizontalCentered: true,
    verticalCentered: false,
    margins: {
      left: 0.4,
      right: 0.4,
      top: 0.5,
      bottom: 0.5,
      header: 0.2,
      footer: 0.2,
    },
    printArea: `A1:${lastCell}`,
  };
}
