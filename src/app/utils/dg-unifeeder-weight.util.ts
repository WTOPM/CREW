import { parseDgWeightKg } from '../models/dg-manifest.models';
import type { DgUnifeederRow } from '../models/dg-unifeeder.models';
import { dgLineActiveWeightKg } from './dg-weight-tonnage.util';
import {
  planDgLineWeightDisplays,
  sumPlannedDgLineWeightsKg,
  type DgWeightViewOptions,
} from './dg-weight-view.util';
import { mergeUnifeederRowsInContainersWithMeta } from './dg-unifeeder-merge.util';

export interface UnifeederWeightPipelineOptions extends DgWeightViewOptions {
  mergeLines?: boolean;
}

function unifeederDisplayRows(
  rows: readonly DgUnifeederRow[],
  options: UnifeederWeightPipelineOptions,
): DgUnifeederRow[] {
  const mergeLines = options.mergeLines !== false;
  return mergeUnifeederRowsInContainersWithMeta(rows, mergeLines, options.useGrossWeight).rows;
}

/** Preview/export line weights — same pipeline as inventory table. */
export function planUnifeederInventoryWeightDisplays(
  rows: readonly DgUnifeederRow[],
  options: UnifeederWeightPipelineOptions,
): Map<string, string> {
  const displayRows = unifeederDisplayRows(rows, options);
  if (!displayRows.length) return new Map();

  const rawWeights = displayRows.map((row) => dgLineActiveWeightKg(row, options.useGrossWeight));
  const displays = planDgLineWeightDisplays(rawWeights, options.roundWeights);

  return new Map(displayRows.map((row, index) => [row.id, displays[index] ?? '']));
}

export function unifeederExportWeightKg(
  rows: readonly DgUnifeederRow[],
  options: UnifeederWeightPipelineOptions,
): Map<string, number> {
  const displays = planUnifeederInventoryWeightDisplays(rows, options);
  const displayRows = unifeederDisplayRows(rows, options);
  return new Map(
    displayRows.map((row) => {
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
  options: UnifeederWeightPipelineOptions,
): number[] {
  const displayRows = unifeederDisplayRows(rows, options);
  return displayRows.map((row) => dgLineActiveWeightKg(row, options.useGrossWeight));
}

export function unifeederInventoryDisplayTotalKg(
  rows: readonly DgUnifeederRow[],
  options: UnifeederWeightPipelineOptions,
): number {
  return sumPlannedDgLineWeightsKg(
    unifeederInventoryDisplayRawWeights(rows, options),
    options.roundWeights,
  );
}

export function unifeederExportTotalKg(
  rows: readonly DgUnifeederRow[],
  options: UnifeederWeightPipelineOptions,
): number {
  return unifeederInventoryDisplayTotalKg(rows, options);
}

/** DP WORLD PDF/Excel Amount column — always `N.N kg` (e.g. `1.0 kg`). */
export function formatUnifeederExportAmountKg(kg: number): string {
  if (!Number.isFinite(kg) || kg <= 0) return '';
  return `${(Math.round(kg * 10) / 10).toFixed(1)} kg`;
}
