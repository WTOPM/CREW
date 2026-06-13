import ExcelJS from 'exceljs';
import {
  dgOnboardInventoryStats,
  parseDgWeightKg,
  resolveDgMasterName,
  type DgLibrarySettings,
  type DgOnboardContainer,
} from '../models/dg-manifest.models';
import { compareDgManifestExportRowsByClass } from './dg-inventory-sort.util';
import { CrewMember, ShipInfo } from '../models/crew.models';
import { formatDisplayDate } from './date.util';
import { workbookToBytes } from './crew-list-excel-layout.util';

export const DG_MANIFEST_COLS = 12;
export const DG_MANIFEST_SHEET = 'DG Manifest';

const LABEL_FONT = 'Arial';
const DATA_FONT = 'Times New Roman';
const BORDER_COLOR = 'FF000000';
const PORT_RED = 'FFB91C1C';
const TOTAL_BLUE = 'FF0284C7';

const thin = { style: 'thin' as const, color: { argb: BORDER_COLOR } };
const medium = { style: 'medium' as const, color: { argb: BORDER_COLOR } };

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: thin,
  left: thin,
  bottom: thin,
  right: thin,
};

const COL_WIDTHS = [4.2, 8.5, 8.5, 5.5, 14.5, 8.5, 5.5, 7, 5.5, 10, 42, 10];

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

function merge(ws: ExcelJS.Worksheet, r1: number, c1: number, r2: number, c2: number): void {
  if (r1 === r2 && c1 === c2) return;
  ws.mergeCells(r1, c1, r2, c2);
}

function setBorder(cell: ExcelJS.Cell, border: Partial<ExcelJS.Borders>): void {
  cell.border = border as ExcelJS.Borders;
}

function styleMetaLabel(cell: ExcelJS.Cell): void {
  cell.font = { name: LABEL_FONT, size: 9 };
  cell.alignment = { horizontal: 'left', vertical: 'bottom', wrapText: true };
  setBorder(cell, THIN_BORDER);
}

function styleMetaValue(cell: ExcelJS.Cell, opts?: { color?: string; bold?: boolean }): void {
  cell.font = {
    name: DATA_FONT,
    size: 10,
    bold: opts?.bold ?? true,
    italic: true,
    color: opts?.color ? { argb: opts.color } : undefined,
  };
  cell.alignment = { horizontal: 'left', vertical: 'bottom', wrapText: true };
  setBorder(cell, THIN_BORDER);
}

function styleTableHead(cell: ExcelJS.Cell): void {
  cell.font = { name: LABEL_FONT, size: 8, bold: true };
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  setBorder(cell, THIN_BORDER);
}

function styleTableData(cell: ExcelJS.Cell, align: 'left' | 'center' | 'right' = 'left'): void {
  cell.font = { name: DATA_FONT, size: 9, bold: true, italic: true };
  cell.alignment = { horizontal: align, vertical: 'middle', wrapText: true };
  setBorder(cell, THIN_BORDER);
}

export function formatDgVesselDisplay(ship: ShipInfo): string {
  const name = ship.name?.trim();
  const cs = ship.callSign?.trim();
  if (name && cs) return `m/v "${name}" / ${cs}`;
  if (name) return `m/v "${name}"`;
  return cs ?? '';
}

/** ISO type 22G1 → 20, 42G1 → 40 (matches paper manifest). */
export function dgExcelContainerType(type: string): string {
  const t = type.trim().toUpperCase();
  if (/^2/.test(t)) return '20';
  if (/^4/.test(t)) return '40';
  return t;
}

