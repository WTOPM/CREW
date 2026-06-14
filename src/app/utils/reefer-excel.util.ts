import ExcelJS from 'exceljs';
import {
  resolveReeferExportPortCode,
  type ReeferLibrarySettings,
  type ReeferOnboardUnit,
} from '../models/reefer.models';
import { portCode, ShipInfo, type Port } from '../models/crew.models';
import { workbookToBytes } from './crew-list-excel-layout.util';
import {
  REEFER_FIXED_HEADERS,
  REEFER_LOG_DATA_END,
  REEFER_LOG_DATA_START,
  REEFER_LOG_LAST_ROW,
  REEFER_LOG_STD_COL_WIDTH,
  buildReeferLogLayout,
  excelColumnLetter,
  padReeferExportUnits,
  parseReeferSetPointNumber,
  reeferExportOnboardUnits,
  reeferLogRowHeight,
  reeferLogTitleYear,
  type ReeferLogLayout,
} from './reefer-monitoring-layout.util';

const SHEET = 'REEFER LOG';
const CALIBRI = 'Calibri';
const ARIAL = 'Arial';
const DATE_FMT = 'dd.mm.yyyy';

const THIN = {
  top: { style: 'thin' as const },
  left: { style: 'thin' as const },
  bottom: { style: 'thin' as const },
  right: { style: 'thin' as const },
};

const WHITE_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFFFFFF' },
};

function merge(ws: ExcelJS.Worksheet, r1: number, c1: number, r2: number, c2: number): void {
  if (r1 === r2 && c1 === c2) return;
  ws.mergeCells(r1, c1, r2, c2);
}

function setCell(
  ws: ExcelJS.Worksheet,
  row: number,
  col: number,
  value: ExcelJS.CellValue,
  style?: Partial<ExcelJS.Style>,
): void {
  const cell = ws.getCell(row, col);
  cell.value = value;
  if (style) cell.style = { ...cell.style, ...style };
}

function isoToExcelDate(iso: string): Date | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function parseSetPointNumber(value: string): number | string {
  return parseReeferSetPointNumber(value);
}

function applyLayout(ws: ExcelJS.Worksheet, layout: ReeferLogLayout): void {
  for (let c = 1; c <= layout.lastCol; c++) {
    ws.getColumn(c).width = layout.colWidths[c - 1] ?? REEFER_LOG_STD_COL_WIDTH;
  }
  for (let r = 1; r <= REEFER_LOG_LAST_ROW; r++) {
    const h = reeferLogRowHeight(r);
    ws.getRow(r).height = h;
  }
}

function drawTopHeader(
  ws: ExcelJS.Worksheet,
  ship: ShipInfo,
  year: string,
  depPortCode: string,
  departureDate: Date | null,
  layout: ReeferLogLayout,
): void {
  const { lastCol } = layout;
  const depLabelCol = lastCol - 3;
  const depValueCol = lastCol - 1;

  setCell(ws, 1, 2, 'SHIP NAME:', {
    font: { name: CALIBRI, size: 11 },
    alignment: { vertical: 'middle' },
  });
  merge(ws, 1, 3, 1, 4);
  setCell(ws, 1, 3, ship.name || '', {
    font: { name: CALIBRI, size: 11 },
    alignment: { horizontal: 'center', vertical: 'middle' },
  });

  setCell(ws, 1, depLabelCol, 'DEPARTURE PORT:', {
    font: { name: CALIBRI, size: 11 },
    alignment: { vertical: 'middle' },
  });
  merge(ws, 1, depValueCol, 1, lastCol);
  setCell(ws, 1, depValueCol, depPortCode || '', {
    font: { name: CALIBRI, size: 11 },
    alignment: { horizontal: 'center', vertical: 'middle' },
  });

  setCell(ws, 2, 2, 'IMO:', {
    font: { name: CALIBRI, size: 11 },
    alignment: { vertical: 'middle' },
  });
  merge(ws, 2, 3, 2, 4);
  setCell(ws, 2, 3, ship.imoNo || '', {
    font: { name: CALIBRI, size: 11 },
    alignment: { horizontal: 'center', vertical: 'middle' },
  });

  setCell(ws, 2, depLabelCol, 'DEPARTURE DATE:', {
    font: { name: CALIBRI, size: 11 },
    alignment: { vertical: 'middle' },
  });
  merge(ws, 2, depValueCol, 2, lastCol);
  const depCell = ws.getCell(2, depValueCol);
  if (departureDate) {
    depCell.value = departureDate;
    depCell.numFmt = DATE_FMT;
  } else {
    depCell.value = '';
  }
  depCell.font = { name: CALIBRI, size: 11 };
  depCell.alignment = { horizontal: 'center', vertical: 'middle' };

  merge(ws, 4, 7, 4, 11);
  setCell(ws, 4, 7, `REEFER MONITORING LOG - ${year}`, {
    font: { name: CALIBRI, size: 11 },
    alignment: { horizontal: 'center', vertical: 'middle' },
  });
}

