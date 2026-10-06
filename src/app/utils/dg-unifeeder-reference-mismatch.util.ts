import type {
  DgUnifeederRow,
  UnifeederRefCompareField,
  UnifeederReferenceKeepManifest,
} from '../models/dg-unifeeder.models';
import { unifeederAutofillFromManifestRow } from './dg-un-number-autofill.util';
import { normalizeDgPackingGroupKey } from './dg-packing-group.util';
import {
  listUnNumberVariantPackingGroups,
  scoreUnDescriptionMatch,
} from './dg-un-reference-variant.util';
import { listUnNumberReferenceVariants, matchUnNumberReference } from './dg-un-number.util';
import { normalizeUnifeederSubRisk } from './dg-unifeeder-sub-risk.util';

export type { UnifeederRefCompareField, UnifeederReferenceKeepManifest };

/** Fields compared live against the matched DG Reference variant. */
export const UNIFEEDER_REF_COMPARE_FIELDS: readonly UnifeederRefCompareField[] = [
  'packingGroup',
  'dgClass',
  'subRisk',
  'fire',
  'spillage',
  'goodsDescription',
];

export interface UnifeederReferenceMismatch {
  field: UnifeederRefCompareField;
  currentValue: string;
  referenceValue: string;
}

export type UnifeederRefCompareRow = Pick<
  DgUnifeederRow,
  'unNo' | 'goodsDescription' | UnifeederRefCompareField
> & {
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
    case 'goodsDescription':
      return 'Goods description';
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
  if (field === 'goodsDescription') {
    return value.toUpperCase().replace(/\s+/g, ' ').trim();
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

function referenceValueForField(
  field: UnifeederRefCompareField,
  row: UnifeederRefCompareRow,
): string {
  const match = matchUnNumberReference(row.unNo, {
    packingGroup: row.packingGroup,
    description: row.goodsDescription,
    dgClass: row.dgClass,
  });
  if (!match) return '';

  if (field === 'packingGroup') {
    if (match.packingGroupMissing) {
      const available = listUnNumberVariantPackingGroups(
        listUnNumberReferenceVariants(row.unNo),
      );
      // Suggest the best-scored variant's PG; list alternates when several exist.
      const suggested = match.row.packingGroup.trim();
      if (available.length > 1) {
        return suggested ? `${suggested} (allowed: ${available.join('/')})` : available.join(' / ');
      }
      return suggested || available[0] || '';
    }
    return match.row.packingGroup.trim();
  }

  if (field === 'goodsDescription') {
    return match.row.description.trim();
  }

  const autofill = unifeederAutofillFromManifestRow(row);
  return String(autofill?.[field] ?? '').trim();
}

/** Active mismatches for a row (manifest value present and differs from matched variant). */
export function listUnifeederReferenceMismatches(
  row: UnifeederRefCompareRow,
): UnifeederReferenceMismatch[] {
  const variants = listUnNumberReferenceVariants(row.unNo);
  if (!variants.length) return [];

  const match = matchUnNumberReference(row.unNo, {
    packingGroup: row.packingGroup,
    description: row.goodsDescription,
    dgClass: row.dgClass,
  });
  if (!match) return [];

  const out: UnifeederReferenceMismatch[] = [];
  for (const field of UNIFEEDER_REF_COMPARE_FIELDS) {
    const referenceValue = referenceValueForField(field, row);
    const currentValue = String(row[field] ?? '').trim();
    if (!referenceValue || !currentValue) continue;

    if (field === 'goodsDescription') {
      if (scoreUnDescriptionMatch(currentValue, match.row.description) >= 50) continue;
    } else if (
      normalizeUnifeederRefCompareValue(field, currentValue) ===
      normalizeUnifeederRefCompareValue(field, applyUnifeederReferenceValue(field, referenceValue))
    ) {
      continue;
    }

    if (isDismissedForReference(row.referenceKeepManifest, field, referenceValue)) continue;
    out.push({ field, currentValue, referenceValue });
  }
  return out;
}

/** Strip UI-only suffixes before writing a reference suggestion into the grid. */
export function applyUnifeederReferenceValue(
  field: UnifeederRefCompareField,
  referenceValue: string,
): string {
  const raw = String(referenceValue ?? '').trim();
  if (field !== 'packingGroup') return raw;
  const withoutNote = raw.replace(/\s*\(allowed:[^)]*\)\s*$/i, '').trim();
  const key = normalizeDgPackingGroupKey(withoutNote);
  return key ?? withoutNote;
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
