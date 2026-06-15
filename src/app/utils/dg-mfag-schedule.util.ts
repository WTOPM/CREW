import {
  MFAG_FIRE_SCHEDULE_REFS,
  MFAG_SPILLAGE_SCHEDULE_REFS,
  type MfagScheduleRef,
} from '../data/dg-mfag-reference';

export interface MfagScheduleEntry extends MfagScheduleRef {
  /** Short English line for hover tooltips. */
  summary: string;
  /** Physical size / lead line in tooltip (MFAG page). */
  sizeLabel: string;
}

const FIRE_BY_CODE = new Map(MFAG_FIRE_SCHEDULE_REFS.map((row) => [row.code, row] as const));
const SPILLAGE_BY_CODE = new Map(
  MFAG_SPILLAGE_SCHEDULE_REFS.map((row) => [row.code, row] as const),
);

const FIRE_BY_PAGE = new Map(
  MFAG_FIRE_SCHEDULE_REFS.map((row) => [normalizeMfagPageRef(row.pageRef), row] as const),
);
const SPILLAGE_BY_PAGE = new Map(
  MFAG_SPILLAGE_SCHEDULE_REFS.map((row) => [normalizeMfagPageRef(row.pageRef), row] as const),
);

export function normalizeMfagEmsCode(raw: string | undefined | null): string {
  const v = String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  if (!v) return '';
  const m = v.match(/^([FS])-?([A-Z])$/);
  if (m) return `${m[1]}-${m[2]}`;
  return v;
}

export function normalizeMfagPageRef(raw: string | undefined | null): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

function buildEntry(kind: 'fire' | 'spillage', row: MfagScheduleRef): MfagScheduleEntry {
  const label = kind === 'fire' ? 'Fire schedule' : 'Spillage schedule';
  return {
    ...row,
    sizeLabel: row.pageRef,
    summary: `${label} ${row.code} — see MFAG (Medical First Aid Guide), ${row.pageRef}.`,
  };
}

export function lookupMfagFireSchedule(raw: string | undefined | null): MfagScheduleEntry | null {
  const code = normalizeMfagEmsCode(raw);
  if (code.startsWith('F-')) {
    const row = FIRE_BY_CODE.get(code);
    return row ? buildEntry('fire', row) : null;
  }
  const page = normalizeMfagPageRef(raw);
  if (!page) return null;
  const row = FIRE_BY_PAGE.get(page);
  return row ? buildEntry('fire', row) : null;
}

export function lookupMfagSpillageSchedule(raw: string | undefined | null): MfagScheduleEntry | null {
  const code = normalizeMfagEmsCode(raw);
  if (code.startsWith('S-')) {
    const row = SPILLAGE_BY_CODE.get(code);
    return row ? buildEntry('spillage', row) : null;
  }
  const page = normalizeMfagPageRef(raw);
  if (!page) return null;
  const row = SPILLAGE_BY_PAGE.get(page);
  return row ? buildEntry('spillage', row) : null;
}

export function mfagFirePageRefFromEmsCode(raw: string | undefined | null): string {
  const code = normalizeMfagEmsCode(raw);
  return FIRE_BY_CODE.get(code)?.pageRef ?? '';
}

export function mfagSpillagePageRefFromEmsCode(raw: string | undefined | null): string {
  const code = normalizeMfagEmsCode(raw);
  return SPILLAGE_BY_CODE.get(code)?.pageRef ?? '';
}

export function applyMfagSchedulesToUnifeederRow<
  T extends { fire?: string; spillage?: string; fireSchedule?: string; spillageSchedule?: string },
>(row: T): T {
  const fireSchedule =
    row.fireSchedule?.trim() || mfagFirePageRefFromEmsCode(row.fire ?? '') || '';
  const spillageSchedule =
    row.spillageSchedule?.trim() || mfagSpillagePageRefFromEmsCode(row.spillage ?? '') || '';
  return { ...row, fireSchedule, spillageSchedule };
}
