/** Crew cabin / ship phone directory from CREW CABIN PHONE.xlsx */

export const PHONE_DATA_START_ROW = 3;
export const PHONE_DATA_END_ROW = 25;

/** One logical row of the left (editable) panel — right panel mirrors on save. */
export interface PhoneDirectoryRow {
  excelRow: number;
  /** Role / station label (Subscribe). */
  subscribe: string;
  call: string;
  cabin: string;
  name: string;
  /** Second Subscribe column (common rooms / stations). */
  facilitySubscribe: string;
  facilityCall: string;
}

export interface PhoneLibrarySettings {
  sourcePath: string;
  sourceFileName: string;
  importedAt: string;
  sheetName: string;
  title: string;
  rows: PhoneDirectoryRow[];
}

export function createDefaultPhoneLibrary(): PhoneLibrarySettings {
  return {
    sourcePath: '',
    sourceFileName: '',
    importedAt: '',
    sheetName: '',
    title: '',
    rows: [],
  };
}

export function createEmptyPhoneRow(excelRow: number): PhoneDirectoryRow {
  return {
    excelRow,
    subscribe: '',
    call: '',
    cabin: '',
    name: '',
    facilitySubscribe: '',
    facilityCall: '',
  };
}

export function normalizePhoneDirectoryRow(raw: unknown, fallbackRow: number): PhoneDirectoryRow {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<PhoneDirectoryRow>;
  const excelRow = Number(r.excelRow);
  return {
    excelRow: Number.isFinite(excelRow) && excelRow >= 1 ? Math.floor(excelRow) : fallbackRow,
    subscribe: String(r.subscribe ?? ''),
    call: String(r.call ?? ''),
    cabin: String(r.cabin ?? ''),
    name: String(r.name ?? ''),
    facilitySubscribe: String(r.facilitySubscribe ?? ''),
    facilityCall: String(r.facilityCall ?? ''),
  };
}

export function normalizePhoneLibrary(raw: unknown): PhoneLibrarySettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<PhoneLibrarySettings>;
  const rowsIn = Array.isArray(r.rows) ? r.rows : [];
  const rows = rowsIn.map((row, i) =>
    normalizePhoneDirectoryRow(row, PHONE_DATA_START_ROW + i),
  );
  return {
    sourcePath: String(r.sourcePath ?? ''),
    sourceFileName: String(r.sourceFileName ?? ''),
    importedAt: String(r.importedAt ?? ''),
    sheetName: String(r.sheetName ?? ''),
    title: String(r.title ?? ''),
    rows,
  };
}
