import {
  CrewMember,
  Port,
  ShipInfo,
  formatShipSecurityOfficerName,
  resolveKnownPortName,
} from './crew.models';
import { dgInventoryDisplayTotalKg, mergeDgCargoLines, dgContainerDisplayRawWeights } from '../utils/dg-cargo-merge.util';
import { sumPlannedDgLineWeightsKg } from '../utils/dg-weight-view.util';
import {
  createEmptyDgPageContext,
  normalizeDgPageContext,
  type DgPageContext,
} from '../utils/page-ship-context.util';
import {
  createDefaultUnifeederLibrary,
  normalizeUnifeederLibrary,
  type DgUnifeederLibrarySettings,
} from './dg-unifeeder.models';
import { normalizeDgDualWeightFields, dgLineActiveWeightKg } from '../utils/dg-weight-tonnage.util';
import { formatDisplayDate } from '../utils/date.util';

/** Manifest chip / import log title: load port and departure date from the PDF. */
export function formatDgManifestSourceName(
  loadPort: string,
  departureDate: string,
  fallback = '',
): string {
  const port = loadPort.trim();
  const date = formatDisplayDate(departureDate.trim());
  if (port && date) return `${port} · ${date}`;
  if (port) return port;
  if (date) return date;
  const fb = fallback.trim();
  return fb || 'Import';
}

export type { DgPageContext };

/** @deprecated Legacy flat row — migrated into onboard inventory. */
export interface DgManifestRow {
  id: string;
  pol: string;
  pod: string;
  type: string;
  containerNo: string;
  stowage: string;
  dgClass: string;
  unNo: string;
  mpLq: string;
  flashPoint: string;
  properShippingName: string;
  weightKg: string;
  /** Gross weight from manifest (kg). */
  grossWeightKg?: string;
  /** Net weight from manifest (kg). */
  netWeightKg?: string;
}

/** @deprecated */
export interface DgManifestFormSettings {
  vesselDisplay: string;
  voyageNumber: string;
  masterName: string;
  portOfDeparture: string;
  portOfArrival: string;
  departureDate: string;
  arrivalDate: string;
  rows: DgManifestRow[];
}

export type DgSortMode = 'added' | 'date' | 'voyage';
export type DgContainerStatus = 'onboard' | 'discharged';

export interface DgCargoLine {
  id: string;
  dgClass: string;
  unNo: string;
  weightKg: string;
  /** Gross weight from manifest (kg). */
  grossWeightKg?: string;
  /** Net weight from manifest (kg). */
  netWeightKg?: string;
  properShippingName: string;
  /** MP / LQ abbreviations from manifest fields (4) and (5). */
  mpLq: string;
  /** Flash point temperature from manifest field (3), e.g. -10 °C. */
  flashPoint: string;
}

/** One container on the cumulative onboard DG list. */
export interface DgOnboardContainer {
  id: string;
  containerNo: string;
  type: string;
  stowage: string;
  loadPort: string;
  dischargePort: string;
  status: DgContainerStatus;
  lines: DgCargoLine[];
  /** Manifest import that added this container. */
  sourceManifestId: string;
}

/** Import log entry (PDF per port call) — not the editable inventory. */
export interface DgManifestDocument {
  id: string;
  sourceName: string;
  addedAt: string;
  voyageNumber: string;
  documentDate: string;
  loadPort: string;
  dischargePort: string;
  containerCount: number;
  /** SHA-256 of parsed manifest cargo (header + rows), for duplicate import detection. */
  contentFingerprint?: string;
  /** SHA-256 of raw PDF bytes when imported from PDF. */
  pdfBytesFingerprint?: string;
  /** @deprecated Containers moved to dgLibrary.onboard */
  containers?: DgContainerEntry[];
}

/** @deprecated Use DgOnboardContainer */
export type DgContainerEntry = Omit<
  DgOnboardContainer,
  'loadPort' | 'dischargePort' | 'status' | 'sourceManifestId'
>;

export type DgActiveInventoryTab = 'cmaCgm' | 'unifeeder';

