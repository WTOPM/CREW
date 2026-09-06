import type { DgPdfTextItem } from './dg-pdf-text.util';

/** Reference PDFs are capped so a wrong drop can't stall the app. */
export const IMDG_REFERENCE_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const IMDG_REFERENCE_MAX_FILE_MB = 10;

/** One parsed entry of the Chapter 3.2 Dangerous Goods List. */
export interface ImdgChapter32Row {
  unNo: string;
  description: string;
  /** Column 3 as printed, e.g. `3`, `6.1`, `1.1D`. */
  dgClass: string;
  /** Column 3 reduced to the base class, e.g. `1.1D` -> `1`. */
  dgClassBase: string;
  /** Column 4 without the marine-pollutant `P` marker. */
  subRisk: string;
  packingGroup: string;
  /** Column 15 first EmS code, e.g. `F-B`. */
  fire: string;
  /** Column 15 second EmS code, e.g. `S-Y`. */
  spillage: string;
  marinePollutant: boolean;
  page: number;
}

export interface ImdgChapter32ParseResult {
  rows: ImdgChapter32Row[];
  /** Edition line printed in the page footer, e.g. `IMDG Code (Amendment 42-24) 2024 EDITION`. */
  amendment: string;
  /** Pages that carried the Dangerous Goods List grid. */
  tablePages: number[];
  /** Pages skipped before the list started (cover, 3.2.1 structure text, tab pages). */
  skippedLeadingPages: number;
  totalPages: number;
  warnings: string[];
}

export class ImdgChapter32ParseError extends Error {}

const COLUMN_MARKERS = [
  '(1)',
  '(2)',
  '(3)',
  '(4)',
  '(5)',
  '(6)',
  '(7a)',
  '(7b)',
  '(8)',
  '(9)',
  '(10)',
  '(11)',
  '(12)',
  '(13)',
  '(14)',
  '(15)',
  '(16a)',
  '(16b)',
  '(17)',
  '(18)',
] as const;

/** Markers that must all be present for a page to count as a list page. */
const REQUIRED_MARKERS = ['(1)', '(2)', '(3)', '(4)', '(5)', '(15)', '(18)'] as const;

const COL_UN_NO = 0;
const COL_PSN = 1;
const COL_CLASS = 2;
const COL_SUBSIDIARY = 3;
const COL_PACKING_GROUP = 4;
const COL_EMS = 15;

/** Column 1 is a 4-digit number; keep its band tight so the PSN can't leak into it. */
const UN_NO_BAND_WIDTH = 16;
/**
 * The proper shipping name is left-aligned and far wider than its centred marker,
 * so its italic tails (`AMINOPHENOLS (o-, m-, p-)`) reach past the naive midpoint.
 * Keep the PSN/class boundary just left of the class column instead.
 */
const CLASS_BAND_LEAD = 20;
/** Header block ends a couple of lines below the `(n)` marker row. */
const HEADER_BOTTOM_OFFSET = 22;
/** Page footer (`IMDG Code (Amendment ...)`) sits near the bottom edge. */
const FOOTER_TOP = 800;
/** Thumb-tab letters print in the outer margins. */
const MARGIN_LEFT = 30;
const MARGIN_RIGHT_INSET = 26;

const DASHES = new Set(['-', '–', '—', '--']);

interface PageGrid {
  page: number;
  /** Right edge per column, last entry is the page's right margin. */
  dividers: number[];
  dataTop: number;
}

function isDash(value: string): boolean {
  return DASHES.has(value.trim());
}

function cleanCell(value: string): string {
  const text = value.replace(/\s+/g, ' ').trim();
  if (!text || isDash(text)) return '';
  return text;
}

/**
 * Build column bands from the printed `(1) … (18)` row.
 * Returns null when the page has no list grid (intro text, tab page, other document).
 */
