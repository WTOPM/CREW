import { Injectable } from '@angular/core';
import {
  type DgManifestFormSettings,
  type DgManifestRow,
  formatDgWeightKgDisplay,
} from '../models/dg-manifest.models';
import { resolveManifestPortName, type Port } from '../models/crew.models';
import { extractDgPdfTextItems, type DgPdfTextItem } from '../utils/dg-pdf-text.util';

export type DgManifestPdfFormat = 'cma-imdg' | 'unknown';

export interface DgManifestImportResult {
  format: DgManifestPdfFormat;
  warnings: string[];
  header: Partial<Omit<DgManifestFormSettings, 'rows'>>;
  rows: Partial<Omit<DgManifestRow, 'id'>>[];
}

/** CMA CGM PFR0767 IMDG manifest — measured column X ranges (pt). */
const COL = {
  containerNo: [8, 78] as const,
  isoType: [80, 112] as const,
  properName: [305, 488] as const,
  netWeight: [528, 572] as const,
  imdgClass: [582, 592] as const,
  unNo: [600, 628] as const,
  stowage: [235, 275] as const,
  flashPoint: [300, 390] as const,
  fieldBlock: [290, 520] as const,
  loadPort: [484, 560] as const,
  transhipmentPort: [684, 770] as const,
  dischargePort: [680, 770] as const,
  vessel: [64, 130] as const,
  voyage: [64, 170] as const,
  callSign: [254, 295] as const,
  etd: [484, 545] as const,
};

const CONTAINER_RE = /^[A-Z]{4}\d{7}$/;
const ISO_TYPE_RE = /^[0-9]{2}[A-Z0-9]{2,3}$/i;
/** e.g. 2.1, 2.2, 3, 8, 6.1 */
const IMDG_CLASS_RE = /^\d+(?:\.\d+)?$/;
const UN_NO_RE = /^\d{4}$/;
const FLASH_POINT_VALUE_RE = /^-?\d+(?:\.\d+)?\s*°C$/i;

@Injectable({ providedIn: 'root' })
export class DgManifestImportService {
  async importFromPdfBytes(bytes: Uint8Array, ports: Port[] = []): Promise<DgManifestImportResult> {
    const items = await extractDgPdfTextItems(bytes);
    const joined = items.map((i) => i.str).join(' ');
    if (!/Dangerous Cargo Manifest|PFR0767_IMDG/i.test(joined)) {
      return {
        format: 'unknown',
        warnings: ['Unrecognized PDF format (expected CMA CGM Dangerous Cargo Manifest).'],
        header: {},
        rows: [],
      };
    }

    const header = parseCmaHeader(items);
    const importPorts = resolveCmaImportPorts(items, ports);
    if (importPorts.pol) header.portOfDeparture = importPorts.pol;
    if (importPorts.pod) header.portOfArrival = importPorts.pod;
    const { rows, warnings } = parseCmaCargoRows(items, importPorts, ports);

    return {
      format: 'cma-imdg',
      warnings,
      header,
      rows,
    };
  }
}

function inCol(x: number, range: readonly [number, number]): boolean {
  return x >= range[0] && x <= range[1];
}

function nearY(item: DgPdfTextItem, y: number, tol = 2): boolean {
  return Math.abs(item.y - y) <= tol;
}

function pickAtY(
  items: DgPdfTextItem[],
  y: number,
  col: keyof typeof COL,
  page: number,
  pred?: (s: string) => boolean,
  yTol = 2,
): string {
  for (const it of items) {
    if (it.page !== page) continue;
    if (!nearY(it, y, yTol) || !inCol(it.x, COL[col])) continue;
    if (pred && !pred(it.str)) continue;
    return it.str.trim();
  }
  return '';
}

function pickNearY(
  items: DgPdfTextItem[],
  y: number,
  col: keyof typeof COL,
  page: number,
  pred?: (s: string) => boolean,
): string {
  for (const delta of [0, -1, 1, -2, 2]) {
    const v = pickAtY(items, y + delta, col, page, pred);
    if (v) return v;
  }
  return '';
}

function parseCmaHeader(items: DgPdfTextItem[]): Partial<Omit<DgManifestFormSettings, 'rows'>> {
  const loadPort = findPortValue(items, 'loadPort');
  const transhipmentPort = findPortValue(items, 'transhipmentPort');
  const dischargePort = findDischargePort(items);
  const arrivalPort =
    !isBlankManifestPort(transhipmentPort) ? transhipmentPort : dischargePort;
  const vesselName = pickInBand(items, 117, 122, 'vessel', (s) => s.length > 1 && s !== 'Vessel');
  const voyage = pickInBand(items, 131, 136, 'voyage', (s) => s.length > 3 && s !== 'Voyage');
  const callSign = pickInBand(items, 131, 136, 'callSign', (s) => /^[A-Z0-9]+$/i.test(s));
  const etd = pickInBand(items, 130, 135, 'etd', (s) => /\d/.test(s));

  const vesselDisplay =
    vesselName && callSign
      ? `m/v "${vesselName}" / ${callSign}`
      : vesselName || callSign
        ? vesselName || callSign
        : '';

  return {
    vesselDisplay,
    voyageNumber: voyage,
    portOfDeparture: loadPort.toUpperCase(),
    portOfArrival: arrivalPort.toUpperCase(),
    departureDate: parseManifestDateToIso(etd),
  };
}

