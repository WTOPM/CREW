import type { DgPdfTextItem } from './dg-pdf-text.util';
import { parseDgWeightKg } from '../models/dg-manifest.models';
import { normalizeUnifeederSubRisk } from './dg-unifeeder-sub-risk.util';
import {
  parseUnifeederGrandTotalSummary,
  validateUnifeederImportAgainstSummary,
  type UnifeederImportValidation,
  type UnifeederPdfGrandTotalSummary,
} from './dg-unifeeder-pdf-summary.util';
import {
  isDpWorldManifestLayout,
  parseDpWorldDangerousCargoPages,
  parseDpWorldHeaderFromPage,
} from './dg-dpworld-pdf.util';
import { finalizeUnifeederImportRows } from './dg-import-un-reference.util';
import {
  resolveDgWeightTonnageOptions,
  type DgWeightTonnageOptions,
} from '../models/dg-weight-tonnage.models';
import { dualWeightFromImport } from './dg-weight-tonnage.util';

export type UnifeederPdfFormat = 'dp-world-dg' | 'unifeeder-dg' | 'unknown';

export interface UnifeederImportHeader {
  portOfDeparture: string;
  portOfArrival: string;
  departureDate: string;
  voyageNumber: string;
  vesselName: string;
}

export interface UnifeederImportRowPartial {
  size: string;
  stow: string;
  containerNo: string;
  loadPort: string;
  dischargePort: string;
  unNo: string;
  packingGroup: string;
  weightKg: string;
  grossWeightKg?: string;
  netWeightKg?: string;
  lq: string;
  flashPoint: string;
  marinePollutant: string;
  goodsDescription: string;
  dgClass: string;
  subRisk: string;
  fire: string;
  spillage: string;
}

export interface UnifeederPdfParseResult {
  format: UnifeederPdfFormat;
  warnings: string[];
  header: Partial<UnifeederImportHeader>;
  rows: UnifeederImportRowPartial[];
  summary?: UnifeederPdfGrandTotalSummary | null;
  validation?: UnifeederImportValidation;
}

const MONTHS: Record<string, string> = {
  january: '01',
  jan: '01',
  february: '02',
  feb: '02',
  march: '03',
  mar: '03',
  april: '04',
  apr: '04',
  may: '05',
  maj: '05',
  june: '06',
  jun: '06',
  juni: '06',
  july: '07',
  jul: '07',
  august: '08',
  aug: '08',
  september: '09',
  sept: '09',
  sep: '09',
  october: '10',
  oct: '10',
  okt: '10',
  november: '11',
  nov: '11',
  december: '12',
  dec: '12',
};

const CONTAINER_RAW_RE = /^[A-Z]{4}\s*[\d\s-]{6,12}$/i;
const ISO_SIZE_RE = /^[0-9]{2}[A-Z0-9]{2,3}$/i;
const LETTER_SIZE_RE = /^[A-Z][0-9][A-Z0-9]{2,3}$/i;
const SAILING_DATE_RE = /^\d{1,2}-[a-z]+-\d{4}$/i;
const EU_WEIGHT_RE = /^\d{1,3}(?:\.\d{3})*,\d{2}$/;
const PORT_SLASH_RE = /^[A-Za-z][A-Za-z\s.-]{2,}\/.+$/;

/** Y offsets from the "IMO Information" row on each page. */
const IMO = {
  size: 0,
  containerNo: -27,
  class: -21,
  unNo: -63,
  properName: -66,
  subRisk: -66,
  marinePollutant: -63,
  group: -160,
  fire: -246,
  spillage: -281,
  nweight: -400,
  flashpoint: -449,
  stowage: -219,
} as const;

export function normalizeUnifeederContainerNo(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '').replace(/-/g, '');
}

/**
 * Landscape pages are ~842 pt wide. A container header can sit past x=520 on the
 * trailing column that is split across a page break — do not discard those.
 */
const CONTAINER_HEADER_MAX_X = 780;

/** Count distinct container numbers extractable from PDF text (cargo pages). */
export function countExtractableUnifeederContainers(items: readonly DgPdfTextItem[]): number {
  const seen = new Set<string>();
  for (const it of items) {
    if (!CONTAINER_RAW_RE.test(it.str.trim())) continue;
    if (it.x > CONTAINER_HEADER_MAX_X) continue;
    const containerNo = normalizeUnifeederContainerNo(it.str);
    if (containerNo.length >= 10) seen.add(containerNo);
  }
  return seen.size;
}

/** Normalize ISO size codes; fix common PDF font misreads (e.g. EMT6 → 22T6). */
export function normalizeUnifeederSizeCode(raw: string): string {
  const s = raw.trim().toUpperCase();
  if (!s) return '';
  if (ISO_SIZE_RE.test(s)) return s;
  if (LETTER_SIZE_RE.test(s)) return s;
  if (s === 'EMT6') return '22T6';
  return s;
}

