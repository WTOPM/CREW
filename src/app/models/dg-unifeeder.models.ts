import { Port, resolveKnownPortName, resolveManifestPortName } from './crew.models';
import { parseDgWeightKg, roundDgWeightKgSum, type DgContainerStatus } from './dg-manifest.models';
import { applyMfagSchedulesToUnifeederRow } from '../utils/dg-mfag-schedule.util';
import { normalizeUnifeederSubRisk } from '../utils/dg-unifeeder-sub-risk.util';
import { unifeederInventoryDisplayTotalKg } from '../utils/dg-unifeeder-weight.util';
import { normalizeDgDualWeightFields, dgLineActiveWeightKg } from '../utils/dg-weight-tonnage.util';

export type DgUnifeederRowField = keyof Omit<DgUnifeederRow, 'id' | 'status' | 'sourceManifestId'>;

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
  /** Grand Total Summary from PDF (kg, parsed). */
  pdfImoNetWeightKg?: number;
  pdfImoGrossWeightKg?: number;
}

export interface DgUnifeederLibrarySettings {
  manifests: DgUnifeederManifestDocument[];
  onboard: DgUnifeederRow[];
  showDischarged: boolean;
  /** Preview consolidated rows (same rule as CMA DG export). */
  mergeLines: boolean;
  /** true = show gross tonnage, false = net tonnage. */
  useGrossWeight: boolean;
  /** Round displayed weights and totals to whole kg. */
  roundWeights: boolean;
  /** @deprecated Use useGrossWeight + roundWeights */
  grossTotalKg?: boolean;
}

export function createDefaultUnifeederLibrary(): DgUnifeederLibrarySettings {
  return {
    manifests: [],
    onboard: [],
    showDischarged: false,
    mergeLines: false,
    useGrossWeight: true,
    roundWeights: false,
  };
}

export function createDgUnifeederRow(
  partial?: Partial<Omit<DgUnifeederRow, 'id'> & { id?: string }>,
): DgUnifeederRow {
  const existingId = (partial?.id ?? '').trim();
  const status: DgContainerStatus = partial?.status === 'discharged' ? 'discharged' : 'onboard';
  const weights = normalizeDgDualWeightFields(partial);
  return applyMfagSchedulesToUnifeederRow({
    id: existingId || crypto.randomUUID(),
    size: (partial?.size ?? '').trim(),
    stow: (partial?.stow ?? '').trim(),
    containerNo: (partial?.containerNo ?? '').trim().toUpperCase(),
    loadPort: (partial?.loadPort ?? '').trim(),
    dischargePort: (partial?.dischargePort ?? '').trim(),
    unNo: (partial?.unNo ?? '').trim(),
    packingGroup: (partial?.packingGroup ?? '').trim(),
    weightKg: weights.weightKg,
    grossWeightKg: weights.grossWeightKg,
    netWeightKg: weights.netWeightKg,
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
    pdfImoNetWeightKg: Number(partial?.pdfImoNetWeightKg) || 0,
    pdfImoGrossWeightKg: Number(partial?.pdfImoGrossWeightKg) || 0,
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
  const hasNewWeightFields = 'useGrossWeight' in raw || 'roundWeights' in raw;
  let useGrossWeight = raw.useGrossWeight !== false;
  let roundWeights = raw.roundWeights === true;
  if (!hasNewWeightFields && raw.grossTotalKg !== undefined) {
    useGrossWeight = raw.grossTotalKg !== false;
    roundWeights = raw.grossTotalKg === true;
  }
  return {
    manifests: (raw.manifests ?? []).map((m) => createDgUnifeederManifestDocument(m ?? {})),
    onboard: (raw.onboard ?? [])
      .map((r) => createDgUnifeederRow(r ?? {}))
      .filter((row) => row.containerNo.trim() || !row.sourceManifestId.trim())
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
    useGrossWeight,
    roundWeights,
  };
}

export function unifeederOnboardInventoryStats(
  onboard: readonly DgUnifeederRow[],
  includeDischarged: boolean,
  useGrossWeight = true,
  roundWeights = false,
  mergeLines = false,
): { rowCount: number; dischargedCount: number; totalKg: number } {
  const visible = includeDischarged ? onboard : onboard.filter((r) => r.status === 'onboard');
  const totalKg = unifeederInventoryDisplayTotalKg(visible, {
    useGrossWeight,
    roundWeights,
    mergeLines,
  });
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
    (m) => (content && m.contentFingerprint === content) || (pdf && m.pdfBytesFingerprint === pdf),
  );
}
