import {
  resolveDgWeightTonnageOptions,
  type DgWeightTonnageOptions,
} from '../models/dg-weight-tonnage.models';
import type { DgPdfTextItem } from './dg-pdf-text.util';
import { pickBestGoodsDescription } from './dg-goods-description.util';
import type { UnifeederImportHeader, UnifeederImportRowPartial } from './dg-unifeeder-pdf.util';
import { dualWeightFromImport } from './dg-weight-tonnage.util';
import { coerceIsoDate } from './date.util';
import { normalizeManifestSizeCode } from './iso-container-type.util';


function normalizeContainerNo(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '').replace(/-/g, '');
}

function normalizeSizeCode(raw: string): string {
  const s = normalizeManifestSizeCode(raw);
  if (!s) return '';
  if (/^[0-9]{2}[A-Z0-9]{2,3}$/i.test(s)) return s;
  if (/^[A-Z][0-9][A-Z0-9]{2,3}$/i.test(s)) return s;
  return s;
}

function parseManifestDate(raw: string): string {
  return coerceIsoDate(raw);
}

function extractPortName(raw: string): string {
  const part = raw.split('/')[0]?.trim() ?? '';
  return part.replace(/\s+/g, ' ');
}

function extractTerminalHint(raw: string): string {
  const slash = raw.indexOf('/');
  if (slash < 0) return '';
  return raw
    .slice(slash + 1)
    .trim()
    .replace(/\s+/g, ' ');
}

/** European weights; PDF may use space or dot thousands (`2 125,08` / `2.125,08`). */
const EU_WEIGHT_RE = /^\d{1,3}(?:[.\s]\d{3})*,\d{2}$/;
const CONTAINER_RAW_RE = /^[A-Z]{4}\s*[\d\s-]{6,12}$/i;
const ISO_SIZE_RE = /^[0-9]{2}[A-Z0-9]{2,3}$/i;
const LETTER_SIZE_RE = /^[A-Z][0-9][A-Z0-9]{2,3}$/i;
const SAILING_DATE_RE = /^\d{1,2}-[a-z]+-\d{4}$/i;
const PORT_SLASH_RE = /^[A-Za-z][A-Za-z\s.-]{2,}\/.+$/;

/** Y offsets from the "IMO Information" row (compact DP WORLD table layout). */
const DP_IMO = {
  size: -24,
  containerNo: -24,
  stowage: -12,
  dataRow: 28,
  properName: 41,
  marinePollutant: 62,
  subRisk: 86,
} as const;

/** Fixed X columns on the cargo data row (y = imoY + dataRow). */
const DP_COL = {
  class: 84,
  unNo: 126,
  group: 223,
  fire: 309,
  spillage: 344,
  gweight: 419,
  nweight: 463,
  flashpoint: 512,
} as const;

/** Offsets below each cargo data row (UN/class/weight line). */
const DP_DATA = {
  properName: 13,
  marinePollutant: 34,
  subRisk: 58,
} as const;

function nearY(item: DgPdfTextItem, y: number, tol = 3): boolean {
  return Math.abs(item.y - y) <= tol;
}

function pickAtRowCol(
  items: readonly DgPdfTextItem[],
  rowY: number,
  colX: number,
  pred: (value: string) => boolean,
  xTol = 28,
  yTol = 4,
): string {
  let best = '';
  let bestScore = Number.POSITIVE_INFINITY;
  for (const it of items) {
    if (!nearY(it, rowY, yTol)) continue;
    const xDist = Math.abs(it.x - colX);
    if (xDist > xTol) continue;
    const value = it.str.trim();
    if (!pred(value)) continue;
    const score = xDist;
    if (score < bestScore) {
      bestScore = score;
      best = value;
    }
  }
  return best;
}

function pickLeftField(
  items: readonly DgPdfTextItem[],
  targetY: number,
  pred: (value: string) => boolean,
): string {
  let best = '';
  let bestDist = Number.POSITIVE_INFINITY;
  for (const it of items) {
    if (it.x > 220) continue;
    const value = it.str.trim();
    if (!pred(value)) continue;
    const dist = Math.abs(it.y - targetY);
    if (dist > 5) continue;
    if (dist < bestDist) {
      bestDist = dist;
      best = value;
    }
  }
  return best;
}

function normalizePackingGroup(raw: string): string {
  const value = raw.trim();
  if (!value || value === '--' || value === '—') return '';
  return value;
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
  const left = extractPortName(value).toUpperCase();
  if (!left || left.length < 3) return false;
  if (left === 'POL' || left === 'POD') return false;
  return true;
}