function isSizeCodeCandidate(value: string): boolean {
  const normalized = normalizeUnifeederSizeCode(value);
  return ISO_SIZE_RE.test(normalized) || LETTER_SIZE_RE.test(normalized);
}

function pickUnifeederSizeCode(items: readonly DgPdfTextItem[], targetY: number): string {
  const raw = pickLeftColumnField(items, targetY, (value) => isSizeCodeCandidate(value));
  return normalizeUnifeederSizeCode(raw);
}

export function parseUnifeederManifestDate(raw: string): string {
  const m = raw.trim().match(/^(\d{1,2})-([a-z]+)-(\d{4})$/i);
  if (!m) return raw.trim();
  const month = MONTHS[m[2].toLowerCase()];
  if (!month) return raw.trim();
  return `${m[3]}-${month}-${m[1].padStart(2, '0')}`;
}

export function extractUnifeederPortName(raw: string): string {
  const part = raw.split('/')[0]?.trim() ?? '';
  return part.replace(/\s+/g, ' ');
}

function nearY(item: DgPdfTextItem, y: number, tol = 3): boolean {
  return Math.abs(item.y - y) <= tol;
}

function pickNear(
  items: readonly DgPdfTextItem[],
  anchorX: number,
  targetY: number,
  pred: (value: string) => boolean,
  xTol = 22,
  yTol = 3,
): string {
  for (const delta of [0, -4, 4, -6, 6]) {
    for (const it of items) {
      if (Math.abs(it.x - anchorX) > xTol) continue;
      if (!nearY(it, targetY + delta, yTol)) continue;
      const value = it.str.trim();
      if (pred(value)) return value;
    }
  }
  return '';
}

function pickNameNear(items: readonly DgPdfTextItem[], anchorX: number, targetY: number): string {
  let best = '';
  for (const it of items) {
    if (!nearY(it, targetY, 4)) continue;
    if (it.x < anchorX - 5 || it.x > anchorX + 95) continue;
    const value = it.str.trim();
    if (value.length < 4) continue;
    if (/^\d{4}$/.test(value)) continue;
    if (/^(YES|NO|0,0|\/ \/ \/)$/.test(value)) continue;
    if (/^Proper ship\. name:$/i.test(value)) continue;
    if (value.length > best.length) best = value;
  }
  return best;
}

function normalizePackingGroup(raw: string): string {
  const value = raw.trim();
  if (!value || value === '--' || value === '—') return '';
  return value;
}

function normalizeSubRisk(raw: string): string {
  return normalizeUnifeederSubRisk(raw);
}

function normalizeMarinePollutant(raw: string): string {
  const value = raw.trim().toUpperCase();
  if (value === 'NO' || value === 'N') return '';
  return value;
}

function isRealPortSlash(raw: string): boolean {
  const value = raw.trim();
  if (!PORT_SLASH_RE.test(value)) return false;
  if (/A\/S|DENMARK|GERMANY|GMBH|VAT:|UNIFEEDER|DP WORLD/i.test(value)) return false;
  const left = extractUnifeederPortName(value).toUpperCase();
  if (!left || left.length < 3) return false;
  if (left === 'POL' || left === 'POD') return false;
  return true;
}

function findPortTerminalValue(items: readonly DgPdfTextItem[], label: string): string {
  const labelItems = items.filter((it) => it.str.trim() === label);
  let best = '';
  let bestScore = Number.POSITIVE_INFINITY;
  for (const labelItem of labelItems) {
    for (const it of items) {
      if (!isRealPortSlash(it.str)) continue;
      const xDist = Math.abs(it.x - labelItem.x);
      if (xDist > 25) continue;
      const yDist = Math.abs(it.y - labelItem.y);
      if (yDist > 160) continue;
      const score = xDist + yDist * 0.5;
      if (score < bestScore) {
        bestScore = score;
        best = it.str.trim();
      }
    }
  }
  return best;
}

function findPolSailingDate(items: readonly DgPdfTextItem[]): string {
  const labelItems = items.filter(
    (it) => it.str.trim() === 'POL SAILING DATE' || it.str.includes('POL SAILING'),
  );
  let best = '';
  let bestDist = Number.POSITIVE_INFINITY;
  for (const label of labelItems) {
    for (const it of items) {
      if (!SAILING_DATE_RE.test(it.str)) continue;
      const xDist = Math.abs(it.x - label.x);
      if (xDist > 25) continue;
      const yDist = Math.abs(it.y - label.y);
      if (yDist > 120) continue;
      const score = xDist + yDist;
      if (score < bestDist) {
        bestDist = score;
        best = it.str.trim();
      }
    }
  }
  return best;
}

