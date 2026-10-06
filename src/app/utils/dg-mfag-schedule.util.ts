import { signal } from '@angular/core';
import {
  MFAG_FIRE_SCHEDULE_REFS,
  MFAG_SPILLAGE_SCHEDULE_REFS,
  type MfagScheduleRef,
} from '../data/dg-mfag-reference';

export interface MfagScheduleEntry extends MfagScheduleRef {
  /** Short English line for hover tooltips. */
  summary: string;
  /** Physical size / lead line in tooltip (EmS Guide page). */
  sizeLabel: string;
}

export interface EmsScheduleTables {
  fire: readonly MfagScheduleRef[];
  spillage: readonly MfagScheduleRef[];
}

/** null = use bundled tables. */
const emsScheduleOverride = signal<EmsScheduleTables | null>(null);

export function setEmsScheduleOverride(tables: EmsScheduleTables | null): void {
  emsScheduleOverride.set(tables);
}

export function getActiveEmsFireSchedules(): readonly MfagScheduleRef[] {
  return emsScheduleOverride()?.fire ?? MFAG_FIRE_SCHEDULE_REFS;
}

export function getActiveEmsSpillageSchedules(): readonly MfagScheduleRef[] {
  return emsScheduleOverride()?.spillage ?? MFAG_SPILLAGE_SCHEDULE_REFS;
}

export function normalizeMfagEmsCode(raw: string | undefined | null): string {
  const v = String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[\u2013\u2014]/g, '-');
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
    summary: `${label} ${row.code} — see EmS Guide, ${row.pageRef}.`,
  };
}

function fireByCode(): Map<string, MfagScheduleRef> {
  return new Map(getActiveEmsFireSchedules().map((row) => [row.code, row] as const));
}

function spillageByCode(): Map<string, MfagScheduleRef> {
  return new Map(getActiveEmsSpillageSchedules().map((row) => [row.code, row] as const));
}

function fireByPage(): Map<string, MfagScheduleRef> {
  return new Map(
    getActiveEmsFireSchedules().map((row) => [normalizeMfagPageRef(row.pageRef), row] as const),
  );
}

function spillageByPage(): Map<string, MfagScheduleRef> {
  return new Map(
    getActiveEmsSpillageSchedules().map(
      (row) => [normalizeMfagPageRef(row.pageRef), row] as const,
    ),
  );
}

export function lookupMfagFireSchedule(raw: string | undefined | null): MfagScheduleEntry | null {
  const code = normalizeMfagEmsCode(raw);
  if (code.startsWith('F-')) {
    const row = fireByCode().get(code);
    return row ? buildEntry('fire', row) : null;
  }
  const page = normalizeMfagPageRef(raw);
  if (!page) return null;
  const row = fireByPage().get(page);
  return row ? buildEntry('fire', row) : null;
}

export function lookupMfagSpillageSchedule(
  raw: string | undefined | null,
): MfagScheduleEntry | null {
  const code = normalizeMfagEmsCode(raw);
  if (code.startsWith('S-')) {
    const row = spillageByCode().get(code);
    return row ? buildEntry('spillage', row) : null;
  }
  const page = normalizeMfagPageRef(raw);
  if (!page) return null;
  const row = spillageByPage().get(page);
  return row ? buildEntry('spillage', row) : null;
}

export function mfagFirePageRefFromEmsCode(raw: string | undefined | null): string {
  const code = normalizeMfagEmsCode(raw);
  return fireByCode().get(code)?.pageRef ?? '';
}

export function mfagSpillagePageRefFromEmsCode(raw: string | undefined | null): string {
  const code = normalizeMfagEmsCode(raw);
  return spillageByCode().get(code)?.pageRef ?? '';
}

export function applyMfagSchedulesToUnifeederRow<
  T extends { fire?: string; spillage?: string; fireSchedule?: string; spillageSchedule?: string },
>(row: T): T {
  const fireSchedule = row.fireSchedule?.trim() || mfagFirePageRefFromEmsCode(row.fire ?? '') || '';
  const spillageSchedule =
    row.spillageSchedule?.trim() || mfagSpillagePageRefFromEmsCode(row.spillage ?? '') || '';
  return { ...row, fireSchedule, spillageSchedule };
}