function findLabelValueOnRow(
  items: readonly DgPdfTextItem[],
  label: string,
  pred: (value: string) => boolean,
): string {
  const labels = items.filter((it) => it.str.trim() === label);
  let best = '';
  let bestScore = Number.POSITIVE_INFINITY;
  for (const labelItem of labels) {
    for (const it of items) {
      if (!pred(it.str.trim())) continue;
      if (it.x <= labelItem.x + 5) continue;
      const yDist = Math.abs(it.y - labelItem.y);
      if (yDist > 6) continue;
      const score = yDist + Math.abs(it.x - labelItem.x) * 0.1;
      if (score < bestScore) {
        bestScore = score;
        best = it.str.trim();
      }
    }
  }
  return best;
}

/** True when cargo fields sit below "IMO Information" (DP WORLD compact layout). */
export function isDpWorldManifestLayout(items: readonly DgPdfTextItem[]): boolean {
  const page1 = items.filter((i) => i.page === 1);
  const imo = page1.find((i) => i.str === 'IMO Information');
  if (!imo) return false;
  return page1.some((i) => /^\d{4}$/.test(i.str.trim()) && i.y > imo.y + 12 && i.y < imo.y + 45);
}

export function parseDpWorldHeaderFromPage(
  items: readonly DgPdfTextItem[],
): Partial<UnifeederImportHeader> {
  const polRaw = findLabelValueOnRow(items, 'POL/TERMINAL', isRealPortSlash);
  const podRaw = findLabelValueOnRow(items, 'POD/TERMINAL', isRealPortSlash);
  const sailingRaw =
    findLabelValueOnRow(items, 'POL SAILING DATE', (v) => SAILING_DATE_RE.test(v)) ||
    items.find((it) => SAILING_DATE_RE.test(it.str))?.str ||
    '';
  const voyage =
    findLabelValueOnRow(items, 'VOY NO.', (v) => /^\d{2,4}$/.test(v)) ||
    findLabelValueOnRow(items, 'VOY NO', (v) => /^\d{2,4}$/.test(v));
  const vessel =
    findLabelValueOnRow(
      items,
      'VESSEL',
      (v) => /^[A-Z][A-Z0-9\s-]{2,}$/i.test(v) && !SAILING_DATE_RE.test(v),
    ) || '';

  return {
    portOfDeparture: extractPortName(polRaw),
    portOfArrival: extractPortName(podRaw),
    terminalOfDeparture: extractTerminalHint(polRaw),
    terminalOfArrival: extractTerminalHint(podRaw),
    departureDate: sailingRaw ? parseManifestDate(sailingRaw) : '',
    voyageNumber: voyage,
    vesselName: vessel.trim(),
  };
}

interface DpWorldColumnPositions {
  class: number;
  unNo: number;
  group: number;
  fire: number;
  spillage: number;
  gweight: number;
  nweight: number;
  flashpoint: number;
}

function resolveDpWorldColumns(
  pageItems: readonly DgPdfTextItem[],
  imoY: number,
): DpWorldColumnPositions {
  const headerY = imoY + 13;
  const findHeader = (label: string, fallback: number): number => {
    const hit = pageItems.find(
      (it) => nearY(it, headerY, 8) && it.str.trim().toLowerCase() === label.toLowerCase(),
    );
    return hit?.x ?? fallback;
  };
  return {
    class: DP_COL.class,
    unNo: DP_COL.unNo,
    group: DP_COL.group,
    fire: DP_COL.fire,
    spillage: DP_COL.spillage,
    gweight: findHeader('gweight', DP_COL.gweight),
    nweight: findHeader('nweight', DP_COL.nweight),
    flashpoint: findHeader('flashpoint', DP_COL.flashpoint),
  };
}

function findAllDataRowYs(pageItems: readonly DgPdfTextItem[], imoY: number): number[] {
  return [
    ...new Set(
      pageItems
        .filter(
          (it) =>
            /^\d{4}$/.test(it.str.trim()) &&
            it.x >= 90 &&
            it.x <= 200 &&
            it.y > imoY + 10 &&
            it.y < imoY + 420,
        )
        .map((it) => it.y),
    ),
  ].sort((a, b) => a - b);
}

function pickGoodsDescription(pageItems: readonly DgPdfTextItem[], dataY: number): string {
  const properY = dataY + DP_DATA.properName;
  const candidates: { str: string; x: number }[] = [];
  for (const it of pageItems) {
    if (!nearY(it, properY, 5)) continue;
    if (it.x < 100 || it.x > 520) continue;
    candidates.push({ str: it.str, x: it.x });
  }
  return pickBestGoodsDescription(candidates);
}

