import {
  type DgManifestFormSettings,
  type DgManifestRow,
  commitDgWeightKgInput,
} from '../models/dg-manifest.models';
import { resolveManifestPortName, type Port } from '../models/crew.models';
import type { DgPdfTextItem } from './dg-pdf-text.util';

/** CMA CGM PFR0767 v5.x "Dangerous Cargo List" — measured column X ranges (pt). */
const LIST_COL = {
  containerNo: [12, 78] as const,
  isoType: [78, 118] as const,
  stowage: [195, 245] as const,
  properName: [255, 450] as const,
  grossWeight: [478, 525] as const,
  netWeight: [538, 575] as const,
  imdgClass: [562, 588] as const,
  unNo: [585, 615] as const,
  fieldBlock: [245, 450] as const,
  packing: [724, 820] as const,
};

const CONTAINER_RE = /^[A-Z]{4}\d{7}$/;
const ISO_TYPE_RE = /^[0-9]{2}[A-Z0-9]{2,3}$/i;
const IMDG_CLASS_RE = /^\d+(?:\.\d+)?$/;
const UN_NO_RE = /^\d{4}$/;
const FLASH_POINT_VALUE_RE = /^-?\d+(?:\.\d+)?\s*°C$/i;

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

function inListCol(x: number, col: keyof typeof LIST_COL): boolean {
  const range = LIST_COL[col];
  return x >= range[0] && x <= range[1];
}

function nearY(item: DgPdfTextItem, y: number, tol = 2): boolean {
  return Math.abs(item.y - y) <= tol;
}

function isBlankPort(raw: string): boolean {
  const s = raw.trim();
  return !s || s === '-' || s === '—' || /^[-–—:\s]+$/.test(s);
}

function parseListDateToIso(raw: string): string {
  const m = raw.trim().match(/^(\d{1,2})-([A-Z]{3})-(\d{2})$/i);
  if (!m) return raw.trim();
  const day = m[1].padStart(2, '0');
  const mon = MONTH[m[2].toUpperCase()];
  if (!mon) return raw.trim();
  return `20${m[3]}-${mon}-${day}`;
}

function formatDgClass(raw: string): string {
  const s = raw.trim();
  if (/^\d+\.\d+$/.test(s)) return s.replace('.', ',');
  return s;
}

function findListLabelValue(items: readonly DgPdfTextItem[], label: string): string {
  const labelItem = items.find((it) => it.str === label);
  if (!labelItem) return '';
  const candidates = items
    .filter(
      (it) =>
        it.page === labelItem.page &&
        nearY(it, labelItem.y, 4) &&
        it.x > labelItem.x + 15 &&
        it.str !== ':' &&
        it.str !== label,
    )
    .sort((a, b) => a.x - b.x);
  return candidates[0]?.str.trim() ?? '';
}

function findListPortValue(items: readonly DgPdfTextItem[], label: string): string {
  const labelItem = items.find((it) => it.str === label);
  if (!labelItem) return '';
  const val = items.find(
    (it) =>
      it.page === labelItem.page &&
      nearY(it, labelItem.y, 3) &&
      it.x > labelItem.x + 30 &&
      it.str !== ':' &&
      it.str.length > 1 &&
      !/Port$/i.test(it.str),
  );
  return val?.str.trim() ?? '';
}

function resolveListPod(
  transhipmentRaw: string,
  dischargeRaw: string,
  ports: readonly Port[],
): string {
  if (!isBlankPort(transhipmentRaw)) {
    const matched = resolveManifestPortName(transhipmentRaw, ports);
    if (matched) return matched;
  }
  if (!isBlankPort(dischargeRaw)) {
    return resolveManifestPortName(dischargeRaw, ports);
  }
  return '';
}

function pickListAtY(
  items: readonly DgPdfTextItem[],
  y: number,
  col: keyof typeof LIST_COL,
  page: number,
  pred?: (s: string) => boolean,
  yTol = 2,
): string {
  for (const it of items) {
    if (it.page !== page) continue;
    if (!nearY(it, y, yTol) || !inListCol(it.x, col)) continue;
    if (pred && !pred(it.str.trim())) continue;
    return it.str.trim();
  }
  return '';
}