export function dgOnboardToExcelRows(onboard: readonly DgOnboardContainer[]): DgManifestExcelRow[] {
  const rows: DgManifestExcelRow[] = [];
  for (const container of onboard.filter((c) => c.status === 'onboard')) {
    const base = {
      pol: container.loadPort.trim(),
      pod: container.dischargePort.trim(),
      type: dgExcelContainerType(container.type),
      containerNo: container.containerNo.trim(),
      stowage: container.stowage.trim(),
    };
    if (!container.lines.length) {
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
    for (const line of container.lines) {
      const hasCargo =
        line.dgClass.trim() ||
        line.unNo.trim() ||
        line.weightKg.trim() ||
        line.properShippingName.trim();
      if (!hasCargo) continue;
      rows.push({
        ...base,
        dgClass: line.dgClass.trim(),
        unNo: line.unNo.trim(),
        mpLq: '',
        flashPoint: '',
        properShippingName: line.properShippingName.trim(),
        weightKg: line.weightKg.trim(),
      });
    }
  }
  return rows.sort(compareDgManifestExportRowsByClass);
}

function formatTotalKg(value: number): number | string {
  if (!value) return '';
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? rounded : rounded;
}

function applyTotalBoxBorder(ws: ExcelJS.Worksheet, top: number, bottom: number): void {
  for (let r = top; r <= bottom; r++) {
    for (let c = 9; c <= DG_MANIFEST_COLS; c++) {
      const cell = ws.getCell(r, c);
      const border = { ...cell.border } as ExcelJS.Borders;
      if (r === top) border.top = medium;
      if (r === bottom) border.bottom = medium;
      if (c === 9) border.left = medium;
      if (c === DG_MANIFEST_COLS) border.right = medium;
      cell.border = border;
    }
  }
}

export function buildDgManifestWorksheet(
  ws: ExcelJS.Worksheet,
  ship: ShipInfo,
  crew: readonly CrewMember[],
  library: DgLibrarySettings,
): number {
  COL_WIDTHS.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  const dataRows = dgOnboardToExcelRows(library.onboard);
  const stats = dgOnboardInventoryStats(library.onboard, false);
  const totalKg = stats.totalKg;

  const titleRow = 2;
  const headerRow = 3;
  const metaTop = 5;
  const metaBottom = 6;
  const tableHeadRow = 8;
  const dataStart = 9;
  const dataEnd = Math.max(dataStart, dataStart + dataRows.length - 1);
  const lastRow = dataEnd;

  ws.getRow(1).height = 6;

  merge(ws, titleRow, 1, titleRow, DG_MANIFEST_COLS);
  const titleCell = ws.getCell(titleRow, 1);
  titleCell.value = 'DANGEROUS GOODS MANIFEST';
  titleCell.font = { name: DATA_FONT, size: 14, bold: true };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(titleRow).height = 22;

  merge(ws, headerRow, 1, headerRow, 4);
  const vesselCell = ws.getCell(headerRow, 1);
  vesselCell.value = formatDgVesselDisplay(ship);
  vesselCell.font = { name: DATA_FONT, size: 10, bold: true, italic: true };
  vesselCell.alignment = { horizontal: 'left', vertical: 'middle' };

  merge(ws, headerRow, 5, headerRow, 8);
  const voyCell = ws.getCell(headerRow, 5);
  voyCell.value = `Voy. No. ${ship.voyageNumber?.trim() ?? ''}`;
  voyCell.font = { name: DATA_FONT, size: 10, bold: true, italic: true };
  voyCell.alignment = { horizontal: 'center', vertical: 'middle' };

  merge(ws, headerRow, 9, headerRow, DG_MANIFEST_COLS);
  const masterCell = ws.getCell(headerRow, 9);
  masterCell.value = `Master: ${resolveDgMasterName(crew)}`;
  masterCell.font = { name: DATA_FONT, size: 10, bold: true, italic: true };
  masterCell.alignment = { horizontal: 'right', vertical: 'middle' };
  ws.getRow(headerRow).height = 18;

  ws.getCell(metaTop, 1).value = 'Port of departure:';
  styleMetaLabel(ws.getCell(metaTop, 1));
  merge(ws, metaTop, 2, metaTop, 4);
  styleMetaValue(ws.getCell(metaTop, 2), { color: PORT_RED });
  ws.getCell(metaTop, 2).value = ship.portOfCall?.trim().toUpperCase() ?? '';

  ws.getCell(metaTop, 5).value = 'Dep. Date:';
  styleMetaLabel(ws.getCell(metaTop, 5));
  merge(ws, metaTop, 6, metaTop, 8);
  styleMetaValue(ws.getCell(metaTop, 6));
  ws.getCell(metaTop, 6).value = formatDisplayDate(ship.dateOfDeparture);

  merge(ws, metaTop, 9, metaTop, DG_MANIFEST_COLS);
  const totalLabelCell = ws.getCell(metaTop, 9);
  totalLabelCell.value = 'Total, kg:';
  totalLabelCell.font = { name: LABEL_FONT, size: 9, bold: true };
  totalLabelCell.alignment = { horizontal: 'center', vertical: 'middle' };
  setBorder(totalLabelCell, THIN_BORDER);

  ws.getCell(metaBottom, 1).value = 'Port of arrival:';
  styleMetaLabel(ws.getCell(metaBottom, 1));
  merge(ws, metaBottom, 2, metaBottom, 4);
  styleMetaValue(ws.getCell(metaBottom, 2), { color: PORT_RED });
  ws.getCell(metaBottom, 2).value = ship.nextPortOfCall?.trim().toUpperCase() ?? '';

  ws.getCell(metaBottom, 5).value = 'Arr. Date:';
  styleMetaLabel(ws.getCell(metaBottom, 5));
  merge(ws, metaBottom, 6, metaBottom, 8);
  styleMetaValue(ws.getCell(metaBottom, 6));
  ws.getCell(metaBottom, 6).value = formatDisplayDate(ship.dateOfArrival);

  merge(ws, metaBottom, 9, metaBottom, DG_MANIFEST_COLS);
  const totalValueCell = ws.getCell(metaBottom, 9);
  totalValueCell.value = formatTotalKg(totalKg);
  totalValueCell.font = { name: DATA_FONT, size: 14, bold: true, italic: true, color: { argb: TOTAL_BLUE } };
  totalValueCell.alignment = { horizontal: 'center', vertical: 'middle' };
  setBorder(totalValueCell, THIN_BORDER);
  applyTotalBoxBorder(ws, metaTop, metaBottom);

  ws.getRow(metaTop).height = 16;
  ws.getRow(metaBottom).height = 20;

  const headers = [
    '',
    'POL',
    'POD',
    'Type',
    'Container-No.',
    'Stowage',
    'Class',
    'UN-No.',
    'MP/LQ',
    'FLASH POINT',
    'PROPER SHIPPING NAME',
    'Weight, kg',
  ];
  headers.forEach((label, i) => {
    const cell = ws.getCell(tableHeadRow, i + 1);
    cell.value = label;
    styleTableHead(cell);
  });
  ws.getRow(tableHeadRow).height = 24;

  dataRows.forEach((row, index) => {
    const r = dataStart + index;
    const values: (string | number)[] = [
      index + 1,
      row.pol,
      row.pod,
      row.type,
      row.containerNo,
      row.stowage,
      row.dgClass,
      row.unNo,
      row.mpLq,
      row.flashPoint,
      row.properShippingName,
      row.weightKg ? parseDgWeightKg(row.weightKg) || row.weightKg : '',
    ];
    values.forEach((value, colIndex) => {
      const cell = ws.getCell(r, colIndex + 1);
      cell.value = value;
      const align =
        colIndex === 0 ||
        colIndex === 3 ||
        colIndex === 5 ||
        colIndex === 6 ||
        colIndex === 7 ||
        colIndex === 8 ||
        colIndex === 11
          ? 'center'
          : colIndex === 10
            ? 'left'
            : 'center';
      styleTableData(cell, align);
    });
    ws.getRow(r).height = 15;
  });

  for (let r = metaTop; r <= lastRow; r++) {
    for (let c = 1; c <= DG_MANIFEST_COLS; c++) {
      const cell = ws.getCell(r, c);
      if (!cell.border) setBorder(cell, THIN_BORDER);
    }
  }

  const lastCell = `${ws.getColumn(DG_MANIFEST_COLS).letter}${lastRow}`;
  ws.pageSetup = {
    paperSize: 9,
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    margins: {
      left: 0.35,
      right: 0.35,
      top: 0.45,
      bottom: 0.45,
      header: 0.2,
      footer: 0.2,
    },
    printArea: `A1:${lastCell}`,
    printTitlesRow: `${tableHeadRow}:${tableHeadRow}`,
  };
  ws.views = [{ showGridLines: false, state: 'frozen', ySplit: tableHeadRow }];
  ws.headerFooter = { oddFooter: '&CPage &P of &N' };

  return lastRow;
}

export async function buildDgManifestExcelBytes(
  ship: ShipInfo,
  crew: readonly CrewMember[],
  library: DgLibrarySettings,
): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CREW Documents';
  const ws = wb.addWorksheet(DG_MANIFEST_SHEET, {
    pageSetup: { orientation: 'landscape', paperSize: 9 },
  });
  buildDgManifestWorksheet(ws, ship, crew, library);
  return workbookToBytes(wb);
}
