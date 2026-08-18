// Pure normalization & migration logic for AppData.
//
// Extracted from StorageService to keep that service focused on state + persistence.
// Everything here is a pure function: it takes raw (possibly legacy / partial) data
// and returns normalized data. No signals, no I/O, no `this`.
//
// Schema is ADDITIVE (see CLAUDE.md): every field is read as `raw.X ?? default`, new
// fields get empty defaults in old data, old data is preserved. Do not add destructive
// migrations here.

import {
  AppData,
  createDefaultDocumentOverlayPrefs,
  createEmptyShipAssetsMeta,
  DocumentStampOptions,
  CrewEffectStampOptions,
  CrewMember,
  Port,
  PortCallHistoryEntry,
  createDefaultCrewArrSettings,
  createDefaultOutputSettings,
  CustomDocument,
  PortPackage,
  PortAuthority,
  PortPackageItem,
  createDefaultPortOfCallSettings,
  createEmptyPortCallEntry,
  createEmptyShip,
  mergePorts,
  mergeUniqueList,
  normalizeCrewDocuments,
  migrateCrewListFlags,
  migrateCrewMember,
  migratePortsRaw,
  resolvePortRef,
  normalizePortSecLvl,
  normalizePortSettingsDocId,
  normalizePortTerminals,
  normalizeShipStoresDocId,
} from '../models/crew.models';
import {
  PassengerMember,
  createDefaultPaxArrSettings,
  normalizePaxListType,
  migratePassengerMember,
} from '../models/passenger.models';
import { APP_DATA_SCHEMA_VERSION } from '../data/empty-app-data';
import { POC_DEFAULT_ROW_COUNT, POC_MAX_ROW_COUNT, POC_MIN_ROW_COUNT } from './port-of-call-coordinates';
import { PORT_OF_CALL_HTML_MAX_ROWS_PER_PAGE } from '../models/port-of-call-form-01.paths';
import {
  normalizeCrewEffectForm,
  normalizeCrewEffectForm02,
  normalizeCrewEffectForm03,
} from '../models/crew-effect.models';
import { normalizeNilListForm } from '../models/nil-list.models';
import { normalizeShipMoneyForm } from '../models/ship-money.models';
import {
  normalizeShipStoresForm,
  normalizeShipStoresForm02,
  normalizeShipStoresForm03,
} from '../models/ship-stores.models';
import { normalizeCashAdvanceForm } from '../models/cash-advance.models';
import { normalizeCrewMoneyListForm } from '../models/crew-money-list.models';
import { normalizeNarcoticListForm } from '../models/narcotic-list.models';
import { normalizeDgLibrary } from '../models/dg-manifest.models';
import { normalizeReeferLibrary } from '../models/reefer.models';
import { normalizeEtaLibrary } from '../models/eta.models';
import {
  isCrewListForm05CssBox,
  normalizeCrewListDocumentPrefs,
  type CrewEffectHtmlFormStampOptions,
  type PaxHtmlFormStampOptions,
  type PortOfCallHtmlFormStampOptions,
  type ShipStoresHtmlFormStampOptions,
  type NilListHtmlFormStampOptions,
} from '../models/document-overlay.models';
import { isValidStampBox } from '../utils/overlay-stamp-box.util';
import { normalizeCrewSignatureByRow } from '../utils/crew-effect-signature.util';
import {
  normalizeCrewSignatureCellByRow,
  readCrewEffectHtmlOverlayBox,
} from '../utils/crew-effect-html-overlay.util';