export interface DgLibrarySettings {
  manifests: DgManifestDocument[];
  onboard: DgOnboardContainer[];
  showDischarged: boolean;
  /** Preview consolidated cargo lines (same rule as PDF export). */
  manifestMergeLines: boolean;
  /** true = show gross tonnage, false = net tonnage. */
  manifestUseGrossWeight: boolean;
  /** Round displayed weights and totals to whole kg. */
  manifestRoundWeights: boolean;
  /** @deprecated Use manifestUseGrossWeight + manifestRoundWeights */
  manifestGrossTotalKg?: boolean;
  /** Last opened inventory table on the DG page. */
  activeInventoryTab: DgActiveInventoryTab;
  /** Port/date context for this page and DG document export. */
  pageContext: DgPageContext;
  /** DP WORLD manifest — separate inventory from CMA CGM. */
  unifeeder: DgUnifeederLibrarySettings;
  /** @deprecated Renamed to manifestMergeLines — read during normalize only */
  manifestRoundLineKg?: boolean;
  /** @deprecated */
  documents?: DgManifestDocument[];
  activeDocumentId?: string;
  sortBy?: DgSortMode;
}

export interface DgManifestViewOptions {
  manifestMergeLines: boolean;
  manifestUseGrossWeight: boolean;
  manifestRoundWeights: boolean;
}

export function createDgCargoLine(
  partial?: Partial<Omit<DgCargoLine, 'id'> & { id?: string }>,
): DgCargoLine {
  const existingId = (partial?.id ?? '').trim();
  const weights = normalizeDgDualWeightFields(partial);
  return {
    id: existingId || crypto.randomUUID(),
    dgClass: (partial?.dgClass ?? '').trim(),
    unNo: (partial?.unNo ?? '').trim(),
    weightKg: weights.weightKg,
    grossWeightKg: weights.grossWeightKg,
    netWeightKg: weights.netWeightKg,
    properShippingName: (partial?.properShippingName ?? '').trim(),
    mpLq: (partial?.mpLq ?? '').trim(),
    flashPoint: (partial?.flashPoint ?? '').trim(),
  };
}

export function createDgOnboardContainer(
  partial?: Partial<
    Omit<DgOnboardContainer, 'id' | 'lines'> & {
      id?: string;
      lines?: DgCargoLine[];
    }
  >,
): DgOnboardContainer {
  const existingId = (partial?.id ?? '').trim();
  const lines = Array.isArray(partial?.lines) ? partial.lines.map((l) => createDgCargoLine(l)) : [];
  const status: DgContainerStatus = partial?.status === 'discharged' ? 'discharged' : 'onboard';
  return {
    id: existingId || crypto.randomUUID(),
    containerNo: (partial?.containerNo ?? '').trim(),
    type: (partial?.type ?? '').trim(),
    stowage: (partial?.stowage ?? '').trim(),
    loadPort: (partial?.loadPort ?? '').trim(),
    dischargePort: (partial?.dischargePort ?? '').trim(),
    status,
    lines,
    sourceManifestId: (partial?.sourceManifestId ?? '').trim(),
  };
}

export function createDgManifestDocument(
  partial?: Partial<
    Omit<DgManifestDocument, 'id' | 'addedAt' | 'containerCount' | 'containers'>
  > & {
    id?: string;
    addedAt?: string;
    containerCount?: number;
    containers?: DgContainerEntry[];
  },
): DgManifestDocument {
  const existingId = (partial?.id ?? '').trim();
  const legacyContainers = Array.isArray(partial?.containers) ? partial.containers : [];
  return {
    id: existingId || crypto.randomUUID(),
    sourceName: (partial?.sourceName ?? 'Manual').trim() || 'Manual',
    addedAt: (partial?.addedAt ?? new Date().toISOString()).trim(),
    voyageNumber: (partial?.voyageNumber ?? '').trim(),
    documentDate: (partial?.documentDate ?? '').trim(),
    loadPort: (partial?.loadPort ?? '').trim(),
    dischargePort: (partial?.dischargePort ?? '').trim(),
    containerCount: partial?.containerCount ?? legacyContainers.length,
    contentFingerprint: (partial?.contentFingerprint ?? '').trim(),
    pdfBytesFingerprint: (partial?.pdfBytesFingerprint ?? '').trim(),
  };
}

