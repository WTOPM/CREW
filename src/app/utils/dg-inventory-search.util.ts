import type { DgOnboardContainer } from '../models/dg-manifest.models';
import { matchesArchiveQuery } from './archive-search.util';

/** Search text for DG inventory — excludes flash point, proper shipping name, and kg. */
export function dgContainerSearchText(container: DgOnboardContainer): string {
  const lineParts = container.lines.flatMap((line) => [line.dgClass, line.unNo, line.mpLq]);
  return [
    container.containerNo,
    container.type,
    container.loadPort,
    container.dischargePort,
    container.stowage,
    container.status,
    ...lineParts,
  ]
    .filter((value) => value !== undefined && value !== null && String(value).trim() !== '')
    .join(' ');
}

export function filterDgOnboardContainers(
  containers: readonly DgOnboardContainer[],
  query: string,
): DgOnboardContainer[] {
  if (!query.trim()) return [...containers];
  return containers.filter((container) =>
    matchesArchiveQuery(dgContainerSearchText(container), query),
  );
}