function buildPageGrid(pageItems: readonly DgPdfTextItem[], page: number): PageGrid | null {
  const centers = new Map<string, { x: number; y: number }>();
  for (const item of pageItems) {
    const label = item.str.trim();
    if (!COLUMN_MARKERS.includes(label as (typeof COLUMN_MARKERS)[number])) continue;
    const existing = centers.get(label);
    if (!existing || item.y < existing.y) centers.set(label, { x: item.x, y: item.y });
  }

  for (const marker of REQUIRED_MARKERS) {
    if (!centers.has(marker)) return null;
  }

  const ordered = COLUMN_MARKERS.map((marker) => centers.get(marker)).filter(
    (entry): entry is { x: number; y: number } => entry !== undefined,
  );
  if (ordered.length < REQUIRED_MARKERS.length) return null;

  // Markers must read left to right on one row, otherwise this is not the grid.
  const markerY = Math.min(...ordered.map((entry) => entry.y));
  const sameRow = ordered.filter((entry) => Math.abs(entry.y - markerY) <= 6);
  if (sameRow.length < REQUIRED_MARKERS.length) return null;
  for (let i = 1; i < sameRow.length; i++) {
    if (sameRow[i].x <= sameRow[i - 1].x) return null;
  }

  const dividers: number[] = [];
  for (let i = 0; i < sameRow.length - 1; i++) {
    dividers.push((sameRow[i].x + sameRow[i + 1].x) / 2);
  }
  // Column 2 is far wider than its centred marker, so the first divider would
  // otherwise swallow the proper shipping name.
  dividers[0] = Math.min(dividers[0], sameRow[0].x + UN_NO_BAND_WIDTH);
  dividers[1] = Math.max(dividers[1], sameRow[2].x - CLASS_BAND_LEAD);
  dividers.push(Number.POSITIVE_INFINITY);

  return { page, dividers, dataTop: markerY + HEADER_BOTTOM_OFFSET };
}

function columnIndex(grid: PageGrid, x: number): number {
  for (let i = 0; i < grid.dividers.length; i++) {
    if (x < grid.dividers[i]) return i;
  }
  return grid.dividers.length - 1;
}

function joinColumn(cells: readonly { x: number; y: number; str: string }[]): string {
  return cells
    .slice()
    .sort((a, b) => (Math.abs(a.y - b.y) > 2 ? a.y - b.y : a.x - b.x))
    .map((cell) => cell.str.trim())
    .filter(Boolean)
    .join(' ');
}

/** `F-B, S-Y` (sometimes split across text items) -> fire / spillage. */
function parseEmsCodes(raw: string): { fire: string; spillage: string } {
  const text = raw.toUpperCase();
  const fire = /\bF\s*-\s*([A-Z])\b/.exec(text);
  const spillage = /\bS\s*-\s*([A-Z])\b/.exec(text);
  return {
    fire: fire ? `F-${fire[1]}` : '',
    spillage: spillage ? `S-${spillage[1]}` : '',
  };
}

/** Pull `3`, `2.1` or `1.1D` out of the class cell, ignoring stray PSN punctuation. */
function parseDgClass(raw: string): string {
  const text = cleanCell(raw);
  if (!text) return '';
  const match = /(?:^|\s)(\d(?:\.\d)?[A-Z]?)(?=$|\s)/.exec(text);
  return match ? match[1] : '';
}

function baseDgClass(dgClass: string): string {
  const match = /^(\d)(?:\.\d)?/.exec(dgClass.trim());
  if (!match) return dgClass.trim();
  // Divisions matter outside class 1 (2.1 vs 2.3), but explosives collapse to `1`.
  if (match[1] === '1') return '1';
  const withDivision = /^(\d\.\d)/.exec(dgClass.trim());
  return withDivision ? withDivision[1] : match[1];
}

/** Column 4 also flags marine pollutants with a standalone `P`. */
function splitSubsidiaryHazard(raw: string): { subRisk: string; marinePollutant: boolean } {
  const text = cleanCell(raw);
  if (!text) return { subRisk: '', marinePollutant: false };

  const tokens = text.split(/[\s,]+/).filter(Boolean);
  const kept: string[] = [];
  let marinePollutant = false;
  for (const token of tokens) {
    if (token.toUpperCase() === 'P') {
      marinePollutant = true;
      continue;
    }
    if (isDash(token)) continue;
    kept.push(token);
  }

  return { subRisk: kept.join(' '), marinePollutant };
}

