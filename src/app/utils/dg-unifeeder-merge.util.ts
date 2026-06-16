import { formatDgWeightKgDisplay, parseDgWeightKg } from '../models/dg-manifest.models';
import { createDgUnifeederRow, type DgUnifeederRow } from '../models/dg-unifeeder.models';
import {
  dgExportCargoMergeKey,
  formatDgDisplayLineWeightsKg,
  resolveDgExportMergedFlashPoint,
} from './dg-cargo-merge.util';

function joinMpLq(lq: string, marinePollutant: string): string {
  const parts: string[] = [];
  const mp = marinePollutant.trim().toUpperCase();
  const lqVal = lq.trim().toUpperCase();
  if (mp && mp !== 'NO' && mp !== 'N') {
    parts.push(mp === 'YES' || mp === 'Y' || mp === 'MP' ? 'MP' : marinePollutant.trim());
  }
  if (lqVal && lqVal !== 'NO' && lqVal !== 'N') {
    parts.push(lqVal === 'YES' || lqVal === 'Y' || lqVal === 'LQ' ? 'LQ' : lq.trim());
  }
  return parts.join(' ');
}

function unifeederRowHasCargo(row: Pick<DgUnifeederRow, 'dgClass' | 'unNo' | 'weightKg' | 'goodsDescription'>): boolean {
  return Boolean(
    row.dgClass.trim() ||
      row.unNo.trim() ||
      row.weightKg.trim() ||
      row.goodsDescription.trim(),
  );
}

function unifeederContainerKey(row: DgUnifeederRow): string {
  return [
    row.containerNo.trim().toUpperCase(),
    row.loadPort.trim(),
    row.dischargePort.trim(),
    row.status,
    row.size.trim(),
    row.stow.trim(),
  ].join('|');
}

function mergeUnifeederContainerRows(
  rows: readonly DgUnifeederRow[],
): { rows: DgUnifeederRow[]; sourceRowIds: Map<string, string[]> } {
  const merged = new Map<
    string,
    {
      base: DgUnifeederRow;
      weightSum: number;
      flashPoints: string[];
      sourceRowIds: string[];
    }
  >();
  const order: string[] = [];
  const passthrough: DgUnifeederRow[] = [];
  const passthroughSources = new Map<string, string[]>();
  const containerKey = rows[0] ? unifeederContainerKey(rows[0]) : '';

  for (const row of rows) {
    if (!unifeederRowHasCargo(row)) {
      passthrough.push(row);
      passthroughSources.set(row.id, [row.id]);
      continue;
    }

    const cargoKey = dgExportCargoMergeKey(
      row.dgClass,
      row.unNo,
      row.goodsDescription,
      joinMpLq(row.lq, row.marinePollutant),
    );

    if (!merged.has(cargoKey)) {
      merged.set(cargoKey, {
        base: row,
        weightSum: parseDgWeightKg(row.weightKg),
        flashPoints: [row.flashPoint],
        sourceRowIds: [row.id],
      });
      order.push(cargoKey);
      continue;
    }

    const entry = merged.get(cargoKey)!;
    entry.weightSum += parseDgWeightKg(row.weightKg);
    entry.flashPoints.push(row.flashPoint);
    entry.sourceRowIds.push(row.id);
  }

  const sourceRowIds = new Map<string, string[]>();
  const mergedRows = order.map((cargoKey) => {
    const entry = merged.get(cargoKey)!;
    const id = `merge:${containerKey}\0${cargoKey}`;
    sourceRowIds.set(id, [...entry.sourceRowIds]);
    return createDgUnifeederRow({
      ...entry.base,
      id,
      weightKg: formatDgWeightKgDisplay(entry.weightSum) || String(entry.weightSum),
      flashPoint: resolveDgExportMergedFlashPoint(entry.flashPoints),
    });
  });

  for (const row of passthrough) {
    sourceRowIds.set(row.id, passthroughSources.get(row.id) ?? [row.id]);
  }

  return { rows: [...mergedRows, ...passthrough], sourceRowIds };
}

/** Combine rows in the same container when class, UN, name and MP/LQ match (same as CMA DG export). */
export function mergeUnifeederRowsInContainers(
  rows: readonly DgUnifeederRow[],
  mergeLines: boolean,
): DgUnifeederRow[] {
  return mergeUnifeederRowsInContainersWithMeta(rows, mergeLines).rows;
}

export function mergeUnifeederRowsInContainersWithMeta(
  rows: readonly DgUnifeederRow[],
  mergeLines: boolean,
): { rows: DgUnifeederRow[]; sourceRowIds: Map<string, string[]> } {
  if (!mergeLines) {
    return {
      rows: [...rows],
      sourceRowIds: new Map(rows.map((row) => [row.id, [row.id]])),
    };
  }

  const containerOrder: string[] = [];
  const byContainer = new Map<string, DgUnifeederRow[]>();

  for (const row of rows) {
    const key = unifeederContainerKey(row);
    if (!byContainer.has(key)) {
      byContainer.set(key, []);
      containerOrder.push(key);
    }
    byContainer.get(key)!.push(row);
  }

  const out: DgUnifeederRow[] = [];
  const sourceRowIds = new Map<string, string[]>();
  for (const key of containerOrder) {
    const merged = mergeUnifeederContainerRows(byContainer.get(key)!);
    out.push(...merged.rows);
    for (const [id, ids] of merged.sourceRowIds) {
      sourceRowIds.set(id, ids);
    }
  }

  return { rows: out, sourceRowIds };
}

export interface DgUnifeederRowDisplay extends DgUnifeederRow {
  editable: boolean;
  sourceRowIds: readonly string[];
  weightKgDisplay: string;
}

export function buildUnifeederInventoryDisplayRows(
  rows: readonly DgUnifeederRow[],
  options: { mergeLines: boolean; grossTotalKg: boolean },
): DgUnifeederRowDisplay[] {
  const { rows: displayRows, sourceRowIds } = mergeUnifeederRowsInContainersWithMeta(
    rows,
    options.mergeLines,
  );
  const rawWeights = displayRows.map((row) => parseDgWeightKg(row.weightKg));
  const weightTexts = options.grossTotalKg
    ? formatDgDisplayLineWeightsKg(rawWeights, true)
    : rawWeights.map((weight) => formatDgWeightKgDisplay(weight));

  return displayRows.map((row, index) => ({
    ...row,
    editable: !options.mergeLines || !row.id.startsWith('merge:'),
    sourceRowIds: sourceRowIds.get(row.id) ?? [row.id],
    weightKgDisplay: weightTexts[index] ?? row.weightKg,
  }));
}
