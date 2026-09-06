import type { UnNumberReferenceEntry, UnNumberReferenceRow } from './dg-un-number.util';

/**
 * Serialize the active reference back into the shape of
 * `src/app/data/un-numbers-reference.json` (UN number -> entry), so an imported
 * IMDG list can also be committed as the app's new bundled baseline.
 */
export function buildUnNumbersReferenceJson(rows: readonly UnNumberReferenceRow[]): string {
  const out: Record<string, UnNumberReferenceEntry> = {};
  for (const row of [...rows].sort((a, b) =>
    a.unNo.localeCompare(b.unNo, undefined, { numeric: true }),
  )) {
    out[row.unNo] = {
      description: row.description,
      dgClass: row.dgClass,
      packingGroup: row.packingGroup,
      subRisk: row.subRisk,
      fire: row.fire,
      spillage: row.spillage,
      marinePollutant: row.marinePollutant === true,
    };
  }
  return JSON.stringify(out, null, 2);
}

/** Save the active reference as a JSON file. */
export function downloadUnNumbersReferenceJson(
  rows: readonly UnNumberReferenceRow[],
  fileName = 'un-numbers-reference.json',
): void {
  const blob = new Blob([buildUnNumbersReferenceJson(rows)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