function parseListHeader(
  items: readonly DgPdfTextItem[],
  ports: readonly Port[],
): Partial<Omit<DgManifestFormSettings, 'rows'>> {
  const loadRaw = findListPortValue(items, 'Load Port');
  const transRaw = findListPortValue(items, 'Transhipment Port');
  const disRaw = findListPortValue(items, 'Discharge Port');
  const arrivalRaw = !isBlankPort(transRaw) ? transRaw : disRaw;

  const vesselName = findListLabelValue(items, 'Vessel');
  const voyage = findListLabelValue(items, 'Voyage');
  const callSign = findListLabelValue(items, 'Call Sign');
  const etd = findListLabelValue(items, 'ETD');

  const vesselDisplay =
    vesselName && callSign
      ? `m/v "${vesselName}" / ${callSign}`
      : vesselName || callSign || '';

  return {
    vesselDisplay,
    voyageNumber: voyage,
    portOfDeparture: resolveManifestPortName(loadRaw, ports) || loadRaw.toUpperCase(),
    portOfArrival: resolveManifestPortName(arrivalRaw, ports) || arrivalRaw.toUpperCase(),
    departureDate: parseListDateToIso(etd),
  };
}

function listContainerAnchors(items: readonly DgPdfTextItem[]): DgPdfTextItem[] {
  return items
    .filter(
      (it) =>
        inListCol(it.x, 'containerNo') &&
        CONTAINER_RE.test(it.str.trim()) &&
        it.y >= 240,
    )
    .sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);
}

function listCargoDataRows(
  items: readonly DgPdfTextItem[],
): { page: number; dataY: number }[] {
  const keys = new Set<string>();
  const rows: { page: number; dataY: number }[] = [];

  for (const it of items) {
    if (it.y < 240) continue;
    if (!inListCol(it.x, 'unNo') || !UN_NO_RE.test(it.str.trim())) continue;

    const dataY = it.y;
    const page = it.page;
    const key = `${page}:${dataY}`;
    if (keys.has(key)) continue;

    const dgClass = pickListAtY(items, dataY, 'imdgClass', page, (s) => IMDG_CLASS_RE.test(s));
    const netRaw = pickListAtY(items, dataY, 'netWeight', page, (s) => /^[\d.]+$/.test(s));
    if (!dgClass || !netRaw) continue;

    keys.add(key);
    rows.push({ page, dataY });
  }

  return rows.sort((a, b) => a.page - b.page || a.dataY - b.dataY);
}

function containersByPage(
  items: readonly DgPdfTextItem[],
): Map<number, DgPdfTextItem[]> {
  const map = new Map<number, DgPdfTextItem[]>();
  for (const anchor of listContainerAnchors(items)) {
    const list = map.get(anchor.page) ?? [];
    list.push(anchor);
    map.set(anchor.page, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.y - b.y);
  }
  return map;
}

function resolveListContainerForCargo(
  pageContainers: readonly DgPdfTextItem[],
  dataY: number,
  lastContainer: DgPdfTextItem | null,
): DgPdfTextItem | null {
  const onPage = pageContainers.filter((c) => c.y <= dataY + 1);
  if (onPage.length) return onPage[onPage.length - 1];
  return lastContainer;
}

function pickListFlashPointForCargo(
  items: readonly DgPdfTextItem[],
  dataY: number,
  page: number,
): string {
  for (const delta of [20, 22, 24, 18, 26, 16, 28, 30]) {
    for (const it of items) {
      if (it.page !== page) continue;
      if (Math.abs(it.y - (dataY + delta)) > 2) continue;
      if (!inListCol(it.x, 'fieldBlock')) continue;
      const s = it.str.trim();
      if (FLASH_POINT_VALUE_RE.test(s)) return s;
      if (/^\d+(?:\.\d+)?$/.test(s) && delta >= 20) return `${s} °C`;
    }
  }
  return '';
}

function parseListMpLqForCargo(
  items: readonly DgPdfTextItem[],
  dataY: number,
  page: number,
): string {
  let hasMp = false;
  let hasLq = false;

  for (const it of items) {
    if (it.page !== page) continue;
    if (it.y < dataY - 5 || it.y > dataY + 90) continue;
    if (!inListCol(it.x, 'fieldBlock')) continue;

    const s = it.str.trim();
    if (!s || /^\(\d+\)$/.test(s)) continue;
    if (/Marine Pollutant/i.test(s)) hasMp = true;
    if (/Limited Quantity|Excepted Quantity/i.test(s)) hasLq = true;
  }

  if (!hasLq) {
    const lqMark = items.find(
      (it) =>
        it.page === page &&
        nearY(it, dataY, 2) &&
        it.x >= 715 &&
        it.x <= 730 &&
        /^x$/i.test(it.str),
    );
    if (lqMark) hasLq = true;
  }

  const parts: string[] = [];
  if (hasMp) parts.push('MP');
  if (hasLq) parts.push('LQ');
  return parts.join(' ');
}

