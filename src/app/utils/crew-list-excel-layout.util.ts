import ExcelJS from 'exceljs';

export const EXCEL_FONT = 'Calibri';

const BORDER_COLOR = 'FF334155';

export const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: BORDER_COLOR } },
  left: { style: 'thin', color: { argb: BORDER_COLOR } },
  bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
  right: { style: 'thin', color: { argb: BORDER_COLOR } },
};

export const META_LABEL_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFE2E8F0' },
};

export const TABLE_HEAD_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1E3A8A' },
};

export function applyBorder(cell: ExcelJS.Cell): void {
  cell.border = THIN_BORDER as ExcelJS.Borders;
}

export function applyMetaLabel(cell: ExcelJS.Cell): void {
  cell.font = { name: EXCEL_FONT, size: 10, bold: true };
  cell.fill = META_LABEL_FILL;
  cell.alignment = { vertical: 'middle', wrapText: true };
  applyBorder(cell);
}

export function applyMetaValue(cell: ExcelJS.Cell): void {
  cell.font = { name: EXCEL_FONT, size: 10 };
  cell.alignment = { vertical: 'middle', wrapText: true };
  applyBorder(cell);
}

export function applyTableHeader(cell: ExcelJS.Cell): void {
  cell.font = { name: EXCEL_FONT, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  cell.fill = TABLE_HEAD_FILL;
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  applyBorder(cell);
}

export function applyTableBody(cell: ExcelJS.Cell, align: 'left' | 'center' = 'left'): void {
  cell.font = { name: EXCEL_FONT, size: 10 };
  cell.alignment = { horizontal: align, vertical: 'middle', wrapText: true };
  applyBorder(cell);
}

export function applyTitle(cell: ExcelJS.Cell): void {
  cell.font = { name: EXCEL_FONT, size: 16, bold: true };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
}

export function configurePrint(
  ws: ExcelJS.Worksheet,
  opts: {
    orientation: 'portrait' | 'landscape';
    lastRow: number;
    lastCol: number;
    headerRow: number;
  },
): void {
  const lastCell = `${ws.getColumn(opts.lastCol).letter}${opts.lastRow}`;

  ws.pageSetup = {
    paperSize: 9,
    orientation: opts.orientation,
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
    printTitlesRow: `${opts.headerRow}:${opts.headerRow}`,
  };

  ws.headerFooter = {
    oddFooter: '&CPage &P of &N',
  };

  ws.views = [{ showGridLines: false, state: 'frozen', ySplit: opts.headerRow }];
}

export async function workbookToBytes(wb: ExcelJS.Workbook): Promise<Uint8Array> {
  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf);
}

export function setColumnWidths(ws: ExcelJS.Worksheet, widths: number[]): void {
  widths.forEach((wch, i) => {
    ws.getColumn(i + 1).width = wch;
  });
}

export function writeMetaRow(
  ws: ExcelJS.Worksheet,
  row: number,
  label: string,
  value: string,
): void {
  const labelCell = ws.getCell(row, 1);
  labelCell.value = label;
  applyMetaLabel(labelCell);

  const valueCell = ws.getCell(row, 2);
  valueCell.value = value;
  applyMetaValue(valueCell);
}

/** Span the value column through the rest of the sheet (cols 2…lastCol). */
export function mergeMetaBlock(
  ws: ExcelJS.Worksheet,
  fromRow: number,
  toRow: number,
  lastCol: number,
): void {
  if (lastCol <= 2) return;
  for (let r = fromRow; r <= toRow; r++) {
    ws.mergeCells(r, 2, r, lastCol);
    applyMetaValue(ws.getCell(r, 2));
    for (let c = 3; c <= lastCol; c++) {
      const cell = ws.getCell(r, c);
      cell.value = '';
      applyMetaValue(cell);
    }
  }
}
