import {
  formatDgWeightKgDisplay,
  formatDgWeightKgGrossDisplay,
  roundDgWeightKgSum,
} from '../models/dg-manifest.models';
import { dgLineActiveWeightKg, type DgDualWeightLine } from './dg-weight-tonnage.util';

/** Inventory display: gross/net source + optional whole-kg rounding. */
export interface DgWeightViewOptions {
  useGrossWeight: boolean;
  roundWeights: boolean;
}

export function formatDgWeightForView(
  value: string | number | undefined | null,
  roundWeights: boolean,
): string {
  if (roundWeights) {
    return formatDgWeightKgGrossDisplay(value) || '';
  }
  return formatDgWeightKgDisplay(value) || '';
}

/** One cargo line in whole-kg display (same as {@link formatDgWeightForView}). */
export function roundDgLineWeightKg(weight: number): number {
  if (!Number.isFinite(weight)) return 0;
  return Math.round(weight);
}

/** Inventory/export total — when rounding, sum each line's whole kg (not round the raw sum). */
export function sumPlannedDgLineWeightsKg(
  rawWeights: readonly number[],
  roundWeights: boolean,
): number {
  if (!rawWeights.length) return 0;
  if (roundWeights) {
    return rawWeights.reduce((sum, weight) => sum + roundDgLineWeightKg(weight), 0);
  }
  return roundDgWeightKgSum(rawWeights.reduce((sum, weight) => sum + weight, 0));
}

export function finalizeDgWeightTotalKg(total: number, roundWeights: boolean): number {
  if (!Number.isFinite(total)) return 0;
  return roundWeights ? Math.round(total) : roundDgWeightKgSum(total);
}

export function sumDgLinesWeightKg(
  lines: readonly DgDualWeightLine[],
  useGrossWeight: boolean,
): number {
  let total = 0;
  for (const line of lines) {
    total += dgLineActiveWeightKg(line, useGrossWeight);
  }
  return total;
}

export function planDgLineWeightDisplays(
  rawWeights: readonly number[],
  roundWeights: boolean,
): string[] {
  if (!rawWeights.length) return [];
  return rawWeights.map((weight) => formatDgWeightForView(weight, roundWeights));
}