/** Normalize raw (possibly legacy / partial) persisted data into a complete AppData. */
export function normalizeAppData(raw: Partial<AppData> & { ports?: unknown }): AppData {
  const ship = { ...createEmptyShip(), ...raw.ship };
  let crew = (raw.crew ?? []).map((m) => normalizeMember(m, raw.ports));
  const crewArr = { ...createDefaultCrewArrSettings(), ...raw.crewArr };
  // Ports/ranks/nationalities are user-managed suggestion lists: keep exactly what
  // was saved (so Settings deletions are permanent) and only derive from referenced
  // data / defaults on first run, when the field is absent.
  const portsProvided = Array.isArray(raw.ports);
  // When ports were saved, keep EXACTLY them (dedupe only). Do NOT route through
  // mergePorts on the saved list — only derive missing ports from ship/crew refs.
  let ports = portsProvided
    ? dedupePorts(raw.ports as unknown[])
    : mergePorts(
        [],
        ship.portOfCall,
        ship.lastPortOfCall,
        ship.nextPortOfCall,
        ship.homeport,
        ship.waterTestPort,
        ship.sanitationCertificateIssuedAt,
        ...crew.map((c) => c.joiningPort),
      );
  ship.homeport = resolvePortRef(ship.homeport, ports)?.name ?? ship.homeport;
  ship.waterTestPort = resolvePortRef(ship.waterTestPort, ports)?.name ?? ship.waterTestPort;
  ship.sanitationCertificateIssuedAt =
    resolvePortRef(ship.sanitationCertificateIssuedAt, ports)?.name ??
    ship.sanitationCertificateIssuedAt;
  ship.portOfCall = resolvePortRef(ship.portOfCall, ports)?.name ?? ship.portOfCall;
  ship.lastPortOfCall = resolvePortRef(ship.lastPortOfCall, ports)?.name ?? ship.lastPortOfCall;
  ship.nextPortOfCall = resolvePortRef(ship.nextPortOfCall, ports)?.name ?? ship.nextPortOfCall;
  crew = crew.map((m) => ({
    ...m,
    joiningPort: resolvePortRef(m.joiningPort, ports)?.name ?? m.joiningPort,
  }));
  crew = rescueOrphanCrew(crew);
  let passengers = (raw.passengers ?? []).map((m) => normalizePassenger(m, raw.ports));
  passengers = rescueOrphanPassengers(passengers);
  const paxArr = {
    ...createDefaultPaxArrSettings(),
    ...raw.paxArr,
    listType: normalizePaxListType(raw.paxArr?.listType),
  };
  const ranks = Array.isArray(raw.ranks)
    ? mergeUniqueList(raw.ranks)
    : mergeUniqueList([], ...crew.map((c) => c.rank));
  const nationalities = Array.isArray(raw.nationalities)
    ? mergeUniqueList(raw.nationalities)
    : mergeUniqueList(
        [],
        ship.nationality,
        ...crew.map((c) => c.nationality),
        ...passengers.map((p) => p.nationality),
      );
  const portCallHistory = normalizePortCallHistory(raw, ports);
  if (!portsProvided) {
    ports = mergePorts(ports, ...portCallHistory.map((e) => e.portName));
  }
  const portOfCall = normalizePortOfCallSettings(raw.portOfCall);
  const shipStoresForm = normalizeShipStoresForm(raw.shipStoresForm);
  const { shipStoresForm02, shipStoresForm03 } = normalizeShipStoresForms(raw);
  const crewEffectForm = normalizeCrewEffectForm(raw.crewEffectForm);
  const { crewEffectForm02, crewEffectForm03 } = normalizeCrewEffectForms(raw);
  const nilListForm = normalizeNilListForm(raw.nilListForm);
  const shipMoneyForm = normalizeShipMoneyForm(raw.shipMoneyForm);
  const cashAdvanceForm = normalizeCashAdvanceForm(raw.cashAdvanceForm);
  const crewMoneyListForm = normalizeCrewMoneyListForm(raw.crewMoneyListForm);
  const narcoticListForm = normalizeNarcoticListForm(raw.narcoticListForm);
  const dgLibrary = normalizeDgLibrary(
    raw.dgLibrary,
    (
      raw as Partial<
        AppData & { dgManifestForm?: import('../models/dg-manifest.models').DgManifestFormSettings }
      >
    ).dgManifestForm,
    ports,
    ship,
  );
  const reeferLibrary = normalizeReeferLibrary(raw.reeferLibrary, ports, ship);
  const etaLibrary = normalizeEtaLibrary(raw.etaLibrary);
  const documentOverlay = normalizeDocumentOverlay(raw.documentOverlay, raw);
  const shipAssets = { ...createEmptyShipAssetsMeta(), ...raw.shipAssets };
  const outputSettings = normalizeOutputSettings(raw.outputSettings);
  const printPackages = normalizePrintPackages(
    migrateLegacyPrintPackageDocIds(raw.printPackages, raw.seedVersion),
  );
  const customDocuments = normalizeCustomDocuments(raw.customDocuments);
  return {
    ship,
    crew,
    crewArrivalOrder: normalizeListOrder(raw.crewArrivalOrder),
    crewDepartureOrder: normalizeListOrder(raw.crewDepartureOrder),
    crewArr,
    passengers,
    passengerArrivalOrder: normalizeListOrder(raw.passengerArrivalOrder),
    passengerDepartureOrder: normalizeListOrder(raw.passengerDepartureOrder),
    paxArr,
    ports,
    ranks: mergeUniqueList(ranks),
    nationalities: mergeUniqueList(nationalities),
    portCallHistory,
    portOfCall,
    shipStoresSettingsDocId: normalizeShipStoresDocId(raw.shipStoresSettingsDocId),
    shipStoresForm,
    shipStoresForm02,
    shipStoresForm03,
    crewEffectForm,
    crewEffectForm02,
    crewEffectForm03,
    nilListForm,
    shipMoneyForm,
    cashAdvanceForm,
    crewMoneyListForm,
    narcoticListForm,
    dgLibrary,
    reeferLibrary,
    etaLibrary,
    documentOverlay,
    shipAssets,
    outputSettings,
    printPackages,
    customDocuments,
    seedVersion: APP_DATA_SCHEMA_VERSION,
  };
}