function parseHeaderFromPage(items: readonly DgPdfTextItem[]): Partial<UnifeederImportHeader> {
  let polRaw = findPortTerminalValue(items, 'POL/TERMINAL');
  let podRaw = findPortTerminalValue(items, 'POD/TERMINAL');

  if (!polRaw || !podRaw) {
    const sailing = items.find((it) => SAILING_DATE_RE.test(it.str));
    const slashPorts = [
      ...new Set(items.filter((it) => isRealPortSlash(it.str)).map((it) => it.str.trim())),
    ];
    if (!polRaw) {
      polRaw =
        (sailing && items.find((it) => it.y === sailing.y && isRealPortSlash(it.str))?.str) ??
        slashPorts[0] ??
        '';
    }
    if (!podRaw) {
      podRaw = slashPorts.find((p) => p !== polRaw) ?? '';
    }
  }

  const sailingRaw =
    findPolSailingDate(items) || items.find((it) => SAILING_DATE_RE.test(it.str))?.str || '';

  const voyage = items.find((it) => nearY(it, 511, 2) && /^\d{2,4}$/.test(it.str))?.str ?? '';
  const vessel =
    items.find((it) => nearY(it, 511, 2) && /^[A-Z][A-Z\s-]{2,}$/.test(it.str))?.str ?? '';

  return {
    portOfDeparture: extractUnifeederPortName(polRaw),
    portOfArrival: extractUnifeederPortName(podRaw),
    departureDate: sailingRaw ? parseUnifeederManifestDate(sailingRaw) : '',
    voyageNumber: voyage,
    vesselName: vessel,
  };
}

function pickLeftColumnField(
  items: readonly DgPdfTextItem[],
  targetY: number,
  pred: (value: string) => boolean,
  yTol = 4,
): string {
  const xBands = [
    { min: 0, max: 130 },
    { min: 100, max: 220 },
    { min: 0, max: 280 },
  ];
  let best = '';
  let bestDist = Number.POSITIVE_INFINITY;
  for (const band of xBands) {
    for (const delta of [0, -4, 4, -6, 6, -8, 8]) {
      const wantedY = targetY + delta;
      for (const it of items) {
        if (it.x < band.min || it.x > band.max) continue;
        const value = it.str.trim();
        if (!pred(value)) continue;
        const dist = Math.abs(it.y - wantedY);
        if (dist > yTol) continue;
        if (dist < bestDist) {
          bestDist = dist;
          best = value;
        }
      }
    }
    if (best) return best;
  }
  return best;
}

const COLUMN_HALF_WIDTH = 80;

function blockItemsForColumn(
  items: readonly DgPdfTextItem[],
  columnX: number,
  imoY: number,
): DgPdfTextItem[] {
  const top = imoY - 520;
  const bottom = imoY + 90;
  const left = columnX - COLUMN_HALF_WIDTH;
  const right = columnX + COLUMN_HALF_WIDTH;
  return items.filter((it) => it.y >= top && it.y <= bottom && it.x >= left && it.x <= right);
}

interface UnifeederContainerColumnAnchor {
  columnX: number;
  y: number;
  containerNo: string;
  size: string;
  imoY: number;
  /** False when the header sits alone at a page edge (cargo continues on the next page). */
  hasImoOnPage: boolean;
}

function findImoRowForContainer(
  items: readonly DgPdfTextItem[],
  containerX: number,
  containerY: number,
): DgPdfTextItem | undefined {
  const expectedImoY = containerY - IMO.containerNo;
  let best: DgPdfTextItem | undefined;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const it of items) {
    if (it.str !== 'IMO Information') continue;
    const xDist = Math.abs(it.x - containerX);
    const yDist = Math.abs(it.y - expectedImoY);
    if (xDist > 95) continue;
    if (yDist > 20) continue;
    const score = xDist + yDist * 2;
    if (score < bestScore) {
      bestScore = score;
      best = it;
    }
  }
  return best;
}

function findContainerColumnAnchors(
  items: readonly DgPdfTextItem[],
): UnifeederContainerColumnAnchor[] {
  const candidates: UnifeederContainerColumnAnchor[] = [];
  for (const it of items) {
    const value = it.str.trim();
    if (!CONTAINER_RAW_RE.test(value)) continue;
    if (it.x > CONTAINER_HEADER_MAX_X) continue;
    const containerNo = normalizeUnifeederContainerNo(value);
    if (!containerNo) continue;
    const imo = findImoRowForContainer(items, it.x, it.y);
    const imoY = imo?.y ?? it.y - IMO.containerNo;
    const size =
      items
        .find(
          (s) =>
            nearY(s, imoY, 4) && isSizeCodeCandidate(s.str.trim()) && Math.abs(s.x - it.x) < 70,
        )
        ?.str.trim() ?? '';
    candidates.push({
      columnX: it.x,
      y: it.y,
      containerNo,
      size: normalizeUnifeederSizeCode(size),
      imoY,
      hasImoOnPage: !!imo,
    });
  }

  const seen = new Set<string>();
  const anchors: UnifeederContainerColumnAnchor[] = [];
  for (const candidate of candidates.sort((a, b) => a.y - b.y || a.columnX - b.columnX)) {
    if (seen.has(candidate.containerNo)) continue;
    seen.add(candidate.containerNo);
    anchors.push(candidate);
  }
  return anchors;
}

