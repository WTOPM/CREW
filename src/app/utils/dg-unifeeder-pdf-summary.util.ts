import { parseDgWeightKg } from '../models/dg-manifest.models';
import type { DgPdfTextItem } from './dg-pdf-text.util';
import { manifestLengthLabelFromSizeCode } from './dg-manifest-summary.util';

interface UnifeederImportRowForValidation {
  containerNo: string;
  size: string;
  weightKg: string;
}

const EU_WEIGHT_RE = /^\d{1,3}(?:\.\d{3})*,\d{2}$/;
const LENGTH_KEYS = ['20', '30', '40', '45'] as const;
type LengthKey = (typeof LENGTH_KEYS)[number];

export interface UnifeederPdfGrandTotalSummary {
  containerCountsByLength: Record<LengthKey, number>;
  totalContainers: number;
  totalImoNetWeightKg: number;
  totalImoGrossWeightKg: number;
}

export interface UnifeederImportValidation {
  ok: boolean;
  mismatches: string[];
}

function lengthKeyToBucketLabel(key: LengthKey): string {
  if (key === '20') return "20'";
  if (key === '30') return "30'";
  if (key === '40') return "40'";
  return "45'";
}

function findSummaryPage(items: readonly DgPdfTextItem[]): number | null {
  const pages = [...new Set(items.map((i) => i.page))].sort((a, b) => b - a);
  for (const page of pages) {
    if (items.some((it) => it.page === page && /Grand Total Summary/i.test(it.str))) {
      return page;
    }
  }
  return null;
}

export type DgManifestSummaryLayout = 'legacy' | 'dp-world';

function pickCountNearLabel(
  pageItems: readonly DgPdfTextItem[],
  labelY: number,
  layout: DgManifestSummaryLayout,
): number | null {
  for (const it of pageItems) {
    if (!/^\d+$/.test(it.str.trim())) continue;
    if (Math.abs(it.y - labelY) > 12) continue;
    if (layout === 'dp-world') {
      if (it.x >= 68 && it.x <= 95) return parseInt(it.str.trim(), 10);
      continue;
    }
    if (it.x < 70 || it.x > 88) continue;
    return parseInt(it.str.trim(), 10);
  }
  return null;
}

function pickGrandWeight(
  pageItems: readonly DgPdfTextItem[],
  xMin: number,
  xMax: number,
): number {
  for (const it of pageItems) {
    if (it.x < xMin || it.x > xMax) continue;
    if (!EU_WEIGHT_RE.test(it.str.trim())) continue;
    return parseDgWeightKg(it.str);
  }
  return 0;
}

/** Parse "Grand Total Summary" from the last summary page of a DP WORLD DG PDF. */
export function parseUnifeederGrandTotalSummary(
  items: readonly DgPdfTextItem[],
  layout: DgManifestSummaryLayout = 'legacy',
): UnifeederPdfGrandTotalSummary | null {
  const page = findSummaryPage(items);
  if (!page) return null;

  const pageItems = items.filter((it) => it.page === page);
  const containerCountsByLength: Record<LengthKey, number> = {
    '20': 0,
    '30': 0,
    '40': 0,
    '45': 0,
  };

  if (layout === 'dp-world') {
    for (const it of pageItems) {
      const label = it.str.trim();
      if (!LENGTH_KEYS.includes(label as LengthKey)) continue;
      if (it.y < 40 || it.y > 70) continue;
      const countItem = pageItems.find(
        (c) =>
          /^\d+$/.test(c.str.trim()) &&
          c.y >= 68 &&
          c.y <= 95 &&
          Math.abs(c.x - it.x) <= 35,
      );
      if (countItem) {
        containerCountsByLength[label as LengthKey] = parseInt(countItem.str.trim(), 10);
      }
    }
  } else {
    const labelXMin = 50;
    const labelXMax = 66;
    for (const it of pageItems) {
      if (it.x < labelXMin || it.x > labelXMax) continue;
      const label = it.str.trim();
      if (!LENGTH_KEYS.includes(label as LengthKey)) continue;
      const count = pickCountNearLabel(pageItems, it.y, layout);
      if (count !== null) {
        containerCountsByLength[label as LengthKey] = count;
      }
    }
  }

  const totalContainers = LENGTH_KEYS.reduce(
    (sum, key) => sum + containerCountsByLength[key],
    0,
  );
  const totalImoNetWeightKg =
    layout === 'dp-world'
      ? pickGrandWeight(pageItems, 190, 215)
      : pickGrandWeight(pageItems, 123, 132);
  const totalImoGrossWeightKg =
    layout === 'dp-world'
      ? pickGrandWeight(pageItems, 190, 215)
      : pickGrandWeight(pageItems, 136, 145);

  if (totalContainers <= 0 && totalImoNetWeightKg <= 0) return null;

  return {
    containerCountsByLength,
    totalContainers,
    totalImoNetWeightKg,
    totalImoGrossWeightKg,
  };
}

