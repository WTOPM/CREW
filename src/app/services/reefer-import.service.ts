import { Injectable } from '@angular/core';
import { formatReeferSetPoint, type ReeferImportRow } from '../models/reefer.models';
import { resolveManifestPortName, type Port } from '../models/crew.models';
import { extractDgPdfTextItems, type DgPdfTextItem } from '../utils/dg-pdf-text.util';

export type ReeferPdfFormat = 'cma-reefer' | 'unknown';

export interface ReeferImportHeader {
  voyageNumber: string;
  documentDate: string;
  portOfDeparture: string;
  portOfArrival: string;
  vesselName: string;
}

export interface ReeferImportResult {
  format: ReeferPdfFormat;
  warnings: string[];
  header: Partial<ReeferImportHeader>;
  rows: ReeferImportRow[];
}

/** CMA CGM PFR0777 reefer manifest — measured column X ranges (pt). */
const COL = {
  containerNo: [120, 190] as const,
  carriageTemp: [395, 442] as const,
  loadPort: [100, 220] as const,
  transhipmentPort: [100, 220] as const,
  dischargePort: [380, 500] as const,
  etd: [340, 400] as const,
  voyage: [435, 520] as const,
  vessel: [435, 520] as const,
};

const CONTAINER_RE = /^[A-Z]{4}\d{7}$/;
const TEMP_RE = /^-?\d+(?:\.\d+)?\s*°?\s*C$/i;

@Injectable({ providedIn: 'root' })
export class ReeferImportService {
  async importFromPdfBytes(bytes: Uint8Array, ports: Port[] = []): Promise<ReeferImportResult> {
    const items = await extractDgPdfTextItems(bytes);
    const joined = items.map((i) => i.str).join(' ');
    if (!/REEFER MANIFEST|PFR0777/i.test(joined)) {
      return {
        format: 'unknown',
        warnings: ['Unrecognized PDF format (expected CMA CGM Reefer Manifest).'],
        header: {},
        rows: [],
      };
    }

    const header = parseCmaReeferHeader(items);
    const importPorts = resolveCmaReeferImportPorts(items, ports);
    if (importPorts.pol) header.portOfDeparture = importPorts.pol;
    if (importPorts.pod) header.portOfArrival = importPorts.pod;
    const { rows, warnings } = parseCmaReeferRows(items, importPorts);

    return { format: 'cma-reefer', warnings, header, rows };
  }
}

function inCol(x: number, range: readonly [number, number]): boolean {
  return x >= range[0] && x <= range[1];
}

function nearY(item: DgPdfTextItem, y: number, tol = 2): boolean {
  return Math.abs(item.y - y) <= tol;
}

function isBlankManifestPort(raw: string): boolean {
  const s = raw.trim();
  return !s || s === '-' || s === '—' || /^[-–—:\s]+$/.test(s);
}

function findPortAtY(items: DgPdfTextItem[], col: readonly [number, number], y: number): string {
  for (const it of items) {
    if (!nearY(it, y, 1)) continue;
    if (!inCol(it.x, col)) continue;
    const v = it.str.trim();
    if (isBlankManifestPort(v)) continue;
    if (/^:/.test(v)) continue;
    return v;
  }
  return '';
}

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

function firstPageItems(items: DgPdfTextItem[]): DgPdfTextItem[] {
  const page1 = items.filter((it) => it.page === 1);
  return page1.length ? page1 : items;
}

function resolveCmaReeferImportPorts(
  items: DgPdfTextItem[],
  ports: readonly Port[],
): { pol: string; pod: string } {
  const headerItems = firstPageItems(items);
  const loadRaw = findPortAtY(headerItems, COL.loadPort, 175);
  const transRaw = findPortAtY(headerItems, COL.transhipmentPort, 227);
  const disRaw = findPortAtY(headerItems, COL.dischargePort, 227);
  return {
    pol: resolveManifestPortName(loadRaw, ports),
    pod: resolveCmaPodPort(transRaw, disRaw, ports),
  };
}

function parseCmaReeferHeader(items: DgPdfTextItem[]): Partial<ReeferImportHeader> {
  const headerItems = firstPageItems(items);
  const voyage =
    headerItems.find((it) => nearY(it, 103, 1) && inCol(it.x, COL.voyage))?.str.trim() ?? '';
  const vessel =
    headerItems.find((it) => nearY(it, 116, 1) && inCol(it.x, COL.vessel))?.str.trim() ?? '';
  const etd = headerItems.find((it) => nearY(it, 175, 1) && inCol(it.x, COL.etd))?.str.trim() ?? '';
  return {
    voyageNumber: voyage,
    vesselName: vessel,
    documentDate: normalizeEtdDate(etd),
  };
}

function normalizeEtdDate(raw: string): string {
  const v = raw.trim();
  const m = v.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/);
  if (!m) return v;
  const months: Record<string, string> = {
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
  const mm = months[m[2].toUpperCase()];
  if (!mm) return v;
  let year = parseInt(m[3], 10);
  if (year < 100) year += 2000;
  const day = String(parseInt(m[1], 10)).padStart(2, '0');
  return `${year}-${mm}-${day}`;
}

function parseCmaReeferRows(
  items: DgPdfTextItem[],
  importPorts: { pol: string; pod: string },
): { rows: ReeferImportRow[]; warnings: string[] } {
  const warnings: string[] = [];
  const anchors = items
    .filter((it) => inCol(it.x, COL.containerNo) && CONTAINER_RE.test(it.str.trim()))
    .sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);

  /** Same Y repeats on every page — key must include page. */
  const seenRows = new Set<string>();
  const rows: ReeferImportRow[] = [];

  for (const anchor of anchors) {
    const rowKey = `${anchor.page}:${anchor.y}`;
    if (seenRows.has(rowKey)) continue;
    seenRows.add(rowKey);

    const band = items.filter((it) => it.page === anchor.page && nearY(it, anchor.y, 2));
    const containerNo = anchor.str.trim();
    if (!containerNo) continue;

    const carriageRaw =
      band.find((it) => inCol(it.x, COL.carriageTemp) && TEMP_RE.test(it.str.trim()))?.str.trim() ??
      band.find((it) => inCol(it.x, COL.carriageTemp) && /^-?\d/.test(it.str.trim()))?.str.trim() ??
      '';

    rows.push({
      containerNo,
      setPointTemp: formatReeferSetPoint(carriageRaw),
      loadPort: importPorts.pol,
      dischargePort: importPorts.pod,
    });
  }

  if (!rows.length) warnings.push('No reefer containers found in PDF.');
  return { rows, warnings };
}