function parsePackingGroup(raw: string): string {
  const text = cleanCell(raw).toUpperCase();
  if (!text) return '';
  const match = text.match(/I{1,3}V?|IV/g);
  return match ? match.join('/') : '';
}

/**
 * A row starts with the 4-digit UN number of column 1. pdf.js sometimes merges
 * that number with the start of the proper shipping name into one text item
 * (`"1830 SULPHURIC ACID with more than"`), so the tail is captured too.
 */
const ROW_ANCHOR_RE = /^[\s■□△▲▪]*(\d{4})(?:\s+(\S.*))?$/;

interface RowAnchor {
  unNo: string;
  /** Proper shipping name text that shared the text item with the UN number. */
  psnLead: string;
  y: number;
}

function parsePageRows(pageItems: readonly DgPdfTextItem[], grid: PageGrid): ImdgChapter32Row[] {
  const pageWidth = Math.max(...pageItems.map((item) => item.x), 0) + MARGIN_RIGHT_INSET;
  const body = pageItems.filter(
    (item) =>
      item.y > grid.dataTop &&
      item.y < FOOTER_TOP &&
      item.x >= MARGIN_LEFT &&
      item.x <= pageWidth - MARGIN_RIGHT_INSET,
  );

  const anchors: RowAnchor[] = [];
  for (const item of body) {
    if (columnIndex(grid, item.x) !== COL_UN_NO) continue;
    const match = ROW_ANCHOR_RE.exec(item.str.trim());
    if (!match) continue;
    anchors.push({ unNo: match[1], psnLead: match[2] ?? '', y: item.y });
  }
  anchors.sort((a, b) => a.y - b.y);
  if (!anchors.length) return [];

  const rows: ImdgChapter32Row[] = [];
  for (let i = 0; i < anchors.length; i++) {
    const top = anchors[i].y - 4;
    const bottom = i + 1 < anchors.length ? anchors[i + 1].y - 6 : FOOTER_TOP;

    const buckets = new Map<number, { x: number; y: number; str: string }[]>();
    for (const item of body) {
      if (item.y < top || item.y >= bottom) continue;
      const col = columnIndex(grid, item.x);
      const bucket = buckets.get(col);
      if (bucket) bucket.push(item);
      else buckets.set(col, [item]);
    }

    const cell = (col: number): string => joinColumn(buckets.get(col) ?? []);

    const dgClass = parseDgClass(cell(COL_CLASS));
    const { subRisk, marinePollutant } = splitSubsidiaryHazard(cell(COL_SUBSIDIARY));
    const { fire, spillage } = parseEmsCodes(cell(COL_EMS));
    const psn = [anchors[i].psnLead, cell(COL_PSN)].filter(Boolean).join(' ');

    rows.push({
      unNo: anchors[i].unNo,
      description: cleanCell(psn),
      dgClass,
      dgClassBase: baseDgClass(dgClass),
      subRisk,
      packingGroup: parsePackingGroup(cell(COL_PACKING_GROUP)),
      fire,
      spillage,
      marinePollutant,
      page: grid.page,
    });
  }

  return rows;
}

/** True when the document actually contains the Chapter 3.2 Dangerous Goods List. */
export function isImdgChapter32Pdf(items: readonly DgPdfTextItem[]): boolean {
  const byPage = groupByPage(items);
  for (const [page, pageItems] of byPage) {
    if (buildPageGrid(pageItems, page)) return true;
  }
  return false;
}

