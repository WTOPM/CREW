import ExcelJS from 'exceljs';
import {
  CREW_LIST_BODY_NIL_LABEL,
  CREW_LIST_FRAME_LABELS,
  CREW_LIST_ROW_COUNT,
  CREW_LIST_STATIC_LABELS,
} from '../services/crew-list-coordinates';
import { CrewMember, ShipInfo, formatCrewListName } from '../models/crew.models';
import { formatBirthDate } from './date.util';

export const IMO_CREW_LIST_SHEET = 'IMO CREW LIST';
export const IMO_CREW_LIST_COLS = 7;

const FONT = 'Arial';
const DATA_FONT = 'Arial';
const BORDER_COLOR = 'FF000000';

const thin = { style: 'thin' as const, color: { argb: BORDER_COLOR } };
const medium = { style: 'medium' as const, color: { argb: BORDER_COLOR } };

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: thin,
  left: thin,
  bottom: thin,
  right: thin,
};

/** Relative widths from CREW_LIST_BOXES (No…identity). */
const COL_WIDTHS = [4.5, 30, 11, 10, 9, 18, 14];

export interface ImoCrewListExcelLayout {
  formTop: number;
  dataStart: number;
  dataEnd: number;
  signatureRow: number;
  lastRow: number;
}

export interface ImoCrewListHeaderInput {
  ship: ShipInfo;
  isArrival: boolean;
  identityDocumentType: string;
  voyageDate: string;
  pageNo: number;
}

function merge(ws: ExcelJS.Worksheet, r1: number, c1: number, r2: number, c2: number): void {
  if (r1 === r2 && c1 === c2) return;
  ws.mergeCells(r1, c1, r2, c2);
}

function setBorder(cell: ExcelJS.Cell, border: Partial<ExcelJS.Borders>): void {
  cell.border = border as ExcelJS.Borders;
}

function styleLabel(cell: ExcelJS.Cell, align: 'left' | 'center' | 'right' = 'left'): void {
  cell.font = { name: FONT, size: 7 };
  cell.alignment = { horizontal: align, vertical: 'top', wrapText: true };
  setBorder(cell, THIN_BORDER);
}

function styleHeaderValue(cell: ExcelJS.Cell, align: 'left' | 'center' = 'left'): void {
  cell.font = { name: DATA_FONT, size: 10, bold: true, italic: true };
  cell.alignment = { horizontal: align, vertical: 'bottom', wrapText: true };
  setBorder(cell, THIN_BORDER);
}

function styleColHead(cell: ExcelJS.Cell, align: 'left' | 'center' = 'left'): void {
  cell.font = { name: FONT, size: 7 };
  cell.alignment = { horizontal: align, vertical: 'middle', wrapText: true };
  setBorder(cell, THIN_BORDER);
}

function styleData(cell: ExcelJS.Cell, align: 'left' | 'center' = 'left'): void {
  cell.font = { name: DATA_FONT, size: 9, bold: true, italic: true };
  cell.alignment = { horizontal: align, vertical: 'middle', wrapText: true };
  setBorder(cell, THIN_BORDER);
}

function applyOuterBorder(ws: ExcelJS.Worksheet, top: number, bottom: number, cols: number): void {
  for (let r = top; r <= bottom; r++) {
    for (let c = 1; c <= cols; c++) {
      const cell = ws.getCell(r, c);
      const border = { ...cell.border } as ExcelJS.Borders;
      if (r === top) border.top = medium;
      if (r === bottom) border.bottom = medium;
      if (c === 1) border.left = medium;
      if (c === cols) border.right = medium;
      cell.border = border;
    }
  }
}

