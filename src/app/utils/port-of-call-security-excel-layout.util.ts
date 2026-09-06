import ExcelJS from 'exceljs';
import {
  CrewMember,
  Port,
  PortCallHistoryEntry,
  ShipInfo,
  formatPortCallPortName,
  normalizePortSecLvl,
  portCode,
  portCountry,
} from '../models/crew.models';
import { POC_TEMPLATE_ROWS_PER_PAGE } from '../services/port-of-call-template-coordinates';
import { formatDisplayDate } from './date.util';
import { workbookToBytes } from './crew-list-excel-layout.util';

export const POC_SECURITY_EXCEL_SHEET = 'Port of Call Security';
export const POC_SECURITY_COLS = 6;

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

const COL_WIDTHS = [28, 18, 10, 12, 12, 8];

export interface PocSecurityExcelLayout {
  formTop: number;
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

function styleValue(cell: ExcelJS.Cell, align: 'left' | 'center' = 'left'): void {
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

function formatCaptainName(member: Pick<CrewMember, 'familyName' | 'givenNames'>): string {
  const parts = [member.familyName?.trim(), member.givenNames?.trim()].filter(Boolean);
  return parts.join(' ').toUpperCase();
}

function formatPortWithCountry(portName: string, ports: Port[]): string {
  const name = formatPortCallPortName(portName);
  if (!name) return '';
  const country = portCountry(portName, ports);
  return country ? `${name} / ${country}` : name;
}

export function buildPocSecurityFormLayout(ws: ExcelJS.Worksheet): PocSecurityExcelLayout {
  COL_WIDTHS.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  const titleRow = 2;
  const formTop = 4;
  const headerValue1 = 5;
  const headerValue2 = 7;
  const tableHead = 9;
  const dataStart = 10;
  const dataEnd = dataStart + POC_TEMPLATE_ROWS_PER_PAGE - 1;
  const signatureRow = dataEnd + 2;

  ws.mergeCells(titleRow, 1, titleRow, POC_SECURITY_COLS);
  const titleCell = ws.getCell(titleRow, 1);
  titleCell.value = '03 - Port of Call - Security';
  titleCell.font = { name: FONT, size: 14, bold: true, underline: true };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(titleRow).height = 22;

  // Row 4 — header labels
  ws.getCell(formTop, 1).value = 'Name of ship';
  styleLabel(ws.getCell(formTop, 1));
  ws.getCell(formTop, 2).value = 'Nationality';
  styleLabel(ws.getCell(formTop, 2));
  ws.getCell(formTop, 3).value = 'IMO No.';
  styleLabel(ws.getCell(formTop, 3));
  merge(ws, formTop, 4, formTop, 5);
  ws.getCell(formTop, 4).value = 'Port of arrival';
  styleLabel(ws.getCell(formTop, 4));
  ws.getCell(formTop, 6).value = 'Date of arrival';
  styleLabel(ws.getCell(formTop, 6));

  for (let c = 1; c <= POC_SECURITY_COLS; c++) {
    styleValue(ws.getCell(headerValue1, c));
  }
  merge(ws, headerValue1, 4, headerValue1, 5);

  ws.getCell(formTop + 2, 1).value = 'Arrived from';
  styleLabel(ws.getCell(formTop + 2, 1));
  merge(ws, formTop + 2, 2, formTop + 2, 3);
  ws.getCell(formTop + 2, 2).value = 'Next port';
  styleLabel(ws.getCell(formTop + 2, 2));
  merge(ws, formTop + 2, 4, formTop + 2, POC_SECURITY_COLS);
  ws.getCell(formTop + 2, 4).value = '';
  styleLabel(ws.getCell(formTop + 2, 4));

  for (let c = 1; c <= POC_SECURITY_COLS; c++) {
    styleValue(ws.getCell(headerValue2, c));
  }
  merge(ws, headerValue2, 2, headerValue2, 3);
  merge(ws, headerValue2, 4, headerValue2, POC_SECURITY_COLS);

  const heads = ['NAME OF PORT & COUNTRY', '', 'LOCODE', 'Date of Arrival', 'Date of Departure', 'SEC. LVL.'];
  merge(ws, tableHead, 1, tableHead, 2);
  heads.forEach((label, i) => {
    if (i === 1) return;
    const cell = ws.getCell(tableHead, i + 1);
    cell.value = label;
    styleTableHead(cell, i >= 3 ? 'center' : 'center');
  });
  styleTableHead(ws.getCell(tableHead, 2), 'center');

  ws.getRow(formTop).height = 18;
  ws.getRow(headerValue1).height = 20;
  ws.getRow(formTop + 2).height = 18;
  ws.getRow(headerValue2).height = 20;
  ws.getRow(tableHead).height = 28;

  for (let r = dataStart; r <= dataEnd; r++) {
    ws.getRow(r).height = 22;
    for (let c = 1; c <= POC_SECURITY_COLS; c++) {
      styleData(ws.getCell(r, c), c >= 4 ? 'center' : 'left');
    }
  }

  merge(ws, signatureRow, 1, signatureRow, POC_SECURITY_COLS);
  const sigCell = ws.getCell(signatureRow, 1);
  sigCell.value = 'Master / Captain';
  sigCell.font = { name: FONT, size: 8 };
  sigCell.alignment = { horizontal: 'right', vertical: 'bottom', wrapText: true };
  setBorder(sigCell, THIN_BORDER);
  ws.getRow(signatureRow).height = 36;

  for (let r = formTop; r <= signatureRow; r++) {
    for (let c = 1; c <= POC_SECURITY_COLS; c++) {
      const cell = ws.getCell(r, c);
      const border = { ...cell.border } as ExcelJS.Borders;
      if (r === formTop) border.top = medium;
      if (r === signatureRow) border.bottom = medium;
      if (c === 1) border.left = medium;
      if (c === POC_SECURITY_COLS) border.right = medium;
      if (r === tableHead) border.bottom = medium;
      cell.border = border;
    }
  }

  ws.views = [{ showGridLines: false }];

  return { formTop, dataStart, signatureRow };
}

export function fillPocSecurityHeaderValues(
  ws: ExcelJS.Worksheet,
  ship: ShipInfo,
  ports: Port[],
  signatureRow: number,
  master?: CrewMember,
): void {
  const set = (row: number, col: number, text: string) => {
    const cell = ws.getCell(row, col);
    cell.value = text;
    styleValue(cell);
  };

  set(5, 1, ship.name);
  set(5, 2, formatPortCallPortName(ship.nationality));
  set(5, 3, ship.imoNo);
  set(5, 4, formatPortWithCountry(ship.portOfCall, ports));
  set(5, 6, formatDisplayDate(ship.dateOfArrival));

  set(7, 1, formatPortWithCountry(ship.lastPortOfCall, ports));
  set(7, 2, formatPortWithCountry(ship.nextPortOfCall, ports));

  if (master) {
    const sigCell = ws.getCell(signatureRow, 1);
    sigCell.value = `Master / Captain: ${formatCaptainName(master)}`;
    sigCell.font = { name: FONT, size: 8 };
    sigCell.alignment = { horizontal: 'right', vertical: 'bottom', wrapText: true };
    setBorder(sigCell, THIN_BORDER);
  }
}

export function fillPocSecurityDataRows(
  ws: ExcelJS.Worksheet,
  entries: PortCallHistoryEntry[],
  ports: Port[],
  dataStart: number,
): void {
  for (let i = 0; i < POC_TEMPLATE_ROWS_PER_PAGE; i++) {
    const row = dataStart + i;
    const entry = entries[i];
    if (!entry) continue;

    const portName = formatPortCallPortName(entry.portName);
    if (!portName) continue;

    const country =
      entry.country.trim().toUpperCase() || portCountry(entry.portName, ports).toUpperCase();
    const code = portCode(entry.portName, ports);

    ws.getCell(row, 1).value = portName;
    styleData(ws.getCell(row, 1));
    ws.getCell(row, 2).value = country;
    styleData(ws.getCell(row, 2));
    ws.getCell(row, 3).value = code;
    styleData(ws.getCell(row, 3), 'center');
    writeDateCell(ws.getCell(row, 4), entry.arrivalDate);
    writeDateCell(ws.getCell(row, 5), entry.departureDate);
    ws.getCell(row, 6).value = normalizePortSecLvl(entry.secLvl);
    styleData(ws.getCell(row, 6), 'center');
  }
}

export function configurePocSecurityPrint(ws: ExcelJS.Worksheet, lastRow: number): void {
  const lastCell = `${ws.getColumn(POC_SECURITY_COLS).letter}${lastRow}`;
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

export async function buildPortOfCallSecurityWorkbook(
  ship: ShipInfo,
  ports: Port[],
  crew: CrewMember[],
  pages: PortCallHistoryEntry[][],
): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CREW Documents';

  const master =
    crew.find((m) => m.rank.trim().toLowerCase() === 'master') ??
    crew.find((m) => m.rank.trim().toLowerCase().includes('master'));

  const sheetPages = pages.length > 0 ? pages : [[]];
  sheetPages.forEach((pageRows, pageIndex) => {
    const sheetName =
      pageIndex === 0 ? POC_SECURITY_EXCEL_SHEET : `${POC_SECURITY_EXCEL_SHEET} (${pageIndex + 1})`;
    const ws = wb.addWorksheet(sheetName, {
      pageSetup: { paperSize: 9, orientation: 'portrait' },
    });
    const layout = buildPocSecurityFormLayout(ws);
    fillPocSecurityHeaderValues(ws, ship, ports, layout.signatureRow, master);
    fillPocSecurityDataRows(ws, pageRows, ports, layout.dataStart);
    configurePocSecurityPrint(ws, layout.signatureRow);
  });

  return workbookToBytes(wb);
}
