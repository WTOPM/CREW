import type { ImdgChapter32Entry } from './dg-imdg-chapter32-pdf.util';
import { getUnNumberReferenceRows, type UnNumberReferenceRow } from './dg-un-number.util';

export interface ImdgUnChange {
  unNo: string;
  description: string;
  was: string;
  now: string;
}

export interface ImdgReferenceDiff {
  /** In the PDF but not in the app reference. */
  added: { unNo: string; description: string }[];
  /** In the app reference but no longer printed in the PDF. */
  removed: { unNo: string; description: string }[];
  fireChanges: ImdgUnChange[];
  spillageChanges: ImdgUnChange[];
  classChanges: ImdgUnChange[];
  packingGroupChanges: ImdgUnChange[];
  /** UN numbers present in both with no field difference. */
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
    for (const row of list) touched.add(row.unNo);
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

/**
 * Compare a parsed Chapter 3.2 list against the bundled UN reference so the
 * user can see what a new IMDG amendment would add, drop or correct.
 */
export function diffImdgReference(
  parsed: ReadonlyMap<string, ImdgChapter32Entry>,
  reference: readonly UnNumberReferenceRow[] = getUnNumberReferenceRows(),
): ImdgReferenceDiff {
  const byUn = new Map(reference.map((row) => [row.unNo, row]));

  const diff: ImdgReferenceDiff = {
    added: [],
    removed: [],
    fireChanges: [],
    spillageChanges: [],
    classChanges: [],
    packingGroupChanges: [],
    unchanged: 0,
    parsedTotal: parsed.size,
    referenceTotal: byUn.size,
  };

  for (const [unNo, entry] of parsed) {
    const current = byUn.get(unNo);
    if (!current) {
      diff.added.push({ unNo, description: entry.description });
      continue;
    }

    let touched = false;
    if ((current.fire ?? '').trim() !== entry.fire) {
      diff.fireChanges.push(change(unNo, entry.description, current.fire, entry.fire));
      touched = true;
    }
    if ((current.spillage ?? '').trim() !== entry.spillage) {
      diff.spillageChanges.push(change(unNo, entry.description, current.spillage, entry.spillage));
      touched = true;
    }
    if ((current.dgClass ?? '').trim() !== entry.dgClass) {
      diff.classChanges.push(change(unNo, entry.description, current.dgClass, entry.dgClass));
      touched = true;
    }
    if ((current.packingGroup ?? '').trim() !== entry.packingGroup) {
      diff.packingGroupChanges.push(
        change(unNo, entry.description, current.packingGroup, entry.packingGroup),
      );
      touched = true;
    }
    if (!touched) diff.unchanged++;
  }

  for (const [unNo, row] of byUn) {
    if (!parsed.has(unNo)) diff.removed.push({ unNo, description: row.description });
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
