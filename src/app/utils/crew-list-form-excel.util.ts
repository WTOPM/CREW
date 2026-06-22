import ExcelJS from 'exceljs';
import {
  AppData,
  CrewMember,
  formatCrewListName,
  formatPortCallPortName,
  portCountry,
} from '../models/crew.models';
import {
  CREW_LIST_BODY_NIL_LABEL,
  CREW_LIST_FRAME_LABELS,
  CREW_LIST_STATIC_LABELS,
} from '../services/crew-list-coordinates';
import { formatBirthDate, formatDisplayDate } from './date.util';

export const FORM_FONT = 'Arial';
export const FORM_DATA_FONT = 'Times New Roman';
const BORDER_COLOR = 'FF000000';

const thin = { style: 'thin' as const, color: { argb: BORDER_COLOR } };
const medium = { style: 'medium' as const, color: { argb: BORDER_COLOR } };

export const FORM_THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: thin,
  left: thin,
  bottom: thin,
  right: thin,
};

export interface CrewListFormExcelLayout {
  formTop: number;
  dataStart: number;
  dataEnd: number;
  signatureRow: number;
  lastRow: number;
  colCount: number;
}

export interface CrewListFormHeaderInput {
  ship: AppData['ship'];
  ports: AppData['ports'];
  isArrival: boolean;
  voyageDate: string;
  pageNo: number;
  charterer?: string;
  showPageNo?: boolean;
}

export interface CrewListFormColumn {
  header: string;
  width: number;
  align?: 'left' | 'center';
  value: (member: CrewMember, data: AppData, rowNo: number) => string | number;
}

export function mergeCells(
  ws: ExcelJS.Worksheet,
  r1: number,
  c1: number,
  r2: number,
  c2: number,
): void {
  if (r1 === r2 && c1 === c2) return;
  ws.mergeCells(r1, c1, r2, c2);
}

function setBorder(cell: ExcelJS.Cell, border: Partial<ExcelJS.Borders>): void {
  cell.border = border as ExcelJS.Borders;
}

export function styleFormLabel(
  cell: ExcelJS.Cell,
  align: 'left' | 'center' | 'right' = 'left',
): void {
  cell.font = { name: FORM_FONT, size: 7 };
  cell.alignment = { horizontal: align, vertical: 'top', wrapText: true };
  setBorder(cell, FORM_THIN_BORDER);
}

export function styleFormHeaderValue(cell: ExcelJS.Cell, align: 'left' | 'center' = 'left'): void {
  cell.font = { name: FORM_DATA_FONT, size: 10, bold: true, italic: true };
  cell.alignment = { horizontal: align, vertical: 'bottom', wrapText: true };
  setBorder(cell, FORM_THIN_BORDER);
}

function styleColHead(cell: ExcelJS.Cell, align: 'left' | 'center' = 'left'): void {
  cell.font = { name: FORM_FONT, size: 7 };
  cell.alignment = { horizontal: align, vertical: 'middle', wrapText: true };
  setBorder(cell, FORM_THIN_BORDER);
}