/** Read the amendment/edition wording out of the running page footer. */
function findAmendment(items: readonly DgPdfTextItem[]): string {
  let amendment = '';
  let edition = '';
  for (const item of items) {
    if (!amendment) {
      const match = /IMDG Code\s*\(Amendment\s*([\w-]+)\)/i.exec(item.str);
      if (match) amendment = `Amendment ${match[1]}`;
    }
    if (!edition) {
      const match = /\b(\d{4})\s+EDITION\b/i.exec(item.str);
      if (match) edition = `${match[1]} edition`;
    }
    if (amendment && edition) break;
  }
  return [amendment, edition].filter(Boolean).join(', ');
}

function groupByPage(items: readonly DgPdfTextItem[]): Map<number, DgPdfTextItem[]> {
  const byPage = new Map<number, DgPdfTextItem[]>();
  for (const item of items) {
    const bucket = byPage.get(item.page);
    if (bucket) bucket.push(item);
    else byPage.set(item.page, [item]);
  }
  return byPage;
}

/**
 * Parse the Chapter 3.2 Dangerous Goods List.
 *
 * Only pages carrying the printed `(1) … (18)` column row are scanned, so the
 * cover, the `3.2.1 Structure of the Dangerous Goods List` explanation and any
 * unrelated pages are skipped instead of producing junk rows.
 */
export function parseImdgChapter32(
  items: readonly DgPdfTextItem[],
  onProgress?: (done: number, total: number) => void,
): ImdgChapter32ParseResult {
  const byPage = groupByPage(items);
  const pages = [...byPage.keys()].sort((a, b) => a - b);
  if (!pages.length) {
    throw new ImdgChapter32ParseError('The PDF has no extractable text.');
  }

  const rows: ImdgChapter32Row[] = [];
  const tablePages: number[] = [];
  const warnings: string[] = [];
  let skippedLeadingPages = 0;
  let seenTable = false;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const pageItems = byPage.get(page) ?? [];
    const grid = buildPageGrid(pageItems, page);

    if (!grid) {
      if (!seenTable) skippedLeadingPages++;
      onProgress?.(i + 1, pages.length);
      continue;
    }

    seenTable = true;
    tablePages.push(page);
    const pageRows = parsePageRows(pageItems, grid);
    if (!pageRows.length) warnings.push(`Page ${page}: grid found but no UN rows read.`);
    rows.push(...pageRows);
    onProgress?.(i + 1, pages.length);
  }

  if (!tablePages.length) {
    throw new ImdgChapter32ParseError(
      'No Dangerous Goods List (Chapter 3.2) table found in this PDF.',
    );
  }

  return {
    rows,
    amendment: findAmendment(items),
    tablePages,
    skippedLeadingPages,
    totalPages: pages.length,
    warnings,
  };
}

export interface ImdgChapter32Entry {
  unNo: string;
  description: string;
  dgClass: string;
  packingGroup: string;
  subRisk: string;
  fire: string;
  spillage: string;
  marinePollutant: boolean;
  /** How many list rows share this UN number (PG variants print separately). */
  variants: number;
}

/** Collapse list rows to one entry per UN number, keeping the first printed variant. */
export function collapseImdgRows(
  rows: readonly ImdgChapter32Row[],
): Map<string, ImdgChapter32Entry> {
  const byUn = new Map<string, ImdgChapter32Entry>();
  for (const row of rows) {
    const existing = byUn.get(row.unNo);
    if (existing) {
      existing.variants++;
      if (!existing.fire && row.fire) existing.fire = row.fire;
      if (!existing.spillage && row.spillage) existing.spillage = row.spillage;
      if (!existing.packingGroup && row.packingGroup) existing.packingGroup = row.packingGroup;
      if (!existing.subRisk && row.subRisk) existing.subRisk = row.subRisk;
      existing.marinePollutant = existing.marinePollutant || row.marinePollutant;
      continue;
    }
    byUn.set(row.unNo, {
      unNo: row.unNo,
      description: row.description,
      dgClass: row.dgClassBase,
      packingGroup: row.packingGroup,
      subRisk: row.subRisk,
      fire: row.fire,
      spillage: row.spillage,
      marinePollutant: row.marinePollutant,
      variants: 1,
    });
  }
  return byUn;
}
