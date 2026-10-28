import type { DgPdfTextItem } from './dg-pdf-text.util';

/** One cargo line from MACS3 “Dagos on Board” (position + optional UN / net). */
export interface UnifeederDagosLineRow {
  containerNo: string;
  position: string;
  unNo: string;
  /** Net weight kg from the “Net W.” column when present. */
  netWeightKg: string;
}

/** Unique container → final bay position (last page wins). */
export interface UnifeederDagosPositionRow {
  containerNo: string;
  position: string;
}

const CONTAINER_RE = /^[A-Z]{4}\d{7}$/;
const POSITION_RE = /^\d{6}$/;
const UN_RE = /^\d{4}$/;
/** Net weights are decimals like 18000.0 / 15713.5 — not UN (4) or Pos (6). */
const NET_RE = /^\d+\.\d+$/;

/** Landscape MACS3 table columns (x ranges, pt). */
const POS_COL: readonly [number, number] = [25, 65];
const SERIAL_COL: readonly [number, number] = [65, 150];
const UN_COL: readonly [number, number] = [175, 210];
const NET_COL: readonly [number, number] = [515, 570];

function normalizeContainerNo(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '').replace(/-/g, '');
}

function normalizeNetWeightKg(raw: string): string {
  const n = Number.parseFloat(raw.trim().replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return '';
  // Keep one decimal when PDF has it; strip trailing .0 for whole kg.
  const rounded = Math.round(n * 1000) / 1000;
  return String(rounded);
}

function inCol(x: number, range: readonly [number, number]): boolean {
  return x >= range[0] && x <= range[1];
}

function groupRowItems(
  items: readonly DgPdfTextItem[],
  yTol = 3,
): { y: number; items: DgPdfTextItem[] }[] {
  const groups: { y: number; items: DgPdfTextItem[] }[] = [];
  for (const it of items) {
    const group = groups.find((g) => Math.abs(g.y - it.y) <= yTol);
    if (group) {
      group.items.push(it);
    } else {
      groups.push({ y: it.y, items: [it] });
    }
  }
  groups.sort((a, b) => a.y - b.y);
  return groups;
}

function pickInCol(
  items: readonly DgPdfTextItem[],
  col: readonly [number, number],
  pred: (value: string) => boolean,
): string {
  for (const it of items) {
    if (!inCol(it.x, col)) continue;
    const value = it.str.trim();
    if (pred(value)) return value;
  }
  return '';
}

function extractPageLines(pageItems: readonly DgPdfTextItem[]): UnifeederDagosLineRow[] {
  const rows: UnifeederDagosLineRow[] = [];
  let lastPosition = '';

  for (const group of groupRowItems(pageItems)) {
    const position = pickInCol(group.items, POS_COL, (value) => POSITION_RE.test(value));
    const serialRaw = pickInCol(group.items, SERIAL_COL, (value) =>
      CONTAINER_RE.test(normalizeContainerNo(value)),
    );
    const unNo = pickInCol(group.items, UN_COL, (value) => UN_RE.test(value));
    const netRaw = pickInCol(group.items, NET_COL, (value) => NET_RE.test(value));

    if (position) lastPosition = position;
    if (!serialRaw) continue; // ghost Pos/UN rows without Serial Number

    // Continuation lines omit Pos but still have UN / Net W.
    // A lone serial without Pos/UN/net is not a row (see CBHU fixture).
    if (!position && !unNo && !netRaw) continue;

    const resolvedPos = position || lastPosition;
    if (!resolvedPos) continue;

    rows.push({
      containerNo: normalizeContainerNo(serialRaw),
      position: resolvedPos,
      unNo,
      netWeightKg: netRaw ? normalizeNetWeightKg(netRaw) : '',
    });
  }
  return rows;
}

/**
 * MACS3 “Dagos on Board (IMDG-Code …)” list — final container positions.
 * Distinct from DP WORLD Dangerous Cargo Manifest and from CMA prestow.
 */
export function isUnifeederDagosPositionsPdf(items: readonly DgPdfTextItem[]): boolean {
  const joined = items.map((it) => it.str).join(' ');
  if (/Dangerous Cargo Manifest/i.test(joined)) return false;
  if (!/Dagos on Board/i.test(joined)) return false;
  return /\bPos\.?\b/i.test(joined) && /Serial Number/i.test(joined);
}

/**
 * All Dagos cargo lines (container may repeat). Later pages append after earlier ones;
 * position for a container is still “last seen Pos” when a continuation omits Pos.
 */
export function parseUnifeederDagosLines(items: readonly DgPdfTextItem[]): UnifeederDagosLineRow[] {
  const pages = [...new Set(items.map((it) => it.page))].sort((a, b) => a - b);
  const out: UnifeederDagosLineRow[] = [];
  for (const page of pages) {
    out.push(...extractPageLines(items.filter((it) => it.page === page)));
  }
  return out;
}

/**
 * Parse Pos. + Serial Number across every page.
 * Later pages overwrite earlier ones for the same container (final list wins).
 */
export function parseUnifeederDagosPositions(
  items: readonly DgPdfTextItem[],
): UnifeederDagosPositionRow[] {
  const byContainer = new Map<string, string>();
  for (const row of parseUnifeederDagosLines(items)) {
    byContainer.set(row.containerNo, row.position);
  }

  return [...byContainer.entries()]
    .map(([containerNo, position]) => ({ containerNo, position }))
    .sort((a, b) => a.containerNo.localeCompare(b.containerNo));
}
