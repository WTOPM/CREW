import { formatDgWeightKgDisplay, parseDgWeightKg } from '../models/dg-manifest.models';
import type { DgUnifeederRow } from '../models/dg-unifeeder.models';
import { formatDgDisplayLineWeightsKg } from './dg-cargo-merge.util';

/** Preview/export line weights — same allocation as CMA DG gross total. */
export function planUnifeederInventoryWeightDisplays(
  rows: readonly DgUnifeederRow[],
  grossTotalKg: boolean,
): Map<string, string> {
  if (!rows.length) return new Map();

  const rawWeights = rows.map((row) => parseDgWeightKg(row.weightKg));
  const displays = grossTotalKg
    ? formatDgDisplayLineWeightsKg(rawWeights, true)
    : rawWeights.map((weight) => formatDgWeightKgDisplay(weight));

  return new Map(rows.map((row, index) => [row.id, displays[index] ?? '']));
}

export function unifeederExportWeightKg(
  rows: readonly DgUnifeederRow[],
  grossTotalKg: boolean,
): Map<string, number> {
  const displays = planUnifeederInventoryWeightDisplays(rows, grossTotalKg);
  return new Map(
    rows.map((row) => {
      const text = displays.get(row.id) ?? '';
      const parsed = text ? parseDgWeightKg(text) : parseDgWeightKg(row.weightKg);
      return [row.id, parsed];
    }),
  );
}
