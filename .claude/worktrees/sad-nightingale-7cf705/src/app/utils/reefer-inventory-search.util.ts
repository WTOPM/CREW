import type { ReeferOnboardUnit } from '../models/reefer.models';
import { matchesArchiveQuery } from './archive-search.util';

/** Search text for reefer inventory — container, position, load/discharge ports only. */
export function reeferUnitSearchText(unit: ReeferOnboardUnit): string {
  return [unit.containerNo, unit.loadPort, unit.dischargePort, unit.position]
    .filter((value) => value !== undefined && value !== null && String(value).trim() !== '')
    .join(' ');
}

export function filterReeferOnboardUnits(
  units: readonly ReeferOnboardUnit[],
  query: string,
): ReeferOnboardUnit[] {
  if (!query.trim()) return [...units];
  return units.filter((unit) => matchesArchiveQuery(reeferUnitSearchText(unit), query));
}