function dedupeImoPositions(items: readonly DgPdfTextItem[]): DgPdfTextItem[] {
  const imoRows = items
    .filter((it) => it.str === 'IMO Information')
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const kept: DgPdfTextItem[] = [];
  for (const row of imoRows) {
    if (kept.some((k) => Math.abs(k.y - row.y) <= 6 && Math.abs(k.x - row.x) <= 6)) continue;
    kept.push(row);
  }
  return kept;
}

/** IMO row anchor, or continuation page where only field labels remain (no "IMO Information"). */
function findPageCargoAnchors(items: readonly DgPdfTextItem[]): Array<{ x: number; y: number }> {
  const imoRows = dedupeImoPositions(items);
  if (imoRows.length) {
    return imoRows.map((row) => ({ x: row.x, y: row.y }));
  }

  const properLabels = items.filter((it) => /^Proper ship\.\s*name:?\s*$/i.test(it.str.trim()));
  if (!properLabels.length) return [];

  const clusters = new Map<number, DgPdfTextItem[]>();
  for (const label of properLabels) {
    const bucketY = [...clusters.keys()].find((y) => Math.abs(y - label.y) <= 6) ?? label.y;
    if (!clusters.has(bucketY)) clusters.set(bucketY, []);
    clusters.get(bucketY)!.push(label);
  }

  const anchors: Array<{ x: number; y: number }> = [];
  for (const [y, cluster] of clusters) {
    const unY = y + IMO.unNo;
    const hasUn = items.some(
      (it) => nearY(it, unY, 4) && /^\d{4}$/.test(it.str.trim()) && it.x >= 30,
    );
    if (!hasUn) continue;
    anchors.push({ x: Math.min(...cluster.map((c) => c.x)), y });
  }

  return anchors.sort((a, b) => a.y - b.y || a.x - b.x);
}

interface UnifeederImoBlockBinding {
  size: string;
  containerNo: string;
  stow: string;
}

function fieldItemsForAnchor(
  pageItems: readonly DgPdfTextItem[],
  columnX: number,
  imoY: number,
  anchorX: number,
): DgPdfTextItem[] {
  const top = imoY - 520;
  const bottom = imoY + 90;
  const blockRight = columnX + COLUMN_HALF_WIDTH;
  if (columnX >= 80 && anchorX <= blockRight + 10) {
    return blockItemsForColumn(pageItems, columnX, imoY);
  }
  const left = anchorX - 55;
  const right = anchorX + 55;
  return pageItems.filter((it) => it.y >= top && it.y <= bottom && it.x >= left && it.x <= right);
}

