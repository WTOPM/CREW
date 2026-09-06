import type { DgPdfTextItem } from './dg-pdf-text.util';

/** One container → final bay position from MACS3 “Dagos on Board”. */
export interface UnifeederDagosPositionRow {
  containerNo: string;
  position: string;
}

const CONTAINER_RE = /^[A-Z]{4}\d{7}$/;
const POSITION_RE = /^\d{6}$/;

/** Landscape MACS3 table: Pos. ~x44, Serial Number ~x77. */
const POS_COL: readonly [number, number] = [25, 72];
const SERIAL_COL: readonly [number, number] = [72, 140];

function normalizeContainerNo(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '').replace(/-/g, '');
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

function extractPagePositions(pageItems: readonly DgPdfTextItem[]): UnifeederDagosPositionRow[] {
  const rows: UnifeederDagosPositionRow[] = [];
  for (const group of groupRowItems(pageItems)) {
    const position = pickInCol(group.items, POS_COL, (value) => POSITION_RE.test(value));
    const serialRaw = pickInCol(group.items, SERIAL_COL, (value) =>
      CONTAINER_RE.test(normalizeContainerNo(value)),
    );
    if (!position || !serialRaw) continue;
    rows.push({
      containerNo: normalizeContainerNo(serialRaw),
      position,
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
 * Parse Pos. + Serial Number across every page.
 * Later pages overwrite earlier ones for the same container (final list wins).
 */
export function parseUnifeederDagosPositions(
  items: readonly DgPdfTextItem[],
): UnifeederDagosPositionRow[] {
  const byContainer = new Map<string, string>();
  const pages = [...new Set(items.map((it) => it.page))].sort((a, b) => a - b);

  for (const page of pages) {
    const pageItems = items.filter((it) => it.page === page);
    for (const row of extractPagePositions(pageItems)) {
      byContainer.set(row.containerNo, row.position);
    }
  }

  return [...byContainer.entries()]
    .map(([containerNo, position]) => ({ containerNo, position }))
    .sort((a, b) => a.containerNo.localeCompare(b.containerNo));
}
