import { dgClassSortKey, dgUnSortKey } from '../models/dg-manifest.models';
import type { DgUnifeederRow } from '../models/dg-unifeeder.models';

export type DgUnifeederSortColumn = Exclude<
  keyof DgUnifeederRow,
  'id' | 'status' | 'sourceManifestId' | 'weightKg' | 'goodsDescription' | 'fireSchedule' | 'spillageSchedule'
>;

export type DgUnifeederSortDirection = 'asc' | 'desc';

function compareText(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
}

function rowFieldCompare(a: DgUnifeederRow, b: DgUnifeederRow, column: DgUnifeederSortColumn): number {
  switch (column) {
    case 'dgClass': {
      const cmp = dgClassSortKey(a.dgClass) - dgClassSortKey(b.dgClass);
      if (cmp) return cmp;
      return compareText(a.dgClass, b.dgClass);
    }
    case 'unNo': {
      const cmp = dgUnSortKey(a.unNo) - dgUnSortKey(b.unNo);
      if (cmp) return cmp;
      return compareText(a.unNo, b.unNo);
    }
    default: {
      const av = (a[column] ?? '').trim();
      const bv = (b[column] ?? '').trim();
      return compareText(av, bv);
    }
  }
}

function compareUnifeederRows(
  a: DgUnifeederRow,
  b: DgUnifeederRow,
  column: DgUnifeederSortColumn,
): number {
  const cmp = rowFieldCompare(a, b, column);
  if (cmp) return cmp;
  return compareText(a.containerNo, b.containerNo) || compareText(a.id, b.id);
}

export function sortUnifeederRows(
  rows: readonly DgUnifeederRow[],
  column: DgUnifeederSortColumn,
  direction: DgUnifeederSortDirection,
): DgUnifeederRow[] {
  const mul = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => mul * compareUnifeederRows(a, b, column));
}