function findUnAnchorsForImoBlock(
  pageItems: readonly DgPdfTextItem[],
  imoY: number,
  columnX: number,
  allowWideUnAnchors = false,
  nextAnchorX?: number,
): DgPdfTextItem[] {
  const targetY = imoY + IMO.unNo;
  const minBlockX = columnX < 80 ? 30 : Math.max(50, columnX - 40);
  const collect = (source: readonly DgPdfTextItem[], minX: number): DgPdfTextItem[] =>
    source
      .filter((it) => nearY(it, targetY, 4) && /^\d{4}$/.test(it.str.trim()) && it.x >= minX)
      .sort((a, b) => a.x - b.x || a.y - b.y);

  const blockItems = blockItemsForColumn(pageItems, columnX, imoY);
  let anchors = collect(blockItems, minBlockX);
  const wideAnchors = collect(pageItems, 30);
  const anchorSpread =
    wideAnchors.length > 1 ? wideAnchors[wideAnchors.length - 1].x - wideAnchors[0].x : 0;

  if (!anchors.length) {
    if (columnX < 80 && wideAnchors.length > 0 && anchorSpread > 200) {
      anchors = wideAnchors;
    }
  } else if (wideAnchors.length > anchors.length && anchorSpread > 200 && allowWideUnAnchors) {
    anchors = wideAnchors;
  } else {
    const blockRight = columnX + COLUMN_HALF_WIDTH;
    const maxX = nextAnchorX != null ? nextAnchorX - 35 : Number.POSITIVE_INFINITY;
    for (const a of wideAnchors) {
      if (a.x <= blockRight + 10) continue;
      if (a.x >= maxX) continue;
      anchors.push(a);
    }
    anchors.sort((a, b) => a.x - b.x || a.y - b.y);
  }

  const unique: DgPdfTextItem[] = [];
  const seen = new Set<string>();
  for (const anchor of anchors) {
    const key = `${anchor.str.trim()}@${anchor.x}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(anchor);
  }
  return unique;
}

function pickImportedWeightKg(
  fieldItems: readonly DgPdfTextItem[],
  ax: number,
  imoY: number,
): string {
  const net = pickNear(fieldItems, ax, imoY + IMO.nweight, (v) => EU_WEIGHT_RE.test(v));
  let best = parseDgWeightKg(net);
  let bestRaw = net;

  const gross = pickNear(fieldItems, ax, imoY + IMO.nweight + 44, (v) => EU_WEIGHT_RE.test(v));
  const grossKg = parseDgWeightKg(gross);
  if (grossKg > best) {
    best = grossKg;
    bestRaw = gross;
  }

  if (best >= 50) return bestRaw;

  let fallback = 0;
  let fallbackRaw = '';
  for (const it of fieldItems) {
    if (!EU_WEIGHT_RE.test(it.str)) continue;
    if (Math.abs(it.x - ax) > 55) continue;
    if (it.y < imoY + IMO.nweight - 10 || it.y > imoY + IMO.nweight + 60) continue;
    const w = parseDgWeightKg(it.str);
    if (w > fallback) {
      fallback = w;
      fallbackRaw = it.str.trim();
    }
  }
  return fallbackRaw || bestRaw;
}

function pickLegacyImoGrossRaw(
  fieldItems: readonly DgPdfTextItem[],
  ax: number,
  imoY: number,
): string {
  return pickNear(fieldItems, ax, imoY + IMO.nweight + 44, (v) => EU_WEIGHT_RE.test(v));
}

function pickLegacyImoNetRaw(
  fieldItems: readonly DgPdfTextItem[],
  ax: number,
  imoY: number,
): string {
  return pickNear(fieldItems, ax, imoY + IMO.nweight, (v) => EU_WEIGHT_RE.test(v));
}

function pickNweightKg(fieldItems: readonly DgPdfTextItem[], ax: number, imoY: number): string {
  const near = pickNear(fieldItems, ax, imoY + IMO.nweight, (v) => EU_WEIGHT_RE.test(v));
  const nearKg = parseDgWeightKg(near);
  if (nearKg >= 10) return near;

  let best = nearKg;
  let bestRaw = near;
  for (const it of fieldItems) {
    if (!EU_WEIGHT_RE.test(it.str)) continue;
    if (Math.abs(it.x - ax) > 55) continue;
    if (it.y < imoY + IMO.nweight - 10 || it.y > imoY + IMO.nweight + 15) continue;
    const w = parseDgWeightKg(it.str);
    if (w > best) {
      best = w;
      bestRaw = it.str.trim();
    }
  }
  return bestRaw || pickImportedWeightKg(fieldItems, ax, imoY);
}

function parseImoBlock(
  items: readonly DgPdfTextItem[],
  imoY: number,
  columnX: number,
  loadPort: string,
  dischargePort: string,
  binding?: UnifeederImoBlockBinding,
  allowWideUnAnchors = false,
  nextAnchorX?: number,
  useGrossWeight = true,
): UnifeederImportRowPartial[] {
  const blockItems = blockItemsForColumn(items, columnX, imoY);
  const size =
    (binding?.size && binding.size) ||
    pickUnifeederSizeCode(blockItems, imoY + IMO.size) ||
    pickUnifeederSizeCode(items, imoY + IMO.size);
  const containerNo =
    (binding?.containerNo && binding.containerNo) ||
    normalizeUnifeederContainerNo(
      pickLeftColumnField(blockItems, imoY + IMO.containerNo, (value) =>
        CONTAINER_RAW_RE.test(value),
      ) ||
        pickLeftColumnField(items, imoY + IMO.containerNo, (value) => CONTAINER_RAW_RE.test(value)),
    );
  const stow =
    (binding?.stow && binding.stow) ||
    items
      .find(
        (it) =>
          nearY(it, imoY + IMO.stowage, 4) &&
          it.x >= 30 &&
          it.x <= 160 &&
          /^\d{4,6}$/.test(it.str.trim()),
      )
      ?.str.trim() ||
    pickLeftColumnField(blockItems, imoY + IMO.stowage, (value) => /^\d{4,6}$/.test(value)) ||
    pickLeftColumnField(items, imoY + IMO.stowage, (value) => /^\d{4,6}$/.test(value));

  if (!containerNo) return [];

  const uniqueUnAnchors = findUnAnchorsForImoBlock(
    items,
    imoY,
    columnX,
    allowWideUnAnchors,
    nextAnchorX,
  );

  if (!uniqueUnAnchors.length) return [];

  const rows: UnifeederImportRowPartial[] = [];
  for (const anchor of uniqueUnAnchors) {
    const ax = anchor.x;
    const ty = imoY;
    const fieldItems = fieldItemsForAnchor(items, columnX, imoY, ax);
    const dgClass = pickNear(fieldItems, ax, ty + IMO.class, (v) => /^\d+(?:\.\d+)?$/.test(v));
    const unNo = anchor.str.trim();
    const packingGroup = normalizePackingGroup(
      pickNear(
        fieldItems,
        ax,
        ty + IMO.group,
        (v) => v === '--' || /^[I]{1,3}$|^II$|^III$|^\d+\s*\/\s*[A-Z0-9]+$/i.test(v),
      ),
    );
    const fire = pickNear(fieldItems, ax, ty + IMO.fire, (v) => /^F-[A-Z]$/i.test(v));
    const spillage = pickNear(fieldItems, ax, ty + IMO.spillage, (v) => /^S-[A-Z]$/i.test(v));
    const weights = dualWeightFromImport(
      pickLegacyImoGrossRaw(fieldItems, ax, imoY),
      pickLegacyImoNetRaw(fieldItems, ax, imoY),
      useGrossWeight,
    );
    const flashPoint = pickNear(
      fieldItems,
      ax,
      ty + IMO.flashpoint,
      (v) => v.length > 0 && !/^flashpoint$/i.test(v),
      30,
      6,
    );
    const goodsDescription = pickNameNear(fieldItems, ax, ty + IMO.properName);
    const marinePollutant = normalizeMarinePollutant(
      pickNear(fieldItems, ax, ty + IMO.marinePollutant, (v) => /^(YES|NO)$/i.test(v), 40, 4) ||
        fieldItems.find(
          (it) =>
            nearY(it, ty + IMO.marinePollutant, 4) &&
            it.x >= ax + 20 &&
            it.x <= ax + 50 &&
            /^(YES|NO)$/i.test(it.str),
        )?.str ||
        '',
    );
    const subRisk = normalizeSubRisk(
      fieldItems.find(
        (it) =>
          nearY(it, ty + IMO.subRisk, 4) &&
          it.x >= ax + 45 &&
          it.x <= ax + 80 &&
          it.str.trim().length > 0 &&
          !/^0([.,]0)?$/.test(it.str.trim()) &&
          it.str.trim() !== '/ / /',
      )?.str ?? '',
    );

    if (!weights.weightKg.trim() && !goodsDescription.trim()) continue;

    rows.push({
      size,
      stow,
      containerNo,
      loadPort,
      dischargePort,
      unNo,
      packingGroup,
      weightKg: weights.weightKg,
      grossWeightKg: weights.grossWeightKg,
      netWeightKg: weights.netWeightKg,
      lq: '',
      flashPoint,
      marinePollutant,
      goodsDescription,
      dgClass,
      subRisk,
      fire,
      spillage,
    });
  }

  return rows;
}

function resolveBindingForImo(
  items: readonly DgPdfTextItem[],
  imo: DgPdfTextItem,
  headers: readonly UnifeederContainerColumnAnchor[],
): UnifeederImoBlockBinding | undefined {
  const blockItems = blockItemsForColumn(items, imo.x, imo.y);
  const explicitContainer = normalizeUnifeederContainerNo(
    pickLeftColumnField(blockItems, imo.y + IMO.containerNo, (value) =>
      CONTAINER_RAW_RE.test(value),
    ),
  );
  if (explicitContainer) {
    const size = pickUnifeederSizeCode(blockItems, imo.y + IMO.size);
    const stow =
      blockItems
        .find((it) => nearY(it, imo.y + IMO.stowage, 4) && /^\d{4,6}$/.test(it.str.trim()))
        ?.str.trim() ??
      pickLeftColumnField(blockItems, imo.y + IMO.stowage, (value) => /^\d{4,6}$/.test(value));
    return { containerNo: explicitContainer, size, stow };
  }

  const header = headers
    .filter((h) => Math.abs(h.imoY - imo.y) <= 8 && h.columnX <= imo.x + 25)
    .sort((a, b) => b.columnX - a.columnX)[0];
  if (!header) return undefined;

  const headerBlockItems = blockItemsForColumn(items, header.columnX, header.imoY);
  const stow =
    headerBlockItems
      .find((it) => nearY(it, header.imoY + IMO.stowage, 4) && /^\d{4,6}$/.test(it.str.trim()))
      ?.str.trim() ??
    items
      .find(
        (it) =>
          nearY(it, header.imoY + IMO.stowage, 4) &&
          it.x >= 90 &&
          it.x <= 200 &&
          /^\d{4,6}$/.test(it.str.trim()),
      )
      ?.str.trim() ??
    pickLeftColumnField(headerBlockItems, header.imoY + IMO.stowage, (value) =>
      /^\d{4,6}$/.test(value),
    );

  return {
    containerNo: header.containerNo,
    size: header.size,
    stow: stow ?? '',
  };
}

function resolveBindingForContinuation(
  items: readonly DgPdfTextItem[],
  anchorY: number,
  pageHeaders: readonly UnifeederContainerColumnAnchor[],
  recentHeaders: readonly UnifeederContainerColumnAnchor[],
): UnifeederImoBlockBinding | undefined {
  const targetUnY = anchorY + IMO.unNo;
  const unXs = items
    .filter((it) => nearY(it, targetUnY, 4) && /^\d{4}$/.test(it.str.trim()) && it.x >= 30)
    .map((it) => it.x);
  if (!unXs.length) return undefined;

  const refX = Math.min(...unXs);
  const pool = pageHeaders.length ? pageHeaders : recentHeaders;
  if (!pool.length) return undefined;

  const header = pool
    .slice()
    .sort((a, b) => Math.abs(a.columnX - refX) - Math.abs(b.columnX - refX))[0];
  if (!header) return undefined;

  const stow =
    items
      .find(
        (it) =>
          nearY(it, header.imoY + IMO.stowage, 4) &&
          it.x >= 30 &&
          it.x <= 200 &&
          /^\d{4,6}$/.test(it.str.trim()),
      )
      ?.str.trim() ?? '';

  return {
    containerNo: header.containerNo,
    size: header.size,
    stow,
  };
}

function parsePageRows(
  items: readonly DgPdfTextItem[],
  loadPort: string,
  dischargePort: string,
  inheritedBinding?: UnifeederImoBlockBinding,
  recentColumnHeaders: readonly UnifeederContainerColumnAnchor[] = [],
  useGrossWeight = true,
  pendingOrphans: readonly UnifeederImoBlockBinding[] = [],
): {
  rows: UnifeederImportRowPartial[];
  lastBinding?: UnifeederImoBlockBinding;
  columnHeaders: readonly UnifeederContainerColumnAnchor[];
  /** Container headers printed on this page whose cargo body continues on the next page. */
  orphanBindings: UnifeederImoBlockBinding[];
} {
  const anchors = findPageCargoAnchors(items);
  if (!anchors.length) {
    // A trailing page-break header with no IMO on this page still needs to travel forward.
    const orphanOnly = findContainerColumnAnchors(items)
      .filter((h) => !h.hasImoOnPage)
      .map((h) => ({ containerNo: h.containerNo, size: h.size, stow: '' }));
    return {
      rows: [],
      lastBinding: inheritedBinding,
      columnHeaders: recentColumnHeaders,
      orphanBindings: orphanOnly.length ? orphanOnly : [...pendingOrphans],
    };
  }

  const containerHeaders = findContainerColumnAnchors(items);
  const columnHeaders = [...recentColumnHeaders];
  for (const header of containerHeaders) {
    if (!columnHeaders.some((h) => h.containerNo === header.containerNo)) {
      columnHeaders.push(header);
    }
  }

  const hasImoRows = items.some((it) => it.str === 'IMO Information');
  let activeBinding = inheritedBinding;
  const orphanQueue = [...pendingOrphans];
  const rows: UnifeederImportRowPartial[] = [];
  const usedContainerNos = new Set<string>();

  const allowWideUnAnchors = anchors.length === 1;

  for (let i = 0; i < anchors.length; i++) {
    const anchor = anchors[i]!;
    const nextAnchorX = anchors[i + 1]?.x;
    const pseudoImo: DgPdfTextItem = {
      str: 'IMO Information',
      x: anchor.x,
      y: anchor.y,
      page: items[0]?.page ?? 1,
    };
    let binding: UnifeederImoBlockBinding | undefined;
    if (!hasImoRows) {
      binding =
        resolveBindingForContinuation(items, anchor.y, containerHeaders, recentColumnHeaders) ??
        orphanQueue.shift() ??
        activeBinding;
    } else {
      binding = resolveBindingForImo(items, pseudoImo, containerHeaders);
      if (!binding) {
        // Cargo column without a container number — claim the oldest orphan from a page break.
        binding = orphanQueue.shift() ?? activeBinding;
      }
    }
    const blockRows = parseImoBlock(
      items,
      anchor.y,
      anchor.x,
      loadPort,
      dischargePort,
      binding,
      allowWideUnAnchors,
      nextAnchorX,
      useGrossWeight,
    );
    rows.push(...blockRows);
    if (blockRows.length) {
      const ref = blockRows[0]!;
      if (ref.containerNo) {
        usedContainerNos.add(ref.containerNo);
        activeBinding = {
          containerNo: ref.containerNo,
          size: ref.size,
          stow: ref.stow,
        };
      }
    }
  }

  // Headers printed on this page that never got a cargo body belong to the next page.
  const orphanBindings: UnifeederImoBlockBinding[] = [];
  for (const header of containerHeaders) {
    if (usedContainerNos.has(header.containerNo)) continue;
    if (header.hasImoOnPage) continue;
    orphanBindings.push({
      containerNo: header.containerNo,
      size: header.size,
      stow: '',
    });
  }
  // Unused carried orphans stay pending (should be rare).
  for (const leftover of orphanQueue) {
    if (!usedContainerNos.has(leftover.containerNo)) orphanBindings.push(leftover);
  }

  return { rows, lastBinding: activeBinding, columnHeaders, orphanBindings };
}

export function parseUnifeederDangerousCargoManifest(
  items: readonly DgPdfTextItem[],
  options: DgWeightTonnageOptions = {},
): UnifeederPdfParseResult {
  const useGrossWeight = resolveDgWeightTonnageOptions(options).useGrossWeight;
  const joined = items.map((i) => i.str).join(' ');
  if (!/Dangerous Cargo Manifest/i.test(joined) || !/IMO Information/i.test(joined)) {
    return {
      format: 'unknown',
      warnings: ['Unrecognized PDF format (expected DP WORLD Dangerous Cargo Manifest).'],
      header: {},
      rows: [],
    };
  }

  if (isDpWorldManifestLayout(items)) {
    return parseDpWorldManifest(items, useGrossWeight);
  }

  return parseLegacyUnifeederManifest(items, useGrossWeight);
}

function parseDpWorldManifest(
  items: readonly DgPdfTextItem[],
  useGrossWeight: boolean,
): UnifeederPdfParseResult {
  const pages = [...new Set(items.map((i) => i.page))].sort((a, b) => a - b);
  const header = parseDpWorldHeaderFromPage(items.filter((i) => i.page === pages[0]));
  const { rows, warnings } = parseDpWorldDangerousCargoPages(items, header, {
    useGrossWeight,
  });

  if (!rows.length) {
    warnings.unshift('No DP WORLD cargo rows extracted from PDF.');
  }

  const summary = parseUnifeederGrandTotalSummary(items, 'dp-world');
  const extractableContainers = countExtractableUnifeederContainers(items);
  const finalized = finalizeUnifeederImportRows(rows, warnings);
  const validation = validateUnifeederImportAgainstSummary(finalized.rows, summary, {
    extractableContainers,
    useGrossWeight,
  });

  return {
    format: 'dp-world-dg',
    warnings: finalized.warnings,
    header,
    rows: finalized.rows,
    summary,
    validation,
  };
}

function parseLegacyUnifeederManifest(
  items: readonly DgPdfTextItem[],
  useGrossWeight: boolean,
): UnifeederPdfParseResult {
  const warnings: string[] = [];
  const pages = [...new Set(items.map((i) => i.page))].sort((a, b) => a - b);
  const header = parseHeaderFromPage(items.filter((i) => i.page === pages[0]));
  const loadPort = header.portOfDeparture ?? '';
  const dischargePort = header.portOfArrival ?? '';

  let lastBinding: UnifeederImoBlockBinding | undefined;
  let columnHeaders: UnifeederContainerColumnAnchor[] = [];
  let pendingOrphans: UnifeederImoBlockBinding[] = [];
  const rows: UnifeederImportRowPartial[] = [];
  for (const page of pages) {
    const pageItems = items.filter((i) => i.page === page);
    const {
      rows: pageRows,
      lastBinding: nextBinding,
      columnHeaders: nextHeaders,
      orphanBindings,
    } = parsePageRows(
      pageItems,
      loadPort,
      dischargePort,
      lastBinding,
      columnHeaders,
      useGrossWeight,
      pendingOrphans,
    );
    lastBinding = nextBinding;
    columnHeaders = [...nextHeaders];
    pendingOrphans = orphanBindings;
    if (!pageRows.length) {
      const mightHaveCargo = pageItems.some(
        (it) => it.str === 'IMO Information' || /^Proper ship\.\s*name:?\s*$/i.test(it.str.trim()),
      );
      if (mightHaveCargo) {
        warnings.push(`Page ${page}: no DG cargo rows found.`);
      }
      continue;
    }
    rows.push(...pageRows);
  }

  if (pendingOrphans.length) {
    warnings.push(
      `Container header(s) without cargo body: ${pendingOrphans.map((o) => o.containerNo).join(', ')}.`,
    );
  }

  if (!rows.length) {
    warnings.unshift('No DP WORLD cargo rows extracted from PDF.');
  }

  const summary = parseUnifeederGrandTotalSummary(items, 'legacy');
  const extractableContainers = countExtractableUnifeederContainers(items);
  const finalized = finalizeUnifeederImportRows(rows, warnings);
  const validation = validateUnifeederImportAgainstSummary(finalized.rows, summary, {
    extractableContainers,
    useGrossWeight,
  });

  return {
    format: 'unifeeder-dg',
    warnings: finalized.warnings,
    header,
    rows: finalized.rows,
    summary,
    validation,
  };
}
