import { computed, signal } from '@angular/core';
import unNumbersReference from '../data/un-numbers-reference.json';
import {
  pickUnNumberReferenceVariant,
  type UnNumberLookupHints,
  type UnNumberVariantMatch,
} from './dg-un-reference-variant.util';

export interface UnNumberReferenceEntry {
  description: string;
  dgClass: string;
  packingGroup: string;
  subRisk: string;
  fire: string;
  spillage: string;
  /** Column 4 of the IMDG list flags marine pollutants with a `P`. */
  marinePollutant?: boolean;
}

export interface UnNumberReferenceRow {
  unNo: string;
  description: string;
  dgClass: string;
  packingGroup: string;
  subRisk: string;
  fire: string;
  spillage: string;
  marinePollutant?: boolean;
}

export interface UnNumberClassGroup {
  dgClass: string;
  rows: UnNumberReferenceRow[];
}

export interface UnNumberTooltipEntry {
  unNo: string;
  description: string;
  summary: string;
}

export type { UnNumberLookupHints, UnNumberVariantMatch };

function loadBundledRows(): UnNumberReferenceRow[] {
  const raw = unNumbersReference as
    | UnNumberReferenceRow[]
    | Record<string, UnNumberReferenceEntry>;

  if (Array.isArray(raw)) {
    return raw
      .map((row) => ({
        unNo: normalizeUnNumber(row.unNo),
        description: String(row.description ?? '').trim(),
        dgClass: String(row.dgClass ?? '').trim(),
        packingGroup: String(row.packingGroup ?? '').trim(),
        subRisk: String(row.subRisk ?? '').trim(),
        fire: String(row.fire ?? '').trim(),
        spillage: String(row.spillage ?? '').trim(),
        marinePollutant: row.marinePollutant === true,
      }))
      .filter((row) => /^\d{4}$/.test(row.unNo) && row.unNo !== '0000' && row.description)
      .sort(compareUnNumberReferenceRows);
  }

  return Object.entries(raw)
    .map(([unNo, entry]) => ({
      unNo: normalizeUnNumber(unNo),
      description: entry.description,
      dgClass: entry.dgClass,
      packingGroup: entry.packingGroup,
      subRisk: entry.subRisk,
      fire: entry.fire,
      spillage: entry.spillage,
      marinePollutant: entry.marinePollutant ?? false,
    }))
    .sort(compareUnNumberReferenceRows);
}

export function compareUnNumberReferenceRows(a: UnNumberReferenceRow, b: UnNumberReferenceRow): number {
  const un = a.unNo.localeCompare(b.unNo, undefined, { numeric: true });
  if (un) return un;
  const pgRank = (pg: string) => {
    const u = pg.trim().toUpperCase();
    if (u === 'I' || u === '1') return 1;
    if (u === 'II' || u === '2') return 2;
    if (u === 'III' || u === '3') return 3;
    if (!u || u === '-') return 9;
    return 5;
  };
  const pg = pgRank(a.packingGroup) - pgRank(b.packingGroup);
  if (pg) return pg;
  return a.description.localeCompare(b.description);
}

/** List compiled into the bundle — the fallback when the user has not imported an IMDG PDF. */
const BUNDLED_ROWS: UnNumberReferenceRow[] = loadBundledRows();

/**
 * Set from the persisted AppData by `DgUnReferenceStore`. `null` means "use the
 * bundled list". Kept as a module signal so the pure lookup helpers below stay
 * callable from plain utils while page-level `computed`s still react to imports.
 */
const overrideRows = signal<readonly UnNumberReferenceRow[] | null>(null);

const effectiveRows = computed<readonly UnNumberReferenceRow[]>(
  () => overrideRows() ?? BUNDLED_ROWS,
);

const effectiveByUn = computed(() => {
  const map = new Map<string, UnNumberReferenceRow[]>();
  for (const row of effectiveRows()) {
    const bucket = map.get(row.unNo);
    if (bucket) bucket.push(row);
    else map.set(row.unNo, [row]);
  }
  return map;
});

/** Replace the active reference (imported IMDG list), or pass `null` to fall back to the bundle. */
export function setUnNumberReferenceOverride(rows: readonly UnNumberReferenceRow[] | null): void {
  overrideRows.set(rows ? [...rows] : null);
}

export function getBundledUnNumberRows(): readonly UnNumberReferenceRow[] {
  return BUNDLED_ROWS;
}

export function isUnNumberReferenceOverridden(): boolean {
  return overrideRows() !== null;
}

const UN_NUMBER_CLASS_ORDER = [
  '2.1',
  '2.2',
  '2.3',
  '3',
  '4.1',
  '4.2',
  '4.3',
  '5.1',
  '5.2',
  '6.1',
  '6.2',
  '7',
  '8',
  '9',
];

export function compareDgClass(a: string, b: string): number {
  const ai = UN_NUMBER_CLASS_ORDER.indexOf(a);
  const bi = UN_NUMBER_CLASS_ORDER.indexOf(b);
  if (ai >= 0 && bi >= 0) return ai - bi;
  if (ai >= 0) return -1;
  if (bi >= 0) return 1;
  return a.localeCompare(b, undefined, { numeric: true });
}