/** Build static IMO FAL Form 5 grid (labels + borders). */
export function buildImoCrewListFormLayout(
  ws: ExcelJS.Worksheet,
  identityDocumentType: string,
): ImoCrewListExcelLayout {
  COL_WIDTHS.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  const titleRow = 2;
  const formTop = 3;
  const headerValue1 = 5;
  const headerValue2 = 7;
  const tableHeadRow = 8;
  const dataStart = 9;
  const dataEnd = dataStart + CREW_LIST_ROW_COUNT - 1;
  const signatureRow = dataEnd + 1;

  ws.getRow(1).height = 6;

  merge(ws, titleRow, 1, titleRow, IMO_CREW_LIST_COLS);
  const titleCell = ws.getCell(titleRow, 1);
  titleCell.value = CREW_LIST_FRAME_LABELS.title;
  titleCell.font = { name: FONT, size: 13, bold: true };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(titleRow).height = 20;

  merge(ws, formTop, 1, formTop, 2);
  styleLabel(ws.getCell(formTop, 1));
  merge(ws, formTop, 3, formTop, 4);
  styleLabel(ws.getCell(formTop, 3));
  ws.getCell(formTop, 5).value = 'Page No.';
  styleLabel(ws.getCell(formTop, 5), 'right');
  merge(ws, formTop, 6, formTop, 7);
  styleHeaderValue(ws.getCell(formTop, 6), 'center');
  ws.getRow(formTop).height = 16;

  merge(ws, formTop + 1, 1, formTop + 1, 3);
  ws.getCell(formTop + 1, 1).value = '1.   Name of ship';
  styleLabel(ws.getCell(formTop + 1, 1));
  merge(ws, formTop + 1, 4, formTop + 1, 5);
  ws.getCell(formTop + 1, 4).value = '2.   Port of arrival / departure';
  styleLabel(ws.getCell(formTop + 1, 4));
  merge(ws, formTop + 1, 6, formTop + 1, 7);
  ws.getCell(formTop + 1, 6).value = '3.   Date of arrival / departure';
  styleLabel(ws.getCell(formTop + 1, 6));

  for (let c = 1; c <= IMO_CREW_LIST_COLS; c++) {
    styleHeaderValue(ws.getCell(headerValue1, c));
  }
  merge(ws, headerValue1, 1, headerValue1, 3);
  merge(ws, headerValue1, 4, headerValue1, 5);
  merge(ws, headerValue1, 6, headerValue1, 7);

  merge(ws, formTop + 3, 1, formTop + 3, 3);
  ws.getCell(formTop + 3, 1).value = '4.   Nationality of Ship';
  styleLabel(ws.getCell(formTop + 3, 1));
  merge(ws, formTop + 3, 4, formTop + 3, 6);
  ws.getCell(formTop + 3, 4).value = '5.   Port arrived from / Sailing to';
  styleLabel(ws.getCell(formTop + 3, 4));
  merge(ws, formTop + 3, 7, formTop + 4, 7);
  const idLabel = ws.getCell(formTop + 3, 7);
  idLabel.value = '6.   Nature und No.\nof identity documents';
  styleLabel(idLabel);

  for (let c = 1; c <= 6; c++) {
    styleHeaderValue(ws.getCell(headerValue2, c));
  }
  merge(ws, headerValue2, 1, headerValue2, 3);
  merge(ws, headerValue2, 4, headerValue2, 6);
  const docTypeCell = ws.getCell(formTop + 4, 7);
  docTypeCell.value = identityDocumentType.trim() || 'Passport';
  docTypeCell.font = { name: FONT, size: 7, bold: true };
  docTypeCell.alignment = { horizontal: 'center', vertical: 'bottom' };
  setBorder(docTypeCell, THIN_BORDER);

  ws.getRow(formTop + 1).height = 14;
  ws.getRow(headerValue1).height = 18;
  ws.getRow(formTop + 3).height = 14;
  ws.getRow(headerValue2).height = 18;

  ws.getCell(tableHeadRow, 1).value = '7.   No.';
  styleColHead(ws.getCell(tableHeadRow, 1), 'center');
  ws.getCell(tableHeadRow, 2).value = '8.   Family names, given names';
  styleColHead(ws.getCell(tableHeadRow, 2));
  ws.getCell(tableHeadRow, 3).value = '9.   Rank or rating';
  styleColHead(ws.getCell(tableHeadRow, 3));
  ws.getCell(tableHeadRow, 4).value = '10.   Nationality';
  styleColHead(ws.getCell(tableHeadRow, 4));
  merge(ws, tableHeadRow, 5, tableHeadRow, 6);
  ws.getCell(tableHeadRow, 5).value = '11.   Date and place of birth';
  styleColHead(ws.getCell(tableHeadRow, 5));
  ws.getCell(tableHeadRow, 7).value = '';
  styleColHead(ws.getCell(tableHeadRow, 7));
  ws.getRow(tableHeadRow).height = 22;

  for (let r = dataStart; r <= dataEnd; r++) {
    ws.getRow(r).height = 15;
    for (let c = 1; c <= IMO_CREW_LIST_COLS; c++) {
      styleData(ws.getCell(r, c), c === 1 ? 'center' : 'left');
    }
  }

  merge(ws, signatureRow, 1, signatureRow, IMO_CREW_LIST_COLS);
  const sigCell = ws.getCell(signatureRow, 1);
  sigCell.value = CREW_LIST_FRAME_LABELS.field12;
  sigCell.font = { name: FONT, size: 8 };
  sigCell.alignment = { horizontal: 'left', vertical: 'bottom', wrapText: true };
  setBorder(sigCell, THIN_BORDER);
  ws.getRow(signatureRow).height = 28;

  applyOuterBorder(ws, formTop, signatureRow, IMO_CREW_LIST_COLS);

  for (let c = 1; c <= IMO_CREW_LIST_COLS; c++) {
    const cell = ws.getCell(tableHeadRow, c);
    const border = { ...cell.border } as ExcelJS.Borders;
    border.bottom = medium;
    cell.border = border;
  }

  ws.views = [{ showGridLines: false }];

  return { formTop, dataStart, dataEnd, signatureRow, lastRow: signatureRow };
}