function findDischargePort(items: DgPdfTextItem[]): string {
  const labelItem = items.find((it) => it.str === 'Discharge Port');
  if (labelItem) {
    const val = items.find(
      (it) =>
        nearY(it, labelItem.y, 3) &&
        inCol(it.x, COL.dischargePort) &&
        it.str !== ':' &&
        it.str !== '-' &&
        it.str.length > 1,
    );
    if (val) return val.str.trim();
  }
  return pickInBand(items, 129, 134, 'dischargePort', (s) => s.length > 2 && s !== ':' && s !== '-');
}

function findPortValue(items: DgPdfTextItem[], kind: 'loadPort' | 'transhipmentPort'): string {
  const col = COL[kind];
  const label = kind === 'loadPort' ? 'Load Port' : 'Transhipment Port';
  const labelItem = items.find((it) => it.str === label);
  if (labelItem) {
    const val = items.find(
      (it) =>
        nearY(it, labelItem.y, 3) &&
        inCol(it.x, col) &&
        it.str !== ':' &&
        it.str !== '-' &&
        it.str.length > 1,
    );
    if (val) return val.str.trim();
  }
  return pickInBand(items, 116, 121, kind, (s) => s.length > 2 && s !== ':' && s !== '-');
}

function isBlankManifestPort(raw: string): boolean {
  const s = raw.trim();
  return !s || s === '-' || s === '—' || /^[-–—:\s]+$/.test(s);
}

/** POD: transhipment if it matches a known port, else discharge if it matches. */
function resolveCmaPodPort(
  transhipmentRaw: string,
  dischargeRaw: string,
  ports: readonly Port[],
): string {
  if (!isBlankManifestPort(transhipmentRaw)) {
    const matched = resolveManifestPortName(transhipmentRaw, ports);
    if (matched) return matched;
  }
  if (!isBlankManifestPort(dischargeRaw)) {
    return resolveManifestPortName(dischargeRaw, ports);
  }
  return '';
}

function resolveCmaPodForPage(
  items: DgPdfTextItem[],
  page: number,
  ports: readonly Port[],
): string {
  const pageItems = items.filter((it) => it.page === page);
  if (!pageItems.length) return '';
  const transRaw = findPortValue(pageItems, 'transhipmentPort');
  const disRaw = findDischargePort(pageItems);
  return resolveCmaPodPort(transRaw, disRaw, ports);
}

function pagesWithContainerNumbers(items: DgPdfTextItem[]): Set<number> {
  const pages = new Set<number>();
  for (const it of items) {
    if (!inCol(it.x, COL.containerNo)) continue;
    if (!CONTAINER_RE.test(it.str.trim())) continue;
    pages.add(it.page);
  }
  return pages;
}

function resolveCmaImportPorts(
  items: DgPdfTextItem[],
  ports: readonly Port[],
): { pol: string; pod: string } {
  const loadRaw = findPortValue(items, 'loadPort');
  const transRaw = findPortValue(items, 'transhipmentPort');
  const disRaw = findDischargePort(items);
  return {
    pol: resolveManifestPortName(loadRaw, ports),
    pod: resolveCmaPodPort(transRaw, disRaw, ports),
  };
}

function pickInBand(
  items: DgPdfTextItem[],
  yMin: number,
  yMax: number,
  col: keyof typeof COL,
  pred: (s: string) => boolean,
): string {
  for (const it of items) {
    if (it.y < yMin || it.y > yMax) continue;
    if (!inCol(it.x, COL[col])) continue;
    if (!pred(it.str)) continue;
    return it.str.trim();
  }
  return '';
}