function pickRowWeight(
  pageItems: readonly DgPdfTextItem[],
  dataY: number,
  cols: DpWorldColumnPositions,
  useGrossWeight: boolean,
): string {
  const primary = useGrossWeight ? cols.gweight : cols.nweight;
  const fallback = useGrossWeight ? cols.nweight : cols.gweight;
  let weightKg = pickAtRowCol(pageItems, dataY, primary, (v) => EU_WEIGHT_RE.test(v));
  if (!weightKg) {
    weightKg = pickAtRowCol(pageItems, dataY, fallback, (v) => EU_WEIGHT_RE.test(v));
  }
  if (!weightKg) {
    for (const it of pageItems) {
      if (!nearY(it, dataY, 4)) continue;
      if (it.x < 380) continue;
      if (!EU_WEIGHT_RE.test(it.str)) continue;
      weightKg = it.str.trim();
      break;
    }
  }
  return weightKg;
}

function findUnAnchorsOnDataRow(
  pageItems: readonly DgPdfTextItem[],
  dataY: number,
): DgPdfTextItem[] {
  return pageItems
    .filter(
      (it) => nearY(it, dataY, 4) && /^\d{4}$/.test(it.str.trim()) && it.x >= 90 && it.x <= 200,
    )
    .sort((a, b) => a.x - b.x);
}