export function findDgManifestDuplicate(
  manifests: readonly DgManifestDocument[],
  fingerprints: { contentFingerprint?: string; pdfBytesFingerprint?: string },
): DgManifestDocument | undefined {
  const content = fingerprints.contentFingerprint?.trim();
  const pdf = fingerprints.pdfBytesFingerprint?.trim();
  if (!content && !pdf) return undefined;
  return manifests.find(
    (m) => (content && m.contentFingerprint === content) || (pdf && m.pdfBytesFingerprint === pdf),
  );
}

export function createDefaultDgLibrary(): DgLibrarySettings {
  return {
    manifests: [],
    onboard: [],
    showDischarged: false,
    manifestMergeLines: false,
    manifestUseGrossWeight: true,
    manifestRoundWeights: false,
    activeInventoryTab: 'cmaCgm',
    pageContext: createEmptyDgPageContext(),
    unifeeder: createDefaultUnifeederLibrary(),
  };
}

function sanitizeDgOnboardPorts(
  container: DgOnboardContainer,
  ports: readonly Port[],
): DgOnboardContainer {
  return {
    ...container,
    loadPort: resolveKnownPortName(container.loadPort, ports),
    dischargePort: resolveKnownPortName(container.dischargePort, ports),
  };
}

function sanitizeDgManifestPorts(
  doc: DgManifestDocument,
  ports: readonly Port[],
): DgManifestDocument {
  return {
    ...doc,
    loadPort: resolveKnownPortName(doc.loadPort, ports),
    dischargePort: resolveKnownPortName(doc.dischargePort, ports),
  };
}

export function normalizeDgLibrary(
  raw?: Partial<DgLibrarySettings>,
  legacy?: Partial<DgManifestFormSettings>,
  ports: readonly Port[] = [],
  shipSeed?: Pick<ShipInfo, 'portOfCall' | 'nextPortOfCall' | 'dateOfDeparture' | 'dateOfArrival'>,
): DgLibrarySettings {
  const rawManifests = raw?.manifests ?? raw?.documents;
  if (raw && (Array.isArray(rawManifests) || Array.isArray(raw.onboard))) {
    const manifests = (rawManifests ?? []).map((m) =>
      sanitizeDgManifestPorts(createDgManifestDocument(m ?? {}), ports),
    );
    let onboard = Array.isArray(raw.onboard)
      ? raw.onboard.map((c) => sanitizeDgOnboardPorts(createDgOnboardContainer(c ?? {}), ports))
      : [];

    if (!onboard.length && rawManifests?.length) {
      onboard = flattenManifestContainersToOnboard(
        (rawManifests ?? []).map((m) => createDgManifestDocument(m ?? {})),
      ).map((c) => sanitizeDgOnboardPorts(c, ports));
    }

    const pageContext = normalizeDgPageContext(raw.pageContext, 'pageContext' in raw, shipSeed);
    const hasNewWeightFields = 'manifestUseGrossWeight' in raw || 'manifestRoundWeights' in raw;
    let manifestUseGrossWeight = raw.manifestUseGrossWeight !== false;
    let manifestRoundWeights = raw.manifestRoundWeights === true;
    if (!hasNewWeightFields && raw.manifestGrossTotalKg !== undefined) {
      manifestUseGrossWeight = raw.manifestGrossTotalKg !== false;
      manifestRoundWeights = raw.manifestGrossTotalKg === true;
    }
    return {
      manifests,
      onboard,
      showDischarged: raw.showDischarged === true,
      manifestMergeLines: raw.manifestMergeLines === true || raw.manifestRoundLineKg === true,
      manifestUseGrossWeight,
      manifestRoundWeights,
      activeInventoryTab: raw.activeInventoryTab === 'unifeeder' ? 'unifeeder' : 'cmaCgm',
      pageContext,
      unifeeder: normalizeUnifeederLibrary(raw.unifeeder, ports, pageContext),
    };
  }

  if (legacy) {
    const migrated = migrateLegacyDgForm(legacy, ports, shipSeed);
    if (migrated.manifests.length || migrated.onboard.length) return migrated;
  }

  return createDefaultDgLibrary();
}

