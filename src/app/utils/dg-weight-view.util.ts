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
