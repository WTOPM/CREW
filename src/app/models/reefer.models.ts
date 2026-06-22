import { Port, resolveKnownPortName, resolveManifestPortName, type ShipInfo } from './crew.models';
import {
  createEmptyReeferPageContext,
  normalizeReeferPageContext,
  type ReeferPageContext,
} from '../utils/page-ship-context.util';
import {
  emptyReeferMonitoringSigners,
  normalizeReeferMonitoringSigners,
  type ReeferMonitoringSigner,
} from '../utils/reefer-check-signoff.util';

export type { ReeferPageContext };
export type { ReeferMonitoringSigner };

export type ReeferUnitStatus = 'onboard' | 'discharged';

export interface ReeferOnboardUnit {
  id: string;
  containerNo: string;
  setPointTemp: string;
  loadPort: string;
  dischargePort: string;
  position: string;
  sourceManifestId: string;
  status: ReeferUnitStatus;
}

export interface ReeferManifestDocument {
  id: string;
  sourceName: string;
  addedAt: string;
  voyageNumber: string;
  documentDate: string;
  loadPort: string;
  dischargePort: string;
  unitCount: number;
  contentFingerprint?: string;
  pdfBytesFingerprint?: string;
}

export interface ReeferLibrarySettings {
  manifests: ReeferManifestDocument[];
  onboard: ReeferOnboardUnit[];
  showDischarged: boolean;
  /** When true, show 5 days starting after monitoringNextDays from departure (not from departure itself). */
  monitoringAddNextDays: boolean;
  /** Days to skip from departure when monitoringAddNextDays is on (5, 10, 15, 20, or 25). */
  monitoringNextDays: ReeferMonitoringNextDays;
  inventorySortColumn: ReeferInventorySortColumn | null;
  inventorySortDirection: ReeferInventorySortDirection;
  /** Two crew names for the 08:30 check line in monitoring log export. */
  monitoringMorningSigners: ReeferMonitoringSigner[];
  /** Two crew names for the 16:55 check line in monitoring log export. */
  monitoringEveningSigners: ReeferMonitoringSigner[];
  /** Port/date context for this page and reefer document export. */
  pageContext: ReeferPageContext;
}

export type ReeferInventorySortColumn = 'containerNo' | 'loadPort' | 'dischargePort' | 'position';
export type ReeferInventorySortDirection = 'asc' | 'desc';

export const REEFER_BASE_MONITORING_DAYS = 5;
export const REEFER_MONITORING_NEXT_DAY_OPTIONS = [5, 10, 15, 20, 25] as const;
export type ReeferMonitoringNextDays = (typeof REEFER_MONITORING_NEXT_DAY_OPTIONS)[number];

export interface ReeferImportRow {
  containerNo: string;
  setPointTemp: string;
  loadPort: string;
  dischargePort: string;
}

export function createDefaultReeferLibrary(): ReeferLibrarySettings {
  return {
    manifests: [],
    onboard: [],
    showDischarged: false,
    monitoringAddNextDays: false,
    monitoringNextDays: 5,
    inventorySortColumn: null,
    inventorySortDirection: 'asc',
    monitoringMorningSigners: emptyReeferMonitoringSigners(),
    monitoringEveningSigners: emptyReeferMonitoringSigners(),
    pageContext: createEmptyReeferPageContext(),
  };
}

export function createReeferOnboardUnit(
  partial?: Partial<Omit<ReeferOnboardUnit, 'id'> & { id?: string }>,
): ReeferOnboardUnit {
  const existingId = (partial?.id ?? '').trim();
  const status: ReeferUnitStatus = partial?.status === 'discharged' ? 'discharged' : 'onboard';
  return {
    id: existingId || crypto.randomUUID(),
    containerNo: (partial?.containerNo ?? '').trim().toUpperCase(),
    setPointTemp: (partial?.setPointTemp ?? '').trim(),
    loadPort: (partial?.loadPort ?? '').trim(),
    dischargePort: (partial?.dischargePort ?? '').trim(),
    position: (partial?.position ?? '').trim(),
    sourceManifestId: (partial?.sourceManifestId ?? '').trim(),
    status,
  };
}

