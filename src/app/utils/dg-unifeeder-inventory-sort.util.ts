import { dgClassSortKey, dgUnSortKey } from '../models/dg-manifest.models';
import type { DgUnifeederRow } from '../models/dg-unifeeder.models';
import type { DgUnifeederRawContainerGroup } from './dg-unifeeder-merge.util';

export type DgUnifeederSortColumn = Exclude<
  keyof DgUnifeederRow,
  'id' | 'status' | 'sourceManifestId' | 'weightKg' | 'goodsDescription' | 'fireSchedule' | 'spillageSchedule'
>;

export type DgUnifeederSortDirection = 'asc' | 'desc';

const CONTAINER_COLUMNS = new Set<DgUnifeederSortColumn>([
  'size',
  'stow',
  'containerNo',
  'loadPort',
  'dischargePort',
]);

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

function groupFieldCompare(
  a: DgUnifeederRawContainerGroup,
  b: DgUnifeederRawContainerGroup,
  column: DgUnifeederSortColumn,
): number {
  const ar = a.rows[0];
  const br = b.rows[0];
  if (!ar || !br) return compareText(ar?.containerNo ?? '', br?.containerNo ?? '');
  return rowFieldCompare(ar, br, column);
}

function groupLineAggregate(
  group: DgUnifeederRawContainerGroup,
  column: DgUnifeederSortColumn,
): string | number {
  if (!group.rows.length) return column === 'dgClass' || column === 'unNo' ? Number.POSITIVE_INFINITY : '';
  const values = group.rows.map((row) => {
    switch (column) {
      case 'dgClass': {
        const key = dgClassSortKey(row.dgClass);
        return key || Number.POSITIVE_INFINITY;
      }
      case 'unNo': {
        const key = dgUnSortKey(row.unNo);
        return key || Number.POSITIVE_INFINITY;
      }
      default:
        return (row[column] ?? '').trim();
    }
  });
  if (column === 'dgClass' || column === 'unNo') {
    return Math.min(...values.map((v) => (typeof v === 'number' ? v : Number.POSITIVE_INFINITY)));
  }
  const sorted = [...values].sort((x, y) => compareText(String(x), String(y)));
  return sorted[0] ?? '';
}

function compareUnifeederContainerGroups(
  a: DgUnifeederRawContainerGroup,
  b: DgUnifeederRawContainerGroup,
  column: DgUnifeederSortColumn,
): number {
  if (!CONTAINER_COLUMNS.has(column)) {
    const av = groupLineAggregate(a, column);
    const bv = groupLineAggregate(b, column);
    if (typeof av === 'number' && typeof bv === 'number') {
      if (av !== bv) return av - bv;
    } else if (av !== bv) {
      const cmp = compareText(String(av), String(bv));
      if (cmp) return cmp;
    }
  } else {
    const cmp = groupFieldCompare(a, b, column);
    if (cmp) return cmp;
  }
  return compareText(a.rows[0]?.containerNo ?? '', b.rows[0]?.containerNo ?? '');
}

export function sortUnifeederContainerGroups(
  groups: readonly DgUnifeederRawContainerGroup[],
  column: DgUnifeederSortColumn,
  direction: DgUnifeederSortDirection,
): DgUnifeederRawContainerGroup[] {
  const mul = direction === 'asc' ? 1 : -1;
  const sorted = [...groups].sort(
    (a, b) => mul * compareUnifeederContainerGroups(a, b, column),
  );
  if (CONTAINER_COLUMNS.has(column)) return sorted;

  return sorted.map((group) => ({
    ...group,
    rows: [...group.rows].sort((a, b) => mul * compareUnifeederRows(a, b, column)),
  }));
}
