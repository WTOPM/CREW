import type { DgPdfTextItem } from './dg-pdf-text.util';

export interface CmaPrestowPositionRow {
  containerNo: string;
  position: string;
}

const CONTAINER_RE = /^[A-Z]{4}\d{7}$/;
const POSITION_RE = /^\d{6}$/;

const IMDG_COLS = {
  position: [20, 95] as const,
  serial: [145, 275] as const,
};

const REEFER_COLS = {
  position: [20, 95] as const,
  serial: [195, 375] as const,
};

function normalizeContainerNo(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '').replace(/-/g, '');
}

function inCol(x: number, range: readonly [number, number]): boolean {
  return x >= range[0] && x <= range[1];
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

function findSectionY(items: readonly DgPdfTextItem[], label: string): number | null {
  let y: number | null = null;
  for (const it of items) {
    if (it.str.trim() !== label) continue;
    y = y === null ? it.y : Math.min(y, it.y);
  }
  return y;
}

function groupRowItems(items: readonly DgPdfTextItem[], yTol = 5): { y: number; items: DgPdfTextItem[] }[] {
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

function parseSectionRows(
  pageItems: readonly DgPdfTextItem[],
  sectionLabel: 'IMDG IN POL' | 'REEFER IN POL',
  cols: { position: readonly [number, number]; serial: readonly [number, number] },
  stopBeforeLabel: string | null,
): CmaPrestowPositionRow[] {
  const sectionY = findSectionY(pageItems, sectionLabel);
  if (sectionY === null) return [];

  const stopY = stopBeforeLabel ? findSectionY(pageItems, stopBeforeLabel) : null;
  const headerEndY = sectionY + 20;
  const rows: CmaPrestowPositionRow[] = [];

  for (const group of groupRowItems(pageItems)) {
    if (group.y <= headerEndY) continue;
    if (stopY !== null && group.y >= stopY - 4) break;

    const position = pickInCol(group.items, cols.position, (value) => POSITION_RE.test(value));
    const serialRaw = pickInCol(group.items, cols.serial, (value) =>
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

function extractPagePositions(pageItems: readonly DgPdfTextItem[]): CmaPrestowPositionRow[] {
  const text = pageItems.map((it) => it.str).join(' ');
  if (!/IMDG IN POL|REEFER IN POL/i.test(text)) return [];

  return [
    ...parseSectionRows(pageItems, 'IMDG IN POL', IMDG_COLS, 'REEFER IN POL'),
    ...parseSectionRows(pageItems, 'REEFER IN POL', REEFER_COLS, null),
  ];
}

export function isCmaPrestowPdf(items: readonly DgPdfTextItem[]): boolean {
  const joined = items.map((it) => it.str).join(' ');
  if (!/IMDG IN POL|REEFER IN POL/i.test(joined)) return false;
  if (/Dangerous Cargo Manifest|PFR0767_IMDG/i.test(joined)) return false;
  return /seacos MACS3|MACS3 by Navis|PRESTOW/i.test(joined);
}

export function parseCmaPrestowPositions(items: readonly DgPdfTextItem[]): CmaPrestowPositionRow[] {
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