export function getUnNumberReferenceRows(): readonly UnNumberReferenceRow[] {
  return effectiveRows();
}

export function getUnNumberReferenceCount(): number {
  return effectiveRows().length;
}

export function getUnNumberClassLabels(): string[] {
  const labels = new Set(
    effectiveRows()
      .map((row) => row.dgClass)
      .filter(Boolean),
  );
  return [...labels].sort(compareDgClass);
}

export function groupUnNumbersByClass(rows: readonly UnNumberReferenceRow[]): UnNumberClassGroup[] {
  const groups = new Map<string, UnNumberReferenceRow[]>();
  for (const row of rows) {
    const dgClass = row.dgClass || '—';
    const bucket = groups.get(dgClass);
    if (bucket) bucket.push(row);
    else groups.set(dgClass, [row]);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => compareDgClass(a, b))
    .map(([dgClass, groupRows]) => ({
      dgClass,
      rows: [...groupRows].sort(compareUnNumberReferenceRows),
    }));
}

export function searchUnNumberRows(
  rows: readonly UnNumberReferenceRow[],
  query: string,
  dgClassFilter: string | null = null,
): UnNumberReferenceRow[] {
  const normalizedQuery = query.trim().toLowerCase();
  const digitsOnly = normalizedQuery.replace(/\D/g, '');

  return rows.filter((row) => {
    if (dgClassFilter && row.dgClass !== dgClassFilter) return false;
    if (!normalizedQuery) return true;

    if (digitsOnly.length >= 2 && row.unNo.includes(digitsOnly)) return true;

    const haystack = [
      row.unNo,
      row.description,
      row.dgClass,
      row.packingGroup,
      row.subRisk,
      row.fire,
      row.spillage,
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}

export function getUnNumberClassCounts(
  rows: readonly UnNumberReferenceRow[] = effectiveRows(),
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.dgClass, (counts.get(row.dgClass) ?? 0) + 1);
  }
  return counts;
}

export function formatUnNumberMeta(value: string): string {
  const trimmed = String(value ?? '').trim();
  return trimmed && trimmed !== '-' ? trimmed : '—';
}

export function normalizeUnNumber(raw: string | undefined | null): string {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length >= 4) return digits.slice(0, 4);
  return digits.padStart(4, '0').slice(-4);
}

/** All Dangerous Goods List rows for one UN number (PG / PSN variants). */
export function listUnNumberReferenceVariants(
  raw: string | undefined | null,
): readonly UnNumberReferenceRow[] {
  const unNo = normalizeUnNumber(raw);
  if (!/^\d{4}$/.test(unNo) || unNo === '0000') return [];
  return effectiveByUn().get(unNo) ?? [];
}

/** Best-matching list variant for manifesto hints (PG + description). */
export function matchUnNumberReference(
  raw: string | undefined | null,
  hints: UnNumberLookupHints = {},
): UnNumberVariantMatch | null {
  return pickUnNumberReferenceVariant(listUnNumberReferenceVariants(raw), hints);
}

export function lookupUnNumber(raw: string | undefined | null): UnNumberTooltipEntry | null {
  const unNo = normalizeUnNumber(raw);
  if (!/^\d{4}$/.test(unNo) || unNo === '0000') return null;

  const variants = listUnNumberReferenceVariants(unNo);
  if (!variants.length) return null;
  const entry = variants[0]!;

  const parts: string[] = [];
  if (entry.dgClass) parts.push(`Class ${entry.dgClass}`);
  const pgs = [
    ...new Set(
      variants
        .map((v) => v.packingGroup.trim())
        .filter((pg) => pg && pg !== '-'),
    ),
  ];
  if (pgs.length > 1) parts.push(`PG ${pgs.join('/')}`);
  else if (pgs.length === 1) parts.push(`PG ${pgs[0]}`);
  if (variants.length > 1) parts.push(`${variants.length} list variants`);
  if (entry.subRisk && entry.subRisk !== '-') {
    parts.push(`Sub-risk ${entry.subRisk}`);
  }
  if (entry.marinePollutant) parts.push('Marine pollutant');
  if (entry.fire) parts.push(`Fire ${entry.fire}`);
  if (entry.spillage) parts.push(`Spillage ${entry.spillage}`);

  return {
    unNo,
    description: entry.description,
    summary: parts.length ? parts.join(' · ') : 'IMDG dangerous goods entry',
  };
}

/**
 * Full DG reference row for a UN number.
 * Pass manifesto packing group / description to select the correct list variant.
 */
export function lookupUnNumberReference(
  raw: string | undefined | null,
  hints: UnNumberLookupHints = {},
): UnNumberReferenceEntry | null {
  const match = matchUnNumberReference(raw, hints);
  if (!match) return null;
  const { row } = match;
  return {
    description: row.description,
    dgClass: row.dgClass,
    packingGroup: row.packingGroup,
    subRisk: row.subRisk,
    fire: row.fire,
    spillage: row.spillage,
    marinePollutant: row.marinePollutant ?? false,
  };
}