export function fillImoCrewListHeader(ws: ExcelJS.Worksheet, input: ImoCrewListHeaderInput): void {
  const { ship, isArrival, identityDocumentType, voyageDate, pageNo } = input;
  const portFromTo = [ship.lastPortOfCall, ship.nextPortOfCall].filter(Boolean).join('  /  ');

  const arrivalCell = ws.getCell(3, 1);
  arrivalCell.value = `${isArrival ? 'X' : ' '}   ${CREW_LIST_STATIC_LABELS.arrival}`;
  arrivalCell.font = { name: FONT, size: 7, bold: isArrival };
  arrivalCell.alignment = { horizontal: 'left', vertical: 'middle' };

  const depCell = ws.getCell(3, 3);
  depCell.value = `${isArrival ? ' ' : 'X'}   ${CREW_LIST_STATIC_LABELS.departure}`;
  depCell.font = { name: FONT, size: 7, bold: !isArrival };
  depCell.alignment = { horizontal: 'left', vertical: 'middle' };

  ws.getCell(3, 6).value = String(pageNo);

  ws.getCell(5, 1).value = ship.name;
  ws.getCell(5, 4).value = ship.portOfCall;
  ws.getCell(5, 6).value = voyageDate;
  ws.getCell(7, 1).value = ship.nationality;
  ws.getCell(7, 4).value = portFromTo;

  const docType = identityDocumentType.trim() || 'Passport';
  ws.getCell(7, 7).value = docType;
}

function identityNumber(member: CrewMember, identityDocumentType: string): string {
  if (identityDocumentType.toLowerCase().includes('seaman')) {
    return member.seamansBook.trim();
  }
  return member.passport.trim();
}

export function fillImoCrewListRows(
  ws: ExcelJS.Worksheet,
  crew: CrewMember[],
  identityDocumentType: string,
  dataStart: number,
  rowOffset = 0,
): void {
  for (let i = 0; i < CREW_LIST_ROW_COUNT; i++) {
    const row = dataStart + i;
    const member = crew[i];
    if (!member) continue;

    ws.getCell(row, 1).value = rowOffset + i + 1;
    ws.getCell(row, 2).value = formatCrewListName(member);
    ws.getCell(row, 3).value = member.rank;
    ws.getCell(row, 4).value = member.nationality;
    ws.getCell(row, 5).value = formatBirthDate(member.dateOfBirth);
    ws.getCell(row, 6).value = member.placeOfBirth;
    ws.getCell(row, 7).value = identityNumber(member, identityDocumentType);

    for (let c = 1; c <= IMO_CREW_LIST_COLS; c++) {
      styleData(ws.getCell(row, c), c === 1 ? 'center' : 'left');
    }
  }
}

export function drawImoCrewListNil(ws: ExcelJS.Worksheet, layout: ImoCrewListExcelLayout): void {
  merge(ws, layout.dataStart, 1, layout.dataEnd, IMO_CREW_LIST_COLS);
  const nilCell = ws.getCell(layout.dataStart, 1);
  nilCell.value = CREW_LIST_BODY_NIL_LABEL;
  nilCell.font = { name: FONT, size: 48, bold: true, color: { argb: 'FF808080' } };
  nilCell.alignment = { horizontal: 'center', vertical: 'middle' };
  setBorder(nilCell, THIN_BORDER);
}

export function configureImoCrewListPrint(ws: ExcelJS.Worksheet, lastRow: number): void {
  const lastCell = `${ws.getColumn(IMO_CREW_LIST_COLS).letter}${lastRow}`;
  ws.pageSetup = {
    paperSize: 9,
    orientation: 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    horizontalCentered: true,
    verticalCentered: false,
    margins: {
      left: 0.35,
      right: 0.35,
      top: 0.4,
      bottom: 0.4,
      header: 0.15,
      footer: 0.15,
    },
    printArea: `A1:${lastCell}`,
  };
}

export function chunkCrewForExcel(crew: CrewMember[]): CrewMember[][] {
  if (crew.length === 0) return [[]];
  const pages: CrewMember[][] = [];
  for (let i = 0; i < crew.length; i += CREW_LIST_ROW_COUNT) {
    pages.push(crew.slice(i, i + CREW_LIST_ROW_COUNT));
  }
  return pages;
}

export function addImoFalFormNote(ws: ExcelJS.Worksheet, dataEnd: number): void {
  const noteRow = dataEnd - 1;
  const cell = ws.getCell(noteRow, 1);
  cell.value = `${CREW_LIST_FRAME_LABELS.falFormLine1}\n${CREW_LIST_FRAME_LABELS.falFormLine2}`;
  cell.font = { name: FONT, size: 7 };
  cell.alignment = { horizontal: 'left', vertical: 'bottom', wrapText: true };
}