export function styleFormData(cell: ExcelJS.Cell, align: 'left' | 'center' = 'left'): void {
  cell.font = { name: FORM_DATA_FONT, size: 9, bold: true, italic: true };
  cell.alignment = { horizontal: align, vertical: 'middle', wrapText: true };
  setBorder(cell, FORM_THIN_BORDER);
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

/** Split column count into three bands (left / middle / right). */
function colThirds(colCount: number): [number, number, number, number, number, number] {
  const a = Math.max(1, Math.floor(colCount / 3));
  const b = Math.max(a + 1, Math.floor((colCount * 2) / 3));
  return [1, a, a + 1, b, b + 1, colCount];
}

export function formatPortWithCountry(portName: string, ports: AppData['ports']): string {
  const name = formatPortCallPortName(portName);
  if (!name) return '';
  const country = portCountry(portName, ports);
  return country ? `${name} / ${country}` : name;
}

export function portsFromToText(data: AppData): string {
  const { ship, ports } = data;
  return [ship.lastPortOfCall, ship.nextPortOfCall]
    .filter(Boolean)
    .map((p) => formatPortWithCountry(p, ports))
    .join('  /  ');
}

export function findMasterName(data: AppData, listCrew: CrewMember[]): string {
  const roster = data.crew.length > 0 ? data.crew : listCrew;
  const exact = roster.find((m) => m.rank.trim().toLowerCase() === 'master');
  const master = exact ?? roster.find((m) => m.rank.trim().toLowerCase().includes('master'));
  if (!master) return '';
  const parts = [master.familyName?.trim(), master.givenNames?.trim()].filter(Boolean);
  return (parts.length ? parts.join(' ') : formatCrewListName(master)).toUpperCase();
}

export function chunkCrewPages(crew: CrewMember[], maxRows: number): CrewMember[][] {
  if (crew.length === 0) return [[]];
  const pages: CrewMember[][] = [];
  for (let i = 0; i < crew.length; i += maxRows) {
    pages.push(crew.slice(i, i + maxRows));
  }
  return pages;
}

function blankStyledRow(ws: ExcelJS.Worksheet, row: number, colCount: number): void {
  for (let c = 1; c <= colCount; c++) {
    styleFormHeaderValue(ws.getCell(row, c));
  }
}

/**
 * Portrait crew-list header grid (arrival / ship / nationality bands) — same style as IMO FAL Excel.
 */
export function buildPortraitCrewListForm(
  ws: ExcelJS.Worksheet,
  title: string,
  columns: CrewListFormColumn[],
  opts: { charterer?: boolean; maxRows: number },
): CrewListFormExcelLayout {
  const colCount = columns.length;
  columns.forEach((col, i) => {
    ws.getColumn(i + 1).width = col.width;
  });

  const [l1, l2, m1, m2, r1, r2] = colThirds(colCount);
  const pageCols = Math.min(2, colCount);
  const pageLabelStart = colCount - pageCols - (pageCols > 1 ? 1 : 0);
  const pageLabelEnd = colCount - pageCols;
  const pageValStart = pageLabelEnd + 1;

  const titleRow = 2;
  let formTop = 3;

  ws.getRow(1).height = 6;

  mergeCells(ws, titleRow, 1, titleRow, colCount);
  const titleCell = ws.getCell(titleRow, 1);
  titleCell.value = title;
  titleCell.font = { name: FORM_FONT, size: 13, bold: true };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(titleRow).height = 20;

  if (opts.charterer) {
    mergeCells(ws, formTop, 1, formTop, 2);
    ws.getCell(formTop, 1).value = 'Charterer';
    styleFormLabel(ws.getCell(formTop, 1));
    mergeCells(ws, formTop, 3, formTop, colCount);
    styleFormHeaderValue(ws.getCell(formTop, 3));
    ws.getRow(formTop).height = 16;
    formTop++;
  }

  const headerValue1 = formTop + 2;
  const headerValue2 = formTop + 4;
  const tableHeadRow = formTop + 5;
  const dataStart = tableHeadRow + 1;
  const dataEnd = dataStart + opts.maxRows - 1;
  const signatureRow = dataEnd + 1;

  mergeCells(ws, formTop, l1, formTop, l2);
  styleFormLabel(ws.getCell(formTop, l1));
  mergeCells(ws, formTop, m1, formTop, m2);
  styleFormLabel(ws.getCell(formTop, m1));
  if (pageLabelStart >= 1 && pageValStart <= colCount) {
    mergeCells(ws, formTop, pageLabelStart, formTop, pageLabelEnd);
    ws.getCell(formTop, pageLabelStart).value = 'Page No.';
    styleFormLabel(ws.getCell(formTop, pageLabelStart), 'right');
    mergeCells(ws, formTop, pageValStart, formTop, r2);
    styleFormHeaderValue(ws.getCell(formTop, pageValStart), 'center');
  }
  ws.getRow(formTop).height = 16;

  mergeCells(ws, formTop + 1, l1, formTop + 1, l2);
  ws.getCell(formTop + 1, l1).value = '1.   Name of ship';
  styleFormLabel(ws.getCell(formTop + 1, l1));
  mergeCells(ws, formTop + 1, m1, formTop + 1, m2);
  ws.getCell(formTop + 1, m1).value = '2.   Port of arrival / departure';
  styleFormLabel(ws.getCell(formTop + 1, m1));
  mergeCells(ws, formTop + 1, r1, formTop + 1, r2);
  ws.getCell(formTop + 1, r1).value = '3.   Date of arrival / departure';
  styleFormLabel(ws.getCell(formTop + 1, r1));

  blankStyledRow(ws, headerValue1, colCount);
  mergeCells(ws, headerValue1, l1, headerValue1, l2);
  mergeCells(ws, headerValue1, m1, headerValue1, m2);
  mergeCells(ws, headerValue1, r1, headerValue1, r2);

  mergeCells(ws, formTop + 3, l1, formTop + 3, l2);
  ws.getCell(formTop + 3, l1).value = '4.   Nationality of Ship';
  styleFormLabel(ws.getCell(formTop + 3, l1));
  mergeCells(ws, formTop + 3, m1, formTop + 3, r2);
  ws.getCell(formTop + 3, m1).value = '5.   Port arrived from / Sailing to';
  styleFormLabel(ws.getCell(formTop + 3, m1));

  blankStyledRow(ws, headerValue2, colCount);
  mergeCells(ws, headerValue2, l1, headerValue2, l2);
  mergeCells(ws, headerValue2, m1, headerValue2, r2);

  ws.getRow(formTop + 1).height = 14;
  ws.getRow(headerValue1).height = 18;
  ws.getRow(formTop + 3).height = 14;
  ws.getRow(headerValue2).height = 18;

  columns.forEach((col, i) => {
    const cell = ws.getCell(tableHeadRow, i + 1);
    cell.value = col.header;
    styleColHead(cell, col.align ?? (i === 0 ? 'center' : 'left'));
  });
  ws.getRow(tableHeadRow).height = 22;

  for (let r = dataStart; r <= dataEnd; r++) {
    ws.getRow(r).height = 15;
    for (let c = 1; c <= colCount; c++) {
      styleFormData(ws.getCell(r, c), c === 1 ? 'center' : 'left');
    }
  }

  const sigSplit = Math.max(1, Math.floor(colCount * 0.55));
  mergeCells(ws, signatureRow, 1, signatureRow, sigSplit);
  const sigLeft = ws.getCell(signatureRow, 1);
  sigLeft.value = CREW_LIST_FRAME_LABELS.field12;
  sigLeft.font = { name: FORM_FONT, size: 8 };
  sigLeft.alignment = { horizontal: 'left', vertical: 'bottom', wrapText: true };
  setBorder(sigLeft, FORM_THIN_BORDER);
  if (sigSplit < colCount) {
    mergeCells(ws, signatureRow, sigSplit + 1, signatureRow, colCount);
    styleFormHeaderValue(ws.getCell(signatureRow, sigSplit + 1), 'left');
  }
  ws.getRow(signatureRow).height = 28;

  applyOuterBorder(ws, formTop, signatureRow, colCount);

  for (let c = 1; c <= colCount; c++) {
    const cell = ws.getCell(tableHeadRow, c);
    const border = { ...cell.border } as ExcelJS.Borders;
    border.bottom = medium;
    cell.border = border;
  }

  ws.views = [{ showGridLines: false }];

  return { formTop, dataStart, dataEnd, signatureRow, lastRow: signatureRow, colCount };
}

export function fillPortraitCrewListHeader(
  ws: ExcelJS.Worksheet,
  layout: CrewListFormExcelLayout,
  input: CrewListFormHeaderInput,
): void {
  const { ship, ports, isArrival, voyageDate, pageNo, charterer } = input;
  const [l1, l2, m1, m2, r1, r2] = colThirds(layout.colCount);
  const pageCols = Math.min(2, layout.colCount);
  const pageValStart = layout.colCount - pageCols + 1;
  let formTop = layout.formTop;

  if (charterer !== undefined) {
    ws.getCell(formTop, 3).value = charterer;
    formTop++;
  }

  const arrivalCell = ws.getCell(formTop, l1);
  arrivalCell.value = `${isArrival ? 'X' : ' '}   ${CREW_LIST_STATIC_LABELS.arrival}`;
  arrivalCell.font = { name: FORM_FONT, size: 7, bold: isArrival };
  arrivalCell.alignment = { horizontal: 'left', vertical: 'middle' };

  const depCell = ws.getCell(formTop, m1);
  depCell.value = `${isArrival ? ' ' : 'X'}   ${CREW_LIST_STATIC_LABELS.departure}`;
  depCell.font = { name: FORM_FONT, size: 7, bold: !isArrival };
  depCell.alignment = { horizontal: 'left', vertical: 'middle' };

  if (pageValStart <= layout.colCount) {
    ws.getCell(formTop, pageValStart).value = String(pageNo);
  }

  const headerValue1 = formTop + 2;
  const headerValue2 = formTop + 4;

  ws.getCell(headerValue1, l1).value = formatPortCallPortName(ship.name);
  ws.getCell(headerValue1, m1).value = formatPortWithCountry(ship.portOfCall, ports);
  ws.getCell(headerValue1, r1).value = voyageDate;
  ws.getCell(headerValue2, l1).value = formatPortCallPortName(ship.nationality);
  ws.getCell(headerValue2, m1).value = portsFromToText({ ship, ports } as AppData);
}

/**
 * Landscape header — extra row for IMO / call sign / voyage no (forms 05–07).
 */
export function buildLandscapeCrewListForm(
  ws: ExcelJS.Worksheet,
  title: string,
  columns: CrewListFormColumn[],
  opts: { maxRows: number },
): CrewListFormExcelLayout {
  const colCount = columns.length;
  columns.forEach((col, i) => {
    ws.getColumn(i + 1).width = col.width;
  });

  const [l1, l2, m1, m2, r1, r2] = colThirds(colCount);
  const pageValStart = Math.max(r1, colCount - 1);

  const titleRow = 2;
  let formTop = 3;

  ws.getRow(1).height = 6;

  mergeCells(ws, titleRow, 1, titleRow, colCount);
  const titleCell = ws.getCell(titleRow, 1);
  titleCell.value = title;
  titleCell.font = { name: FORM_FONT, size: 13, bold: true };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(titleRow).height = 20;

  mergeCells(ws, formTop, 1, formTop, 2);
  ws.getCell(formTop, 1).value = 'Charterer';
  styleFormLabel(ws.getCell(formTop, 1));
  mergeCells(ws, formTop, 3, formTop, colCount - 2);
  styleFormHeaderValue(ws.getCell(formTop, 3));
  mergeCells(ws, formTop, colCount - 1, formTop, colCount);
  styleFormHeaderValue(ws.getCell(formTop, colCount - 1), 'center');
  ws.getRow(formTop).height = 16;

  const row2 = formTop + 1;
  mergeCells(ws, row2, l1, row2, l2);
  styleFormLabel(ws.getCell(row2, l1));
  mergeCells(ws, row2, m1, row2, m2);
  styleFormLabel(ws.getCell(row2, m1));
  mergeCells(ws, row2, pageValStart, row2, r2);
  ws.getCell(row2, r1).value = 'Page No.';
  styleFormLabel(ws.getCell(row2, r1), 'right');
  styleFormHeaderValue(ws.getCell(row2, pageValStart), 'center');
  ws.getRow(row2).height = 16;

  const labelRow1 = row2 + 1;
  const valueRow1 = labelRow1 + 1;
  const labelRow2 = valueRow1 + 1;
  const valueRow2 = labelRow2 + 1;
  const labelRow3 = valueRow2 + 1;
  const valueRow3 = labelRow3 + 1;
  const tableHeadRow = valueRow3 + 1;
  const dataStart = tableHeadRow + 1;
  const dataEnd = dataStart + opts.maxRows - 1;
  const signatureRow = dataEnd + 1;

  mergeCells(ws, labelRow1, l1, labelRow1, l2);
  ws.getCell(labelRow1, l1).value = '1.   Name of ship';
  styleFormLabel(ws.getCell(labelRow1, l1));
  mergeCells(ws, labelRow1, m1, labelRow1, m2);
  ws.getCell(labelRow1, m1).value = '2.   Port of arrival / departure';
  styleFormLabel(ws.getCell(labelRow1, m1));
  mergeCells(ws, labelRow1, r1, labelRow1, r2);
  ws.getCell(labelRow1, r1).value = '3.   Date of arrival / departure';
  styleFormLabel(ws.getCell(labelRow1, r1));
  blankStyledRow(ws, valueRow1, colCount);
  mergeCells(ws, valueRow1, l1, valueRow1, l2);
  mergeCells(ws, valueRow1, m1, valueRow1, m2);
  mergeCells(ws, valueRow1, r1, valueRow1, r2);

  mergeCells(ws, labelRow2, l1, labelRow2, l2);
  ws.getCell(labelRow2, l1).value = '4.   Nationality of Ship';
  styleFormLabel(ws.getCell(labelRow2, l1));
  mergeCells(ws, labelRow2, m1, labelRow2, r2);
  ws.getCell(labelRow2, m1).value = '5.   Port arrived from / Sailing to';
  styleFormLabel(ws.getCell(labelRow2, m1));
  blankStyledRow(ws, valueRow2, colCount);
  mergeCells(ws, valueRow2, l1, valueRow2, l2);
  mergeCells(ws, valueRow2, m1, valueRow2, r2);

  mergeCells(ws, labelRow3, l1, labelRow3, l2);
  ws.getCell(labelRow3, l1).value = 'IMO No.';
  styleFormLabel(ws.getCell(labelRow3, l1));
  mergeCells(ws, labelRow3, m1, labelRow3, m2);
  ws.getCell(labelRow3, m1).value = 'Call sign';
  styleFormLabel(ws.getCell(labelRow3, m1));
  mergeCells(ws, labelRow3, r1, labelRow3, r2);
  ws.getCell(labelRow3, r1).value = 'Voyage number';
  styleFormLabel(ws.getCell(labelRow3, r1));
  blankStyledRow(ws, valueRow3, colCount);
  mergeCells(ws, valueRow3, l1, valueRow3, l2);
  mergeCells(ws, valueRow3, m1, valueRow3, m2);
  mergeCells(ws, valueRow3, r1, valueRow3, r2);

  columns.forEach((col, i) => {
    const cell = ws.getCell(tableHeadRow, i + 1);
    cell.value = col.header;
    styleColHead(cell, col.align ?? (i === 0 ? 'center' : 'left'));
  });
  ws.getRow(tableHeadRow).height = 22;

  for (let r = dataStart; r <= dataEnd; r++) {
    ws.getRow(r).height = 15;
    for (let c = 1; c <= colCount; c++) {
      styleFormData(ws.getCell(r, c), c === 1 ? 'center' : 'left');
    }
  }

  const sigSplit = Math.max(1, Math.floor(colCount * 0.45));
  mergeCells(ws, signatureRow, 1, signatureRow, sigSplit);
  const sigLeft = ws.getCell(signatureRow, 1);
  sigLeft.value = CREW_LIST_FRAME_LABELS.field12;
  sigLeft.font = { name: FORM_FONT, size: 8 };
  sigLeft.alignment = { horizontal: 'left', vertical: 'bottom', wrapText: true };
  setBorder(sigLeft, FORM_THIN_BORDER);
  mergeCells(ws, signatureRow, sigSplit + 1, signatureRow, colCount);
  styleFormHeaderValue(ws.getCell(signatureRow, sigSplit + 1), 'left');
  ws.getRow(signatureRow).height = 28;

  applyOuterBorder(ws, formTop, signatureRow, colCount);

  for (let c = 1; c <= colCount; c++) {
    const cell = ws.getCell(tableHeadRow, c);
    const border = { ...cell.border } as ExcelJS.Borders;
    border.bottom = medium;
    cell.border = border;
  }

  ws.views = [{ showGridLines: false }];

  return { formTop, dataStart, dataEnd, signatureRow, lastRow: signatureRow, colCount };
}

export function fillLandscapeCrewListHeader(
  ws: ExcelJS.Worksheet,
  layout: CrewListFormExcelLayout,
  input: CrewListFormHeaderInput,
): void {
  const { ship, ports, isArrival, voyageDate, pageNo } = input;
  const [l1, l2, m1, m2, r1, r2] = colThirds(layout.colCount);
  const pageValStart = Math.max(r1, layout.colCount - 1);

  ws.getCell(layout.formTop, 3).value = ship.charterer;

  const row2 = layout.formTop + 1;
  const arrivalCell = ws.getCell(row2, l1);
  arrivalCell.value = `${isArrival ? 'X' : ' '}   ${CREW_LIST_STATIC_LABELS.arrival}`;
  arrivalCell.font = { name: FORM_FONT, size: 7, bold: isArrival };
  arrivalCell.alignment = { horizontal: 'left', vertical: 'middle' };

  const depCell = ws.getCell(row2, m1);
  depCell.value = `${isArrival ? ' ' : 'X'}   ${CREW_LIST_STATIC_LABELS.departure}`;
  depCell.font = { name: FORM_FONT, size: 7, bold: !isArrival };
  depCell.alignment = { horizontal: 'left', vertical: 'middle' };

  ws.getCell(row2, pageValStart).value = String(pageNo);

  const valueRow1 = layout.formTop + 3;
  const valueRow2 = valueRow1 + 2;
  const valueRow3 = valueRow2 + 2;

  ws.getCell(valueRow1, l1).value = formatPortCallPortName(ship.name);
  ws.getCell(valueRow1, m1).value = formatPortWithCountry(ship.portOfCall, ports);
  ws.getCell(valueRow1, r1).value = voyageDate;
  ws.getCell(valueRow2, l1).value = formatPortCallPortName(ship.nationality);
  ws.getCell(valueRow2, m1).value = portsFromToText({ ship, ports } as AppData);
  ws.getCell(valueRow3, l1).value = ship.imoNo;
  ws.getCell(valueRow3, m1).value = ship.callSign;
  ws.getCell(valueRow3, r1).value = ship.voyageNumber;
}

export function fillCrewListFormRows(
  ws: ExcelJS.Worksheet,
  layout: CrewListFormExcelLayout,
  columns: CrewListFormColumn[],
  crew: CrewMember[],
  data: AppData,
  rowOffset: number,
): void {
  crew.forEach((member, index) => {
    const row = layout.dataStart + index;
    const rowNo = rowOffset + index + 1;
    columns.forEach((col, colIndex) => {
      const cell = ws.getCell(row, colIndex + 1);
      cell.value = col.value(member, data, rowNo);
      styleFormData(cell, col.align ?? (colIndex === 0 ? 'center' : 'left'));
    });
  });
}

export function drawCrewListFormNil(ws: ExcelJS.Worksheet, layout: CrewListFormExcelLayout): void {
  mergeCells(ws, layout.dataStart, 1, layout.dataEnd, layout.colCount);
  const nilCell = ws.getCell(layout.dataStart, 1);
  nilCell.value = CREW_LIST_BODY_NIL_LABEL;
  nilCell.font = { name: FORM_FONT, size: 48, bold: true, color: { argb: 'FF808080' } };
  nilCell.alignment = { horizontal: 'center', vertical: 'middle' };
  nilCell.border = FORM_THIN_BORDER as ExcelJS.Borders;
}

export function fillCrewListFormFooter(
  ws: ExcelJS.Worksheet,
  layout: CrewListFormExcelLayout,
  voyageDate: string,
  masterName: string,
): void {
  const sigSplit = Math.max(1, Math.floor(layout.colCount * (layout.colCount > 8 ? 0.45 : 0.55)));
  ws.getCell(layout.signatureRow, 1).value = `${CREW_LIST_FRAME_LABELS.field12}\n${voyageDate}`;
  ws.getCell(layout.signatureRow, sigSplit + 1).value = masterName;
}

export function configureCrewListFormPrint(
  ws: ExcelJS.Worksheet,
  layout: CrewListFormExcelLayout,
  orientation: 'portrait' | 'landscape',
): void {
  const lastCell = `${ws.getColumn(layout.colCount).letter}${layout.lastRow}`;
  ws.pageSetup = {
    paperSize: 9,
    orientation,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: orientation === 'portrait' ? 1 : 0,
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

export function formatCrewListV2Name(
  member: Pick<CrewMember, 'familyName' | 'givenNames'>,
): string {
  const parts = [member.familyName?.trim(), member.givenNames?.trim()].filter(Boolean);
  return parts.join(' ').toUpperCase();
}

export function formatGender(gender: CrewMember['gender']): string {
  if (gender === 'MALE' || gender === 'FEMALE') return gender;
  return '';
}

export function formatBirthAndPlace(
  member: Pick<CrewMember, 'dateOfBirth' | 'placeOfBirth'>,
): string {
  const dob = formatBirthDate(member.dateOfBirth).trim();
  const pob = member.placeOfBirth?.trim() ?? '';
  if (!dob) return pob;
  if (!pob) return dob;
  return `${dob}  ${pob}`;
}

export function formatPlaceOfIssue(value: string): string {
  return value.trim().toUpperCase();
}
