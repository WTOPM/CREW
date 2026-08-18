import unNumbersReference from '../data/un-numbers-reference.json';

export interface UnNumberReferenceEntry {
  description: string;
  dgClass: string;
  packingGroup: string;
  subRisk: string;
  fire: string;
  spillage: string;
}

export interface UnNumberReferenceRow {
  unNo: string;
  description: string;
  dgClass: string;
  packingGroup: string;
  subRisk: string;
  fire: string;
  spillage: string;
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

const UN_NUMBER_MAP = new Map<string, UnNumberReferenceEntry>(
  Object.entries(unNumbersReference as Record<string, UnNumberReferenceEntry>),
);

const UN_NUMBER_ROWS: UnNumberReferenceRow[] = [...UN_NUMBER_MAP.entries()]
  .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
  .map(([unNo, entry]) => ({
    unNo,
    description: entry.description,
    dgClass: entry.dgClass,
    packingGroup: entry.packingGroup,
    subRisk: entry.subRisk,
    fire: entry.fire,
    spillage: entry.spillage,
  }));

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
  return UN_NUMBER_ROWS;
}

export function getUnNumberClassLabels(): string[] {
  const labels = new Set(UN_NUMBER_ROWS.map((row) => row.dgClass).filter(Boolean));
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
      rows: groupRows.sort((a, b) => a.unNo.localeCompare(b.unNo, undefined, { numeric: true })),
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
  rows: readonly UnNumberReferenceRow[] = UN_NUMBER_ROWS,
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

export function lookupUnNumber(raw: string | undefined | null): UnNumberTooltipEntry | null {
  const unNo = normalizeUnNumber(raw);
  if (!/^\d{4}$/.test(unNo) || unNo === '0000') return null;

  const entry = UN_NUMBER_MAP.get(unNo);
  if (!entry) return null;

  const parts: string[] = [];
  if (entry.dgClass) parts.push(`Class ${entry.dgClass}`);
  if (entry.packingGroup && entry.packingGroup !== '-') {
    parts.push(`PG ${entry.packingGroup}`);
  }
  if (entry.subRisk && entry.subRisk !== '-') {
    parts.push(`Sub-risk ${entry.subRisk}`);
  }
  if (entry.fire) parts.push(`Fire ${entry.fire}`);
  if (entry.spillage) parts.push(`Spillage ${entry.spillage}`);

  return {
    unNo,
    description: entry.description,
    summary: parts.length ? parts.join(' · ') : 'IMDG dangerous goods entry',
  };
}

/** Full DG reference row for a UN number (fire/spillage EMS codes, etc.). */
export function lookupUnNumberReference(
  raw: string | undefined | null,
): UnNumberReferenceEntry | null {
  const unNo = normalizeUnNumber(raw);
  if (!/^\d{4}$/.test(unNo) || unNo === '0000') return null;
  return UN_NUMBER_MAP.get(unNo) ?? null;
}

export const UN_NUMBER_REFERENCE_COUNT = UN_NUMBER_MAP.size;