function flattenManifestContainersToOnboard(manifests: DgManifestDocument[]): DgOnboardContainer[] {
  const onboard: DgOnboardContainer[] = [];
  for (const doc of manifests) {
    const legacy = doc.containers ?? [];
    for (const c of legacy) {
      onboard.push(
        createDgOnboardContainer({
          containerNo: c.containerNo,
          type: c.type,
          stowage: c.stowage,
          lines: c.lines,
          loadPort: doc.loadPort,
          dischargePort: doc.dischargePort,
          status: 'onboard',
          sourceManifestId: doc.id,
        }),
      );
    }
  }
  return onboard;
}

function migrateLegacyDgForm(
  raw: Partial<DgManifestFormSettings>,
  ports: readonly Port[] = [],
  shipSeed?: Pick<ShipInfo, 'portOfCall' | 'nextPortOfCall' | 'dateOfDeparture' | 'dateOfArrival'>,
): DgLibrarySettings {
  const form = normalizeLegacyDgManifestForm(raw);
  const hasRows = form.rows.some(
    (r) => r.containerNo || r.unNo || r.dgClass || r.properShippingName || r.weightKg,
  );
  if (!hasRows && !form.voyageNumber && !form.portOfDeparture) {
    return createDefaultDgLibrary();
  }

  const doc = createDgManifestDocument({
    sourceName: 'Imported (legacy)',
    voyageNumber: form.voyageNumber,
    documentDate: form.departureDate,
    loadPort: form.portOfDeparture,
    dischargePort: form.portOfArrival,
  });
  const onboard = onboardContainersFromImportRows(
    form.rows,
    doc.id,
    form.portOfDeparture,
    form.portOfArrival,
    ports,
  );
  return {
    manifests: [{ ...doc, containerCount: onboard.length }],
    onboard,
    showDischarged: false,
    manifestMergeLines: false,
    manifestUseGrossWeight: true,
    manifestRoundWeights: false,
    activeInventoryTab: 'cmaCgm',
    pageContext: normalizeDgPageContext(undefined, false, shipSeed),
    unifeeder: createDefaultUnifeederLibrary(),
  };
}

function normalizeLegacyDgManifestForm(
  raw: Partial<DgManifestFormSettings>,
): DgManifestFormSettings {
  const rows = Array.isArray(raw.rows)
    ? raw.rows.map((r) => createLegacyDgManifestRow(r ?? {}))
    : [];
  return {
    vesselDisplay: String(raw.vesselDisplay ?? '').trim(),
    voyageNumber: String(raw.voyageNumber ?? '').trim(),
    masterName: String(raw.masterName ?? '').trim(),
    portOfDeparture: String(raw.portOfDeparture ?? '').trim(),
    portOfArrival: String(raw.portOfArrival ?? '').trim(),
    departureDate: String(raw.departureDate ?? '').trim(),
    arrivalDate: String(raw.arrivalDate ?? '').trim(),
    rows,
  };
}

function createLegacyDgManifestRow(
  partial?: Partial<Omit<DgManifestRow, 'id'> & { id?: string }>,
): DgManifestRow {
  const existingId = (partial?.id ?? '').trim();
  return {
    id: existingId || crypto.randomUUID(),
    pol: (partial?.pol ?? '').trim(),
    pod: (partial?.pod ?? '').trim(),
    type: (partial?.type ?? '').trim(),
    containerNo: (partial?.containerNo ?? '').trim(),
    stowage: (partial?.stowage ?? '').trim(),
    dgClass: (partial?.dgClass ?? '').trim(),
    unNo: (partial?.unNo ?? '').trim(),
    mpLq: (partial?.mpLq ?? '').trim(),
    flashPoint: (partial?.flashPoint ?? '').trim(),
    properShippingName: (partial?.properShippingName ?? '').trim(),
    weightKg: (partial?.weightKg ?? '').trim(),
  };
}

