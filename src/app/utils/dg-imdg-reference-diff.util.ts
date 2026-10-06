import type { ImdgChapter32Entry } from './dg-imdg-chapter32-pdf.util';
import { getUnNumberReferenceRows, type UnNumberReferenceRow } from './dg-un-number.util';
import { unNumberReferenceVariantKey } from './dg-un-reference-variant.util';

export interface ImdgUnChange {
  unNo: string;
  description: string;
  was: string;
  now: string;
}

export interface ImdgReferenceDiff {
  /** In the PDF but not in the app reference (same UN+PG+PSN key). */
  added: { unNo: string; description: string }[];
  /** In the app reference but no longer printed in the PDF. */
  removed: { unNo: string; description: string }[];
  fireChanges: ImdgUnChange[];
  spillageChanges: ImdgUnChange[];
  classChanges: ImdgUnChange[];
  packingGroupChanges: ImdgUnChange[];
  /** List rows present in both with no field difference. */
  unchanged: number;
  parsedTotal: number;
  referenceTotal: number;
}

/** Everything the DG reference page needs to describe one import run. */
export interface DgUnReferenceImportReport {
  fileName: string;
  amendment: string;
  tablePages: number;
  skippedLeadingPages: number;
  totalPages: number;
  rowCount: number;
  diff: ImdgReferenceDiff;
}

/** What picking a given apply mode would do, so the user can choose with numbers in hand. */
export interface ImdgApplyOutcome {
  added: number;
  corrected: number;
  removed: number;
  kept: number;
  resultTotal: number;
}

export function correctionCount(diff: ImdgReferenceDiff): number {
  const touched = new Set<string>();
  for (const list of [
    diff.fireChanges,
    diff.spillageChanges,
    diff.classChanges,
    diff.packingGroupChanges,
  ]) {
    for (const row of list) touched.add(`${row.unNo}|${row.description}|${row.was}|${row.now}`);
  }
  return touched.size;
}

export function describeApplyOutcome(
  diff: ImdgReferenceDiff,
  mode: 'replace' | 'merge' | 'addOnly',
): ImdgApplyOutcome {
  const corrected = correctionCount(diff);

  if (mode === 'replace') {
    return {
      added: diff.added.length,
      corrected,
      removed: diff.removed.length,
      kept: 0,
      resultTotal: diff.parsedTotal,
    };
  }
  if (mode === 'merge') {
    return {
      added: diff.added.length,
      corrected,
      removed: 0,
      kept: diff.removed.length,
      resultTotal: diff.referenceTotal + diff.added.length,
    };
  }
  return {
    added: diff.added.length,
    corrected: 0,
    removed: 0,
    kept: diff.removed.length,
    resultTotal: diff.referenceTotal + diff.added.length,
  };
}

function change(unNo: string, description: string, was: string, now: string): ImdgUnChange {
  return { unNo, description, was: was || '—', now: now || '—' };
}

function toRow(entry: ImdgChapter32Entry): UnNumberReferenceRow {
  return {
    unNo: entry.unNo,
    description: entry.description,
    dgClass: entry.dgClass,
    packingGroup: entry.packingGroup,
    subRisk: entry.subRisk,
    fire: entry.fire,
    spillage: entry.spillage,
    marinePollutant: entry.marinePollutant,
  };
}

/**
 * Compare a parsed Chapter 3.2 list against the app reference.
 * Matching is by UN + packing group + proper shipping name (list variants).
 */
export function diffImdgReference(
  parsed: readonly ImdgChapter32Entry[],
  reference: readonly UnNumberReferenceRow[] = getUnNumberReferenceRows(),
): ImdgReferenceDiff {
  const byKey = new Map(reference.map((row) => [unNumberReferenceVariantKey(row), row] as const));
  const parsedRows = parsed.map(toRow);
  const parsedByKey = new Map(
    parsedRows.map((row) => [unNumberReferenceVariantKey(row), row] as const),
  );

  const diff: ImdgReferenceDiff = {
    added: [],
    removed: [],
    fireChanges: [],
    spillageChanges: [],
    classChanges: [],
    packingGroupChanges: [],
    unchanged: 0,
    parsedTotal: parsedRows.length,
    referenceTotal: reference.length,
  };

  for (const [key, entry] of parsedByKey) {
    const current = byKey.get(key);
    if (!current) {
      diff.added.push({ unNo: entry.unNo, description: entry.description });
      continue;
    }

    let touched = false;
    if ((current.fire ?? '').trim() !== entry.fire) {
      diff.fireChanges.push(change(entry.unNo, entry.description, current.fire, entry.fire));
      touched = true;
    }
    if ((current.spillage ?? '').trim() !== entry.spillage) {
      diff.spillageChanges.push(
        change(entry.unNo, entry.description, current.spillage, entry.spillage),
      );
      touched = true;
    }
    if ((current.dgClass ?? '').trim() !== entry.dgClass) {
      diff.classChanges.push(change(entry.unNo, entry.description, current.dgClass, entry.dgClass));
      touched = true;
    }
    if ((current.packingGroup ?? '').trim() !== entry.packingGroup) {
      diff.packingGroupChanges.push(
        change(entry.unNo, entry.description, current.packingGroup, entry.packingGroup),
      );
      touched = true;
    }
    if (!touched) diff.unchanged++;
  }

  for (const [key, row] of byKey) {
    if (!parsedByKey.has(key)) diff.removed.push({ unNo: row.unNo, description: row.description });
  }

  const byUnNo = (a: { unNo: string }, b: { unNo: string }) =>
    a.unNo.localeCompare(b.unNo, undefined, { numeric: true });
  diff.added.sort(byUnNo);
  diff.removed.sort(byUnNo);
  diff.fireChanges.sort(byUnNo);
  diff.spillageChanges.sort(byUnNo);
  diff.classChanges.sort(byUnNo);
  diff.packingGroupChanges.sort(byUnNo);

  return diff;
}
