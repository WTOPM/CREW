import type {
  DgUnifeederRow,
  UnifeederRefCompareField,
  UnifeederReferenceKeepManifest,
} from '../models/dg-unifeeder.models';
import { unifeederAutofillFromUnNumber } from './dg-un-number-autofill.util';
import { normalizeDgPackingGroupKey } from './dg-packing-group.util';
import { normalizeUnifeederSubRisk } from './dg-unifeeder-sub-risk.util';

export type { UnifeederRefCompareField, UnifeederReferenceKeepManifest };

/** Fields compared live against DG Reference while manifesto values stay in the grid. */
export const UNIFEEDER_REF_COMPARE_FIELDS: readonly UnifeederRefCompareField[] = [
  'packingGroup',
  'dgClass',
  'subRisk',
  'fire',
  'spillage',
];

export interface UnifeederReferenceMismatch {
  field: UnifeederRefCompareField;
  currentValue: string;
  referenceValue: string;
}

export type UnifeederRefCompareRow = Pick<DgUnifeederRow, 'unNo' | UnifeederRefCompareField> & {
  referenceKeepManifest?: UnifeederReferenceKeepManifest;
};

export function unifeederRefCompareFieldLabel(field: UnifeederRefCompareField): string {
  switch (field) {
    case 'packingGroup':
      return 'Packing group';
    case 'dgClass':
      return 'Class';
    case 'subRisk':
      return 'Sub-risk';
    case 'fire':
      return 'Fire';
    case 'spillage':
      return 'Spillage';
  }
}

/** Normalize for equality checks (PG roman/arabic, case, sub-risk slashes). */
export function normalizeUnifeederRefCompareValue(
  field: UnifeederRefCompareField,
  raw: string,
): string {
  const value = String(raw ?? '').trim();
  if (!value) return '';
  if (field === 'packingGroup') {
    return normalizeDgPackingGroupKey(value) ?? value.toUpperCase();
  }
  if (field === 'subRisk') {
    return normalizeUnifeederSubRisk(value).toUpperCase();
  }
  return value.toUpperCase().replace(/\s+/g, '');
}

function isDismissedForReference(
  keep: UnifeederReferenceKeepManifest | undefined,
  field: UnifeederRefCompareField,
  referenceValue: string,
): boolean {
  const declined = keep?.[field];
  if (declined == null || !String(declined).trim()) return false;
  return (
    normalizeUnifeederRefCompareValue(field, declined) ===
    normalizeUnifeederRefCompareValue(field, referenceValue)
  );
}

/** Active mismatches for a row (manifesto value present and differs from DG Reference). */
export function listUnifeederReferenceMismatches(
  row: UnifeederRefCompareRow,
): UnifeederReferenceMismatch[] {
  const autofill = unifeederAutofillFromUnNumber(row.unNo);
  if (!autofill) return [];

  const out: UnifeederReferenceMismatch[] = [];
  for (const field of UNIFEEDER_REF_COMPARE_FIELDS) {
    const referenceValue = String(autofill[field] ?? '').trim();
    const currentValue = String(row[field] ?? '').trim();
    if (!referenceValue || !currentValue) continue;
    if (
      normalizeUnifeederRefCompareValue(field, currentValue) ===
      normalizeUnifeederRefCompareValue(field, referenceValue)
    ) {
      continue;
    }
    if (isDismissedForReference(row.referenceKeepManifest, field, referenceValue)) continue;
    out.push({ field, currentValue, referenceValue });
  }
  return out;
}

export function getUnifeederReferenceMismatch(
  row: UnifeederRefCompareRow,
  field: UnifeederRefCompareField,
): UnifeederReferenceMismatch | null {
  return listUnifeederReferenceMismatches(row).find((m) => m.field === field) ?? null;
}

export function countUnifeederReferenceMismatches(rows: readonly UnifeederRefCompareRow[]): number {
  return rows.reduce((sum, row) => sum + listUnifeederReferenceMismatches(row).length, 0);
}

/** Rows with the same field / manifesto value / DG Reference suggestion (not dismissed). */
export function findIdenticalUnifeederReferenceMismatches<T extends UnifeederRefCompareRow>(
  rows: readonly T[],
  sample: UnifeederReferenceMismatch,
): T[] {
  const curKey = normalizeUnifeederRefCompareValue(sample.field, sample.currentValue);
  const refKey = normalizeUnifeederRefCompareValue(sample.field, sample.referenceValue);
  return rows.filter((row) => {
    const mismatch = getUnifeederReferenceMismatch(row, sample.field);
    if (!mismatch) return false;
    return (
      normalizeUnifeederRefCompareValue(sample.field, mismatch.currentValue) === curKey &&
      normalizeUnifeederRefCompareValue(sample.field, mismatch.referenceValue) === refKey
    );
  });
}

export function appendUnifeederReferenceMismatchWarning(
  warnings: string[],
  mismatchCount: number,
): void {
  if (mismatchCount <= 0) return;
  warnings.push(
    mismatchCount === 1
      ? '1 value differs from DG Reference (highlighted — click to review).'
      : `${mismatchCount} values differ from DG Reference (highlighted — click to review).`,
  );
}