function uniqueContainerSizesFromImportRows(
  rows: readonly UnifeederImportRowForValidation[],
): string[] {
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

function unifeederPdfLengthLabelFromSizeCode(sizeCode: string): string {
  const normalized = sizeCode.trim().toUpperCase();
  if (!normalized) return '';
  const key = normalized.slice(0, 2);
  if (key === '20' || key === '22') return "20'";
  if (key === '30') return "30'";
  if (key === '40' || key === '42' || key === '45') return "40'";
  if (key === 'L2' || key === 'L5') return "45'";
  return manifestLengthLabelFromSizeCode(sizeCode);
}

function importedContainerCountsByLength(
  rows: readonly UnifeederImportRowForValidation[],
): Map<string, number> {
  const sizes = uniqueContainerSizesFromImportRows(rows);
  const counts = new Map<string, number>();
  for (const size of sizes) {
    const label = unifeederPdfLengthLabelFromSizeCode(size);
    if (!label) continue;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return counts;
}

function importedTotalWeightKg(rows: readonly UnifeederImportRowForValidation[]): number {
  let total = 0;
  for (const row of rows) {
    total += parseDgWeightKg(row.weightKg);
  }
  return Math.round(total);
}

/** Compare parsed cargo rows against PDF grand-total summary. */
export function validateUnifeederImportAgainstSummary(
  rows: readonly UnifeederImportRowForValidation[],
  summary: UnifeederPdfGrandTotalSummary | null,
  options: { grossTotalKg?: boolean; extractableContainers?: number } = {},
): UnifeederImportValidation {
  if (!summary) return { ok: true, mismatches: [] };

  const mismatches: string[] = [];
  const importedContainers = new Set(rows.map((r) => r.containerNo.trim()).filter(Boolean)).size;
  const importedByLength = importedContainerCountsByLength(rows);

  const importedKg = importedTotalWeightKg(rows);
  const pdfKg = Math.round(
    options.grossTotalKg ? summary.totalImoGrossWeightKg : summary.totalImoNetWeightKg,
  );
  const weightOk = pdfKg > 0 && importedKg === pdfKg;
  const containerDelta =
    summary.totalContainers > 0 ? Math.abs(summary.totalContainers - importedContainers) : 0;
  const extractable = options.extractableContainers ?? 0;
  const allExtractableImported =
    extractable > 0 && importedContainers === extractable && extractable <= summary.totalContainers;

  // PDF grand-total container count can be off by one vs extractable cargo rows; trust weight.
  if (weightOk && containerDelta <= 1) {
    return { ok: true, mismatches: [] };
  }

  // Grand total can exceed container headers on cargo pages; trust weight when all are imported.
  if (weightOk && allExtractableImported) {
    return { ok: true, mismatches: [] };
  }

  if (summary.totalContainers > 0 && importedContainers !== summary.totalContainers) {
    mismatches.push(`containers: PDF ${summary.totalContainers}, imported ${importedContainers}`);
  }

  for (const key of LENGTH_KEYS) {
    const expected = summary.containerCountsByLength[key];
    if (expected <= 0) continue;
    const label = lengthKeyToBucketLabel(key);
    const actual = importedByLength.get(label) ?? 0;
    if (actual !== expected) {
      mismatches.push(`${label}: PDF ${expected}, imported ${actual}`);
    }
  }

  if (pdfKg > 0 && importedKg !== pdfKg) {
    const kind = options.grossTotalKg ? 'gross weight' : 'net weight';
    mismatches.push(`${kind}: PDF ${pdfKg} kg, imported ${importedKg} kg`);
  }

  return { ok: mismatches.length === 0, mismatches };
}

export function formatUnifeederImportValidationError(validation: UnifeederImportValidation): string {
  if (validation.ok || !validation.mismatches.length) return '';
  return `Manifest check failed: ${validation.mismatches.join('; ')}`;
}
