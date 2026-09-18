import ExcelJS from 'exceljs';
import {
  PHONE_DATA_END_ROW,
  PHONE_DATA_START_ROW,
  createEmptyPhoneRow,
  type PhoneDirectoryRow,
} from '../models/phone.models';

/** Left panel columns (editable). Right panel I–N mirrors on write. */
const COL = {
  subscribe: 1,
  call: 2,
  cabin: 3,
  name: 4,
  facilitySubscribe: 5,
  facilityCall: 6,
  rightSubscribe: 9,
  rightCall: 10,
  rightCabin: 11,
  rightName: 12,
  rightFacilitySubscribe: 13,
  rightFacilityCall: 14,
} as const;

export interface PhoneExcelImportResult {
  sheetName: string;
  title: string;
  rows: PhoneDirectoryRow[];
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    const v = value as {
      richText?: Array<{ text?: string }>;
      text?: string;
      result?: unknown;
      formula?: string;
    };
    if (Array.isArray(v.richText)) {
      return v.richText.map((t) => t.text ?? '').join('').trim();
    }
    if (v.text != null) return String(v.text).trim();
    if (v.result != null) return cellText(v.result as ExcelJS.CellValue);
  }
  return '';
}

function readRow(ws: ExcelJS.Worksheet, excelRow: number): PhoneDirectoryRow {
  const row = createEmptyPhoneRow(excelRow);
  row.subscribe = cellText(ws.getCell(excelRow, COL.subscribe).value);
  row.call = cellText(ws.getCell(excelRow, COL.call).value);
  row.cabin = cellText(ws.getCell(excelRow, COL.cabin).value);
  row.name = cellText(ws.getCell(excelRow, COL.name).value);
  row.facilitySubscribe = cellText(ws.getCell(excelRow, COL.facilitySubscribe).value);
  row.facilityCall = cellText(ws.getCell(excelRow, COL.facilityCall).value);
  return row;
}

function writeCell(ws: ExcelJS.Worksheet, row: number, col: number, text: string): void {
  const cell = ws.getCell(row, col);
  const next = text.trim();
  // Preserve rich-text subscribe labels when the plain text is unchanged.
  if (cellText(cell.value) === next) return;
  cell.value = next || null;
}

function applyRowToSheet(ws: ExcelJS.Worksheet, row: PhoneDirectoryRow): void {
  const r = row.excelRow;
  writeCell(ws, r, COL.subscribe, row.subscribe);
  writeCell(ws, r, COL.call, row.call);
  writeCell(ws, r, COL.cabin, row.cabin);
  writeCell(ws, r, COL.name, row.name);
  writeCell(ws, r, COL.facilitySubscribe, row.facilitySubscribe);
  writeCell(ws, r, COL.facilityCall, row.facilityCall);
  // Mirror second print copy (I–N).
  writeCell(ws, r, COL.rightSubscribe, row.subscribe);
  writeCell(ws, r, COL.rightCall, row.call);
  writeCell(ws, r, COL.rightCabin, row.cabin);
  writeCell(ws, r, COL.rightName, row.name);
  writeCell(ws, r, COL.rightFacilitySubscribe, row.facilitySubscribe);
  writeCell(ws, r, COL.rightFacilityCall, row.facilityCall);
}

async function loadWorkbook(bytes: Uint8Array): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes as unknown as ExcelJS.Buffer);
  return wb;
}

export async function importPhoneDirectoryFromExcelBytes(
  bytes: Uint8Array,
): Promise<PhoneExcelImportResult> {
  const wb = await loadWorkbook(bytes);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('Excel has no sheets');

  const title =
    cellText(ws.getCell(1, COL.subscribe).value) ||
    "CREW MEMBER'S CABIN AND PHONE NUMBERS";

  const rows: PhoneDirectoryRow[] = [];
  for (let excelRow = PHONE_DATA_START_ROW; excelRow <= PHONE_DATA_END_ROW; excelRow++) {
    rows.push(readRow(ws, excelRow));
  }

  return {
    sheetName: ws.name || 'Sheet1',
    title,
    rows,
  };
}

/**
 * Patch cabin/phone cells in an existing workbook and return .xlsx bytes.
 * Keeps page setup, merges, and formatting; mirrors left panel → right panel.
 */
export async function writePhoneDirectoryToExcelBytes(
  bytes: Uint8Array,
  rows: readonly PhoneDirectoryRow[],
  title?: string,
): Promise<Uint8Array> {
  const wb = await loadWorkbook(bytes);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('Excel has no sheets');

  if (title != null && title.trim()) {
    const t = title.trim();
    writeCell(ws, 1, COL.subscribe, t);
    writeCell(ws, 1, COL.rightSubscribe, t);
  }

  const byRow = new Map(rows.map((r) => [r.excelRow, r]));
  for (let excelRow = PHONE_DATA_START_ROW; excelRow <= PHONE_DATA_END_ROW; excelRow++) {
    applyRowToSheet(ws, byRow.get(excelRow) ?? createEmptyPhoneRow(excelRow));
  }

  const out = await wb.xlsx.writeBuffer();
  return out instanceof Uint8Array ? out : new Uint8Array(out);
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}
