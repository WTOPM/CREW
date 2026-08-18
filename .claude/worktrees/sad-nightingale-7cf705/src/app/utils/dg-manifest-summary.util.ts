import {
  dgClassSortKey,
  roundDgWeightKgSum,
  type DgOnboardContainer,
} from '../models/dg-manifest.models';
import type { DgUnifeederRow } from '../models/dg-unifeeder.models';
import { dgLineActiveWeightKg, type DgDualWeightLine } from './dg-weight-tonnage.util';
import { roundDgLineWeightKg, sumPlannedDgLineWeightsKg } from './dg-weight-view.util';
import { normalizeIsoContainerTypeCode } from './iso-container-type.util';

/** UNIFEEDER manifest TOTAL length rows (display order). */
const MANIFEST_LENGTH_ORDER = ["20'", '23', '24', '25', '26', "30'", "40'", "45'"] as const;

export interface ManifestLengthBucket {
  label: string;
  containerCount: number;
}

export interface ManifestClassWeightRow {
  dgClass: string;
  totalKg: number;
}

export interface ManifestInventorySummary {
  lengthBuckets: ManifestLengthBucket[];
  classRows: ManifestClassWeightRow[];
  containerCount: number;
  totalKg: number;
}

export function manifestLengthLabelFromSizeCode(sizeCode: string): string {
  const code = normalizeIsoContainerTypeCode(sizeCode);
  if (!code) return '';

  const key = code.slice(0, 2);
  if (key === '20' || key === '22') return "20'";
  if (key === '23') return '23';
  if (key === '24') return '24';
  if (key === '25') return '25';
  if (key === '26') return '26';
  if (key === '30') return "30'";
  if (key === '40' || key === '42' || key === '45') return "40'";
  if (key === 'L2' || key === 'L5') return "45'";

  return '';
}

function manifestLengthSortKey(label: string): number {
  const idx = MANIFEST_LENGTH_ORDER.indexOf(label as (typeof MANIFEST_LENGTH_ORDER)[number]);
  return idx >= 0 ? idx : 100;
}

export function buildManifestLengthBuckets(
  containerSizes: readonly string[],
): ManifestLengthBucket[] {
  const counts = new Map<string, number>();

  for (const size of containerSizes) {
    const label = manifestLengthLabelFromSizeCode(size);
    if (!label) continue;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([label, containerCount]) => ({ label, containerCount }))
    .filter((bucket) => bucket.containerCount > 0)
    .sort(
      (a, b) =>
        manifestLengthSortKey(a.label) - manifestLengthSortKey(b.label) ||
        a.label.localeCompare(b.label),
    );
}

export function buildManifestClassWeightRows(
  entries: readonly ({ dgClass: string } & DgDualWeightLine)[],
  useGross = false,
  roundWeights = false,
): ManifestClassWeightRow[] {
  const map = new Map<string, { dgClass: string; totalKg: number }>();
  const finalize = roundWeights
    ? (total: number) => total
    : (total: number) => roundDgWeightKgSum(total);

  for (const entry of entries) {
    const dgClass = entry.dgClass.trim();
    const raw = dgLineActiveWeightKg(entry, useGross);
    if (!dgClass || raw <= 0) continue;
    const weight = roundWeights ? roundDgLineWeightKg(raw) : raw;

    const key = dgClass.replace(',', '.').toLowerCase();
    if (!map.has(key)) {
      map.set(key, { dgClass, totalKg: 0 });
    }
    const row = map.get(key)!;
    if (dgClass) row.dgClass = dgClass;
    row.totalKg += weight;
  }

  return [...map.values()]
    .map((row) => ({ ...row, totalKg: finalize(row.totalKg) }))
    .filter((row) => row.totalKg > 0)
    .sort((a, b) => {
      const cmp = dgClassSortKey(a.dgClass) - dgClassSortKey(b.dgClass);
      return cmp || a.dgClass.localeCompare(b.dgClass, undefined, { sensitivity: 'base' });
    });
}

function uniqueContainerSizesFromUnifeederRows(rows: readonly DgUnifeederRow[]): string[] {
  const byContainer = new Map<string, string>();

  for (const row of rows) {
    const containerNo = row.containerNo.trim();
    if (!containerNo) continue;
    const size = row.size.trim();
    if (!byContainer.has(containerNo) && size) {
      byContainer.set(containerNo, size);
    }
  }

  return [...byContainer.values()];
}

export function unifeederManifestSummary(
  rows: readonly DgUnifeederRow[],
  useGrossWeight = true,
  roundWeights = false,
): ManifestInventorySummary {
  const lengthBuckets = buildManifestLengthBuckets(uniqueContainerSizesFromUnifeederRows(rows));
  const classRows = buildManifestClassWeightRows(rows, useGrossWeight, roundWeights);
  const rawWeights = rows.map((row) => dgLineActiveWeightKg(row, useGrossWeight));

  return {
    lengthBuckets,
    classRows,
    containerCount: new Set(rows.map((row) => row.containerNo.trim()).filter(Boolean)).size,
    totalKg: sumPlannedDgLineWeightsKg(rawWeights, roundWeights),
  };
}

function uniqueContainerSizesFromDgContainers(containers: readonly DgOnboardContainer[]): string[] {
  return containers.map((container) => container.type.trim()).filter(Boolean);
}

export function dgOnboardManifestSummary(
  containers: readonly DgOnboardContainer[],
  useGross = false,
  roundWeights = false,
): ManifestInventorySummary {
  const lengthBuckets = buildManifestLengthBuckets(
    uniqueContainerSizesFromDgContainers(containers),
  );
  const classRows = buildManifestClassWeightRows(
    containers.flatMap((container) => container.lines),
    useGross,
    roundWeights,
  );

  const rawWeights: number[] = [];
  for (const container of containers) {
    for (const line of container.lines) {
      rawWeights.push(dgLineActiveWeightKg(line, useGross));
    }
  }

  return {
    lengthBuckets,
    classRows,
    containerCount: containers.length,
    totalKg: sumPlannedDgLineWeightsKg(rawWeights, roundWeights),
  };
}
