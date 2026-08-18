import {
  formatDgWeightKgDisplay,
  parseDgWeightKg,
  roundDgWeightKgSum,
} from '../models/dg-manifest.models';
import type { DgPdfTextItem } from './dg-pdf-text.util';
import { dgLineActiveWeightKg, type DgDualWeightLine } from './dg-weight-tonnage.util';
import { manifestLengthLabelFromSizeCode } from './dg-manifest-summary.util';

interface UnifeederImportRowForValidation extends DgDualWeightLine {
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

function pickGrandWeight(pageItems: readonly DgPdfTextItem[], xMin: number, xMax: number): number {
  for (const it of pageItems) {
    if (it.x < xMin || it.x > xMax) continue;
    if (!EU_WEIGHT_RE.test(it.str.trim())) continue;
    return parseDgWeightKg(it.str);
  }
  return 0;
}

function pickGrandWeightNearLabel(
  pageItems: readonly DgPdfTextItem[],
  labelPattern: RegExp,
  xMin: number,
  xMax: number,
): number {
  const label = pageItems.find((it) => labelPattern.test(it.str.trim()));
  if (!label) return 0;
  for (const it of pageItems) {
    if (Math.abs(it.y - label.y) > 4) continue;
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
        (c) => /^\d+$/.test(c.str.trim()) && c.y >= 68 && c.y <= 95 && Math.abs(c.x - it.x) <= 35,
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

  const totalContainers = LENGTH_KEYS.reduce((sum, key) => sum + containerCountsByLength[key], 0);
  const totalImoNetWeightKg =
    layout === 'dp-world'
      ? pickGrandWeightNearLabel(pageItems, /Total\s+IMO\s+Netweight/i, 190, 215) ||
        pickGrandWeight(pageItems, 190, 215)
      : pickGrandWeight(pageItems, 123, 132);
  const totalImoGrossWeightKg =
    layout === 'dp-world'
      ? pickGrandWeightNearLabel(pageItems, /Total\s+IMO\s+Grossweight/i, 190, 215) ||
        pickGrandWeight(pageItems, 190, 215)
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

function validationUseGross(
  options: { useGrossWeight?: boolean; grossTotalKg?: boolean } = {},
): boolean {
  if ('useGrossWeight' in options) return options.useGrossWeight !== false;
  return options.grossTotalKg !== false;
}

function importedTotalWeightKg(
  rows: readonly UnifeederImportRowForValidation[],
  useGrossWeight = false,
): number {
  let total = 0;
  for (const row of rows) {
    total += dgLineActiveWeightKg(row, useGrossWeight);
  }
  return useGrossWeight ? Math.round(total) : Math.round(total * 1000) / 1000;
}

/** Per-line gross rounding can drift a few kg vs one PDF grand-total figure. */
function manifestWeightToleranceKg(rowCount: number, useGrossWeight: boolean): number {
  const base = useGrossWeight ? 5 : 2;
  const perRow = useGrossWeight ? 0.5 : 0.2;
  return Math.max(base, Math.ceil(rowCount * perRow));
}

function weightTotalsMatch(
  pdfKg: number,
  importedKg: number,
  rowCount: number,
  useGrossWeight: boolean,
): boolean {
  if (pdfKg <= 0) return true;
  if (importedKg === pdfKg) return true;
  return Math.abs(importedKg - pdfKg) <= manifestWeightToleranceKg(rowCount, useGrossWeight);
}

/** Compare parsed cargo rows against PDF grand-total summary. */
export function validateUnifeederImportAgainstSummary(
  rows: readonly UnifeederImportRowForValidation[],
  summary: UnifeederPdfGrandTotalSummary | null,
  options: {
    useGrossWeight?: boolean;
    grossTotalKg?: boolean;
    extractableContainers?: number;
  } = {},
): UnifeederImportValidation {
  if (!summary) return { ok: true, mismatches: [] };

  const useGrossWeight = validationUseGross(options);
  const mismatches: string[] = [];
  const importedContainers = new Set(rows.map((r) => r.containerNo.trim()).filter(Boolean)).size;
  const importedByLength = importedContainerCountsByLength(rows);

  const importedKg = importedTotalWeightKg(rows, useGrossWeight);
  const pdfKg = Math.round(
    useGrossWeight ? summary.totalImoGrossWeightKg : summary.totalImoNetWeightKg,
  );
  const weightOk = pdfKg > 0 && weightTotalsMatch(pdfKg, importedKg, rows.length, useGrossWeight);
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

  if (pdfKg > 0 && !weightTotalsMatch(pdfKg, importedKg, rows.length, useGrossWeight)) {
    const kind = useGrossWeight ? 'gross weight' : 'net weight';
    mismatches.push(`${kind}: PDF ${pdfKg} kg, imported ${importedKg} kg`);
  }

  return { ok: mismatches.length === 0, mismatches };
}

export function formatUnifeederImportValidationError(
  validation: UnifeederImportValidation,
): string {
  if (validation.ok || !validation.mismatches.length) return '';
  return `Manifest check failed: ${validation.mismatches.join('; ')}`;
}

export function formatUnifeederImportValidationOk(
  validation: UnifeederImportValidation,
  useGrossWeight: boolean,
  pdfKg: number,
  importedKg: number,
): string {
  if (!validation.ok) return '';
  const kind = useGrossWeight ? 'Gross' : 'Net';
  const inventoryLabel = useGrossWeight
    ? String(Math.round(importedKg))
    : formatDgWeightKgDisplay(importedKg) || String(importedKg);
  const pdfLabel = useGrossWeight
    ? String(Math.round(pdfKg))
    : formatDgWeightKgDisplay(pdfKg) || String(pdfKg);
  return `Manifest check OK: ${kind} PDF ${pdfLabel} kg, inventory ${inventoryLabel} kg`;
}

/** Sum PDF grand-total figures saved on imported manifest documents. */
export function aggregateUnifeederPdfSummaries(
  manifests: readonly { pdfImoNetWeightKg?: number; pdfImoGrossWeightKg?: number }[],
): UnifeederPdfGrandTotalSummary | null {
  let totalImoNetWeightKg = 0;
  let totalImoGrossWeightKg = 0;
  let hasAny = false;

  for (const doc of manifests) {
    const net = Number(doc.pdfImoNetWeightKg) || 0;
    const gross = Number(doc.pdfImoGrossWeightKg) || 0;
    if (net > 0 || gross > 0) hasAny = true;
    totalImoNetWeightKg += net;
    totalImoGrossWeightKg += gross;
  }

  if (!hasAny) return null;

  return {
    containerCountsByLength: { '20': 0, '30': 0, '40': 0, '45': 0 },
    totalContainers: 0,
    totalImoNetWeightKg,
    totalImoGrossWeightKg,
  };
}

export function validateUnifeederOnboardAgainstPdfSummaries(
  rows: readonly UnifeederImportRowForValidation[],
  manifests: readonly { pdfImoNetWeightKg?: number; pdfImoGrossWeightKg?: number }[],
  useGrossWeight: boolean,
): UnifeederImportValidation & { pdfKg: number; importedKg: number } {
  const summary = aggregateUnifeederPdfSummaries(manifests);
  const importedKg = importedTotalWeightKg(rows, useGrossWeight);
  const pdfKg = summary
    ? Math.round(useGrossWeight ? summary.totalImoGrossWeightKg : summary.totalImoNetWeightKg)
    : 0;
  const validation = validateUnifeederImportAgainstSummary(rows, summary, { useGrossWeight });
  return { ...validation, pdfKg, importedKg };
}