function normalizeListOrder(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const ids = raw.map((id) => String(id).trim()).filter(Boolean);
  return ids.length ? ids : undefined;
}

function normalizeCustomDocuments(raw: unknown): CustomDocument[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((d) => ({
      id: String((d as CustomDocument)?.id ?? '').trim() || crypto.randomUUID(),
      name: String((d as CustomDocument)?.name ?? '').trim(),
      dataBase64: String((d as CustomDocument)?.dataBase64 ?? ''),
    }))
    .filter((d) => d.name && d.dataBase64);
}

/** Dedupe a saved ports array WITHOUT injecting DEFAULT_PORTS (keeps user deletions). */
function dedupePorts(raw: unknown[]): Port[] {
  const map = new Map<string, Port>();
  for (const p of raw) {
    if (typeof p === 'string') {
      const name = p.trim();
      if (name) map.set(name.toLowerCase(), { name, code: '', country: '' });
    } else if (p && typeof p === 'object' && 'name' in p) {
      const port = p as Port;
      if (port.name) {
        map.set(port.name.toLowerCase(), {
          name: port.name,
          code: port.code || '',
          country: port.country || '',
          terminals: normalizePortTerminals(port.terminals),
        });
      }
    }
  }
  return [...map.values()];
}

function migrateLegacyPrintPackageDocIds(raw: unknown, seedVersion: unknown): unknown {
  if (typeof seedVersion === 'number' && seedVersion >= APP_DATA_SCHEMA_VERSION) {
    return raw;
  }
  if (!Array.isArray(raw)) return raw;
  return raw.map((pkg) => {
    const authorities = (pkg as PortPackage)?.authorities;
    if (!Array.isArray(authorities)) return pkg;
    return {
      ...(pkg as PortPackage),
      authorities: authorities.map((auth) => ({
        ...auth,
        items: auth.items.map((item) => {
          if (item.documentId === 'shipStores02') {
            return { ...item, documentId: 'shipStores03' };
          }
          if (item.documentId === 'crewEffect02') {
            return { ...item, documentId: 'crewEffect03' };
          }
          return item;
        }),
      })),
    };
  });
}

function normalizePrintPackages(raw: unknown): PortPackage[] {
  if (!Array.isArray(raw)) return [];
  const normItems = (items: unknown): PortPackageItem[] =>
    Array.isArray(items)
      ? items.map((it) => ({
          documentId: String((it as PortPackageItem)?.documentId ?? '').trim(),
          copies: Math.max(
            1,
            Math.min(99, Math.round(Number((it as PortPackageItem)?.copies) || 1)),
          ),
        }))
      : [];

  const byPort = new Map<string, PortAuthority[]>();
  for (const pkg of raw) {
    const port = String((pkg as PortPackage)?.port ?? '').trim();
    if (!port) continue;
    let authorities: PortAuthority[];
    if (Array.isArray((pkg as PortPackage).authorities)) {
      authorities = (pkg as PortPackage).authorities.map((a) => ({
        name: String((a as PortAuthority)?.name ?? '').trim(),
        items: normItems((a as PortAuthority)?.items),
        includeInPrint: (a as PortAuthority)?.includeInPrint !== false,
      }));
    } else if (Array.isArray((pkg as { items?: unknown }).items)) {
      // Legacy: flat items -> single "General" authority.
      authorities = [
        {
          name: 'General',
          items: normItems((pkg as { items?: unknown }).items),
          includeInPrint: true,
        },
      ];
    } else {
      authorities = [];
    }
    byPort.set(port, authorities);
  }
  return [...byPort.entries()].map(([port, authorities]) => ({ port, authorities }));
}