function buildListCargoRow(
  items: readonly DgPdfTextItem[],
  page: number,
  dataY: number,
  container: DgPdfTextItem,
  pol: string,
  pod: string,
  fallbackIsoType = '',
): Partial<Omit<DgManifestRow, 'id'>> | null {
  const containerNo = container.str.trim();
  const isoType =
    pickListAtY(items, container.y, 'isoType', container.page, (s) => ISO_TYPE_RE.test(s)) ||
    fallbackIsoType;
  const unNo = pickListAtY(items, dataY, 'unNo', page, (s) => UN_NO_RE.test(s));
  const dgClassRaw = pickListAtY(items, dataY, 'imdgClass', page, (s) => IMDG_CLASS_RE.test(s));
  const netRaw = pickListAtY(items, dataY, 'netWeight', page, (s) => /^[\d.]+$/.test(s));
  const properShippingName = pickListAtY(
    items,
    dataY - 1,
    'properName',
    page,
    (s) => s.length > 2 && !/^\(\d+\)$/.test(s),
  );
  const stowage = pickListAtY(items, container.y, 'stowage', page, (s) => /^\d{4,6}$/.test(s));

  if (!unNo || !dgClassRaw) return null;

  return {
    pol,
    pod,
    type: isoType.toUpperCase(),
    containerNo,
    stowage,
    dgClass: formatDgClass(dgClassRaw),
    unNo,
    mpLq: parseListMpLqForCargo(items, dataY, page),
    flashPoint: pickListFlashPointForCargo(items, dataY, page),
    weightKg: netRaw ? commitDgWeightKgInput(netRaw) : '',
    properShippingName,
  };
}

export function isCmaCargoListPdf(items: readonly DgPdfTextItem[]): boolean {
  const joined = items.map((it) => it.str).join(' ');
  return /Dangerous Cargo List/i.test(joined) && /PFR0767 v/i.test(joined);
}

export function parseCmaCargoList(
  items: readonly DgPdfTextItem[],
  ports: readonly Port[] = [],
): {
  header: Partial<Omit<DgManifestFormSettings, 'rows'>>;
  rows: Partial<Omit<DgManifestRow, 'id'>>[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const header = parseListHeader(items, ports);

  const loadRaw = findListPortValue(items, 'Load Port');
  const transRaw = findListPortValue(items, 'Transhipment Port');
  const disRaw = findListPortValue(items, 'Discharge Port');
  const pol = resolveManifestPortName(loadRaw, ports);
  const pod = resolveListPod(transRaw, disRaw, ports);

  const cargoRows = listCargoDataRows(items);
  if (!cargoRows.length) {
    warnings.push('No cargo rows found.');
    return { header, rows: [], warnings };
  }

  const pageContainers = containersByPage(items);
  const maxPage = Math.max(...cargoRows.map((row) => row.page));
  let lastContainer: DgPdfTextItem | null = null;
  let lastIsoType = '';
  const rows: Partial<Omit<DgManifestRow, 'id'>>[] = [];

  for (let page = 1; page <= maxPage; page++) {
    const containers = pageContainers.get(page) ?? [];
    const pageCargo = cargoRows.filter((row) => row.page === page);

    for (const cargo of pageCargo) {
      const container = resolveListContainerForCargo(containers, cargo.dataY, lastContainer);
      if (!container) {
        warnings.push(`Skipped cargo on page ${page} (no container).`);
        continue;
      }
      lastContainer = container;

      const isoOnPage = pickListAtY(items, container.y, 'isoType', container.page, (s) =>
        ISO_TYPE_RE.test(s),
      );
      if (isoOnPage) lastIsoType = isoOnPage;

      const row = buildListCargoRow(
        items,
        page,
        cargo.dataY,
        container,
        pol,
        pod,
        lastIsoType,
      );
      if (!row) {
        warnings.push(`Skipped cargo on page ${page} (incomplete row).`);
        continue;
      }
      rows.push(row);
    }
  }

  return { header, rows, warnings };
}
