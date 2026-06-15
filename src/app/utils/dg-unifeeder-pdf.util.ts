import type { DgPdfTextItem } from './dg-pdf-text.util';

export type UnifeederPdfFormat = 'unifeeder-dg' | 'unknown';

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
}

const MONTHS: Record<string, string> = {
  january: '01',
  february: '02',
  march: '03',
  april: '04',
  may: '05',
  june: '06',
  july: '07',
  august: '08',
  september: '09',
  october: '10',
  november: '11',
  december: '12',
};

const CONTAINER_RAW_RE = /^[A-Z]{4}\s*[\d\s-]{6,12}$/i;
const ISO_SIZE_RE = /^[0-9]{2}[A-Z0-9]{2,3}$/i;
const SAILING_DATE_RE = /^\d{1,2}-[a-z]+-\d{4}$/i;
const EU_WEIGHT_RE = /^\d{1,3}(?:\.\d{3})*,\d{2}$/;
const PORT_SLASH_RE = /^[A-Z][A-Z\s-]+\/[A-Z0-9][A-Z0-9\s-]+$/i;

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

function pickNameNear(
  items: readonly DgPdfTextItem[],
  anchorX: number,
  targetY: number,
): string {
  let best = '';
  for (const it of items) {
    if (!nearY(it, targetY, 4)) continue;
    if (it.x < anchorX - 5 || it.x > anchorX + 95) continue;
    const value = it.str.trim();
    if (value.length < 4) continue;
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
  const value = raw.trim();
  if (!value || value === '/ / /' || value === '—') return '';
  return value;
}

function normalizeMarinePollutant(raw: string): string {
  const value = raw.trim().toUpperCase();
  if (value === 'NO' || value === 'N') return '';
  return value;
}

function isRealPortSlash(raw: string): boolean {
  if (!PORT_SLASH_RE.test(raw)) return false;
  const left = extractUnifeederPortName(raw).toUpperCase();
  const right = raw.split('/').slice(1).join('/').trim().toUpperCase();
  if (!left || left.length < 3) return false;
  if (left === 'POL' || left === 'POD') return false;
  if (right === 'TERMINAL') return false;
  return true;
}

function parseHeaderFromPage(items: readonly DgPdfTextItem[]): Partial<UnifeederImportHeader> {
  const sailing = items.find((it) => SAILING_DATE_RE.test(it.str));
  const slashPorts = [
    ...new Set(
      items
        .filter((it) => isRealPortSlash(it.str))
        .map((it) => it.str.trim()),
    ),
  ];
  let polRaw = '';
  if (sailing) {
    polRaw =
      items.find(
        (it) =>
          it.y === sailing.y &&
          isRealPortSlash(it.str),
      )?.str ?? '';
  }
  if (!polRaw && slashPorts.length) {
    polRaw = slashPorts[0];
  }
  const podRaw = slashPorts.find((p) => p !== polRaw) ?? '';

  const voyage = items.find((it) => nearY(it, 511, 2) && /^\d{2,4}$/.test(it.str))?.str ?? '';
  const vessel = items.find((it) => nearY(it, 511, 2) && /^[A-Z][A-Z\s-]{2,}$/.test(it.str))?.str ?? '';

  return {
    portOfDeparture: extractUnifeederPortName(polRaw),
    portOfArrival: extractUnifeederPortName(podRaw),
    departureDate: sailing ? parseUnifeederManifestDate(sailing.str) : '',
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
    { min: 0, max: 250 },
  ];
  for (const band of xBands) {
    for (const delta of [0, -4, 4, -6, 6, -8, 8]) {
      for (const it of items) {
        if (!nearY(it, targetY + delta, yTol)) continue;
        if (it.x < band.min || it.x > band.max) continue;
        const value = it.str.trim();
        if (pred(value)) return value;
      }
    }
  }
  return '';
}

function parsePageRows(
  items: readonly DgPdfTextItem[],
  loadPort: string,
  dischargePort: string,
): UnifeederImportRowPartial[] {
  const imoRow = items.find((it) => it.str === 'IMO Information');
  if (!imoRow) return [];

  const imoY = imoRow.y;
  const size = pickLeftColumnField(items, imoY + IMO.size, (value) => ISO_SIZE_RE.test(value));
  const containerRaw = pickLeftColumnField(
    items,
    imoY + IMO.containerNo,
    (value) => CONTAINER_RAW_RE.test(value),
  );
  const containerNo = normalizeUnifeederContainerNo(containerRaw);
  const stow =
    items.find(
      (it) =>
        nearY(it, imoY + IMO.stowage, 3) &&
        it.x >= 90 &&
        it.x <= 130 &&
        /^\d{4,6}$/.test(it.str),
    )?.str.trim() ??
    pickLeftColumnField(items, imoY + IMO.stowage, (value) => /^\d{4,6}$/.test(value));

  const unAnchors = items
    .filter(
      (it) =>
        nearY(it, imoY + IMO.unNo, 4) &&
        /^\d{4}$/.test(it.str) &&
        it.x >= 120,
    )
    .sort((a, b) => a.x - b.x);

  if (!unAnchors.length) return [];

  const rows: UnifeederImportRowPartial[] = [];
  for (const anchor of unAnchors) {
    const ax = anchor.x;
    const ty = imoY;
    const dgClass = pickNear(items, ax, ty + IMO.class, (v) => /^\d+(?:\.\d+)?$/.test(v));
    const unNo = anchor.str.trim();
    const packingGroup = normalizePackingGroup(
      pickNear(
        items,
        ax,
        ty + IMO.group,
        (v) => v === '--' || /^[I]{1,3}$|^II$|^III$|^\d+\s*\/\s*[A-Z0-9]+$/i.test(v),
      ),
    );
    const fire = pickNear(items, ax, ty + IMO.fire, (v) => /^F-[A-Z]$/i.test(v));
    const spillage = pickNear(items, ax, ty + IMO.spillage, (v) => /^S-[A-Z]$/i.test(v));
    const weightKg = pickNear(items, ax, ty + IMO.nweight, (v) => EU_WEIGHT_RE.test(v));
    const flashPoint = pickNear(
      items,
      ax,
      ty + IMO.flashpoint,
      (v) => v.length > 0 && !/^flashpoint$/i.test(v),
      30,
      6,
    );
    const goodsDescription = pickNameNear(items, ax, ty + IMO.properName);
    const marinePollutant = normalizeMarinePollutant(
      pickNear(items, ax, ty + IMO.marinePollutant, (v) => /^(YES|NO)$/i.test(v), 40, 4) ||
        items.find(
          (it) =>
            nearY(it, ty + IMO.marinePollutant, 4) &&
            it.x >= ax + 20 &&
            it.x <= ax + 50 &&
            /^(YES|NO)$/i.test(it.str),
        )?.str ||
        '',
    );
    const subRisk = normalizeSubRisk(
      items.find(
        (it) =>
          nearY(it, ty + IMO.subRisk, 4) &&
          it.x >= ax + 45 &&
          it.x <= ax + 80 &&
          it.str.trim().length > 0,
      )?.str ?? '',
    );

    rows.push({
      size,
      stow,
      containerNo,
      loadPort,
      dischargePort,
      unNo,
      packingGroup,
      weightKg,
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

export function parseUnifeederDangerousCargoManifest(
  items: readonly DgPdfTextItem[],
): UnifeederPdfParseResult {
  const joined = items.map((i) => i.str).join(' ');
  if (!/Dangerous Cargo Manifest/i.test(joined) || !/IMO Information/i.test(joined)) {
    return {
      format: 'unknown',
      warnings: ['Unrecognized PDF format (expected UNIFEEDER Dangerous Cargo Manifest).'],
      header: {},
      rows: [],
    };
  }

  const warnings: string[] = [];
  const pages = [...new Set(items.map((i) => i.page))].sort((a, b) => a - b);
  const header = parseHeaderFromPage(items.filter((i) => i.page === pages[0]));
  const loadPort = header.portOfDeparture ?? '';
  const dischargePort = header.portOfArrival ?? '';

  const rows: UnifeederImportRowPartial[] = [];
  for (const page of pages) {
    const pageItems = items.filter((i) => i.page === page);
    if (!pageItems.some((it) => it.str === 'IMO Information')) continue;
    const pageRows = parsePageRows(pageItems, loadPort, dischargePort);
    if (!pageRows.length) {
      warnings.push(`Page ${page}: no DG cargo rows found.`);
      continue;
    }
    rows.push(...pageRows);
  }

  if (!rows.length) {
    warnings.unshift('No UNIFEEDER cargo rows extracted from PDF.');
  }

  return {
    format: 'unifeeder-dg',
    warnings,
    header,
    rows,
  };
}