export function normalizeOutputSettings(
  raw: Partial<AppData['outputSettings']> | undefined,
): AppData['outputSettings'] {
  const defaults = createDefaultOutputSettings();
  const savedPaths = Array.from(
    new Set(
      (Array.isArray(raw?.savedPaths) ? raw!.savedPaths : [])
        .map((p) => String(p).trim())
        .filter((p) => p.length > 0),
    ),
  ).slice(0, 5);
  return {
    saveToFolder: raw?.saveToFolder === true,
    activePath: (raw?.activePath ?? defaults.activePath).trim(),
    savedPaths,
    printerName: (raw?.printerName ?? defaults.printerName).trim(),
  };
}

function normalizeDocumentOverlay(
  raw: Partial<AppData['documentOverlay']> | undefined,
  appRaw?: Partial<AppData>,
): AppData['documentOverlay'] {
  const defaults = createDefaultDocumentOverlayPrefs();
  const seedVersion = typeof appRaw?.seedVersion === 'number' ? appRaw.seedVersion : 0;
  const migrateShipStoresOverlay =
    seedVersion < APP_DATA_SCHEMA_VERSION && raw?.shipStores03 == null && raw?.shipStores02 != null;
  const migrateCrewEffectOverlay =
    seedVersion < APP_DATA_SCHEMA_VERSION && raw?.crewEffect03 == null && raw?.crewEffect02 != null;

  const shipStores02Raw = migrateShipStoresOverlay ? undefined : raw?.shipStores02;
  const shipStores03Raw = migrateShipStoresOverlay ? raw?.shipStores02 : raw?.shipStores03;
  const crewEffect02Raw = migrateCrewEffectOverlay ? undefined : raw?.crewEffect02;
  const crewEffect03Raw = migrateCrewEffectOverlay ? raw?.crewEffect02 : raw?.crewEffect03;

  const out: AppData['documentOverlay'] = {
    crewList: normalizeCrewListDocumentPrefs(raw?.crewList),
    pax: normalizePaxHtmlFormPrefs(raw?.pax, defaults.pax),
    paxV2: normalizePaxHtmlFormPrefs(raw?.paxV2, defaults.paxV2),
    portOfCall: normalizePortOfCallHtmlFormPrefs(raw?.portOfCall, defaults.portOfCall),
    portsOfCall: normalizePortOfCallHtmlFormPrefs(raw?.portsOfCall, defaults.portsOfCall),
    mdh: normalizeStampDocumentPrefs(raw?.mdh, defaults.mdh),
    crewVaccine: normalizeStampDocumentPrefs(raw?.crewVaccine, defaults.crewVaccine),
    shipStores: normalizeShipStoresHtmlFormPrefs(raw?.shipStores, defaults.shipStores),
    shipStores02: normalizeShipStoresHtmlFormPrefs(shipStores02Raw, defaults.shipStores02),
    shipStores03: normalizeStampDocumentPrefs(
      shipStores03Raw as Partial<DocumentStampOptions> | undefined,
      defaults.shipStores03,
    ),
    crewEffect: normalizeCrewEffectHtmlFormPrefs(raw?.crewEffect, defaults.crewEffect),
    crewEffect02: normalizeCrewEffectHtmlFormPrefs(crewEffect02Raw, defaults.crewEffect02),
    crewEffect03: normalizeCrewEffectStampPrefs(
      crewEffect03Raw as Partial<CrewEffectStampOptions> | undefined,
      defaults.crewEffect03,
    ),
    nilList: normalizeNilListHtmlFormPrefs(raw?.nilList, defaults.nilList),
    shipMoney: normalizeStampDocumentPrefs(raw?.shipMoney, defaults.shipMoney),
    cashAdvance: normalizeStampDocumentPrefs(raw?.cashAdvance, defaults.cashAdvance),
    crewMoney: normalizeStampDocumentPrefs(raw?.crewMoney, defaults.crewMoney),
    narcoticList: normalizeStampDocumentPrefs(raw?.narcoticList, defaults.narcoticList),
    sso0108PortCalls: normalizeStampDocumentPrefs(raw?.sso0108PortCalls, defaults.sso0108PortCalls),
  };
  return out;
}

