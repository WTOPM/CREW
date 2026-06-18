import { Port, resolveKnownPortName, resolveManifestPortName } from './crew.models';
import { parseDgWeightKg, type DgContainerStatus } from './dg-manifest.models';
import { applyMfagSchedulesToUnifeederRow } from '../utils/dg-mfag-schedule.util';
import { normalizeUnifeederSubRisk } from '../utils/dg-unifeeder-sub-risk.util';

export type DgUnifeederRowField = keyof Omit<
  DgUnifeederRow,
  'id' | 'status' | 'sourceManifestId'
>;

/** One flat DG line in the DP WORLD manifest table. */
export interface DgUnifeederRow {
  id: string;
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
  fireSchedule: string;
  spillageSchedule: string;
  status: DgContainerStatus;
  sourceManifestId: string;
}

export interface DgUnifeederManifestDocument {
  id: string;
  sourceName: string;
  addedAt: string;
  rowCount: number;
  voyageNumber: string;
  documentDate: string;
  loadPort: string;
  dischargePort: string;
  containerCount: number;
  contentFingerprint?: string;
  pdfBytesFingerprint?: string;
}

export interface DgUnifeederLibrarySettings {
  manifests: DgUnifeederManifestDocument[];
  onboard: DgUnifeederRow[];
  showDischarged: boolean;
  /** Preview consolidated rows (same rule as CMA DG export). */
  mergeLines: boolean;
  /** Round line weights to whole kg; total = sum of raw weights rounded once (same as CMA DG export). */
  grossTotalKg: boolean;
}

export function createDefaultUnifeederLibrary(): DgUnifeederLibrarySettings {
  return {
    manifests: [],
    onboard: [],
    showDischarged: false,
    mergeLines: false,
    grossTotalKg: false,
  };
}

export function createDgUnifeederRow(
  partial?: Partial<Omit<DgUnifeederRow, 'id'> & { id?: string }>,
): DgUnifeederRow {
  const existingId = (partial?.id ?? '').trim();
  const status: DgContainerStatus = partial?.status === 'discharged' ? 'discharged' : 'onboard';
  return applyMfagSchedulesToUnifeederRow({
    id: existingId || crypto.randomUUID(),
    size: (partial?.size ?? '').trim(),
    stow: (partial?.stow ?? '').trim(),
    containerNo: (partial?.containerNo ?? '').trim().toUpperCase(),
    loadPort: (partial?.loadPort ?? '').trim(),
    dischargePort: (partial?.dischargePort ?? '').trim(),
    unNo: (partial?.unNo ?? '').trim(),
    packingGroup: (partial?.packingGroup ?? '').trim(),
    weightKg: (partial?.weightKg ?? '').trim(),
    lq: (partial?.lq ?? '').trim(),
    flashPoint: (partial?.flashPoint ?? '').trim(),
    marinePollutant: (partial?.marinePollutant ?? '').trim(),
    goodsDescription: (partial?.goodsDescription ?? '').trim(),
    dgClass: (partial?.dgClass ?? '').trim(),
    subRisk: normalizeUnifeederSubRisk(partial?.subRisk ?? ''),
    fire: (partial?.fire ?? '').trim(),
    spillage: (partial?.spillage ?? '').trim(),
    fireSchedule: (partial?.fireSchedule ?? '').trim(),
    spillageSchedule: (partial?.spillageSchedule ?? '').trim(),
    status,
    sourceManifestId: (partial?.sourceManifestId ?? '').trim(),
  });
}