export function groupLegacyRowsIntoContainers(
  rows: readonly Partial<DgManifestRow>[],
): Pick<DgOnboardContainer, 'containerNo' | 'type' | 'stowage' | 'lines'>[] {
  const map = new Map<
    string,
    Pick<DgOnboardContainer, 'containerNo' | 'type' | 'stowage' | 'lines'>
  >();
  for (const row of rows) {
    const hasCargo =
      row.unNo ||
      row.dgClass ||
      row.properShippingName ||
      row.weightKg ||
      row.mpLq ||
      row.flashPoint;
    if (!hasCargo && !row.containerNo) continue;

    const key = (row.containerNo ?? '').trim() || '__no_container__';
    if (!map.has(key)) {
      map.set(key, {
        containerNo: (row.containerNo ?? '').trim(),
        type: (row.type ?? '').trim(),
        stowage: (row.stowage ?? '').trim(),
        lines: [],
      });
    }
    const container = map.get(key)!;
    if (row.type && !container.type) container.type = row.type.trim();
    if (row.stowage && !container.stowage) container.stowage = row.stowage.trim();
    if (hasCargo) {
      container.lines.push(
        createDgCargoLine({
          dgClass: row.dgClass,
          unNo: row.unNo,
          weightKg: row.weightKg,
          grossWeightKg: row.grossWeightKg,
          netWeightKg: row.netWeightKg,
          properShippingName: row.properShippingName,
          mpLq: row.mpLq,
          flashPoint: row.flashPoint,
        }),
      );
    }
  }
  return [...map.values()];
}

export function onboardContainersFromImportRows(
  rows: readonly Partial<DgManifestRow>[],
  manifestId: string,
  defaultLoadPort: string,
  defaultDischargePort: string,
  ports: readonly Port[] = [],
): DgOnboardContainer[] {
  const grouped = groupLegacyRowsIntoContainers(rows);
  return grouped.map((g) => {
    const rowsForContainer = rows.filter((r) => (r.containerNo ?? '').trim() === g.containerNo);
    const rowWithPorts = rowsForContainer.find((r) => r.pol || r.pod);
    let loadPort = (rowWithPorts?.pol ?? defaultLoadPort).trim();
    let dischargePort = defaultDischargePort.trim();
    for (const row of rowsForContainer) {
      if (row.pod?.trim()) dischargePort = row.pod.trim();
    }
    return createDgOnboardContainer({
      ...g,
      loadPort: resolveKnownPortName(loadPort, ports),
      dischargePort: resolveKnownPortName(dischargePort, ports),
      status: 'onboard',
      sourceManifestId: manifestId,
    });
  });
}

export function sortDgDocuments(
  documents: readonly DgManifestDocument[],
  sortBy: DgSortMode = 'added',
): DgManifestDocument[] {
  const copy = [...documents];
  switch (sortBy) {
    case 'date':
      return copy.sort((a, b) => {
        const cmp = (b.documentDate || '').localeCompare(a.documentDate || '');
        return cmp || b.addedAt.localeCompare(a.addedAt);
      });
    case 'voyage':
      return copy.sort((a, b) => {
        const cmp = (a.voyageNumber || '').localeCompare(b.voyageNumber || '', undefined, {
          sensitivity: 'base',
        });
        return cmp || b.addedAt.localeCompare(a.addedAt);
      });
    case 'added':
    default:
      return copy.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  }
}

/** Normalize weight text for parsing (UI: dot = decimal; CMA import: 22.600 / 980.000 / 1,440.000; European: 19.200,00). */
function normalizeDgWeightInput(raw: string): string {
  const s = raw.replace(/\s/g, '').trim();
  if (!s) return '';

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');

  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    if (lastDot > lastComma) {
      // 15,300.000 — comma thousands, dot decimal
      return s.replace(/,/g, '');
    }
    // 19.200,00 — dot thousands, comma decimal
    return s.replace(/\./g, '').replace(',', '.');
  }

  if (hasComma) {
    if (/^\d{1,3}(,\d{3})+$/.test(s)) {
      return s.replace(/,/g, '');
    }
    return s.replace(',', '.');
  }

  if (hasDot) {
    const dotParts = s.split('.');
    if (dotParts.length > 2 && /^\d{1,3}(\.\d{3})+$/.test(s)) {
      // 1.234.567 — European thousands
      return s.replace(/\./g, '');
    }
    if (dotParts.length === 2) {
      const [intPart, fracPart] = dotParts;
      if (/^\d+$/.test(intPart) && /^\d+$/.test(fracPart)) {
        // Single dot — decimal (CMA KGM: 22.600, 980.000; UI: 480.000)
        return s;
      }
    }
  }

  return s;
}

