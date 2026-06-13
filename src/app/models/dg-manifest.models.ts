import {
  CrewMember,
  Port,
  ShipInfo,
  formatShipSecurityOfficerName,
  resolveKnownPortName,
} from './crew.models';

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
  properShippingName: string;
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
export type DgContainerEntry = Omit<DgOnboardContainer, 'loadPort' | 'dischargePort' | 'status' | 'sourceManifestId'>;

export interface DgLibrarySettings {
  manifests: DgManifestDocument[];
  onboard: DgOnboardContainer[];
  showDischarged: boolean;
  /** @deprecated */
  documents?: DgManifestDocument[];
  activeDocumentId?: string;
  sortBy?: DgSortMode;
}

export function createDgCargoLine(
  partial?: Partial<Omit<DgCargoLine, 'id'> & { id?: string }>,
): DgCargoLine {
  const existingId = (partial?.id ?? '').trim();
  return {
    id: existingId || crypto.randomUUID(),
    dgClass: (partial?.dgClass ?? '').trim(),
    unNo: (partial?.unNo ?? '').trim(),
    weightKg: (partial?.weightKg ?? '').trim(),
    properShippingName: (partial?.properShippingName ?? '').trim(),
  };
}

export function createDgOnboardContainer(
  partial?: Partial<Omit<DgOnboardContainer, 'id' | 'lines'> & {
    id?: string;
    lines?: DgCargoLine[];
  }>,
): DgOnboardContainer {
  const existingId = (partial?.id ?? '').trim();
  const lines = Array.isArray(partial?.lines)
    ? partial.lines.map((l) => createDgCargoLine(l))
    : [];
  const status: DgContainerStatus =
    partial?.status === 'discharged' ? 'discharged' : 'onboard';
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
  partial?: Partial<Omit<DgManifestDocument, 'id' | 'addedAt' | 'containerCount' | 'containers'>> & {
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
    (m) =>
      (content && m.contentFingerprint === content) ||
      (pdf && m.pdfBytesFingerprint === pdf),
  );
}

export function createDefaultDgLibrary(): DgLibrarySettings {
  return {
    manifests: [],
    onboard: [],
    showDischarged: false,
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
): DgLibrarySettings {
  const rawManifests = raw?.manifests ?? raw?.documents;
  if (raw && (Array.isArray(rawManifests) || Array.isArray(raw.onboard))) {
    const manifests = (rawManifests ?? []).map((m) =>
      sanitizeDgManifestPorts(createDgManifestDocument(m ?? {}), ports),
    );
    let onboard = Array.isArray(raw.onboard)
      ? raw.onboard.map((c) =>
          sanitizeDgOnboardPorts(createDgOnboardContainer(c ?? {}), ports),
        )
      : [];

    if (!onboard.length && rawManifests?.length) {
      onboard = flattenManifestContainersToOnboard(
        (rawManifests ?? []).map((m) => createDgManifestDocument(m ?? {})),
      ).map((c) => sanitizeDgOnboardPorts(c, ports));
    }

    return {
      manifests,
      onboard,
      showDischarged: raw.showDischarged === true,
    };
  }

  if (legacy) {
    const migrated = migrateLegacyDgForm(legacy, ports);
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
  };
}

function normalizeLegacyDgManifestForm(raw: Partial<DgManifestFormSettings>): DgManifestFormSettings {
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
  const map = new Map<string, Pick<DgOnboardContainer, 'containerNo' | 'type' | 'stowage' | 'lines'>>();
  for (const row of rows) {
    const hasCargo = row.unNo || row.dgClass || row.properShippingName || row.weightKg;
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
          properShippingName: row.properShippingName,
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
    const rowWithPorts = rows.find(
      (r) => (r.containerNo ?? '').trim() === g.containerNo && (r.pol || r.pod),
    );
    const loadPort = resolveKnownPortName(
      (rowWithPorts?.pol ?? defaultLoadPort).trim(),
      ports,
    );
    const dischargePort = resolveKnownPortName(
      (rowWithPorts?.pod ?? defaultDischargePort).trim(),
      ports,
    );
    return createDgOnboardContainer({
      ...g,
      loadPort,
      dischargePort,
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

export function parseDgWeightKg(value: string | undefined | null): number {
  const cleaned = String(value ?? '')
    .replace(/\s/g, '')
    .replace(',', '.');
  if (!cleaned) return 0;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function dgContainerTotalKg(
  container: Pick<DgOnboardContainer, 'lines'>,
): number {
  return container.lines.reduce((sum, line) => sum + parseDgWeightKg(line.weightKg), 0);
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
  const visible = includeDischarged
    ? onboard
    : onboard.filter((c) => c.status === 'onboard');
  const dischargedCount = onboard.filter((c) => c.status === 'discharged').length;
  return {
    containerCount: visible.length,
    lineCount: visible.reduce((n, c) => n + c.lines.length, 0),
    totalKg: visible.reduce((n, c) => n + dgContainerTotalKg(c), 0),
    dischargedCount,
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
): DgClassSummaryRow[] {
  const visible = includeDischarged
    ? onboard
    : onboard.filter((c) => c.status === 'onboard');

  const map = new Map<string, { dgClass: string; totalKg: number; unSet: Set<string> }>();

  for (const container of visible) {
    for (const line of container.lines) {
      const dgClass = line.dgClass.trim();
      const unNo = line.unNo.trim();
      const weight = parseDgWeightKg(line.weightKg);
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
      totalKg: entry.totalKg,
      unNumbers: [...entry.unSet].sort((a, b) => {
        const cmp = dgUnSortKey(a) - dgUnSortKey(b);
        return cmp || a.localeCompare(b, undefined, { sensitivity: 'base' });
      }),
    }))
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
