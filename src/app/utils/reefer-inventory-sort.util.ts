import type {
  ReeferInventorySortColumn,
  ReeferInventorySortDirection,
  ReeferLibrarySettings,
  ReeferOnboardUnit,
} from '../models/reefer.models';

const SORT_COLUMNS = new Set<ReeferInventorySortColumn>([
  'containerNo',
  'loadPort',
  'dischargePort',
  'position',
]);

function compareText(a: string, b: string): number {
  return a
    .trim()
    .toLocaleLowerCase()
    .localeCompare(b.trim().toLocaleLowerCase(), undefined, { sensitivity: 'base', numeric: true });
}

function compareUnits(
  a: ReeferOnboardUnit,
  b: ReeferOnboardUnit,
  column: ReeferInventorySortColumn,
): number {
  switch (column) {
    case 'containerNo':
      return compareText(a.containerNo, b.containerNo);
    case 'loadPort':
      return compareText(a.loadPort, b.loadPort) || compareText(a.containerNo, b.containerNo);
    case 'dischargePort':
      return compareText(a.dischargePort, b.dischargePort) || compareText(a.containerNo, b.containerNo);
    case 'position':
      return compareText(a.position, b.position) || compareText(a.containerNo, b.containerNo);
  }
}

export function normalizeReeferInventorySortColumn(
  value: unknown,
): ReeferInventorySortColumn | null {
  return typeof value === 'string' && SORT_COLUMNS.has(value as ReeferInventorySortColumn)
    ? (value as ReeferInventorySortColumn)
    : null;
}

export function sortReeferOnboardUnits(
  units: readonly ReeferOnboardUnit[],
  column: ReeferInventorySortColumn,
  direction: ReeferInventorySortDirection,
): ReeferOnboardUnit[] {
  const mul = direction === 'asc' ? 1 : -1;
  return [...units].sort((a, b) => mul * compareUnits(a, b, column));
}

export function reeferVisibleOnboardUnits(library: ReeferLibrarySettings): ReeferOnboardUnit[] {
  let list = library.showDischarged
    ? [...library.onboard]
    : library.onboard.filter((u) => u.status !== 'discharged');
  if (library.inventorySortColumn) {
    list = sortReeferOnboardUnits(list, library.inventorySortColumn, library.inventorySortDirection);
  }
  return list;
}