function drawTableHeader(ws: ExcelJS.Worksheet, layout: ReeferLogLayout): void {
  const headerStyle: Partial<ExcelJS.Style> = {
    font: { name: CALIBRI, size: 12 },
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    border: THIN,
  };

  for (let col = 1; col <= 7; col++) {
    setCell(ws, 6, col, '', headerStyle);
  }

  REEFER_FIXED_HEADERS.forEach(({ col, label, wrap }) => {
    setCell(ws, 7, col, label, {
      ...headerStyle,
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: wrap ?? false },
    });
  });

  layout.dateMergeStarts.forEach((startCol, i) => {
    merge(ws, 6, startCol, 6, startCol + 1);
    const cell = ws.getCell(6, startCol);
    cell.value = { formula: layout.dateFormulas[i] };
    cell.numFmt = DATE_FMT;
    cell.font = { name: CALIBRI, size: 12 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = THIN;
  });

  layout.timeRow7.forEach(({ col, time }) => {
    setCell(ws, 7, col, time, headerStyle);
  });

  sealHeaderRowOuterBorders(ws, layout.lastCol);
  sealHeaderRow6FixedBorders(ws);
}

function sealHeaderRow6FixedBorders(ws: ExcelJS.Worksheet): void {
  for (let col = 1; col <= 7; col++) {
    const cell = ws.getCell(6, col);
    cell.border = {
      top: THIN.top,
      left: col === 1 ? THIN.left : cell.border?.left ?? THIN.left,
      bottom: THIN.bottom,
      right: THIN.right,
    };
  }
}

function sealHeaderRowOuterBorders(ws: ExcelJS.Worksheet, lastCol: number): void {
  const row = 7;
  const leftCell = ws.getCell(row, 1);
  leftCell.border = {
    ...leftCell.border,
    top: THIN.top,
    left: THIN.left,
    bottom: THIN.bottom,
    right: leftCell.border?.right ?? THIN.right,
  };

  const rightCell = ws.getCell(row, lastCol);
  rightCell.border = {
    ...rightCell.border,
    top: THIN.top,
    right: THIN.right,
    bottom: THIN.bottom,
    left: rightCell.border?.left ?? THIN.left,
  };

  for (let col = 1; col <= lastCol; col++) {
    const cell = ws.getCell(row, col);
    cell.border = {
      top: cell.border?.top ?? THIN.top,
      left: col === 1 ? THIN.left : cell.border?.left ?? THIN.left,
      bottom: THIN.bottom,
      right: col === lastCol ? THIN.right : cell.border?.right ?? THIN.right,
    };
  }
}