export function createDgUnifeederManifestDocument(
  partial?: Partial<Omit<DgUnifeederManifestDocument, 'id' | 'addedAt' | 'rowCount'>> & {
    id?: string;
    addedAt?: string;
    rowCount?: number;
  },
): DgUnifeederManifestDocument {
  const existingId = (partial?.id ?? '').trim();
  return {
    id: existingId || crypto.randomUUID(),
    sourceName: (partial?.sourceName ?? 'Manual').trim() || 'Manual',
    addedAt: (partial?.addedAt ?? new Date().toISOString()).trim(),
    rowCount: partial?.rowCount ?? 0,
    voyageNumber: (partial?.voyageNumber ?? '').trim(),
    documentDate: (partial?.documentDate ?? '').trim(),
    loadPort: (partial?.loadPort ?? '').trim(),
    dischargePort: (partial?.dischargePort ?? '').trim(),
    containerCount: partial?.containerCount ?? 0,
    contentFingerprint: (partial?.contentFingerprint ?? '').trim(),
    pdfBytesFingerprint: (partial?.pdfBytesFingerprint ?? '').trim(),
  };
}

function sanitizeUnifeederRowPorts(row: DgUnifeederRow, ports: readonly Port[]): DgUnifeederRow {
  return {
    ...row,
    loadPort: resolveUnifeederRowPort(row.loadPort, ports),
    dischargePort: resolveUnifeederRowPort(row.dischargePort, ports),
  };
}

/** Match manifest city (BREMERHAVEN) to the user's port list; keep label if unknown. */
export function resolveUnifeederRowPort(ref: string, ports: readonly Port[] = []): string {
  const raw = ref.trim();
  if (!raw) return '';
  return resolveManifestPortName(raw, ports) || resolveKnownPortName(raw, ports) || raw;
}

export function normalizeUnifeederLibrary(
  raw?: Partial<DgUnifeederLibrarySettings>,
  ports: readonly Port[] = [],
  pageContext?: { portOfCall?: string; nextPortOfCall?: string },
): DgUnifeederLibrarySettings {
  if (!raw) return createDefaultUnifeederLibrary();
  return {
    manifests: (raw.manifests ?? []).map((m) => createDgUnifeederManifestDocument(m ?? {})),
    onboard: (raw.onboard ?? [])
      .map((r) => createDgUnifeederRow(r ?? {}))
      .filter((row) => row.containerNo.trim())
      .map((row) => {
        let sanitized = sanitizeUnifeederRowPorts(row, ports);
        if (!sanitized.loadPort.trim() && pageContext?.portOfCall?.trim()) {
          sanitized = {
            ...sanitized,
            loadPort: resolveUnifeederRowPort(pageContext.portOfCall, ports),
          };
        }
        if (!sanitized.dischargePort.trim() && pageContext?.nextPortOfCall?.trim()) {
          sanitized = {
            ...sanitized,
            dischargePort: resolveUnifeederRowPort(pageContext.nextPortOfCall, ports),
          };
        }
        return sanitized;
      }),
    showDischarged: raw.showDischarged === true,
    mergeLines: raw.mergeLines === true,
    grossTotalKg: raw.grossTotalKg === true,
  };
}

export function unifeederOnboardInventoryStats(
  onboard: readonly DgUnifeederRow[],
  includeDischarged: boolean,
  grossTotalKg = false,
): { rowCount: number; dischargedCount: number; totalKg: number } {
  const visible = includeDischarged ? onboard : onboard.filter((r) => r.status === 'onboard');
  let totalKg = 0;
  for (const row of visible) {
    totalKg += parseDgWeightKg(row.weightKg);
  }
  if (grossTotalKg) {
    totalKg = Math.round(totalKg);
  }
  return {
    rowCount: visible.length,
    dischargedCount: onboard.filter((r) => r.status === 'discharged').length,
    totalKg,
  };
}

export function findUnifeederManifestDuplicate(
  manifests: readonly DgUnifeederManifestDocument[],
  fingerprints: { contentFingerprint?: string; pdfBytesFingerprint?: string },
): DgUnifeederManifestDocument | undefined {
  const content = fingerprints.contentFingerprint?.trim();
  const pdf = fingerprints.pdfBytesFingerprint?.trim();
  if (!content && !pdf) return undefined;
  return manifests.find(
    (m) =>
      (content && m.contentFingerprint === content) ||
      (pdf && m.pdfBytesFingerprint === pdf),
  );
}