export function parseDgWeightKg(value: string | undefined | null): number {
  const cleaned = normalizeDgWeightInput(String(value ?? ''));
  if (!cleaned) return 0;
  const n = parseFloat(cleaned);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 1000) / 1000;
}

/** Display weight: integer or decimal with dot only (19200, 19200.5 — no thousands, no ,00). */
export function formatDgWeightKgDisplay(value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'string' && !value.trim()) return '';

  const n = typeof value === 'number' ? value : parseDgWeightKg(value);
  if (!n) {
    if (typeof value === 'string') {
      const raw = value.trim();
      if (raw && !Number.isFinite(parseFloat(normalizeDgWeightInput(raw)))) return raw;
    }
    return '';
  }

  const rounded = Math.round(n * 1000) / 1000;
  return rounded.toFixed(3).replace(/\.?0+$/, '');
}

/** Gross-total display: whole kg only, no decimal point. */
export function formatDgWeightKgGrossDisplay(value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'string' && !value.trim()) return '';
  const n = typeof value === 'number' ? value : parseDgWeightKg(value);
  if (!n) return '';
  return String(Math.round(n));
}

/** Normalize weight on commit (blur / import): comma → dot; trim .00 tails. */
export function commitDgWeightKgInput(raw: string, gross = false): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (gross) return formatDgWeightKgGrossDisplay(trimmed);
  return formatDgWeightKgDisplay(trimmed) || trimmed;
}

export function roundDgWeightKgSum(total: number): number {
  if (!Number.isFinite(total)) return 0;
  return Math.round(total * 1000) / 1000;
}

/** Nearest kg for one cargo line in DG export (500.5 → 501, 500.49 → 500). */
export function roundDgExportLineWeightKg(value: string | number | undefined | null): number {
  const n = typeof value === 'number' ? value : parseDgWeightKg(value);
  if (!n) return 0;
  return Math.round(n);
}

export function formatDgExportLineWeightKg(value: string | number | undefined | null): string {
  return formatDgWeightKgGrossDisplay(value);
}

/** Manifest export total — same rows and rounding as inventory / PDF / Excel table. */
export function dgContainersExportTotalKg(
  containers: readonly DgOnboardContainer[],
  useGrossWeight = true,
  roundWeights = false,
  mergeLines = true,
): number {
  return dgInventoryDisplayTotalKg(containers, {
    manifestMergeLines: mergeLines,
    manifestUseGrossWeight: useGrossWeight,
    manifestRoundWeights: roundWeights,
  });
}

export function dgOnboardExportTotalKg(
  onboard: readonly DgOnboardContainer[],
  includeDischarged = false,
): number {
  const visible = includeDischarged ? onboard : onboard.filter((c) => c.status === 'onboard');
  return dgContainersExportTotalKg(visible);
}

export function dgViewContainerTotalKg(
  container: { id: string; lines: readonly DgCargoLine[] },
  options: DgManifestViewOptions,
): number {
  return sumPlannedDgLineWeightsKg(
    dgContainerDisplayRawWeights(container, options),
    options.manifestRoundWeights,
  );
}

export function dgContainerTotalKg(
  container: Pick<DgOnboardContainer, 'lines'>,
  useGross = false,
): number {
  return roundDgWeightKgSum(
    container.lines.reduce((sum, line) => sum + dgLineActiveWeightKg(line, useGross), 0),
  );
}