export function createReeferManifestDocument(
  partial?: Partial<Omit<ReeferManifestDocument, 'id' | 'addedAt' | 'unitCount'>> & {
    id?: string;
    addedAt?: string;
    unitCount?: number;
  },
): ReeferManifestDocument {
  const existingId = (partial?.id ?? '').trim();
  return {
    id: existingId || crypto.randomUUID(),
    sourceName: (partial?.sourceName ?? 'Manual').trim() || 'Manual',
    addedAt: (partial?.addedAt ?? new Date().toISOString()).trim(),
    voyageNumber: (partial?.voyageNumber ?? '').trim(),
    documentDate: (partial?.documentDate ?? '').trim(),
    loadPort: (partial?.loadPort ?? '').trim(),
    dischargePort: (partial?.dischargePort ?? '').trim(),
    unitCount: partial?.unitCount ?? 0,
    contentFingerprint: (partial?.contentFingerprint ?? '').trim(),
    pdfBytesFingerprint: (partial?.pdfBytesFingerprint ?? '').trim(),
  };
}

export function normalizeReeferLibrary(
  raw?: Partial<ReeferLibrarySettings>,
  ports: readonly Port[] = [],
  shipSeed?: Pick<ShipInfo, 'portOfCall' | 'dateOfDeparture'>,
): ReeferLibrarySettings {
  if (raw && (Array.isArray(raw.manifests) || Array.isArray(raw.onboard))) {
    return {
      manifests: (raw.manifests ?? []).map((m) =>
        sanitizeReeferManifestPorts(createReeferManifestDocument(m ?? {}), ports),
      ),
      onboard: (raw.onboard ?? []).map((u) =>
        sanitizeReeferUnitPorts(createReeferOnboardUnit(u ?? {}), ports),
      ),
      showDischarged: raw.showDischarged === true,
      monitoringAddNextDays: raw.monitoringAddNextDays === true,
      monitoringNextDays: normalizeReeferMonitoringNextDays(raw.monitoringNextDays),
      inventorySortColumn: normalizeReeferInventorySortColumn(raw.inventorySortColumn),
      inventorySortDirection: raw.inventorySortDirection === 'desc' ? 'desc' : 'asc',
      monitoringMorningSigners: normalizeReeferMonitoringSigners(raw.monitoringMorningSigners),
      monitoringEveningSigners: normalizeReeferMonitoringSigners(raw.monitoringEveningSigners),
      pageContext: normalizeReeferPageContext(raw.pageContext, 'pageContext' in raw, shipSeed),
    };
  }
  return createDefaultReeferLibrary();
}

function sanitizeReeferUnitPorts(
  unit: ReeferOnboardUnit,
  ports: readonly Port[],
): ReeferOnboardUnit {
  return {
    ...unit,
    setPointTemp: formatReeferSetPoint(unit.setPointTemp),
    loadPort: resolveKnownPortName(unit.loadPort, ports),
    dischargePort: resolveKnownPortName(unit.dischargePort, ports),
  };
}

function sanitizeReeferManifestPorts(
  doc: ReeferManifestDocument,
  ports: readonly Port[],
): ReeferManifestDocument {
  return {
    ...doc,
    loadPort: resolveKnownPortName(doc.loadPort, ports),
    dischargePort: resolveKnownPortName(doc.dischargePort, ports),
  };
}