function parseDpWorldDataRow(
  pageItems: readonly DgPdfTextItem[],
  dataY: number,
  cols: DpWorldColumnPositions,
  containerNo: string,
  size: string,
  stow: string,
  loadPort: string,
  dischargePort: string,
  useGrossWeight: boolean,
  loadTerminal = '',
  dischargeTerminal = '',
): UnifeederImportRowPartial[] {
  const unAnchors = findUnAnchorsOnDataRow(pageItems, dataY);
  if (!unAnchors.length) return [];

  const rows: UnifeederImportRowPartial[] = [];
  for (const anchor of unAnchors) {
    const dgClass = pickAtRowCol(pageItems, dataY, cols.class, (v) => /^\d+(?:\.\d+)?$/.test(v));
    const unNo = anchor.str.trim();
    const packingGroup = normalizePackingGroup(
      pickAtRowCol(
        pageItems,
        dataY,
        cols.group,
        (v) => v === '--' || /^[I]{1,3}$|^II$|^III$|^\d+\s*\/\s*[A-Z0-9]+$/i.test(v),
      ),
    );
    const fire = pickAtRowCol(pageItems, dataY, cols.fire, (v) => /^F-[A-Z]$/i.test(v));
    const spillage = pickAtRowCol(pageItems, dataY, cols.spillage, (v) => /^S-[A-Z]$/i.test(v));
    const grossRaw = pickAtRowCol(pageItems, dataY, cols.gweight, (v) => EU_WEIGHT_RE.test(v));
    const netRaw = pickAtRowCol(pageItems, dataY, cols.nweight, (v) => EU_WEIGHT_RE.test(v));
    const weights = dualWeightFromImport(grossRaw, netRaw, useGrossWeight);
    const flashPoint = pickAtRowCol(
      pageItems,
      dataY,
      cols.flashpoint,
      (v) => v.length > 0 && !/^flashpoint$/i.test(v),
    );
    const goodsDescription = pickGoodsDescription(pageItems, dataY);
    const marinePollutant = normalizeMarinePollutant(
      pickAtRowCol(
        pageItems,
        dataY + DP_DATA.marinePollutant,
        cols.unNo,
        (v) => /^(YES|NO)$/i.test(v),
        40,
        5,
      ) || '',
    );

    let subRisk = '';
    for (const it of pageItems) {
      if (!nearY(it, dataY + DP_DATA.subRisk, 5)) continue;
      if (it.x < 100 || it.x > 200) continue;
      const value = it.str.trim();
      if (!value || /^0([.,]0)?$/.test(value) || value === '/ / /') continue;
      subRisk = value;
      break;
    }

    if (!weights.weightKg.trim() && !goodsDescription.trim()) continue;

    rows.push({
      size,
      stow,
      containerNo,
      loadPort,
      dischargePort,
      loadTerminal,
      dischargeTerminal,
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

function parseDpWorldCargoPage(
  pageItems: readonly DgPdfTextItem[],
  loadPort: string,
  dischargePort: string,
  useGrossWeight: boolean,
  inherited?: { containerNo: string; size: string; stow: string },
  loadTerminal = '',
  dischargeTerminal = '',
): UnifeederImportRowPartial[] {
  const imo = pageItems.find((it) => it.str === 'IMO Information');
  const properFallback = !imo
    ? pageItems.find((it) => /^Proper ship\.\s*name:?\s*$/i.test(it.str.trim()))
    : undefined;
  if (!imo && !properFallback) return [];

  const imoY = imo?.y ?? properFallback!.y;
  const headerY = imoY + DP_IMO.containerNo;
  const cols = resolveDpWorldColumns(pageItems, imoY);

  const containerNo =
    normalizeContainerNo(pickLeftField(pageItems, headerY, (v) => CONTAINER_RAW_RE.test(v))) ||
    inherited?.containerNo ||
    '';
  if (!containerNo) return [];

  const sizeRaw = pickLeftField(pageItems, headerY, (v) => {
    const n = normalizeSizeCode(v);
    return ISO_SIZE_RE.test(n) || LETTER_SIZE_RE.test(n);
  });
  const size = normalizeSizeCode(sizeRaw) || inherited?.size || '';
  const stowRaw = pickLeftField(
    pageItems,
    imoY + DP_IMO.stowage,
    (v) => /^\d{4,6}$/i.test(v) || /^none$/i.test(v),
  );
  const stow = /^none$/i.test(stowRaw) ? '' : stowRaw || inherited?.stow || '';

  const dataYs = findAllDataRowYs(pageItems, imoY);
  if (!dataYs.length) return [];

  const rows: UnifeederImportRowPartial[] = [];
  for (const dataY of dataYs) {
    rows.push(
      ...parseDpWorldDataRow(
        pageItems,
        dataY,
        cols,
        containerNo,
        size,
        stow,
        loadPort,
        dischargePort,
        useGrossWeight,
        loadTerminal,
        dischargeTerminal,
      ),
    );
  }

  return rows;
}

export function parseDpWorldDangerousCargoPages(
  items: readonly DgPdfTextItem[],
  header: Partial<UnifeederImportHeader>,
  options: DgWeightTonnageOptions = {},
): { rows: UnifeederImportRowPartial[]; warnings: string[] } {
  const useGrossWeight = resolveDgWeightTonnageOptions(options).useGrossWeight;
  const warnings: string[] = [];
  let activeLoadPort = (header.portOfDeparture ?? '').trim();
  let activeDischargePort = (header.portOfArrival ?? '').trim();
  let activeLoadTerminal = (header.terminalOfDeparture ?? '').trim();
  let activeDischargeTerminal = (header.terminalOfArrival ?? '').trim();
  const pages = [...new Set(items.map((i) => i.page))].sort((a, b) => a - b);
  const rows: UnifeederImportRowPartial[] = [];
  let openContainer: { containerNo: string; size: string; stow: string } | undefined;

  for (const page of pages) {
    const pageItems = items.filter((i) => i.page === page);
    if (pageItems.some((it) => /Grand Total Summary/i.test(it.str))) continue;

    const pageHeader = parseDpWorldHeaderFromPage(pageItems);
    const pageLoad = (pageHeader.portOfDeparture ?? '').trim();
    const pageDischarge = (pageHeader.portOfArrival ?? '').trim();
    const pageLoadTerm = (pageHeader.terminalOfDeparture ?? '').trim();
    const pageDischargeTerm = (pageHeader.terminalOfArrival ?? '').trim();
    if (pageLoad) {
      activeLoadTerminal =
        pageLoadTerm || (pageLoad === activeLoadPort ? activeLoadTerminal : '');
      activeLoadPort = pageLoad;
    }
    if (pageDischarge) {
      activeDischargeTerminal =
        pageDischargeTerm ||
        (pageDischarge === activeDischargePort ? activeDischargeTerminal : '');
      activeDischargePort = pageDischarge;
    }
    if (pageLoadTerm) activeLoadTerminal = pageLoadTerm;
    if (pageDischargeTerm) activeDischargeTerminal = pageDischargeTerm;

    const pageRows = parseDpWorldCargoPage(
      pageItems,
      activeLoadPort,
      activeDischargePort,
      useGrossWeight,
      openContainer,
      activeLoadTerminal,
      activeDischargeTerminal,
    );
    if (!pageRows.length) {
      const mightHaveCargo = pageItems.some(
        (it) => it.str === 'IMO Information' || /^Proper ship\.\s*name:?\s*$/i.test(it.str.trim()),
      );
      if (mightHaveCargo) warnings.push(`Page ${page}: no DG cargo rows found.`);
      continue;
    }
    rows.push(...pageRows);
    const last = pageRows[pageRows.length - 1]!;
    if (last.containerNo) {
      openContainer = {
        containerNo: last.containerNo,
        size: last.size,
        stow: last.stow,
      };
    }
  }

  return { rows, warnings };
}