/** True when every container linked to this manifest import is discharged. */
export function dgManifestAllContainersDischarged(
  manifestId: string,
  onboard: readonly DgOnboardContainer[],
): boolean {
  const linked = onboard.filter((c) => c.sourceManifestId === manifestId);
  if (!linked.length) return false;
  return linked.every((c) => c.status === 'discharged');
}

export function dgOnboardInventoryStats(
  onboard: readonly DgOnboardContainer[],
  includeDischarged = false,
): {
  containerCount: number;
  lineCount: number;
  totalKg: number;
  dischargedCount: number;
} {
  const visible = includeDischarged ? onboard : onboard.filter((c) => c.status === 'onboard');
  const dischargedCount = onboard.filter((c) => c.status === 'discharged').length;
  return {
    containerCount: visible.length,
    lineCount: visible.reduce((n, c) => n + c.lines.length, 0),
    totalKg: roundDgWeightKgSum(visible.reduce((n, c) => n + dgContainerTotalKg(c), 0)),
    dischargedCount,
  };
}

export function dgViewOnboardInventoryStats(
  onboard: readonly DgOnboardContainer[],
  includeDischarged: boolean,
  options: DgManifestViewOptions,
  displayLineCount?: (container: DgOnboardContainer) => number,
): ReturnType<typeof dgOnboardInventoryStats> {
  const base = dgOnboardInventoryStats(onboard, includeDischarged);
  const visible = includeDischarged ? onboard : onboard.filter((c) => c.status === 'onboard');
  return {
    ...base,
    lineCount: displayLineCount
      ? visible.reduce((n, c) => n + displayLineCount(c), 0)
      : base.lineCount,
    totalKg: dgInventoryDisplayTotalKg(visible, options),
  };
}

export interface DgClassSummaryRow {
  dgClass: string;
  totalKg: number;
  unNumbers: readonly string[];
}

export function dgClassSortKey(dgClass: string): number {
  const n = parseFloat(dgClass.trim().replace(',', '.'));
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
}

export function dgUnSortKey(unNo: string): number {
  const n = parseInt(unNo.trim(), 10);
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
}

/** Totals by IMDG class and unique UN numbers (onboard inventory only). */
export function dgOnboardClassSummaries(
  onboard: readonly DgOnboardContainer[],
  includeDischarged = false,
  useGross = false,
  roundWeights = false,
): DgClassSummaryRow[] {
  const visible = includeDischarged ? onboard : onboard.filter((c) => c.status === 'onboard');
  const finalize = roundWeights
    ? (total: number) => total
    : (total: number) => roundDgWeightKgSum(total);
  const weightForLine = roundWeights
    ? (line: DgCargoLine) => Math.round(dgLineActiveWeightKg(line, useGross))
    : (line: DgCargoLine) => dgLineActiveWeightKg(line, useGross);
  return dgClassSummariesFromLines(visible, weightForLine, finalize);
}

export function dgViewOnboardClassSummaries(
  onboard: readonly DgOnboardContainer[],
  includeDischarged: boolean,
  options: DgManifestViewOptions,
): DgClassSummaryRow[] {
  const useGross = options.manifestUseGrossWeight;
  const roundWeights = options.manifestRoundWeights;
  const visible = includeDischarged ? onboard : onboard.filter((c) => c.status === 'onboard');
  const containers = options.manifestMergeLines
    ? visible.map((container) => ({
        ...container,
        lines: mergeDgCargoLinesForSummary(container.lines, useGross),
      }))
    : visible;
  const finalize = roundWeights
    ? (total: number) => total
    : (total: number) => roundDgWeightKgSum(total);
  const weightForLine = roundWeights
    ? (line: DgCargoLine) => Math.round(dgLineActiveWeightKg(line, useGross))
    : (line: DgCargoLine) => dgLineActiveWeightKg(line, useGross);
  return dgClassSummariesFromLines(containers, weightForLine, finalize);
}

function mergeDgCargoLinesForSummary(
  lines: readonly DgCargoLine[],
  useGross: boolean,
): DgCargoLine[] {
  return mergeDgCargoLines(lines, useGross).map((row) => ({
    id: row.mergeKey,
    dgClass: row.dgClass,
    unNo: row.unNo,
    mpLq: row.mpLq,
    flashPoint: row.flashPoint,
    properShippingName: row.properShippingName,
    weightKg: formatDgWeightKgDisplay(row.weightSum) || String(row.weightSum),
  }));
}