function drawDataRows(
  ws: ExcelJS.Worksheet,
  units: readonly (ReeferOnboardUnit | null)[],
  ports: readonly Port[],
  lastCol: number,
): void {
  for (let row = REEFER_LOG_DATA_START; row <= REEFER_LOG_DATA_END; row++) {
    const unitIndex = row - REEFER_LOG_DATA_START;
    const unit = units[unitIndex];

    const aCell = ws.getCell(row, 1);
    if (row === REEFER_LOG_DATA_START) {
      aCell.value = 1;
    } else {
      aCell.value = { formula: `A${row - 1}+1` };
    }
    aCell.font = { name: ARIAL, size: 9 };
    aCell.alignment = { horizontal: 'center', vertical: 'middle' };
    aCell.border = THIN;
    aCell.fill = WHITE_FILL;

    const rowValues: { col: number; value: ExcelJS.CellValue; fontSize: number; align?: 'left' | 'center' }[] = [
      { col: 2, value: unit?.containerNo ?? '', fontSize: 10, align: 'left' },
      { col: 3, value: unit ? resolveReeferExportPortCode(unit.loadPort, ports) : '', fontSize: 10, align: 'left' },
      { col: 4, value: unit ? resolveReeferExportPortCode(unit.dischargePort, ports) : '', fontSize: 10 },
      { col: 5, value: unit ? parseSetPointNumber(unit.setPointTemp) : '', fontSize: 10 },
      { col: 6, value: '', fontSize: 10 },
      { col: 7, value: unit?.position ?? '', fontSize: 10, align: 'left' },
    ];

    rowValues.forEach(({ col, value, fontSize, align }) => {
      const cell = ws.getCell(row, col);
      cell.value = value;
      cell.font = { name: ARIAL, size: fontSize };
      cell.alignment = {
        horizontal: align ?? 'center',
        vertical: 'middle',
        wrapText: col === 2 || col === 3,
      };
      cell.border = THIN;
      cell.fill = WHITE_FILL;
    });

    for (let col = 8; col <= lastCol; col++) {
      const cell = ws.getCell(row, col);
      cell.value = '';
      cell.font = { name: ARIAL, size: 10 };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = THIN;
      cell.fill = WHITE_FILL;
    }
  }
}

function drawFooter(ws: ExcelJS.Worksheet, lastCol: number): void {
  merge(ws, 38, 1, 38, 6);
  setCell(ws, 38, 1, 'All reefers checked at 08:30. Signed by OS ______ / OS ______', {
    font: { name: ARIAL, size: 9 },
    alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
  });
  for (let col = 8; col <= lastCol; col++) {
    setCell(ws, 38, col, 'Sig.:________', {
      font: { name: ARIAL, size: 9 },
      alignment: { horizontal: 'center', vertical: 'middle' },
    });
  }

  merge(ws, 39, 1, 39, 6);
  setCell(ws, 39, 1, 'All reefers checked at 16:55. Signed by OS ______ / OS ______', {
    font: { name: ARIAL, size: 9 },
    alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
  });
  for (let col = 8; col <= lastCol; col++) {
    setCell(ws, 39, col, 'Sig.:________', {
      font: { name: ARIAL, size: 9 },
      alignment: { horizontal: 'center', vertical: 'middle' },
    });
  }

  merge(ws, 40, 1, 40, lastCol);
  setCell(
    ws,
    40,
    1,
    "All temperatures of above written reefers were checked on the moment of loading and frequently (at 08:30 & 16:55) until their POD by ship's deck crew.",
    {
      font: { name: ARIAL, size: 9 },
      alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
    },
  );

  merge(ws, 41, 1, 41, lastCol);
  setCell(
    ws,
    41,
    1,
    "In case of Reefer's malfunction or temperature non-conformity - Officer On Watch or Captain must be informed immediately !",
    {
      font: { name: ARIAL, size: 9 },
      alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
    },
  );
}

function configurePrint(ws: ExcelJS.Worksheet, lastCol: number): void {
  ws.pageSetup = {
    paperSize: 9,
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    scale: 80,
    horizontalCentered: true,
    verticalCentered: false,
    margins: {
      left: 0.25,
      right: 0.25,
      top: 0.35,
      bottom: 0.35,
      header: 0.15,
      footer: 0.15,
    },
    printArea: `A1:${excelColumnLetter(lastCol)}${REEFER_LOG_LAST_ROW}`,
  };
}

export async function buildReeferMonitoringExcelBytes(
  ship: ShipInfo,
  library: ReeferLibrarySettings,
  ports: readonly Port[] = [],
): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CREW Documents';
  const ws = wb.addWorksheet(SHEET);

  const layout = buildReeferLogLayout(library);
  const year = reeferLogTitleYear(ship.dateOfDeparture);
  const depPortCode = portCode(ship.portOfCall, [...ports]) || resolveReeferExportPortCode(ship.portOfCall, ports);
  const departureDate = isoToExcelDate(ship.dateOfDeparture);
  const exportUnits = padReeferExportUnits(reeferExportOnboardUnits(library));

  applyLayout(ws, layout);
  drawTopHeader(ws, ship, year, depPortCode, departureDate, layout);
  drawTableHeader(ws, layout);
  drawDataRows(ws, exportUnits, ports, layout.lastCol);
  drawFooter(ws, layout.lastCol);
  configurePrint(ws, layout.lastCol);

  return workbookToBytes(wb);
}
