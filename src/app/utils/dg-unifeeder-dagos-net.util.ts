import type { DgUnifeederRow } from '../models/dg-unifeeder.models';
import { parseDgWeightKg } from '../models/dg-manifest.models';
import { normalizeUnNumber } from './dg-un-number.util';
import type { UnifeederDagosLineRow } from './dg-unifeeder-dagos-pdf.util';

export interface UnifeederDagosNetMismatch {
  rowId: string;
  containerNo: string;
  unNo: string;
  programNetKg: string;
  dagosNetKg: string;
}

function netsDiffer(a: string, b: string): boolean {
  const na = parseDgWeightKg(a);
  const nb = parseDgWeightKg(b);
  if (!Number.isFinite(na) || !Number.isFinite(nb)) {
    return a.trim() !== b.trim();
  }
  return Math.abs(na - nb) > 0.05;
}

/** True when Dagos printed a usable Net W. (empty / blank cells are not compared). */
export function dagosNetWeightIsPresent(raw: string | undefined | null): boolean {
  const text = String(raw ?? '').trim();
  if (!text || text === '—' || text === '-') return false;
  const n = parseDgWeightKg(text);
  return Number.isFinite(n) && n > 0;
}

/**
 * Pair Dagos net lines with onboard rows (same container + UN), greedily by closest weight.
 * Only returns pairs where nets differ.
 * Lines with empty Dagos Net W. are skipped — program/manifest weight stays as-is.
 */
export function findUnifeederDagosNetMismatches(
  onboard: readonly DgUnifeederRow[],
  dagosLines: readonly UnifeederDagosLineRow[],
): UnifeederDagosNetMismatch[] {
  const byContainer = new Map<string, DgUnifeederRow[]>();
  for (const row of onboard) {
    if (row.status !== 'onboard') continue;
    const key = row.containerNo.trim().toUpperCase();
    if (!key) continue;
    const list = byContainer.get(key);
    if (list) list.push(row);
    else byContainer.set(key, [row]);
  }

  const usedRowIds = new Set<string>();
  const out: UnifeederDagosNetMismatch[] = [];

  const withNet = dagosLines.filter((l) => l.containerNo && dagosNetWeightIsPresent(l.netWeightKg));
  for (const line of withNet) {
    const candidates = (byContainer.get(line.containerNo) ?? []).filter((r) => !usedRowIds.has(r.id));
    if (!candidates.length) continue;

    const unKey = normalizeUnNumber(line.unNo);
    const sameUn = unKey
      ? candidates.filter((r) => normalizeUnNumber(r.unNo) === unKey)
      : candidates;
    const pool = sameUn.length ? sameUn : candidates;

    const dagosNet = parseDgWeightKg(line.netWeightKg);
    let best: DgUnifeederRow | null = null;
    let bestDelta = Number.POSITIVE_INFINITY;
    for (const row of pool) {
      const progNet = parseDgWeightKg(row.netWeightKg || row.weightKg);
      const delta = Number.isFinite(progNet) ? Math.abs(progNet - dagosNet) : 1e9;
      if (delta < bestDelta) {
        bestDelta = delta;
        best = row;
      }
    }
    if (!best) continue;
    usedRowIds.add(best.id);

    const programNetKg = (best.netWeightKg || best.weightKg || '').trim();
    if (!programNetKg) {
      // Empty program net — treat as mismatch so user can fill from Dagos.
      out.push({
        rowId: best.id,
        containerNo: line.containerNo,
        unNo: line.unNo || best.unNo,
        programNetKg: programNetKg || '—',
        dagosNetKg: line.netWeightKg,
      });
      continue;
    }
    if (!netsDiffer(programNetKg, line.netWeightKg)) continue;

    out.push({
      rowId: best.id,
      containerNo: line.containerNo,
      unNo: line.unNo || best.unNo,
      programNetKg,
      dagosNetKg: line.netWeightKg,
    });
  }

  return out;
}