function dgClassSummariesFromLines(
  containers: readonly DgOnboardContainer[],
  lineWeight: (line: DgCargoLine) => number,
  finalizeTotal: (total: number) => number,
): DgClassSummaryRow[] {
  const map = new Map<string, { dgClass: string; totalKg: number; unSet: Set<string> }>();

  for (const container of containers) {
    for (const line of container.lines) {
      const dgClass = line.dgClass.trim();
      const unNo = line.unNo.trim();
      const weight = lineWeight(line);
      if (!dgClass && !unNo && !weight) continue;

      const key = dgClass.replace(',', '.').toLowerCase() || '__unknown__';
      if (!map.has(key)) {
        map.set(key, { dgClass: dgClass || '—', totalKg: 0, unSet: new Set() });
      }
      const entry = map.get(key)!;
      if (dgClass) entry.dgClass = dgClass;
      entry.totalKg += weight;
      if (unNo) entry.unSet.add(unNo);
    }
  }

  return [...map.values()]
    .map((entry) => ({
      dgClass: entry.dgClass,
      totalKg: finalizeTotal(entry.totalKg),
      unNumbers: [...entry.unSet].sort((a, b) => {
        const cmp = dgUnSortKey(a) - dgUnSortKey(b);
        return cmp || a.localeCompare(b, undefined, { sensitivity: 'base' });
      }),
    }))
    .filter((entry) => entry.totalKg > 0)
    .sort((a, b) => {
      const cmp = dgClassSortKey(a.dgClass) - dgClassSortKey(b.dgClass);
      return cmp || a.dgClass.localeCompare(b.dgClass, undefined, { sensitivity: 'base' });
    });
}

/** @deprecated */
export function dgDocumentTotalKg(document: DgManifestDocument): number {
  return (document.containers ?? []).reduce((sum, c) => sum + dgContainerTotalKg(c), 0);
}

/** @deprecated */
export function dgDocumentLineCount(document: DgManifestDocument): number {
  return (document.containers ?? []).reduce((sum, c) => sum + c.lines.length, 0);
}

export function resolveDgMasterName(crew: readonly CrewMember[]): string {
  const active = crew.filter((m) => !m.archived);
  const master = active.find((m) => /^master$/i.test(m.rank.trim()));
  if (!master) return '';
  const given = master.givenNames?.trim() ?? '';
  const family = master.familyName?.trim() ?? '';
  const first = given.split(/\s+/).find(Boolean);
  const initial = first ? `${first[0].toUpperCase()}.` : '';
  if (initial && family) return `${initial} ${family}`;
  return formatShipSecurityOfficerName(master);
}

export function dgDefaultVoyageFromShip(ship: ShipInfo): string {
  return ship.voyageNumber?.trim() ?? '';
}

export function createDefaultDgManifestForm(): DgManifestFormSettings {
  return {
    vesselDisplay: '',
    voyageNumber: '',
    masterName: '',
    portOfDeparture: '',
    portOfArrival: '',
    departureDate: '',
    arrivalDate: '',
    rows: [],
  };
}

export function normalizeDgManifestForm(
  raw: Partial<DgManifestFormSettings> | undefined,
): DgManifestFormSettings {
  return normalizeLegacyDgManifestForm(raw ?? {});
}

export function createDgManifestRow(
  partial?: Partial<Omit<DgManifestRow, 'id'> & { id?: string }>,
): DgManifestRow {
  return createLegacyDgManifestRow(partial);
}

export function dgManifestTotalKg(rows: readonly DgManifestRow[]): number {
  return rows.reduce((sum, row) => sum + parseDgWeightKg(row.weightKg), 0);
}

export type DgCargoLineField = keyof Omit<DgCargoLine, 'id'>;
export type DgOnboardContainerField = keyof Omit<
  DgOnboardContainer,
  'id' | 'lines' | 'status' | 'sourceManifestId'
>;