function normalizeStampDocumentPrefs<T extends DocumentStampOptions>(
  raw: Partial<T> | undefined,
  defaults: T,
  extra?: Omit<T, keyof DocumentStampOptions>,
): T {
  const base: DocumentStampOptions = {
    useStamp: raw?.useStamp ?? defaults.useStamp,
    useSignature: raw?.useSignature ?? defaults.useSignature,
    useStampAttachment: raw?.useStampAttachment ?? defaults.useStampAttachment ?? false,
    useSignatureAttachment: raw?.useSignatureAttachment ?? defaults.useSignatureAttachment ?? false,
    ...(typeof raw?.overlayRotation === 'number' ? { overlayRotation: raw.overlayRotation } : {}),
    ...(typeof raw?.overlayRotationAttachment === 'number'
      ? { overlayRotationAttachment: raw.overlayRotationAttachment }
      : {}),
    ...(isValidStampBox(raw?.stampBox) ? { stampBox: { ...raw!.stampBox! } } : {}),
    ...(isValidStampBox(raw?.stampBoxAttachment)
      ? { stampBoxAttachment: { ...raw!.stampBoxAttachment! } }
      : {}),
    ...(isValidStampBox(raw?.signatureBox) ? { signatureBox: { ...raw!.signatureBox! } } : {}),
    ...(isValidStampBox(raw?.signatureBoxAttachment)
      ? { signatureBoxAttachment: { ...raw!.signatureBoxAttachment! } }
      : {}),
  };
  return { ...defaults, ...extra, ...base } as T;
}

function preserveHtmlFormCssOverlayBoxes<
  T extends { stampBox?: unknown; signatureBox?: unknown },
>(raw: Partial<{ stampBox?: unknown; signatureBox?: unknown }> | undefined, out: T): void {
  if (isCrewListForm05CssBox(raw?.stampBox)) {
    out.stampBox = raw.stampBox;
  }
  if (isCrewListForm05CssBox(raw?.signatureBox)) {
    out.signatureBox = raw.signatureBox;
  }
}

function normalizeShipStoresHtmlFormPrefs(
  raw: Partial<ShipStoresHtmlFormStampOptions> | undefined,
  defaults: ShipStoresHtmlFormStampOptions,
): ShipStoresHtmlFormStampOptions {
  const base = normalizeStampDocumentPrefs(
    raw as Partial<DocumentStampOptions>,
    defaults as DocumentStampOptions,
  );
  const out: ShipStoresHtmlFormStampOptions = { ...base };
  preserveHtmlFormCssOverlayBoxes(raw, out);
  if (raw?.cellStyles && typeof raw.cellStyles === 'object') {
    out.cellStyles = raw.cellStyles;
  }
  if (raw?.cellValues && typeof raw.cellValues === 'object') {
    out.cellValues = raw.cellValues;
  }
  return out;
}

function normalizeNilListHtmlFormPrefs(
  raw: Partial<NilListHtmlFormStampOptions> | undefined,
  defaults: NilListHtmlFormStampOptions,
): NilListHtmlFormStampOptions {
  const base = normalizeStampDocumentPrefs(
    raw as Partial<DocumentStampOptions>,
    defaults as DocumentStampOptions,
  );
  const out: NilListHtmlFormStampOptions = { ...base };
  preserveHtmlFormCssOverlayBoxes(raw, out);
  return out;
}

