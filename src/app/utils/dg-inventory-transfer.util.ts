import {
  createDgCargoLine,
  createDgOnboardContainer,
  type DgOnboardContainer,
} from '../models/dg-manifest.models';
import { createDgUnifeederRow, type DgUnifeederRow } from '../models/dg-unifeeder.models';
import { lookupUnNumberReference } from './dg-un-number.util';

function splitMpLq(mpLq: string): { lq: string; marinePollutant: string } {
  const upper = mpLq.trim().toUpperCase();
  return {
    lq: /\bLQ\b/.test(upper) ? 'LQ' : '',
    marinePollutant: /\bMP\b/.test(upper) ? 'MP' : '',
  };
}

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

function containerHasCargo(container: DgOnboardContainer): boolean {
  if (container.containerNo.trim()) return true;
  return container.lines.some(
    (line) =>
      line.dgClass.trim() ||
      line.unNo.trim() ||
      line.weightKg.trim() ||
      line.properShippingName.trim(),
  );
}

function unifeederRowHasCargo(row: DgUnifeederRow): boolean {
  return !!(
    row.containerNo.trim() ||
    row.unNo.trim() ||
    row.dgClass.trim() ||
    row.weightKg.trim() ||
    row.goodsDescription.trim()
  );
}

export function cmaContainersToUnifeederRows(
  containers: readonly DgOnboardContainer[],
): DgUnifeederRow[] {
  const rows: DgUnifeederRow[] = [];
  for (const container of containers) {
    if (!containerHasCargo(container)) continue;
    const lines = container.lines.length ? container.lines : [createDgCargoLine()];
    for (const line of lines) {
      const { lq, marinePollutant } = splitMpLq(line.mpLq);
      const unRef = lookupUnNumberReference(line.unNo);
      rows.push(
        createDgUnifeederRow({
          size: container.type,
          stow: container.stowage,
          containerNo: container.containerNo,
          loadPort: container.loadPort,
          dischargePort: container.dischargePort,
          status: container.status,
          dgClass: line.dgClass,
          unNo: line.unNo,
          weightKg: line.weightKg,
          goodsDescription: line.properShippingName,
          flashPoint: line.flashPoint,
          lq,
          marinePollutant,
          fire: unRef?.fire?.trim() ?? '',
          spillage: unRef?.spillage?.trim() ?? '',
        }),
      );
    }
  }
  return rows;
}

export function unifeederRowsToCmaContainers(rows: readonly DgUnifeederRow[]): DgOnboardContainer[] {
  const map = new Map<string, DgOnboardContainer>();
  for (const row of rows) {
    if (!unifeederRowHasCargo(row)) continue;
    const key = [
      row.containerNo.trim().toUpperCase(),
      row.loadPort.trim(),
      row.dischargePort.trim(),
      row.status,
      row.size.trim(),
      row.stow.trim(),
    ].join('|');
    let container = map.get(key);
    if (!container) {
      container = createDgOnboardContainer({
        containerNo: row.containerNo,
        type: row.size,
        stowage: row.stow,
        loadPort: row.loadPort,
        dischargePort: row.dischargePort,
        status: row.status,
        lines: [],
      });
      map.set(key, container);
    }
    container.lines.push(
      createDgCargoLine({
        dgClass: row.dgClass,
        unNo: row.unNo,
        weightKg: row.weightKg,
        properShippingName: row.goodsDescription,
        mpLq: joinMpLq(row.lq, row.marinePollutant),
        flashPoint: row.flashPoint,
      }),
    );
  }
  return [...map.values()];
}
