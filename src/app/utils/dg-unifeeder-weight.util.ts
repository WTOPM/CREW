import { parseDgWeightKg } from '../models/dg-manifest.models';
import type { DgUnifeederRow } from '../models/dg-unifeeder.models';
import { dgLineActiveWeightKg } from './dg-weight-tonnage.util';
import {
  planDgLineWeightDisplays,
  sumPlannedDgLineWeightsKg,
  type DgWeightViewOptions,
} from './dg-weight-view.util';
import { mergeUnifeederRowsInContainersWithMeta } from './dg-unifeeder-merge.util';

/** Preview/export line weights — same allocation as CMA DG inventory. */
export function planUnifeederInventoryWeightDisplays(
  rows: readonly DgUnifeederRow[],
  options: DgWeightViewOptions,
): Map<string, string> {
  if (!rows.length) return new Map();

  const rawWeights = rows.map((row) => dgLineActiveWeightKg(row, options.useGrossWeight));
  const displays = planDgLineWeightDisplays(rawWeights, options.roundWeights);

  return new Map(rows.map((row, index) => [row.id, displays[index] ?? '']));
}

export function unifeederExportWeightKg(
  rows: readonly DgUnifeederRow[],
  options: DgWeightViewOptions,
): Map<string, number> {
  const displays = planUnifeederInventoryWeightDisplays(rows, options);
  return new Map(
    rows.map((row) => {
      const text = displays.get(row.id) ?? '';
      const parsed = text
        ? parseDgWeightKg(text)
        : dgLineActiveWeightKg(row, options.useGrossWeight);
      return [row.id, parsed];
    }),
  );
}

export function unifeederInventoryDisplayRawWeights(
  rows: readonly DgUnifeederRow[],
  options: DgWeightViewOptions & { mergeLines: boolean },
): number[] {
  const { rows: displayRows } = mergeUnifeederRowsInContainersWithMeta(
    rows,
    options.mergeLines,
    options.useGrossWeight,
  );
  return displayRows.map((row) => dgLineActiveWeightKg(row, options.useGrossWeight));
}

export function unifeederInventoryDisplayTotalKg(
  rows: readonly DgUnifeederRow[],
  options: DgWeightViewOptions & { mergeLines: boolean },
): number {
  return sumPlannedDgLineWeightsKg(
    unifeederInventoryDisplayRawWeights(rows, options),
    options.roundWeights,
  );
}

export function unifeederExportTotalKg(
  rows: readonly DgUnifeederRow[],
  options: DgWeightViewOptions & { mergeLines?: boolean },
): number {
  if (options.mergeLines) {
    return unifeederInventoryDisplayTotalKg(rows, {
      ...options,
      mergeLines: true,
    });
  }
  const rawWeights = rows.map((row) => dgLineActiveWeightKg(row, options.useGrossWeight));
  return sumPlannedDgLineWeightsKg(rawWeights, options.roundWeights);
}
