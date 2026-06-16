import {
  formatDgWeightKgDisplay,
  parseDgWeightKg,
  type DgCargoLine,
} from '../models/dg-manifest.models';

function normalizeDgExportMergeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeDgExportMpLq(value: string): string {
  const v = value.trim();
  if (!v || v === '-' || v === '—') return '';
  return v.toUpperCase().replace(/\s+/g, ' ').trim();
}

export function dgExportCargoMergeKey(
  dgClass: string,
  unNo: string,
  properShippingName: string,
  mpLq: string,
): string {
  return [
    dgClass.trim().toLowerCase().replace(',', '.'),
    unNo.trim(),
    normalizeDgExportMergeName(properShippingName),
    normalizeDgExportMpLq(mpLq),
  ].join('\0');
}

function parseDgFlashPointCelsius(value: string): number | null {
  const v = value.trim().replace(/\s*°C\s*$/i, '').trim();
  if (!v || v === '-' || v === '—') return null;
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Export merge: first flash unless 0 °C — then second if > 0; lone 0 or both 0 stays 0. */
export function resolveDgExportMergedFlashPoint(flashPoints: readonly string[]): string {
  if (!flashPoints.length) return '';
  const first = flashPoints[0]?.trim() ?? '';
  if (parseDgFlashPointCelsius(first) !== 0) return first;
  if (flashPoints.length === 1) return first;

  const second = flashPoints[1]?.trim() ?? '';
  const secondVal = parseDgFlashPointCelsius(second);
  if (secondVal !== null && secondVal > 0) return second;

  return first;
}

export function dgCargoLineHasCargo(line: Pick<DgCargoLine, 'dgClass' | 'unNo' | 'weightKg' | 'properShippingName'>): boolean {
  return Boolean(
    line.dgClass.trim() ||
      line.unNo.trim() ||
      line.weightKg.trim() ||
      line.properShippingName.trim(),
  );
}

export interface DgMergedCargoLine {
  mergeKey: string;
  dgClass: string;
  unNo: string;
  mpLq: string;
  flashPoint: string;
  properShippingName: string;
  weightSum: number;
  sourceLineIds: string[];
}

/** Combine cargo lines when class, UN, name and MP/LQ match (same rule as manifest export). */
export function mergeDgCargoLines(lines: readonly DgCargoLine[]): DgMergedCargoLine[] {
  const merged = new Map<string, DgMergedCargoLine & { flashPoints: string[] }>();
  const order: string[] = [];

  for (const line of lines) {
    if (!dgCargoLineHasCargo(line)) continue;

    const dgClass = line.dgClass.trim();
    const unNo = line.unNo.trim();
    const properShippingName = line.properShippingName.trim();
    const mpLq = line.mpLq.trim();
    const key = dgExportCargoMergeKey(dgClass, unNo, properShippingName, mpLq);
    const weight = parseDgWeightKg(line.weightKg);

    if (!merged.has(key)) {
      merged.set(key, {
        mergeKey: key,
        dgClass,
        unNo,
        mpLq,
        flashPoint: line.flashPoint.trim(),
        properShippingName,
        weightSum: weight,
        sourceLineIds: [line.id],
        flashPoints: [line.flashPoint.trim()],
      });
      order.push(key);
      continue;
    }

    const entry = merged.get(key)!;
    entry.weightSum += weight;
    entry.sourceLineIds.push(line.id);
    entry.flashPoints.push(line.flashPoint.trim());
  }

  return order.map((key) => {
    const entry = merged.get(key)!;
    return {
      mergeKey: entry.mergeKey,
      dgClass: entry.dgClass,
      unNo: entry.unNo,
      mpLq: entry.mpLq,
      flashPoint: resolveDgExportMergedFlashPoint(entry.flashPoints),
      properShippingName: entry.properShippingName,
      weightSum: entry.weightSum,
      sourceLineIds: entry.sourceLineIds,
    };
  });
}

/** Integer kg per line that sum exactly to targetTotal (largest-remainder). */
export function allocateDgDisplayLineWeightsKg(
  rawWeights: readonly number[],
  targetTotal: number,
): number[] {
  if (!rawWeights.length) return [];
  const floors = rawWeights.map((w) => Math.floor(w));
  let allocated = floors.reduce((sum, value) => sum + value, 0);
  let need = targetTotal - allocated;
  const order = rawWeights
    .map((weight, index) => ({ index, remainder: weight - Math.floor(weight) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);

  const out = [...floors];
  if (need > 0) {
    for (let i = 0; i < need; i++) {
      out[order[i % order.length].index]++;
    }
  } else if (need < 0) {
    const giveBack = [...order].reverse();
    for (let i = 0; i < -need; i++) {
      const idx = giveBack[i % giveBack.length].index;
      if (out[idx] > 0) out[idx]--;
    }
  }
  return out;
}

export function formatDgDisplayLineWeightsKg(
  rawWeights: readonly number[],
  grossTotal: boolean,
): string[] {
  if (!rawWeights.length) return [];
  if (!grossTotal) {
    return rawWeights.map((weight) => formatDgWeightKgDisplay(weight));
  }
  const target = Math.round(rawWeights.reduce((sum, weight) => sum + weight, 0));
  return allocateDgDisplayLineWeightsKg(rawWeights, target).map((kg) => (kg ? String(kg) : ''));
}

export interface DgCargoLineDisplay {
  id: string;
  dgClass: string;
  unNo: string;
  mpLq: string;
  flashPoint: string;
  properShippingName: string;
  rawWeightKg: number;
  weightKgDisplay: string;
  editable: boolean;
  sourceLineIds: readonly string[];
}

function buildDgContainerDisplayLinesRaw(
  container: { lines: readonly DgCargoLine[] },
  manifestMergeLines: boolean,
): Omit<DgCargoLineDisplay, 'weightKgDisplay'>[] {
  if (manifestMergeLines) {
    const merged = mergeDgCargoLines(container.lines);
    if (merged.length) {
      return merged.map((row) => ({
        id: `merge:${row.mergeKey}`,
        dgClass: row.dgClass,
        unNo: row.unNo,
        mpLq: row.mpLq,
        flashPoint: row.flashPoint,
        properShippingName: row.properShippingName,
        rawWeightKg: row.weightSum,
        editable: false,
        sourceLineIds: row.sourceLineIds,
      }));
    }
  }

  return container.lines.map((line) => ({
    id: line.id,
    dgClass: line.dgClass,
    unNo: line.unNo,
    mpLq: line.mpLq,
    flashPoint: line.flashPoint,
    properShippingName: line.properShippingName,
    rawWeightKg: parseDgWeightKg(line.weightKg),
    editable: true,
    sourceLineIds: [line.id],
  }));
}

/** Whole-inventory weight display so rounded lines sum to the gross total. */
export function planDgInventoryWeightDisplays(
  containers: readonly { id: string; lines: readonly DgCargoLine[] }[],
  options: { manifestMergeLines: boolean; manifestGrossTotalKg: boolean },
): Map<string, string> {
  const rowsByContainer = new Map<string, Omit<DgCargoLineDisplay, 'weightKgDisplay'>[]>();
  const allRaw: number[] = [];
  const keys: { containerId: string; lineId: string }[] = [];

  for (const container of containers) {
    const rows = buildDgContainerDisplayLinesRaw(container, options.manifestMergeLines);
    rowsByContainer.set(container.id, rows);
    for (const row of rows) {
      allRaw.push(row.rawWeightKg);
      keys.push({ containerId: container.id, lineId: row.id });
    }
  }

  const displays = options.manifestGrossTotalKg
    ? formatDgDisplayLineWeightsKg(allRaw, true)
    : allRaw.map((weight) => formatDgWeightKgDisplay(weight));

  const out = new Map<string, string>();
  keys.forEach((key, index) => {
    out.set(`${key.containerId}:${key.lineId}`, displays[index] ?? '');
  });
  return out;
}

export function buildDgContainerDisplayLines(
  container: { id: string; lines: readonly DgCargoLine[] },
  options: { manifestMergeLines: boolean; manifestGrossTotalKg: boolean },
  weightDisplays?: Map<string, string>,
): DgCargoLineDisplay[] {
  const rows = buildDgContainerDisplayLinesRaw(container, options.manifestMergeLines);
  return rows.map((row) => {
    const planned = weightDisplays?.get(`${container.id}:${row.id}`);
    const weightKgDisplay = options.manifestGrossTotalKg
      ? planned ?? (row.rawWeightKg ? String(Math.round(row.rawWeightKg)) : '')
      : planned ?? formatDgWeightKgDisplay(row.rawWeightKg);
    return { ...row, weightKgDisplay };
  });
}

/** Map merged cargo back to DgCargoLine shape (for summaries / export without merge). */
export function mergedDgCargoLinesToRows(lines: readonly DgCargoLine[]): DgCargoLine[] {
  return mergeDgCargoLines(lines).map((row) => ({
    id: row.mergeKey,
    dgClass: row.dgClass,
    unNo: row.unNo,
    mpLq: row.mpLq,
    flashPoint: row.flashPoint,
    properShippingName: row.properShippingName,
    weightKg: formatDgWeightKgDisplay(row.weightSum) || String(row.weightSum),
  }));
}
