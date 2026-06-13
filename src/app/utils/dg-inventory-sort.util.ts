import {
  dgClassSortKey,
  dgUnSortKey,
  parseDgWeightKg,
  type DgCargoLine,
  type DgOnboardContainer,
} from '../models/dg-manifest.models';

export type DgInventorySortColumn =
  | 'containerNo'
  | 'type'
  | 'loadPort'
  | 'dischargePort'
  | 'stowage'
  | 'dgClass'
  | 'unNo'
  | 'weightKg'
  | 'properShippingName';

export type DgInventorySortDirection = 'asc' | 'desc';

const LINE_COLUMNS = new Set<DgInventorySortColumn>([
  'dgClass',
  'unNo',
  'weightKg',
  'properShippingName',
]);

function normText(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
}

function compareLineField(
  line: DgCargoLine,
  column: DgInventorySortColumn,
): string | number {
  switch (column) {
    case 'dgClass':
      return dgClassSortKey(line.dgClass);
    case 'unNo':
      return dgUnSortKey(line.unNo);
    case 'weightKg':
      return parseDgWeightKg(line.weightKg);
    case 'properShippingName':
      return normText(line.properShippingName);
    default:
      return '';
  }
}

function compareLines(a: DgCargoLine, b: DgCargoLine, column: DgInventorySortColumn): number {
  const av = compareLineField(a, column);
  const bv = compareLineField(b, column);
  if (typeof av === 'number' && typeof bv === 'number') {
    if (av !== bv) return av - bv;
  } else if (av !== bv) {
    return compareText(String(av), String(bv));
  }
  return compareText(a.unNo, b.unNo) || compareText(a.dgClass, b.dgClass);
}

function containerFieldCompare(
  a: DgOnboardContainer,
  b: DgOnboardContainer,
  column: DgInventorySortColumn,
): number {
  switch (column) {
    case 'containerNo':
      return compareText(a.containerNo, b.containerNo);
    case 'type':
      return compareText(a.type, b.type) || compareText(a.containerNo, b.containerNo);
    case 'loadPort':
      return compareText(a.loadPort, b.loadPort) || compareText(a.containerNo, b.containerNo);
    case 'dischargePort':
      return compareText(a.dischargePort, b.dischargePort) || compareText(a.containerNo, b.containerNo);
    case 'stowage':
      return compareText(a.stowage, b.stowage) || compareText(a.containerNo, b.containerNo);
    default:
      return 0;
  }
}

function containerLineAggregate(
  container: DgOnboardContainer,
  column: DgInventorySortColumn,
): string | number {
  if (!container.lines.length) {
    if (column === 'weightKg') return 0;
    return column === 'dgClass' || column === 'unNo' ? Number.POSITIVE_INFINITY : '';
  }
  const values = container.lines.map((line) => compareLineField(line, column));
  if (column === 'weightKg') {
    return Math.max(...values.map((v) => (typeof v === 'number' ? v : 0)));
  }
  if (column === 'dgClass' || column === 'unNo') {
    return Math.min(...values.map((v) => (typeof v === 'number' ? v : Number.POSITIVE_INFINITY)));
  }
  const sorted = [...values].sort((x, y) => compareText(String(x), String(y)));
  return sorted[0] ?? '';
}

function compareContainers(
  a: DgOnboardContainer,
  b: DgOnboardContainer,
  column: DgInventorySortColumn,
): number {
  if (LINE_COLUMNS.has(column)) {
    const av = containerLineAggregate(a, column);
    const bv = containerLineAggregate(b, column);
    if (typeof av === 'number' && typeof bv === 'number') {
      if (av !== bv) return av - bv;
    } else if (av !== bv) {
      const cmp = compareText(String(av), String(bv));
      if (cmp) return cmp;
    }
  } else {
    const cmp = containerFieldCompare(a, b, column);
    if (cmp) return cmp;
  }
  return compareText(a.containerNo, b.containerNo);
}

export function sortDgOnboardContainers(
  containers: readonly DgOnboardContainer[],
  column: DgInventorySortColumn,
  direction: DgInventorySortDirection,
): DgOnboardContainer[] {
  const mul = direction === 'asc' ? 1 : -1;
  const sorted = [...containers].sort((a, b) => mul * compareContainers(a, b, column));
  if (!LINE_COLUMNS.has(column)) return sorted;

  return sorted.map((container) => ({
    ...container,
    lines: [...container.lines].sort((a, b) => mul * compareLines(a, b, column)),
  }));
}

/** Manifest PDF/Excel rows — by class, then container, then cargo fields. */
export function compareDgManifestExportRowsByClass<
  T extends {
    dgClass: string;
    unNo: string;
    containerNo: string;
    properShippingName?: string;
    mpLq?: string;
  },
>(a: T, b: T): number {
  const cmp = dgClassSortKey(a.dgClass) - dgClassSortKey(b.dgClass);
  if (cmp) return cmp;
  const cls = compareText(a.dgClass, b.dgClass);
  if (cls) return cls;
  const container = compareText(a.containerNo, b.containerNo);
  if (container) return container;
  const un = dgUnSortKey(a.unNo) - dgUnSortKey(b.unNo);
  if (un) return un;
  const unText = compareText(a.unNo, b.unNo);
  if (unText) return unText;
  const name = compareText(a.properShippingName ?? '', b.properShippingName ?? '');
  if (name) return name;
  return compareText(a.mpLq ?? '', b.mpLq ?? '');
}