function normalizePortOfCallHtmlFormPrefs(
  raw: Partial<PortOfCallHtmlFormStampOptions> | undefined,
  defaults: PortOfCallHtmlFormStampOptions,
): PortOfCallHtmlFormStampOptions {
  const base = normalizeStampDocumentPrefs(raw, defaults);
  const out: PortOfCallHtmlFormStampOptions = { ...base };
  preserveHtmlFormCssOverlayBoxes(raw, out);
  if (raw?.cellStyles && typeof raw.cellStyles === 'object') {
    out.cellStyles = raw.cellStyles;
  }
  if (raw?.cellValues && typeof raw.cellValues === 'object') {
    out.cellValues = raw.cellValues;
  }
  const rows = raw?.rowsPerPage ?? defaults.rowsPerPage ?? POC_DEFAULT_ROW_COUNT;
  out.rowsPerPage = Math.min(PORT_OF_CALL_HTML_MAX_ROWS_PER_PAGE, Math.max(POC_MIN_ROW_COUNT, rows));
  if (typeof raw?.footerSignatureDate === 'string') {
    out.footerSignatureDate = raw.footerSignatureDate;
  }
  if (typeof raw?.footerMasterName === 'string') {
    out.footerMasterName = raw.footerMasterName;
  }
  if (raw?.dateDisplayFormat === 'dot' || raw?.dateDisplayFormat === 'shortMonth' || raw?.dateDisplayFormat === 'fullMonth' || raw?.dateDisplayFormat === 'isoSlash') {
    out.dateDisplayFormat = raw.dateDisplayFormat;
  }
  return out;
}

function normalizePaxHtmlFormPrefs(
  raw: Partial<PaxHtmlFormStampOptions> | undefined,
  defaults: PaxHtmlFormStampOptions,
): PaxHtmlFormStampOptions {
  const base = normalizeStampDocumentPrefs(raw, defaults);
  const out: PaxHtmlFormStampOptions = { ...base };
  if (raw?.cellStyles && typeof raw.cellStyles === 'object') {
    out.cellStyles = raw.cellStyles;
  }
  if (typeof raw?.footerSignatureDate === 'string') {
    out.footerSignatureDate = raw.footerSignatureDate;
  }
  if (typeof raw?.footerMasterName === 'string') {
    out.footerMasterName = raw.footerMasterName;
  }
  if (isCrewListForm05CssBox(raw?.stampBox)) {
    out.stampBox = raw.stampBox;
  }
  if (isCrewListForm05CssBox(raw?.signatureBox)) {
    out.signatureBox = raw.signatureBox;
  }
  return out;
}

function normalizeCrewEffectHtmlFormPrefs(
  raw: Partial<CrewEffectHtmlFormStampOptions> | undefined,
  defaults: CrewEffectHtmlFormStampOptions,
): CrewEffectHtmlFormStampOptions {
  const stampCss = readCrewEffectHtmlOverlayBox(raw?.stampBox);
  const signatureCss = readCrewEffectHtmlOverlayBox(raw?.signatureBox, {
    stampIsCss: !!stampCss,
    isMasterSignature: true,
  });
  const out: CrewEffectHtmlFormStampOptions = {
    useStamp: raw?.useStamp ?? defaults.useStamp ?? false,
    useSignature: raw?.useSignature ?? defaults.useSignature ?? false,
    useCrewSignatures: raw?.useCrewSignatures ?? defaults.useCrewSignatures ?? false,
    crewSignatureByRow: normalizeCrewSignatureCellByRow(
      raw?.crewSignatureByRow as Record<string, unknown> | undefined,
    ),
  };
  if (stampCss) out.stampBox = stampCss;
  if (signatureCss) out.signatureBox = signatureCss;
  if (raw?.cellStyles && typeof raw.cellStyles === 'object') {
    out.cellStyles = raw.cellStyles;
  }
  if (raw?.cellValues && typeof raw.cellValues === 'object') {
    out.cellValues = raw.cellValues;
  }
  return out;
}

function normalizeCrewEffectStampPrefs(
  raw: Partial<CrewEffectStampOptions> | undefined,
  defaults: CrewEffectStampOptions,
): CrewEffectStampOptions {
  const base = normalizeStampDocumentPrefs(raw, defaults);
  const out: CrewEffectStampOptions = {
    ...base,
    useCrewSignatures: raw?.useCrewSignatures ?? defaults.useCrewSignatures ?? false,
    ...(isValidStampBox(raw?.crewSignatureBase)
      ? { crewSignatureBase: { ...raw!.crewSignatureBase! } }
      : defaults.crewSignatureBase
        ? { crewSignatureBase: { ...defaults.crewSignatureBase } }
        : {}),
    crewSignatureByRow: normalizeCrewSignatureByRow(
      raw?.crewSignatureByRow as Record<string, unknown> | undefined,
    ),
  };
  preserveHtmlFormCssOverlayBoxes(raw, out);
  return out;
}

