import { formatDgWeightKgDisplay } from '../models/dg-manifest.models';
import { createDgUnifeederRow, type DgUnifeederRow } from '../models/dg-unifeeder.models';
import { dgExportCargoMergeKey, resolveDgExportMergedFlashPoint } from './dg-cargo-merge.util';
import { dgLineActiveWeightKg } from './dg-weight-tonnage.util';
import { planDgLineWeightDisplays, type DgWeightViewOptions } from './dg-weight-view.util';

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

function unifeederRowHasCargo(
  row: Pick<DgUnifeederRow, 'dgClass' | 'unNo' | 'weightKg' | 'goodsDescription'>,
): boolean {
  return Boolean(
    row.dgClass.trim() || row.unNo.trim() || row.weightKg.trim() || row.goodsDescription.trim(),
  );
}

export function unifeederContainerKey(
  row: Pick<
    DgUnifeederRow,
    'containerNo' | 'loadPort' | 'dischargePort' | 'status' | 'size' | 'stow'
  >,
): string {
  return [
    row.containerNo.trim().toUpperCase(),
    row.loadPort.trim(),
    row.dischargePort.trim(),
    row.status,
    row.size.trim(),
    row.stow.trim(),
  ].join('|');
}

export interface DgUnifeederRawContainerGroup {
  key: string;
  rows: DgUnifeederRow[];
}

export function groupUnifeederRawRowsByContainer(
  rows: readonly DgUnifeederRow[],
): DgUnifeederRawContainerGroup[] {
  const order: string[] = [];
  const byKey = new Map<string, DgUnifeederRow[]>();

  for (const row of rows) {
    const key = unifeederContainerKey(row);
    if (!byKey.has(key)) {
      order.push(key);
      byKey.set(key, []);
    }
    byKey.get(key)!.push(row);
  }

  return order.map((key) => ({ key, rows: byKey.get(key)! }));
}

export function planUnifeederMergedWeightDisplays(
  rows: readonly DgUnifeederRow[],
  options: { mergeLines: boolean } & DgWeightViewOptions,
): Map<string, string> {
  const { rows: displayRows } = mergeUnifeederRowsInContainersWithMeta(
    rows,
    options.mergeLines,
    options.useGrossWeight,
  );
  if (!displayRows.length) return new Map();

  const rawWeights = displayRows.map((row) => dgLineActiveWeightKg(row, options.useGrossWeight));
  const displays = planDgLineWeightDisplays(rawWeights, options.roundWeights);

  return new Map(displayRows.map((row, index) => [row.id, displays[index] ?? '']));
}

function mergeUnifeederContainerRows(
  rows: readonly DgUnifeederRow[],
  useGross = true,
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
        weightSum: dgLineActiveWeightKg(row, useGross),
        flashPoints: [row.flashPoint],
        sourceRowIds: [row.id],
      });
      order.push(cargoKey);
      continue;
    }

    const entry = merged.get(cargoKey)!;
    entry.weightSum += dgLineActiveWeightKg(row, useGross);
    entry.flashPoints.push(row.flashPoint);
    entry.sourceRowIds.push(row.id);
  }

  const sourceRowIds = new Map<string, string[]>();
  const mergedRows = order.map((cargoKey) => {
    const entry = merged.get(cargoKey)!;
    const id = `merge:${containerKey}\0${cargoKey}`;
    const weightStr = formatDgWeightKgDisplay(entry.weightSum) || String(entry.weightSum);
    sourceRowIds.set(id, [...entry.sourceRowIds]);
    return createDgUnifeederRow({
      ...entry.base,
      id,
      weightKg: weightStr,
      grossWeightKg: useGross ? weightStr : '',
      netWeightKg: useGross ? '' : weightStr,
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
  useGross = true,
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
    const merged = mergeUnifeederContainerRows(byContainer.get(key)!, useGross);
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
  consolidated: boolean;
}

export interface DgUnifeederContainerDisplayGroup {
  key: string;
  size: string;
  stow: string;
  containerNo: string;
  loadPort: string;
  dischargePort: string;
  loadTerminal: string;
  dischargeTerminal: string;
  status: DgUnifeederRow['status'];
  lines: DgUnifeederRowDisplay[];
}

export function buildUnifeederInventoryDisplayRows(
  rows: readonly DgUnifeederRow[],
  options: { mergeLines: boolean } & DgWeightViewOptions,
  weightDisplays?: Map<string, string>,
): DgUnifeederRowDisplay[] {
  const { rows: displayRows, sourceRowIds: sourceRowIdsByDisplayId } =
    mergeUnifeederRowsInContainersWithMeta(rows, options.mergeLines, options.useGrossWeight);
  const planned = weightDisplays ?? planUnifeederMergedWeightDisplays(rows, options);

  return displayRows.map((row) => {
    const lineSourceIds = sourceRowIdsByDisplayId.get(row.id) ?? [row.id];
    return {
      ...row,
      editable: !options.mergeLines || !row.id.startsWith('merge:'),
      sourceRowIds: lineSourceIds,
      consolidated: lineSourceIds.length > 1,
      weightKgDisplay: planned.get(row.id) ?? row.weightKg,
    };
  });
}

export function buildUnifeederContainerDisplayGroups(
  rows: readonly DgUnifeederRow[],
  options: { mergeLines: boolean } & DgWeightViewOptions,
): DgUnifeederContainerDisplayGroup[] {
  const groups = groupUnifeederRawRowsByContainer(rows);
  const weightPlan = planUnifeederMergedWeightDisplays(rows, options);

  return groups.map((group) => {
    const first = group.rows[0];
    return {
      key: group.key,
      size: first?.size ?? '',
      stow: first?.stow ?? '',
      containerNo: first?.containerNo ?? '',
      loadPort: first?.loadPort ?? '',
      dischargePort: first?.dischargePort ?? '',
      loadTerminal: first?.loadTerminal ?? '',
      dischargeTerminal: first?.dischargeTerminal ?? '',
      status: first?.status ?? 'onboard',
      lines: buildUnifeederInventoryDisplayRows(group.rows, options, weightPlan),
    };
  });
}