function parseCmaCargoRows(
  items: DgPdfTextItem[],
  importPorts: { pol: string; pod: string },
  ports: readonly Port[],
): { rows: Partial<Omit<DgManifestRow, 'id'>>[]; warnings: string[] } {
  const warnings: string[] = [];
  const classItems = items
    .filter(
      (it) =>
        inCol(it.x, COL.imdgClass) &&
        IMDG_CLASS_RE.test(it.str) &&
        it.y >= 200 &&
        !/^imdg$/i.test(it.str),
    )
    .sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);

  if (!classItems.length) {
    warnings.push('No cargo rows found.');
    return { rows: [], warnings };
  }

  const pagePodByPage = new Map<number, string>();
  for (const page of pagesWithContainerNumbers(items)) {
    const pod = resolveCmaPodForPage(items, page, ports);
    if (pod) pagePodByPage.set(page, pod);
  }

  let lastContainer = '';
  let lastType = '';
  const pol = importPorts.pol;
  let lastPod = importPorts.pod;
  const containerPod = new Map<string, string>();

  const rows: Partial<Omit<DgManifestRow, 'id'>>[] = [];

  for (const classItem of classItems) {
    const y = classItem.y;
    const page = classItem.page;
    const explicitContainer = pickNearY(items, y, 'containerNo', page, (s) => CONTAINER_RE.test(s));
    const container = explicitContainer || lastContainer;
    const isoType =
      pickNearY(items, y, 'isoType', page, (s) => ISO_TYPE_RE.test(s)) || lastType;
    if (container) lastContainer = container;
    if (isoType) lastType = isoType;

    let pod = lastPod;
    if (explicitContainer && pagePodByPage.has(page)) {
      pod = pagePodByPage.get(page)!;
      containerPod.set(explicitContainer, pod);
      lastPod = pod;
    } else if (container && containerPod.has(container)) {
      pod = containerPod.get(container)!;
    }

    const unNo = pickNearY(items, y, 'unNo', page, (s) => UN_NO_RE.test(s));
    const netRaw = pickNearY(items, y, 'netWeight', page, (s) => /[\d,]/.test(s));
    const properShippingName = pickNearY(
      items,
      y,
      'properName',
      page,
      (s) => s.length > 2 && !/^\(\d\)$/.test(s),
    );
    const stowage = pickNearY(items, y, 'stowage', page, (s) => s.length > 0);
    const flashPoint = pickFlashPoint(items, y, page);
    const mpLq = parseImportedMpLq(items, y, page);

    if (!unNo) {
      warnings.push(`Skipped class ${classItem.str} row (no UN-No.).`);
      continue;
    }

    rows.push({
      pol,
      pod,
      type: isoType.toUpperCase(),
      containerNo: container,
      stowage,
      dgClass: formatDgClass(classItem.str),
      unNo,
      mpLq,
      flashPoint,
      weightKg: formatImportedWeight(netRaw),
      properShippingName,
    });
  }

  return { rows, warnings };
}

function formatDgClass(raw: string): string {
  const s = raw.trim();
  if (/^\d+\.\d+$/.test(s)) return s.replace('.', ',');
  return s;
}

function pickFlashPoint(items: DgPdfTextItem[], classY: number, page: number): string {
  for (const delta of [22, 20, 24, 18, 26, 16, 28, 30]) {
    for (const it of items) {
      if (it.page !== page) continue;
      if (Math.abs(it.y - (classY + delta)) > 2) continue;
      if (!inCol(it.x, COL.flashPoint)) continue;
      const s = it.str.trim();
      if (FLASH_POINT_VALUE_RE.test(s)) return s;
    }
  }
  return '';
}

function parseImportedMpLq(items: DgPdfTextItem[], classY: number, page: number): string {
  let hasMp = false;
  let hasLq = false;

  for (const it of items) {
    if (it.page !== page) continue;
    // Fields (4)/(5) sit below the IMDG class row — ignore page legend (1)–(8) at the top.
    if (it.y < classY + 10 || it.y > classY + 120) continue;
    if (!inCol(it.x, COL.fieldBlock)) continue;

    const s = it.str.trim();
    if (!s || /^\(\d+\)$/.test(s)) continue;
    if (/^\(\d+\)\s*Limited Quantity or Excepted Quantity$/i.test(s)) continue;

    if (/Marine Pollutant/i.test(s)) hasMp = true;
    if (/Limited Quantity|Excepted Quantity/i.test(s)) hasLq = true;
  }

  const parts: string[] = [];
  if (hasMp) parts.push('MP');
  if (hasLq) parts.push('LQ');
  return parts.join(' ');
}

function formatImportedWeight(raw: string): string {
  if (!raw) return '';
  return formatDgWeightKgDisplay(raw) || raw.trim();
}

const MONTH: Record<string, string> = {
  JAN: '01',
  FEB: '02',
  MAR: '03',
  APR: '04',
  MAY: '05',
  JUN: '06',
  JUL: '07',
  AUG: '08',
  SEP: '09',
  OCT: '10',
  NOV: '11',
  DEC: '12',
};

/** 25-MAY-26 → 2026-05-25 */
function parseManifestDateToIso(raw: string): string {
  const m = raw.trim().match(/^(\d{1,2})-([A-Z]{3})-(\d{2})$/i);
  if (!m) return raw.trim();
  const day = m[1].padStart(2, '0');
  const mon = MONTH[m[2].toUpperCase()];
  if (!mon) return raw.trim();
  const year = `20${m[3]}`;
  return `${year}-${mon}-${day}`;
}