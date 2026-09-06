import type { DgUnifeederRow } from '../models/dg-unifeeder.models';
import { matchesArchiveQuery } from './archive-search.util';

/** Search UNIFEEDER rows — excludes flash point, goods description, and weight. */
export function unifeederRowSearchText(row: DgUnifeederRow): string {
  return [
    row.size,
    row.stow,
    row.containerNo,
    row.loadPort,
    row.dischargePort,
    row.loadTerminal,
    row.dischargeTerminal,
    row.unNo,
    row.packingGroup,
    row.lq,
    row.marinePollutant,
    row.dgClass,
    row.subRisk,
    row.fire,
    row.spillage,
    row.fireSchedule,
    row.spillageSchedule,
    row.status,
  ]
    .filter((value) => value !== undefined && value !== null && String(value).trim() !== '')
    .join(' ');
}

export function filterUnifeederOnboardRows(
  rows: readonly DgUnifeederRow[],
  query: string,
): DgUnifeederRow[] {
  if (!query.trim()) return [...rows];
  return rows.filter((row) => matchesArchiveQuery(unifeederRowSearchText(row), query));
}