/** Normalize carriage/set-point temperature for display (e.g. -18.00C → -18). */
export function formatReeferSetPoint(value: string | undefined | null): string {
  const v = String(value ?? '').trim();
  if (!v) return '';
  const m = v.match(/^(-?\d+(?:\.\d+)?)\s*°?\s*C?$/i);
  if (!m) return v;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return v;
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

export function findReeferManifestDuplicate(
  manifests: readonly ReeferManifestDocument[],
  fingerprints: { contentFingerprint?: string; pdfBytesFingerprint?: string },
): ReeferManifestDocument | undefined {
  const content = fingerprints.contentFingerprint?.trim();
  const pdf = fingerprints.pdfBytesFingerprint?.trim();
  if (!content && !pdf) return undefined;
  return manifests.find(
    (m) => (content && m.contentFingerprint === content) || (pdf && m.pdfBytesFingerprint === pdf),
  );
}

export function reeferUnitsFromImportRows(
  rows: readonly ReeferImportRow[],
  manifestId: string,
  defaultLoadPort: string,
  defaultDischargePort: string,
  ports: readonly Port[] = [],
): ReeferOnboardUnit[] {
  const seen = new Set<string>();
  const out: ReeferOnboardUnit[] = [];
  for (const row of rows) {
    const containerNo = row.containerNo.trim().toUpperCase();
    if (!containerNo || seen.has(containerNo)) continue;
    seen.add(containerNo);
    out.push(
      createReeferOnboardUnit({
        containerNo,
        setPointTemp: formatReeferSetPoint(row.setPointTemp),
        loadPort: resolveKnownPortName(row.loadPort || defaultLoadPort, ports),
        dischargePort: resolveKnownPortName(row.dischargePort || defaultDischargePort, ports),
        sourceManifestId: manifestId,
      }),
    );
  }
  return out;
}

export function mergeReeferImportIntoOnboard(
  existing: readonly ReeferOnboardUnit[],
  imported: readonly ReeferOnboardUnit[],
): ReeferOnboardUnit[] {
  const map = new Map(existing.map((u) => [u.containerNo.toUpperCase(), u]));
  for (const unit of imported) {
    const key = unit.containerNo.toUpperCase();
    const prev = map.get(key);
    if (prev) {
      map.set(key, {
        ...prev,
        setPointTemp: unit.setPointTemp || prev.setPointTemp,
        loadPort: unit.loadPort || prev.loadPort,
        dischargePort: unit.dischargePort || prev.dischargePort,
        sourceManifestId: unit.sourceManifestId || prev.sourceManifestId,
        status: prev.status,
      });
    } else {
      map.set(key, unit);
    }
  }
  return [...map.values()];
}

export function normalizeReeferMonitoringNextDays(value: unknown): ReeferMonitoringNextDays {
  const n = Number(value);
  return REEFER_MONITORING_NEXT_DAY_OPTIONS.includes(n as ReeferMonitoringNextDays)
    ? (n as ReeferMonitoringNextDays)
    : 5;
}

function normalizeReeferInventorySortColumn(value: unknown): ReeferInventorySortColumn | null {
  return typeof value === 'string' &&
    (['containerNo', 'loadPort', 'dischargePort', 'position'] as const).includes(
      value as ReeferInventorySortColumn,
    )
    ? (value as ReeferInventorySortColumn)
    : null;
}

export function reeferMonitoringDayCount(_library: ReeferLibrarySettings): number {
  return REEFER_BASE_MONITORING_DAYS;
}

/** Days to skip from departure before the 5-day monitoring window starts. */
export function reeferMonitoringDayOffset(library: ReeferLibrarySettings): number {
  if (!library.monitoringAddNextDays) return 0;
  return library.monitoringNextDays;
}

export function reeferManifestFullyDischarged(
  manifestId: string,
  onboard: readonly ReeferOnboardUnit[],
): boolean {
  const linked = onboard.filter((u) => u.sourceManifestId === manifestId);
  return linked.length > 0 && linked.every((u) => u.status === 'discharged');
}

export function reeferOnboardInventoryStats(
  onboard: readonly ReeferOnboardUnit[],
  showDischarged: boolean,
): { unitCount: number; dischargedCount: number } {
  const visible = showDischarged ? onboard : onboard.filter((u) => u.status !== 'discharged');
  return {
    unitCount: visible.length,
    dischargedCount: onboard.filter((u) => u.status === 'discharged').length,
  };
}

export function resolveReeferExportPortCode(ref: string, ports: readonly Port[] = []): string {
  const name = resolveManifestPortName(ref, ports);
  const source = name || ref.trim();
  if (!source) return '';
  const byName = ports.find((p) => p.name.toLowerCase() === source.toLowerCase());
  if (byName?.code) return byName.code.toUpperCase();
  const byCode = ports.find((p) => p.code && p.code.toLowerCase() === source.toLowerCase());
  if (byCode?.code) return byCode.code.toUpperCase();
  return source.toUpperCase();
}