function normalizePortCallHistory(raw: Partial<AppData>, ports: Port[]): PortCallHistoryEntry[] {
  const history = (raw.portCallHistory ?? []).map((entry) => ({
    ...createEmptyPortCallEntry(),
    ...entry,
    id: entry.id || crypto.randomUUID(),
  }));

  return history.map((entry) => ({
    ...entry,
    portName: resolvePortRef(entry.portName, ports)?.name ?? entry.portName,
    secLvl: normalizePortSecLvl(entry.secLvl),
  }));
}

export function normalizePortOfCallSettings(
  raw: Partial<AppData['portOfCall']> | undefined,
): AppData['portOfCall'] {
  const defaults = createDefaultPortOfCallSettings();
  const count = raw?.pdfRowCount ?? defaults.pdfRowCount;
  return {
    pdfRowCount: Math.min(POC_MAX_ROW_COUNT, Math.max(POC_MIN_ROW_COUNT, count)),
    settingsDocId: normalizePortSettingsDocId(raw?.settingsDocId ?? defaults.settingsDocId),
  };
}

function normalizeMember(
  raw: Partial<CrewMember> & { familyNameGivenNames?: string },
  portsRaw?: unknown,
): CrewMember {
  const ports = migratePortsRaw(portsRaw);
  const member = migrateCrewMember(raw);
  if (member.joiningPort) {
    member.joiningPort = resolvePortRef(member.joiningPort, ports)?.name ?? member.joiningPort;
  }
  return normalizeCrewDocuments(migrateCrewListFlags(member));
}

function normalizePassenger(
  raw: Partial<PassengerMember> & { familyNameGivenNames?: string },
  portsRaw?: unknown,
): PassengerMember {
  return migratePassengerMember(raw);
}

function normalizeShipStoresForms(raw: Partial<AppData>): {
  shipStoresForm02: ReturnType<typeof normalizeShipStoresForm02>;
  shipStoresForm03: ReturnType<typeof normalizeShipStoresForm03>;
} {
  const seedVersion = typeof raw.seedVersion === 'number' ? raw.seedVersion : 0;
  const migrateGermanyTo03 = seedVersion < APP_DATA_SCHEMA_VERSION && raw.shipStoresForm03 == null;

  if (migrateGermanyTo03) {
    return {
      shipStoresForm02: normalizeShipStoresForm02(undefined),
      shipStoresForm03: normalizeShipStoresForm03(raw.shipStoresForm02),
    };
  }

  return {
    shipStoresForm02: normalizeShipStoresForm02(raw.shipStoresForm02),
    shipStoresForm03: normalizeShipStoresForm03(raw.shipStoresForm03),
  };
}

function normalizeCrewEffectForms(raw: Partial<AppData>): {
  crewEffectForm02: ReturnType<typeof normalizeCrewEffectForm02>;
  crewEffectForm03: ReturnType<typeof normalizeCrewEffectForm03>;
} {
  const seedVersion = typeof raw.seedVersion === 'number' ? raw.seedVersion : 0;
  const migrateGermanyTo03 = seedVersion < APP_DATA_SCHEMA_VERSION && raw.crewEffectForm03 == null;

  if (migrateGermanyTo03) {
    return {
      crewEffectForm02: normalizeCrewEffectForm02(undefined),
      crewEffectForm03: normalizeCrewEffectForm03(raw.crewEffectForm02),
    };
  }

  return {
    crewEffectForm02: normalizeCrewEffectForm02(raw.crewEffectForm02),
    crewEffectForm03: normalizeCrewEffectForm03(raw.crewEffectForm03),
  };
}

export function rescueOrphanCrew(crew: CrewMember[]): CrewMember[] {
  return crew.map((m) => {
    if (m.archived || m.onArrivalList || m.onDepartureList) return m;
    return { ...m, archived: true, onArrivalList: false, onDepartureList: false };
  });
}

export function rescueOrphanPassengers(passengers: PassengerMember[]): PassengerMember[] {
  return passengers.map((m) => {
    if (m.archived || m.onArrivalList || m.onDepartureList) return m;
    return { ...m, archived: true, onArrivalList: false, onDepartureList: false };
  });
}
