import { Injectable, inject, signal, computed } from '@angular/core';
import {
  AppData,
  createDefaultDocumentOverlayPrefs,
  normalizeCrewListType,
  createEmptyShipAssetsMeta,
  DocumentOverlayId,
  DocumentOverlayPrefs,
  DocumentStampOptions,
  CrewMember,
  Port,
  PortCallHistoryEntry,
  createDefaultCrewArrSettings,
  createDefaultCrewEffectForm,
  createDefaultNilListForm,
  createDefaultShipMoneyForm,
  createDefaultCashAdvanceForm,
  createDefaultCrewMoneyListForm,
  createDefaultNarcoticListForm,
  createDefaultOutputSettings,
  createDefaultPrintPackages,
  createDefaultCustomDocuments,
  CustomDocument,
  PortPackage,
  PortAuthority,
  PortPackageItem,
  createDefaultPortOfCallSettings,
  createDefaultShipStoresForm,
  createEmptyCrewMember,
  createEmptyPortCallEntry,
  createEmptyShip,
  ShipInfo,
  mergePorts,
  mergeUniqueList,
  CrewListKind,
  DepartureToArrivalSyncPreview,
  ArrivalToDepartureSyncPreview,
  CrewDocumentType,
  migrateCrewListFlags,
  normalizeCrewDocuments,
  migrateCrewMember,
  migratePortsRaw,
  resolveKnownPortName,
  resolveManifestPortName,
  resolvePortRef,
  crewRankOrder,
  filterActiveCrewList,
  activeCrewListIds,
  sortCrewByRank,
  shipFieldPersistNotify,
  areCrewListsInSync,
  crewListDiffCounts,
  normalizePortSecLvl,
  normalizePortTerminals,
  type CrewEffectDocId,
  type ShipStoresDocId,
  crewEffectFormField,
  shipStoresFormField,
} from '../models/crew.models';
import { ToastService } from './toast.service';
import {
  PassengerMember,
  PaxListKind,
  createDefaultPaxArrSettings,
  normalizePaxListType,
  PASSENGER_RANK,
  createEmptyPassenger,
  migratePassengerListFlags,
  migratePassengerMember,
  sortPassengersByName,
  arePassengerListsInSync,
  passengerListDiffCounts,
  filterActivePassengerList,
  activePassengerListIds,
} from '../models/passenger.models';
import { APP_DATA_SCHEMA_VERSION, createEmptyAppData } from '../data/empty-app-data';
import { extractMainAppSnapshot, mergeMainAppSnapshotIntoLive } from '../utils/app-snapshot.util';
import { POC_MAX_ROW_COUNT, POC_MIN_ROW_COUNT } from './port-of-call-coordinates';
import {
  normalizeCrewEffectForm,
  normalizeCrewEffectForm02,
  normalizeCrewEffectForm03,
  type CrewEffectForm02Settings,
  type CrewEffectForm03Settings,
  type CrewEffectFormSettings,
} from '../models/crew-effect.models';
import {
  createNilListPhrase,
  normalizeNilListForm,
  type NilListFormSettings,
} from '../models/nil-list.models';
import {
  createShipMoneyEntry,
  normalizeShipMoneyForm,
} from '../models/ship-money.models';
import {
  normalizeShipStoresForm,
  normalizeShipStoresForm02,
  normalizeShipStoresForm03,
  SHIP_STORES_02_ROW_COUNT,
  SHIP_STORES_03_ROW_COUNT,
  SHIP_STORES_ROW_COUNT,
  type ShipStoresFormSettings,
  type ShipStoresRow,
} from '../models/ship-stores.models';
import {
  normalizeCashAdvanceForm,
  type CashAdvanceFormSettings,
} from '../models/cash-advance.models';
import {
  normalizeCrewMoneyListForm,
  type CrewMoneyListFormSettings,
} from '../models/crew-money-list.models';
import {
  createNarcoticMedicineEntry,
  normalizeNarcoticListForm,
  type NarcoticMedicineEntry,
  type NarcoticListFormSettings,
} from '../models/narcotic-list.models';
import {
  createDgCargoLine,
  createDgManifestDocument,
  createDgOnboardContainer,
  createDefaultDgLibrary,
  commitDgWeightKgInput,
  dgDefaultVoyageFromShip,
  normalizeDgLibrary,
  onboardContainersFromImportRows,
  findDgManifestDuplicate,
  type DgCargoLine,
  type DgLibrarySettings,
  type DgManifestDocument,
  type DgOnboardContainer,
} from '../models/dg-manifest.models';
import type { DgManifestImportResult } from './dg-manifest-import.service';
import {
  createDgUnifeederRow,
  createDgUnifeederManifestDocument,
  findUnifeederManifestDuplicate,
  resolveUnifeederRowPort,
  type DgUnifeederLibrarySettings,
  type DgUnifeederRow,
} from '../models/dg-unifeeder.models';
import {
  cmaContainersToUnifeederRows,
  unifeederRowsToCmaContainers,
} from '../utils/dg-inventory-transfer.util';
import type { UnifeederPdfParseResult } from '../utils/dg-unifeeder-pdf.util';
import {
  createReeferManifestDocument,
  createReeferOnboardUnit,
  createDefaultReeferLibrary,
  findReeferManifestDuplicate,
  mergeReeferImportIntoOnboard,
  normalizeReeferLibrary,
  reeferUnitsFromImportRows,
  type ReeferLibrarySettings,
  type ReeferOnboardUnit,
} from '../models/reefer.models';
import type { ReeferImportResult } from './reefer-import.service';
import {
  crewListVariantPatch,
  CREW_LIST_TYPE_IDS,
  getCrewListVariantSettings,
  normalizeCrewListDocumentPrefs,
  CrewListOverlayUpdate,
} from '../models/document-overlay.models';
import { isValidStampBox } from '../utils/overlay-stamp-box.util';
import {
  resolveDgPageContextFromSnapshot,
  resolveReeferPageContextFromSnapshot,
} from '../utils/page-ship-context.util';

const STORAGE_KEY = 'crew-app-data';

@Injectable({ providedIn: 'root' })
export class StorageService {
  /** Set when a modal form auto-saves silently; cleared after Saved toast on close. */
  private formSessionDirty = false;
  private readonly toast = inject(ToastService);
  private readonly data = signal<AppData>(createEmptyAppData());

  readonly ship = computed(() => this.data().ship);
  readonly crewArr = computed(() => this.data().crewArr);
  readonly ports = computed(() => this.data().ports);
  readonly ranks = computed(() => this.data().ranks);
  readonly nationalities = computed(() => this.data().nationalities);
  readonly portCallHistory = computed(() => this.data().portCallHistory);
  readonly portOfCall = computed(() => this.data().portOfCall);
  readonly shipStoresForm = computed(() => this.data().shipStoresForm);
  readonly shipStoresForm02 = computed(() => this.data().shipStoresForm02);
  readonly shipStoresForm03 = computed(() => this.data().shipStoresForm03);
  readonly crewEffectForm = computed(() => this.data().crewEffectForm);
  readonly crewEffectForm02 = computed(() => this.data().crewEffectForm02);
  readonly crewEffectForm03 = computed(() => this.data().crewEffectForm03);
  readonly nilListForm = computed(() => this.data().nilListForm);
  readonly shipMoneyForm = computed(() => this.data().shipMoneyForm);
  readonly cashAdvanceForm = computed(() => this.data().cashAdvanceForm);
  readonly crewMoneyListForm = computed(() => this.data().crewMoneyListForm);
  readonly narcoticListForm = computed(() => this.data().narcoticListForm);
  readonly dgLibrary = computed(() => this.data().dgLibrary);
  readonly reeferLibrary = computed(() => this.data().reeferLibrary);
  readonly documentOverlay = computed(() => this.data().documentOverlay);
  readonly shipAssets = computed(() => this.data().shipAssets);
  readonly outputSettings = computed(() => this.data().outputSettings);
  readonly printPackages = computed(() => this.data().printPackages);
  readonly customDocuments = computed(() => this.data().customDocuments);
  readonly activeCrewArrival = computed(() =>
    filterActiveCrewList(this.data().crew, 'arrival', this.data().crewArrivalOrder),
  );
  readonly activeCrewDeparture = computed(() =>
    filterActiveCrewList(this.data().crew, 'departure', this.data().crewDepartureOrder),
  );
  readonly crewListsInSync = computed(() =>
    areCrewListsInSync(
      this.data().crew,
      this.data().crewArrivalOrder,
      this.data().crewDepartureOrder,
    ),
  );
  readonly crewListDiff = computed(() => crewListDiffCounts(this.data().crew));
  /** @deprecated Use activeCrewArrival — kept for crew-arr page default. */
  readonly activeCrew = this.activeCrewArrival;
  readonly archivedCrew = computed(() => {
    const archived = this.data().crew.filter((m) => m.archived);
    const rankOrder = crewRankOrder(this.data().ranks, this.data().crew);
    return sortCrewByRank(archived, rankOrder);
  });
  readonly allCrew = computed(() => this.data().crew);
  readonly paxArr = computed(() => this.data().paxArr);
  readonly activePassengersArrival = computed(() =>
    filterActivePassengerList(
      this.data().passengers,
      'arrival',
      this.data().passengerArrivalOrder,
    ),
  );
  readonly activePassengersDeparture = computed(() =>
    filterActivePassengerList(
      this.data().passengers,
      'departure',
      this.data().passengerDepartureOrder,
    ),
  );
  readonly passengerListsInSync = computed(() =>
    arePassengerListsInSync(
      this.data().passengers,
      this.data().passengerArrivalOrder,
      this.data().passengerDepartureOrder,
    ),
  );
  readonly passengerListDiff = computed(() => passengerListDiffCounts(this.data().passengers));
  readonly archivedPassengers = computed(() =>
    sortPassengersByName(this.data().passengers.filter((m) => m.archived)),
  );
  readonly allPassengers = computed(() => this.data().passengers);

  async init(): Promise<void> {
    const electron = window.electronAPI;
    if (electron) {
      const loaded = await electron.readData();
      if (loaded) {
        const normalized = this.normalize(loaded);
        this.data.set(normalized);
        if ((loaded.seedVersion ?? 0) < APP_DATA_SCHEMA_VERSION) {
          await this.persist('silent');
        }
        return;
      }
      this.data.set(createEmptyAppData());
      await this.persist('silent');
      return;
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<AppData>;
        const normalized = this.normalize(parsed);
        this.data.set(normalized);
        if ((parsed.seedVersion ?? 0) < APP_DATA_SCHEMA_VERSION) {
          await this.persist('silent');
        }
      } catch {
        this.data.set(createEmptyAppData());
        await this.persist('silent');
      }
    } else {
      this.data.set(createEmptyAppData());
      await this.persist('silent');
    }
  }

  private normalize(raw: Partial<AppData> & { ports?: unknown }): AppData {
    const ship = { ...createEmptyShip(), ...raw.ship };
    let crew = (raw.crew ?? []).map((m) => this.normalizeMember(m, raw.ports));
    const crewArr = { ...createDefaultCrewArrSettings(), ...raw.crewArr };
    // Ports/ranks/nationalities are user-managed suggestion lists: keep exactly what
    // was saved (so Settings deletions are permanent) and only derive from referenced
    // data / defaults on first run, when the field is absent.
    const portsProvided = Array.isArray(raw.ports);
    // When ports were saved, keep EXACTLY them (dedupe only). Do NOT route through
    // mergePorts on the saved list — only derive missing ports from ship/crew refs.
    let ports = portsProvided
      ? this.dedupePorts(raw.ports as unknown[])
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
      resolvePortRef(ship.sanitationCertificateIssuedAt, ports)?.name ?? ship.sanitationCertificateIssuedAt;
    ship.portOfCall = resolvePortRef(ship.portOfCall, ports)?.name ?? ship.portOfCall;
    ship.lastPortOfCall = resolvePortRef(ship.lastPortOfCall, ports)?.name ?? ship.lastPortOfCall;
    ship.nextPortOfCall = resolvePortRef(ship.nextPortOfCall, ports)?.name ?? ship.nextPortOfCall;
    crew = crew.map((m) => ({
      ...m,
      joiningPort: resolvePortRef(m.joiningPort, ports)?.name ?? m.joiningPort,
    }));
    crew = this.rescueOrphanCrew(crew);
    let passengers = (raw.passengers ?? []).map((m) => this.normalizePassenger(m, raw.ports));
    passengers = this.rescueOrphanPassengers(passengers);
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
    const portCallHistory = this.normalizePortCallHistory(raw, ports);
    if (!portsProvided) {
      ports = mergePorts(ports, ...portCallHistory.map((e) => e.portName));
    }
    const portOfCall = this.normalizePortOfCallSettings(raw.portOfCall);
    const shipStoresForm = normalizeShipStoresForm(raw.shipStoresForm);
    const { shipStoresForm02, shipStoresForm03 } = this.normalizeShipStoresForms(raw);
    const crewEffectForm = normalizeCrewEffectForm(raw.crewEffectForm);
    const { crewEffectForm02, crewEffectForm03 } = this.normalizeCrewEffectForms(raw);
    const nilListForm = normalizeNilListForm(raw.nilListForm);
    const shipMoneyForm = normalizeShipMoneyForm(raw.shipMoneyForm);
    const cashAdvanceForm = normalizeCashAdvanceForm(raw.cashAdvanceForm);
    const crewMoneyListForm = normalizeCrewMoneyListForm(raw.crewMoneyListForm);
    const narcoticListForm = normalizeNarcoticListForm(raw.narcoticListForm);
    const dgLibrary = normalizeDgLibrary(
      raw.dgLibrary,
      (raw as Partial<AppData & { dgManifestForm?: import('../models/dg-manifest.models').DgManifestFormSettings }>)
        .dgManifestForm,
      ports,
      ship,
    );
    const reeferLibrary = normalizeReeferLibrary(raw.reeferLibrary, ports, ship);
    const documentOverlay = this.normalizeDocumentOverlay(raw.documentOverlay, raw);
    const shipAssets = { ...createEmptyShipAssetsMeta(), ...raw.shipAssets };
    const outputSettings = this.normalizeOutputSettings(raw.outputSettings);
    const printPackages = this.normalizePrintPackages(
      this.migrateLegacyPrintPackageDocIds(raw.printPackages, raw.seedVersion),
    );
    const customDocuments = this.normalizeCustomDocuments(raw.customDocuments);
    return {
      ship,
      crew,
      crewArrivalOrder: this.normalizeListOrder(raw.crewArrivalOrder),
      crewDepartureOrder: this.normalizeListOrder(raw.crewDepartureOrder),
      crewArr,
      passengers,
      passengerArrivalOrder: this.normalizeListOrder(raw.passengerArrivalOrder),
      passengerDepartureOrder: this.normalizeListOrder(raw.passengerDepartureOrder),
      paxArr,
      ports,
      ranks: mergeUniqueList(ranks),
      nationalities: mergeUniqueList(nationalities),
      portCallHistory,
      portOfCall,
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
      documentOverlay,
      shipAssets,
      outputSettings,
      printPackages,
      customDocuments,
      seedVersion: APP_DATA_SCHEMA_VERSION,
    };
  }

  private normalizeListOrder(raw: unknown): string[] | undefined {
    if (!Array.isArray(raw)) return undefined;
    const ids = raw.map((id) => String(id).trim()).filter(Boolean);
    return ids.length ? ids : undefined;
  }

  private reorderIdList(ids: readonly string[], fromIndex: number, toIndex: number): string[] {
    const next = [...ids];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
  }

  private reorderMembersInCrewArray(
    crew: CrewMember[],
    list: CrewListKind,
    fromIndex: number,
    toIndex: number,
  ): CrewMember[] {
    const inList = (m: CrewMember) =>
      list === 'arrival'
        ? !m.archived && m.onArrivalList
        : !m.archived && m.onDepartureList;
    const indices: number[] = [];
    const members: CrewMember[] = [];
    crew.forEach((m, i) => {
      if (inList(m)) {
        indices.push(i);
        members.push(m);
      }
    });
    const reordered = [...members];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    const next = [...crew];
    indices.forEach((idx, j) => {
      next[idx] = reordered[j];
    });
    return next;
  }

  private normalizeCustomDocuments(raw: unknown): CustomDocument[] {
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
  private dedupePorts(raw: unknown[]): Port[] {
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

  private migrateLegacyPrintPackageDocIds(raw: unknown, seedVersion: unknown): unknown {
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

  private normalizePrintPackages(raw: unknown): PortPackage[] {
    if (!Array.isArray(raw)) return [];
    const normItems = (items: unknown): PortPackageItem[] =>
      Array.isArray(items)
        ? items.map((it) => ({
            documentId: String((it as PortPackageItem)?.documentId ?? '').trim(),
            copies: Math.max(1, Math.min(99, Math.round(Number((it as PortPackageItem)?.copies) || 1))),
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
        authorities = [{ name: 'General', items: normItems((pkg as { items?: unknown }).items), includeInPrint: true }];
      } else {
        authorities = [];
      }
      byPort.set(port, authorities);
    }
    return [...byPort.entries()].map(([port, authorities]) => ({ port, authorities }));
  }

  private normalizeOutputSettings(
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

  private normalizeDocumentOverlay(
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
      crewList: this.normalizeCrewListPrefs(raw?.crewList),
      pax: this.normalizeStampDocumentPrefs(raw?.pax, defaults.pax),
      paxV2: this.normalizeStampDocumentPrefs(raw?.paxV2, defaults.paxV2),
      portOfCall: this.normalizeStampDocumentPrefs(raw?.portOfCall, defaults.portOfCall),
      portsOfCall: this.normalizeStampDocumentPrefs(raw?.portsOfCall, defaults.portsOfCall),
      mdh: this.normalizeStampDocumentPrefs(raw?.mdh, defaults.mdh),
      crewVaccine: this.normalizeStampDocumentPrefs(raw?.crewVaccine, defaults.crewVaccine),
      shipStores: this.normalizeStampDocumentPrefs(raw?.shipStores, defaults.shipStores),
      shipStores02: this.normalizeStampDocumentPrefs(shipStores02Raw, defaults.shipStores02),
      shipStores03: this.normalizeStampDocumentPrefs(shipStores03Raw, defaults.shipStores03),
      crewEffect: this.normalizeStampDocumentPrefs(raw?.crewEffect, defaults.crewEffect),
      crewEffect02: this.normalizeStampDocumentPrefs(crewEffect02Raw, defaults.crewEffect02),
      crewEffect03: this.normalizeStampDocumentPrefs(crewEffect03Raw, defaults.crewEffect03),
      nilList: this.normalizeStampDocumentPrefs(raw?.nilList, defaults.nilList),
      shipMoney: this.normalizeStampDocumentPrefs(raw?.shipMoney, defaults.shipMoney),
      cashAdvance: this.normalizeStampDocumentPrefs(raw?.cashAdvance, defaults.cashAdvance),
      crewMoney: this.normalizeStampDocumentPrefs(raw?.crewMoney, defaults.crewMoney),
      narcoticList: this.normalizeStampDocumentPrefs(raw?.narcoticList, defaults.narcoticList),
      sso0108PortCalls: this.normalizeStampDocumentPrefs(
        raw?.sso0108PortCalls,
        defaults.sso0108PortCalls,
      ),
    };
    return out;
  }

  private normalizeStampDocumentPrefs<T extends DocumentStampOptions>(
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

  private normalizeCrewListPrefs(
    raw: Partial<AppData['documentOverlay']['crewList']> | undefined,
  ): AppData['documentOverlay']['crewList'] {
    return normalizeCrewListDocumentPrefs(raw);
  }

  private normalizePortCallHistory(
    raw: Partial<AppData>,
    ports: Port[],
  ): PortCallHistoryEntry[] {
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

  private normalizePortOfCallSettings(raw: Partial<AppData['portOfCall']> | undefined): AppData['portOfCall'] {
    const defaults = createDefaultPortOfCallSettings();
    const count = raw?.pdfRowCount ?? defaults.pdfRowCount;
    return {
      pdfRowCount: Math.min(POC_MAX_ROW_COUNT, Math.max(POC_MIN_ROW_COUNT, count)),
    };
  }

  private normalizeMember(
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

  private normalizePassenger(
    raw: Partial<PassengerMember> & { familyNameGivenNames?: string },
    portsRaw?: unknown,
  ): PassengerMember {
    const ports = migratePortsRaw(portsRaw);
    return migratePassengerMember(raw);
  }

  private async persist(notify: 'silent' | 'saved' | 'debounced' = 'debounced'): Promise<void> {
    const payload = { ...this.data(), seedVersion: APP_DATA_SCHEMA_VERSION };
    const electron = window.electronAPI;
    if (electron) {
      await electron.writeData(payload);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    }
    if (notify === 'silent') {
      this.formSessionDirty = true;
    } else if (notify === 'saved') {
      this.toast.cancelDebouncedSaved();
      this.toast.showSaved();
      this.formSessionDirty = false;
    } else if (notify === 'debounced') {
      this.toast.debouncedSaved();
    }
  }

  /** Call when a Done / backdrop closes a settings modal (after silent auto-save). */
  finishFormSession(): void {
    this.toast.cancelDebouncedSaved();
    if (this.formSessionDirty) {
      this.toast.showSaved();
      this.formSessionDirty = false;
    }
  }

  updateShip(
    partial: Partial<AppData['ship']>,
    notify?: 'silent' | 'saved' | 'debounced',
  ): void {
    // Ports/nationalities are user-managed (Settings) — do not auto-add referenced values.
    this.data.update((d) => ({ ...d, ship: { ...d.ship, ...partial } }));
    const fields = Object.keys(partial) as (keyof ShipInfo)[];
    const mode =
      notify ?? (fields.length === 1 ? shipFieldPersistNotify(fields[0]) : 'debounced');
    void this.persist(mode);
  }

  updateCrewArr(partial: Partial<AppData['crewArr']>, notify: 'silent' | 'saved' = 'saved'): void {
    this.data.update((d) => ({ ...d, crewArr: { ...d.crewArr, ...partial } }));
    void this.persist(notify);
  }

  updatePaxArr(partial: Partial<AppData['paxArr']>, notify: 'silent' | 'saved' = 'saved'): void {
    this.data.update((d) => ({ ...d, paxArr: { ...d.paxArr, ...partial } }));
    void this.persist(notify);
  }

  addPort(name: string, code: string, country = ''): void {
    const n = name.trim();
    if (!n) return;
    this.data.update((d) => ({
      ...d,
      ports: mergePorts(d.ports, { name: n, code: code.trim(), country: country.trim() }),
    }));
    void this.persist('silent');
    this.toast.showPortAdded();
  }

  removePort(name: string): void {
    this.data.update((d) => ({ ...d, ports: d.ports.filter((p) => p.name !== name) }));
    void this.persist('silent');
    this.toast.showPortDeleted();
  }

  addPortTerminal(portName: string, abbrev: string, name: string): void {
    const a = abbrev.trim();
    const n = name.trim();
    if (!a && !n) return;
    this.data.update((d) => ({
      ...d,
      ports: d.ports.map((p) => {
        if (p.name !== portName) return p;
        const terminals = normalizePortTerminals([...(p.terminals ?? []), { abbrev: a, name: n }]);
        return { ...p, terminals };
      }),
    }));
    void this.persist('silent');
  }

  removePortTerminal(portName: string, terminalIndex: number): void {
    this.data.update((d) => ({
      ...d,
      ports: d.ports.map((p) => {
        if (p.name !== portName) return p;
        const terminals = (p.terminals ?? []).filter((_, i) => i !== terminalIndex);
        return { ...p, terminals };
      }),
    }));
    void this.persist('silent');
  }

  addRank(name: string): void {
    const v = name.trim();
    if (!v) return;
    this.data.update((d) => ({ ...d, ranks: mergeUniqueList(d.ranks, v) }));
    void this.persist('silent');
    this.toast.showRankAdded();
  }

  removeRank(name: string): void {
    this.data.update((d) => ({ ...d, ranks: d.ranks.filter((r) => r !== name) }));
    void this.persist('silent');
    this.toast.showRankDeleted();
  }

  reorderRanks(previousIndex: number, currentIndex: number): void {
    this.data.update((d) => {
      const ranks = [...d.ranks];
      const [moved] = ranks.splice(previousIndex, 1);
      ranks.splice(currentIndex, 0, moved);
      return { ...d, ranks };
    });
    void this.persist('saved');
  }

  addNationality(name: string): void {
    const v = name.trim();
    if (!v) return;
    this.data.update((d) => ({ ...d, nationalities: mergeUniqueList(d.nationalities, v) }));
    void this.persist('silent');
    this.toast.showNationalityAdded();
  }

  removeNationality(name: string): void {
    this.data.update((d) => ({ ...d, nationalities: d.nationalities.filter((n) => n !== name) }));
    void this.persist('silent');
    this.toast.showNationalityDeleted();
  }

  reorderNationalities(previousIndex: number, currentIndex: number): void {
    this.data.update((d) => {
      const nationalities = [...d.nationalities];
      const [moved] = nationalities.splice(previousIndex, 1);
      nationalities.splice(currentIndex, 0, moved);
      return { ...d, nationalities };
    });
    void this.persist('saved');
  }

  reorderPorts(previousIndex: number, currentIndex: number): void {
    this.data.update((d) => {
      const ports = [...d.ports];
      const [moved] = ports.splice(previousIndex, 1);
      ports.splice(currentIndex, 0, moved);
      return { ...d, ports };
    });
    void this.persist('saved');
  }

  updateDocumentOverlay(
    documentId: DocumentOverlayId,
    partial: Partial<DocumentOverlayPrefs[DocumentOverlayId]>,
    notify: 'silent' | 'saved' = 'silent',
  ): void {
    if (documentId === 'crewList') {
      this.updateCrewListOverlay(
        partial as Partial<AppData['documentOverlay']['crewList']>,
        notify,
      );
      return;
    }
    this.data.update((d) => ({
      ...d,
      documentOverlay: {
        ...d.documentOverlay,
        [documentId]: { ...d.documentOverlay[documentId], ...partial },
      },
    }));
    void this.persist(notify);
  }

  private updateCrewListOverlay(
    partial: CrewListOverlayUpdate,
    notify: 'silent' | 'saved' = 'silent',
  ): void {
    const variantPatch = crewListVariantPatch(partial);

    this.data.update((d) => {
      const current = d.documentOverlay.crewList;
      const nextListType = partial.listType ?? current.listType;
      const byType = { ...current.byType };

      if (variantPatch) {
        const activeType = current.listType;
        byType[activeType] = {
          ...getCrewListVariantSettings(current, activeType),
          ...variantPatch,
        };
      }

      return {
        ...d,
        documentOverlay: {
          ...d.documentOverlay,
          crewList: { listType: nextListType, byType },
        },
      };
    });
    void this.persist(notify);
  }

  /** Apply stamp/signature toggles to all document types at once. */
  applyStampTogglesToAllDocuments(useStamp: boolean, useSignature: boolean): void {
    const patch: Pick<
      DocumentStampOptions,
      'useStamp' | 'useSignature' | 'useStampAttachment' | 'useSignatureAttachment'
    > = {
      useStamp,
      useSignature,
      useStampAttachment: useStamp,
      useSignatureAttachment: useSignature,
    };
    this.data.update((d) => {
      const crewList = d.documentOverlay.crewList;
      const byType = { ...crewList.byType };
      for (const id of CREW_LIST_TYPE_IDS) {
        byType[id] = { ...getCrewListVariantSettings(crewList, id), ...patch };
      }
      return {
        ...d,
        documentOverlay: {
          crewList: { ...crewList, byType },
          pax: { ...d.documentOverlay.pax, ...patch },
          paxV2: { ...d.documentOverlay.paxV2, ...patch },
          portOfCall: { ...d.documentOverlay.portOfCall, ...patch },
          portsOfCall: { ...d.documentOverlay.portsOfCall, ...patch },
          mdh: { ...d.documentOverlay.mdh, ...patch },
          crewVaccine: { ...d.documentOverlay.crewVaccine, ...patch },
          shipStores: { ...d.documentOverlay.shipStores, ...patch },
          shipStores02: { ...d.documentOverlay.shipStores02, ...patch },
          shipStores03: { ...d.documentOverlay.shipStores03, ...patch },
          crewEffect: { ...d.documentOverlay.crewEffect, ...patch },
          crewEffect02: { ...d.documentOverlay.crewEffect02, ...patch },
          crewEffect03: { ...d.documentOverlay.crewEffect03, ...patch },
          nilList: { ...d.documentOverlay.nilList, ...patch },
          shipMoney: { ...d.documentOverlay.shipMoney, ...patch },
          cashAdvance: { ...d.documentOverlay.cashAdvance, ...patch },
          crewMoney: { ...d.documentOverlay.crewMoney, ...patch },
          narcoticList: { ...d.documentOverlay.narcoticList, ...patch },
          sso0108PortCalls: { ...d.documentOverlay.sso0108PortCalls, ...patch },
        },
      };
    });
    void this.persist('saved');
  }

  updateCashAdvanceForm(partial: Partial<CashAdvanceFormSettings>): void {
    this.data.update((d) => ({
      ...d,
      cashAdvanceForm: normalizeCashAdvanceForm({ ...d.cashAdvanceForm, ...partial }),
    }));
    void this.persist('silent');
  }

  updateCashAdvanceCrewAmount(
    crewId: string,
    partial: { usd?: string; eur?: string },
  ): void {
    this.data.update((d) => {
      const form = normalizeCashAdvanceForm(d.cashAdvanceForm);
      const prev = form.byCrewId[crewId] ?? { usd: '', eur: '' };
      return {
        ...d,
        cashAdvanceForm: normalizeCashAdvanceForm({
          ...form,
          byCrewId: { ...form.byCrewId, [crewId]: { ...prev, ...partial } },
        }),
      };
    });
    void this.persist('silent');
  }

  updateCrewMoneyListCrewAmount(
    crewId: string,
    partial: { usd?: string; euro?: string; others?: string },
  ): void {
    this.data.update((d) => {
      const form = normalizeCrewMoneyListForm(d.crewMoneyListForm);
      const prev = form.byCrewId[crewId] ?? { usd: '', euro: '', others: '' };
      return {
        ...d,
        crewMoneyListForm: normalizeCrewMoneyListForm({
          ...form,
          byCrewId: { ...form.byCrewId, [crewId]: { ...prev, ...partial } },
        }),
      };
    });
    void this.persist('silent');
  }

  updateNarcoticListEntry(
    id: string,
    partial: Partial<Omit<NarcoticMedicineEntry, 'id'>>,
  ): void {
    this.data.update((d) => {
      const form = normalizeNarcoticListForm(d.narcoticListForm);
      const entries = form.entries.map((e) => (e.id === id ? { ...e, ...partial } : e));
      return { ...d, narcoticListForm: { entries } };
    });
    void this.persist('silent');
  }

  addNarcoticListEntry(
    partial?: Partial<Omit<import('../models/narcotic-list.models').NarcoticMedicineEntry, 'id'>>,
  ): void {
    this.data.update((d) => {
      const form = normalizeNarcoticListForm(d.narcoticListForm);
      return {
        ...d,
        narcoticListForm: normalizeNarcoticListForm({
          entries: [...form.entries, createNarcoticMedicineEntry(partial)],
        }),
      };
    });
    void this.persist('silent');
  }

  removeNarcoticListEntry(id: string): void {
    this.data.update((d) => {
      const form = normalizeNarcoticListForm(d.narcoticListForm);
      return {
        ...d,
        narcoticListForm: normalizeNarcoticListForm({
          entries: form.entries.filter((e) => e.id !== id),
        }),
      };
    });
    void this.persist('silent');
  }

  setActiveDgDocument(_id: string): void {
    /* deprecated — manifests are import log only */
  }

  updateDgShowDischarged(showDischarged: boolean): void {
    this.updateDgManifestView({ showDischarged });
  }

  updateDgManifestView(
    partial: Partial<
      Pick<DgLibrarySettings, 'showDischarged' | 'manifestMergeLines' | 'manifestGrossTotalKg'>
    >,
  ): void {
    this.data.update((d) => ({
      ...d,
      dgLibrary: { ...normalizeDgLibrary(d.dgLibrary, undefined, d.ports, d.ship), ...partial },
    }));
    void this.persist('silent');
  }

  updateDgPageContext(
    partial: Partial<import('../utils/page-ship-context.util').DgPageContext>,
  ): void {
    this.data.update((d) => {
      const lib = normalizeDgLibrary(d.dgLibrary, undefined, d.ports, d.ship);
      return {
        ...d,
        dgLibrary: {
          ...lib,
          pageContext: { ...lib.pageContext, ...partial },
        },
      };
    });
    void this.persist('silent');
  }

  applyDgPageSnapshot(
    dgLibrary: DgLibrarySettings,
    shipCtx: import('../models/dg-page-archive.models').DgPageShipContext,
  ): void {
    this.data.update((d) => {
      const lib = normalizeDgLibrary(structuredClone(dgLibrary), undefined, d.ports);
      const pageContext = resolveDgPageContextFromSnapshot(lib.pageContext, shipCtx);
      return {
        ...d,
        dgLibrary: { ...lib, pageContext },
      };
    });
    void this.persist('silent');
  }

  applyReeferPageSnapshot(
    reeferLibrary: ReeferLibrarySettings,
    shipCtx: import('../models/reefer-page-archive.models').ReeferPageShipContext,
  ): void {
    this.data.update((d) => {
      const lib = normalizeReeferLibrary(structuredClone(reeferLibrary), d.ports);
      const pageContext = resolveReeferPageContextFromSnapshot(lib.pageContext, shipCtx);
      return {
        ...d,
        reeferLibrary: { ...lib, pageContext },
      };
    });
    void this.persist('silent');
  }

  captureMainAppSnapshot(): import('../models/app-snapshot.models').AppMainSnapshot {
    return extractMainAppSnapshot(this.data());
  }

  applyMainAppSnapshot(snapshot: import('../models/app-snapshot.models').AppMainSnapshot): void {
    this.data.update((d) => {
      const merged = mergeMainAppSnapshotIntoLive(d, snapshot);
      return this.normalize({
        ...merged,
        dgLibrary: d.dgLibrary,
        reeferLibrary: d.reeferLibrary,
      });
    });
    void this.persist('silent');
  }

  coerceStoredMainSnapshot(raw: unknown): import('../models/app-snapshot.models').AppMainSnapshot | null {
    if (!raw || typeof raw !== 'object') return null;
    try {
      const empty = createEmptyAppData();
      const merged: Partial<AppData> = {
        ...(raw as Partial<AppData>),
        dgLibrary: empty.dgLibrary,
        reeferLibrary: empty.reeferLibrary,
      };
      return extractMainAppSnapshot(this.normalize(merged));
    } catch {
      return null;
    }
  }

  updateReeferViewSettings(
    partial: Partial<
      Pick<
        ReeferLibrarySettings,
        | 'showDischarged'
        | 'monitoringAddNextDays'
        | 'monitoringNextDays'
        | 'inventorySortColumn'
        | 'inventorySortDirection'
      >
    >,
  ): void {
    this.data.update((d) => ({
      ...d,
      reeferLibrary: { ...normalizeReeferLibrary(d.reeferLibrary, d.ports, d.ship), ...partial },
    }));
    void this.persist('silent');
  }

  updateReeferPageContext(
    partial: Partial<import('../utils/page-ship-context.util').ReeferPageContext>,
  ): void {
    this.data.update((d) => {
      const lib = normalizeReeferLibrary(d.reeferLibrary, d.ports, d.ship);
      return {
        ...d,
        reeferLibrary: {
          ...lib,
          pageContext: { ...lib.pageContext, ...partial },
        },
      };
    });
    void this.persist('silent');
  }

  updateReeferMonitoringSigner(
    which: 'morning' | 'evening',
    index: number,
    field: 'rank' | 'name',
    value: string,
  ): void {
    if (index < 0 || index >= 2) return;
    this.data.update((d) => {
      const lib = normalizeReeferLibrary(d.reeferLibrary, d.ports, d.ship);
      const key = which === 'morning' ? 'monitoringMorningSigners' : 'monitoringEveningSigners';
      const signers = lib[key].map((s, i) =>
        i === index ? { ...s, [field]: value } : s,
      );
      return {
        ...d,
        reeferLibrary: { ...lib, [key]: signers },
      };
    });
    void this.persist('silent');
  }

  updateReeferShowDischarged(showDischarged: boolean): void {
    this.updateReeferViewSettings({ showDischarged });
  }

  setReeferUnitStatus(unitId: string, status: 'onboard' | 'discharged'): void {
    this.updateReeferUnit(unitId, { status });
  }

  addDgOnboardContainer(partial?: Partial<Omit<DgOnboardContainer, 'id' | 'lines'>>): void {
    this.data.update((d) => {
      const lib = normalizeDgLibrary(d.dgLibrary, undefined, d.ports);
      const loadPort = resolveKnownPortName(
        partial?.loadPort ?? d.ship.portOfCall ?? '',
        d.ports,
      );
      const dischargePort = resolveKnownPortName(
        partial?.dischargePort ?? d.ship.nextPortOfCall ?? '',
        d.ports,
      );
      return {
        ...d,
        dgLibrary: {
          ...lib,
          onboard: [
            ...lib.onboard,
            createDgOnboardContainer({
              ...partial,
              loadPort,
              dischargePort,
              status: 'onboard',
            }),
          ],
        },
      };
    });
    void this.persist('silent');
  }

  updateDgOnboardContainer(
    containerId: string,
    partial: Partial<Omit<DgOnboardContainer, 'id' | 'lines' | 'sourceManifestId'>>,
  ): void {
    this.data.update((d) => {
      const lib = normalizeDgLibrary(d.dgLibrary, undefined, d.ports);
      const resolved: typeof partial = { ...partial };
      if ('loadPort' in partial) {
        resolved.loadPort = resolveKnownPortName(partial.loadPort ?? '', d.ports);
      }
      if ('dischargePort' in partial) {
        resolved.dischargePort = resolveKnownPortName(partial.dischargePort ?? '', d.ports);
      }
      return {
        ...d,
        dgLibrary: {
          ...lib,
          onboard: lib.onboard.map((c) =>
            c.id === containerId ? { ...c, ...resolved } : c,
          ),
        },
      };
    });
    void this.persist('silent');
  }

  setDgOnboardContainerStatus(containerId: string, status: 'onboard' | 'discharged'): void {
    this.updateDgOnboardContainer(containerId, { status });
  }

  removeDgOnboardContainer(containerId: string): void {
    this.data.update((d) => {
      const lib = normalizeDgLibrary(d.dgLibrary, undefined, d.ports);
      return {
        ...d,
        dgLibrary: {
          ...lib,
          onboard: lib.onboard.filter((c) => c.id !== containerId),
        },
      };
    });
    void this.persist('silent');
  }

  updateDgOnboardCargoLine(
    containerId: string,
    lineId: string,
    partial: Partial<Omit<DgCargoLine, 'id'>>,
  ): void {
    this.data.update((d) => {
      const lib = normalizeDgLibrary(d.dgLibrary, undefined, d.ports);
      return {
        ...d,
        dgLibrary: {
          ...lib,
          onboard: lib.onboard.map((c) =>
            c.id === containerId
              ? {
                  ...c,
                  lines: c.lines.map((l) => (l.id === lineId ? { ...l, ...partial } : l)),
                }
              : c,
          ),
        },
      };
    });
    void this.persist('silent');
  }

  addDgOnboardCargoLine(
    containerId: string,
    partial?: Partial<Omit<DgCargoLine, 'id'>>,
  ): void {
    this.data.update((d) => {
      const lib = normalizeDgLibrary(d.dgLibrary, undefined, d.ports);
      return {
        ...d,
        dgLibrary: {
          ...lib,
          onboard: lib.onboard.map((c) =>
            c.id === containerId
              ? { ...c, lines: [...c.lines, createDgCargoLine(partial)] }
              : c,
          ),
        },
      };
    });
    void this.persist('silent');
  }

  removeDgOnboardCargoLine(containerId: string, lineId: string): void {
    this.data.update((d) => {
      const lib = normalizeDgLibrary(d.dgLibrary, undefined, d.ports);
      return {
        ...d,
        dgLibrary: {
          ...lib,
          onboard: lib.onboard.map((c) =>
            c.id === containerId
              ? { ...c, lines: c.lines.filter((l) => l.id !== lineId) }
              : c,
          ),
        },
      };
    });
    void this.persist('silent');
  }

  removeDgManifest(id: string): void {
    this.data.update((d) => {
      const lib = normalizeDgLibrary(d.dgLibrary, undefined, d.ports);
      return {
        ...d,
        dgLibrary: {
          ...lib,
          manifests: lib.manifests.filter((m) => m.id !== id),
          onboard: lib.onboard.filter((c) => c.sourceManifestId !== id),
        },
      };
    });
    void this.persist('silent');
  }

  updateUnifeederViewSettings(
    partial: Partial<Pick<DgUnifeederLibrarySettings, 'showDischarged' | 'mergeLines' | 'grossTotalKg'>>,
  ): void {
    this.data.update((d) => {
      const lib = normalizeDgLibrary(d.dgLibrary, undefined, d.ports, d.ship);
      return {
        ...d,
        dgLibrary: {
          ...lib,
          unifeeder: { ...lib.unifeeder, ...partial },
        },
      };
    });
    void this.persist('silent');
  }

  /** Replace UNIFEEDER inventory with a copy of the CMA CGM onboard list. */
  transferCmaDgInventoryToUnifeeder(): number {
    let count = 0;
    this.data.update((d) => {
      const lib = normalizeDgLibrary(d.dgLibrary, undefined, d.ports, d.ship);
      const rows = cmaContainersToUnifeederRows(lib.onboard);
      count = rows.length;
      return {
        ...d,
        dgLibrary: {
          ...lib,
          unifeeder: {
            ...lib.unifeeder,
            manifests: [],
            onboard: rows,
          },
        },
      };
    });
    void this.persist('silent');
    return count;
  }

  /** Replace CMA CGM inventory with a copy of the UNIFEEDER onboard list. */
  transferUnifeederDgInventoryToCma(): number {
    let count = 0;
    this.data.update((d) => {
      const lib = normalizeDgLibrary(d.dgLibrary, undefined, d.ports, d.ship);
      const containers = unifeederRowsToCmaContainers(lib.unifeeder.onboard);
      count = containers.length;
      return {
        ...d,
        dgLibrary: {
          ...lib,
          manifests: [],
          onboard: containers,
        },
      };
    });
    void this.persist('silent');
    return count;
  }

  /** Clear CMA CGM onboard list and import history. */
  clearCmaDgInventory(): void {
    this.data.update((d) => {
      const lib = normalizeDgLibrary(d.dgLibrary, undefined, d.ports, d.ship);
      return {
        ...d,
        dgLibrary: {
          ...lib,
          manifests: [],
          onboard: [],
        },
      };
    });
    void this.persist('silent');
  }

  /** Clear UNIFEEDER onboard list and import history. */
  clearUnifeederDgInventory(): void {
    this.data.update((d) => {
      const lib = normalizeDgLibrary(d.dgLibrary, undefined, d.ports, d.ship);
      return {
        ...d,
        dgLibrary: {
          ...lib,
          unifeeder: {
            ...lib.unifeeder,
            manifests: [],
            onboard: [],
          },
        },
      };
    });
    void this.persist('silent');
  }

  addUnifeederRow(
    partial?: Partial<Omit<DgUnifeederRow, 'id' | 'sourceManifestId'>>,
  ): void {
    this.data.update((d) => {
      const lib = normalizeDgLibrary(d.dgLibrary, undefined, d.ports, d.ship);
      const ctx = lib.pageContext;
      const loadPort = resolveUnifeederRowPort(partial?.loadPort ?? ctx.portOfCall ?? '', d.ports);
      const dischargePort = resolveUnifeederRowPort(
        partial?.dischargePort ?? ctx.nextPortOfCall ?? '',
        d.ports,
      );
      return {
        ...d,
        dgLibrary: {
          ...lib,
          unifeeder: {
            ...lib.unifeeder,
            onboard: [
              ...lib.unifeeder.onboard,
              createDgUnifeederRow({
                ...partial,
                loadPort,
                dischargePort,
                status: 'onboard',
              }),
            ],
          },
        },
      };
    });
    void this.persist('silent');
  }

  updateUnifeederRow(
    rowId: string,
    partial: Partial<Omit<DgUnifeederRow, 'id' | 'sourceManifestId'>>,
  ): void {
    this.data.update((d) => {
      const lib = normalizeDgLibrary(d.dgLibrary, undefined, d.ports, d.ship);
      const resolved: typeof partial = { ...partial };
      if ('loadPort' in partial) {
        resolved.loadPort = resolveUnifeederRowPort(partial.loadPort ?? '', d.ports);
      }
      if ('dischargePort' in partial) {
        resolved.dischargePort = resolveUnifeederRowPort(partial.dischargePort ?? '', d.ports);
      }
      return {
        ...d,
        dgLibrary: {
          ...lib,
          unifeeder: {
            ...lib.unifeeder,
            onboard: lib.unifeeder.onboard.map((row) =>
              row.id === rowId ? createDgUnifeederRow({ ...row, ...resolved, id: row.id }) : row,
            ),
          },
        },
      };
    });
    void this.persist('silent');
  }

  setUnifeederRowStatus(rowId: string, status: 'onboard' | 'discharged'): void {
    this.updateUnifeederRow(rowId, { status });
  }

  removeUnifeederRow(rowId: string): void {
    this.data.update((d) => {
      const lib = normalizeDgLibrary(d.dgLibrary, undefined, d.ports, d.ship);
      return {
        ...d,
        dgLibrary: {
          ...lib,
          unifeeder: {
            ...lib.unifeeder,
            onboard: lib.unifeeder.onboard.filter((row) => row.id !== rowId),
          },
        },
      };
    });
    void this.persist('silent');
  }

  removeUnifeederManifest(id: string): void {
    this.data.update((d) => {
      const lib = normalizeDgLibrary(d.dgLibrary, undefined, d.ports, d.ship);
      return {
        ...d,
        dgLibrary: {
          ...lib,
          unifeeder: {
            ...lib.unifeeder,
            manifests: lib.unifeeder.manifests.filter((m) => m.id !== id),
            onboard: lib.unifeeder.onboard.filter((row) => row.sourceManifestId !== id),
          },
        },
      };
    });
    void this.persist('silent');
  }

  applyUnifeederImport(
    result: UnifeederPdfParseResult,
    sourceName: string,
    fingerprints?: { contentFingerprint?: string; pdfBytesFingerprint?: string },
  ): import('../models/dg-unifeeder.models').DgUnifeederManifestDocument | null {
    const lib = normalizeDgLibrary(this.data().dgLibrary, undefined, this.data().ports, this.data().ship);
    const duplicate = findUnifeederManifestDuplicate(lib.unifeeder.manifests, fingerprints ?? {});
    if (duplicate) return duplicate;

    this.data.update((d) => {
      const libInner = normalizeDgLibrary(d.dgLibrary, undefined, d.ports, d.ship);
      const loadPort = resolveUnifeederRowPort(result.header.portOfDeparture ?? '', d.ports);
      const dischargePort = resolveUnifeederRowPort(result.header.portOfArrival ?? '', d.ports);
      const doc = createDgUnifeederManifestDocument({
        sourceName: sourceName.replace(/\.(pdf|xlsx)$/i, '').trim() || 'Import',
        rowCount: result.rows.length,
        contentFingerprint: fingerprints?.contentFingerprint?.trim() ?? '',
        pdfBytesFingerprint: fingerprints?.pdfBytesFingerprint?.trim() ?? '',
      });
      const imported = result.rows
        .filter((row) => row.containerNo.trim())
        .map((row) =>
          createDgUnifeederRow({
            ...row,
            weightKg: commitDgWeightKgInput(row.weightKg),
            loadPort: resolveUnifeederRowPort(
              row.loadPort || result.header.portOfDeparture || '',
              d.ports,
            ),
            dischargePort: resolveUnifeederRowPort(
              row.dischargePort || result.header.portOfArrival || '',
              d.ports,
            ),
            status: 'onboard',
            sourceManifestId: doc.id,
          }),
        );
      const containerCount = new Set(imported.map((row) => row.containerNo).filter(Boolean)).size;
      const docWithCount = {
        ...doc,
        rowCount: imported.length,
        containerCount,
        voyageNumber: (result.header.voyageNumber ?? '').trim(),
        documentDate: (result.header.departureDate ?? '').trim(),
        loadPort,
        dischargePort,
      };
      const pageContext = { ...libInner.pageContext };
      if (loadPort) pageContext.portOfCall = loadPort;
      if (dischargePort) pageContext.nextPortOfCall = dischargePort;
      if (result.header.departureDate?.trim()) {
        pageContext.dateOfDeparture = result.header.departureDate.trim();
      }
      return {
        ...d,
        dgLibrary: {
          ...libInner,
          pageContext,
          unifeeder: {
            ...libInner.unifeeder,
            manifests: [docWithCount, ...libInner.unifeeder.manifests],
            onboard: [...libInner.unifeeder.onboard, ...imported],
          },
        },
      };
    });
    void this.persist('silent');
    return null;
  }

  applyDgManifestImport(
    result: DgManifestImportResult,
    sourceName: string,
    fingerprints?: { contentFingerprint?: string; pdfBytesFingerprint?: string },
  ): DgManifestDocument | null {
    const lib = normalizeDgLibrary(this.data().dgLibrary, undefined, this.data().ports);
    const duplicate = findDgManifestDuplicate(lib.manifests, fingerprints ?? {});
    if (duplicate) return duplicate;

    this.data.update((d) => {
      const libInner = normalizeDgLibrary(d.dgLibrary, undefined, d.ports);
      const loadPort = resolveManifestPortName(result.header.portOfDeparture ?? '', d.ports);
      const dischargePort = resolveManifestPortName(result.header.portOfArrival ?? '', d.ports);
      const doc = createDgManifestDocument({
        sourceName: sourceName.replace(/\.pdf$/i, '').trim() || 'PDF import',
        voyageNumber:
          result.header.voyageNumber?.trim() || dgDefaultVoyageFromShip(d.ship),
        documentDate: result.header.departureDate?.trim() ?? '',
        loadPort,
        dischargePort,
        contentFingerprint: fingerprints?.contentFingerprint?.trim() ?? '',
        pdfBytesFingerprint: fingerprints?.pdfBytesFingerprint?.trim() ?? '',
      });
      const normalizedRows = result.rows.map((row) => ({
        ...row,
        weightKg: row.weightKg?.trim() ? commitDgWeightKgInput(row.weightKg) : '',
      }));
      const added = onboardContainersFromImportRows(
        normalizedRows,
        doc.id,
        loadPort,
        dischargePort,
        d.ports,
      );
      return {
        ...d,
        dgLibrary: {
          ...libInner,
          manifests: [{ ...doc, containerCount: added.length }, ...libInner.manifests],
          onboard: [...libInner.onboard, ...added],
        },
      };
    });
    void this.persist('silent');
    return null;
  }

  applyCmaPrestowPositions(
    positions: readonly { containerNo: string; position: string }[],
  ): { dgUpdated: number; reeferUpdated: number; unmatched: string[] } {
    const byContainer = new Map(
      positions.map((row) => [row.containerNo.trim().toUpperCase(), row.position.trim()]),
    );
    const matched = new Set<string>();
    let dgUpdated = 0;
    let reeferUpdated = 0;

    this.data.update((d) => {
      const dgLib = normalizeDgLibrary(d.dgLibrary, undefined, d.ports);
      const reeferLib = normalizeReeferLibrary(d.reeferLibrary, d.ports);

      const onboardDg = dgLib.onboard.map((container) => {
        const key = container.containerNo.trim().toUpperCase();
        const position = byContainer.get(key);
        if (!position || container.status !== 'onboard') return container;
        matched.add(key);
        if (container.stowage.trim() === position) return container;
        dgUpdated += 1;
        return { ...container, stowage: position };
      });

      const onboardReefer = reeferLib.onboard.map((unit) => {
        const key = unit.containerNo.trim().toUpperCase();
        const position = byContainer.get(key);
        if (!position || unit.status !== 'onboard') return unit;
        matched.add(key);
        if (unit.position.trim() === position) return unit;
        reeferUpdated += 1;
        return { ...unit, position };
      });

      return {
        ...d,
        dgLibrary: { ...dgLib, onboard: onboardDg },
        reeferLibrary: { ...reeferLib, onboard: onboardReefer },
      };
    });

    void this.persist('silent');
    return {
      dgUpdated,
      reeferUpdated,
      unmatched: [...byContainer.keys()].filter((key) => !matched.has(key)).sort(),
    };
  }

  addReeferUnit(partial?: Partial<Omit<ReeferOnboardUnit, 'id' | 'sourceManifestId'>>): void {
    this.data.update((d) => {
      const lib = normalizeReeferLibrary(d.reeferLibrary, d.ports);
      const loadPort = resolveKnownPortName(partial?.loadPort ?? d.ship.portOfCall ?? '', d.ports);
      const dischargePort = resolveKnownPortName(
        partial?.dischargePort ?? d.ship.nextPortOfCall ?? '',
        d.ports,
      );
      return {
        ...d,
        reeferLibrary: {
          ...lib,
          onboard: [
            ...lib.onboard,
            createReeferOnboardUnit({
              ...partial,
              loadPort,
              dischargePort,
              sourceManifestId: '',
              status: 'onboard',
            }),
          ],
        },
      };
    });
    void this.persist('silent');
  }

  updateReeferUnit(
    unitId: string,
    partial: Partial<Omit<ReeferOnboardUnit, 'id' | 'sourceManifestId'>>,
  ): void {
    this.data.update((d) => {
      const lib = normalizeReeferLibrary(d.reeferLibrary, d.ports);
      const resolved: typeof partial = { ...partial };
      if ('loadPort' in partial) {
        resolved.loadPort = resolveKnownPortName(partial.loadPort ?? '', d.ports);
      }
      if ('dischargePort' in partial) {
        resolved.dischargePort = resolveKnownPortName(partial.dischargePort ?? '', d.ports);
      }
      return {
        ...d,
        reeferLibrary: {
          ...lib,
          onboard: lib.onboard.map((u) => (u.id === unitId ? { ...u, ...resolved } : u)),
        },
      };
    });
    void this.persist('silent');
  }

  removeReeferUnit(unitId: string): void {
    this.data.update((d) => {
      const lib = normalizeReeferLibrary(d.reeferLibrary, d.ports);
      return {
        ...d,
        reeferLibrary: {
          ...lib,
          onboard: lib.onboard.filter((u) => u.id !== unitId),
        },
      };
    });
    void this.persist('silent');
  }

  removeReeferManifest(id: string): void {
    this.data.update((d) => {
      const lib = normalizeReeferLibrary(d.reeferLibrary, d.ports);
      return {
        ...d,
        reeferLibrary: {
          ...lib,
          manifests: lib.manifests.filter((m) => m.id !== id),
          onboard: lib.onboard.filter((u) => u.sourceManifestId !== id),
        },
      };
    });
    void this.persist('silent');
  }

  applyReeferImport(
    result: ReeferImportResult,
    sourceName: string,
    fingerprints?: { contentFingerprint?: string; pdfBytesFingerprint?: string },
  ): import('../models/reefer.models').ReeferManifestDocument | null {
    const lib = normalizeReeferLibrary(this.data().reeferLibrary, this.data().ports);
    const duplicate = findReeferManifestDuplicate(lib.manifests, fingerprints ?? {});
    if (duplicate) return duplicate;

    this.data.update((d) => {
      const libInner = normalizeReeferLibrary(d.reeferLibrary, d.ports);
      const loadPort = resolveManifestPortName(result.header.portOfDeparture ?? '', d.ports);
      const dischargePort = resolveManifestPortName(result.header.portOfArrival ?? '', d.ports);
      const doc = createReeferManifestDocument({
        sourceName: sourceName.replace(/\.pdf$/i, '').trim() || 'PDF import',
        voyageNumber: result.header.voyageNumber?.trim() || d.ship.voyageNumber?.trim() || '',
        documentDate: result.header.documentDate?.trim() ?? '',
        loadPort,
        dischargePort,
        contentFingerprint: fingerprints?.contentFingerprint?.trim() ?? '',
        pdfBytesFingerprint: fingerprints?.pdfBytesFingerprint?.trim() ?? '',
      });
      const imported = reeferUnitsFromImportRows(
        result.rows,
        doc.id,
        loadPort,
        dischargePort,
        d.ports,
      );
      return {
        ...d,
        reeferLibrary: {
          ...libInner,
          manifests: [{ ...doc, unitCount: imported.length }, ...libInner.manifests],
          onboard: mergeReeferImportIntoOnboard(libInner.onboard, imported),
        },
      };
    });
    void this.persist('silent');
    return null;
  }

  updateShipAssets(partial: Partial<AppData['shipAssets']>): void {
    this.data.update((d) => ({
      ...d,
      shipAssets: { ...d.shipAssets, ...partial },
    }));
    void this.persist('silent');
  }

  updateOutputSettings(
    partial: Partial<AppData['outputSettings']>,
    notify: 'silent' | 'saved' = 'silent',
  ): void {
    this.data.update((d) => ({
      ...d,
      outputSettings: this.normalizeOutputSettings({ ...d.outputSettings, ...partial }),
    }));
    void this.persist(notify);
  }

  /** Remember a folder path and make it the active output target. */
  addSavedPath(path: string): void {
    const p = path.trim();
    if (!p) return;
    this.data.update((d) => ({
      ...d,
      outputSettings: this.normalizeOutputSettings({
        ...d.outputSettings,
        activePath: p,
        // Newest first, keep only the last 5 (normalize caps to 5).
        savedPaths: [p, ...d.outputSettings.savedPaths.filter((x) => x !== p)],
      }),
    }));
    void this.persist('saved');
  }

  removeSavedPath(path: string): void {
    this.data.update((d) => {
      const savedPaths = d.outputSettings.savedPaths.filter((p) => p !== path);
      const activePath = d.outputSettings.activePath === path ? '' : d.outputSettings.activePath;
      return {
        ...d,
        outputSettings: this.normalizeOutputSettings({
          ...d.outputSettings,
          activePath,
          savedPaths,
        }),
      };
    });
    void this.persist('silent');
  }

  setPrinterName(printerName: string): void {
    this.updateOutputSettings({ printerName });
  }

  addCustomDocument(name: string, dataBase64: string): void {
    const n = name.trim();
    if (!n || !dataBase64) return;
    this.data.update((d) => ({
      ...d,
      customDocuments: [...d.customDocuments, { id: crypto.randomUUID(), name: n, dataBase64 }],
    }));
    void this.persist('saved');
  }

  removeCustomDocument(id: string): void {
    this.data.update((d) => ({
      ...d,
      customDocuments: d.customDocuments.filter((doc) => doc.id !== id),
    }));
    void this.persist('silent');
  }

  /** Create an empty package for a port if it doesn't exist yet. */
  upsertPortPackage(port: string): void {
    const p = port.trim();
    if (!p) return;
    this.data.update((d) => {
      if (d.printPackages.some((pkg) => pkg.port === p)) return d;
      return { ...d, printPackages: [...d.printPackages, { port: p, authorities: [] }] };
    });
    void this.persist('saved');
  }

  removePortPackage(port: string): void {
    this.data.update((d) => ({
      ...d,
      printPackages: d.printPackages.filter((pkg) => pkg.port !== port),
    }));
    void this.persist('silent');
  }

  addAuthority(port: string, name = 'New authority'): void {
    this.mutatePackage(port, (pkg) => ({
      ...pkg,
      authorities: [...pkg.authorities, { name, items: [], includeInPrint: true }],
    }));
  }

  removeAuthority(port: string, authIndex: number): void {
    this.mutatePackage(port, (pkg) => ({
      ...pkg,
      authorities: pkg.authorities.filter((_, i) => i !== authIndex),
    }));
  }

  renameAuthority(port: string, authIndex: number, name: string): void {
    this.mutateAuthority(port, authIndex, (a) => ({ ...a, name }));
  }

  setAuthorityIncludeInPrint(port: string, authIndex: number, includeInPrint: boolean): void {
    this.mutateAuthority(port, authIndex, (a) => ({ ...a, includeInPrint }));
  }

  setAuthorityItems(port: string, authIndex: number, items: PortPackageItem[]): void {
    this.mutateAuthority(port, authIndex, (a) => ({ ...a, items: items.map((it) => ({ ...it })) }));
  }

  private mutatePackage(port: string, fn: (pkg: PortPackage) => PortPackage): void {
    this.data.update((d) => ({
      ...d,
      printPackages: d.printPackages.map((pkg) => (pkg.port === port ? fn(pkg) : pkg)),
    }));
    void this.persist('silent');
  }

  private mutateAuthority(
    port: string,
    authIndex: number,
    fn: (a: PortAuthority) => PortAuthority,
  ): void {
    this.mutatePackage(port, (pkg) => ({
      ...pkg,
      authorities: pkg.authorities.map((a, i) => (i === authIndex ? fn(a) : a)),
    }));
  }

  updatePortOfCallSettings(partial: Partial<AppData['portOfCall']>): void {
    this.data.update((d) => ({
      ...d,
      portOfCall: this.normalizePortOfCallSettings({ ...d.portOfCall, ...partial }),
    }));
    void this.persist('silent');
  }

  updateShipStoresPlaceOfStorage(docId: ShipStoresDocId, placeOfStorage: string): void {
    this.patchShipStoresForm(docId, { placeOfStorage });
  }

  updateCrewEffectForm(
    docId: CrewEffectDocId,
    partial:
      | Partial<CrewEffectFormSettings>
      | Partial<CrewEffectForm02Settings>
      | Partial<CrewEffectForm03Settings>,
    notify?: 'silent' | 'saved',
  ): void {
    const field = crewEffectFormField(docId);
    const normalize = this.crewEffectNormalize(docId);
    this.data.update((d) => ({
      ...d,
      [field]: normalize({ ...d[field], ...partial }),
    }));
    const resolved =
      notify ??
      (docId === 'crewEffect03'
        ? 'nilCigars' in partial ||
          'nilWeapons' in partial ||
          'nilAmmunition' in partial ||
          partial.nilCigarettes !== undefined ||
          partial.nilSpirits !== undefined
          ? 'saved'
          : 'silent'
        : docId === 'crewEffect02'
          ? partial.nilCigarettes !== undefined ||
            partial.nilSpirits !== undefined ||
            'nilBeer' in partial ||
            'nilTobaccoCigars' in partial
            ? 'saved'
            : 'silent'
          : partial.nilCigarettes !== undefined ||
              partial.nilSpirits !== undefined ||
              ('nilWines' in partial && partial.nilWines !== undefined)
            ? 'saved'
            : 'silent');
    void this.persist(resolved);
  }

  updateNilListPhrase(id: string, partial: { text?: string; enabled?: boolean }): void {
    this.data.update((d) => {
      const form = normalizeNilListForm(d.nilListForm);
      const phrases = form.phrases.map((p) => (p.id === id ? { ...p, ...partial } : p));
      return { ...d, nilListForm: normalizeNilListForm({ phrases }) };
    });
    const notify =
      partial.enabled !== undefined && partial.text === undefined ? 'saved' : 'silent';
    void this.persist(notify);
  }

  addNilListPhrase(text: string, enabled = true): void {
    this.data.update((d) => {
      const form = normalizeNilListForm(d.nilListForm);
      return {
        ...d,
        nilListForm: normalizeNilListForm({
          phrases: [...form.phrases, createNilListPhrase(text, enabled)],
        }),
      };
    });
    void this.persist('silent');
  }

  removeNilListPhrase(id: string): void {
    this.data.update((d) => {
      const form = normalizeNilListForm(d.nilListForm);
      const phrases = form.phrases.filter((p) => p.id !== id);
      return { ...d, nilListForm: normalizeNilListForm({ phrases }) };
    });
    void this.persist('silent');
  }

  updateShipMoneyEntry(id: string, partial: { amount?: string; currency?: string }): void {
    this.data.update((d) => {
      const form = normalizeShipMoneyForm(d.shipMoneyForm);
      const entries = form.entries.map((e) => (e.id === id ? { ...e, ...partial } : e));
      return { ...d, shipMoneyForm: normalizeShipMoneyForm({ entries }) };
    });
    void this.persist('silent');
  }

  addShipMoneyEntry(amount: string, currency: string): void {
    this.data.update((d) => {
      const form = normalizeShipMoneyForm(d.shipMoneyForm);
      return {
        ...d,
        shipMoneyForm: normalizeShipMoneyForm({
          entries: [...form.entries, createShipMoneyEntry(amount, currency)],
        }),
      };
    });
    void this.persist('silent');
  }

  removeShipMoneyEntry(id: string): void {
    this.data.update((d) => {
      const form = normalizeShipMoneyForm(d.shipMoneyForm);
      const entries = form.entries.filter((e) => e.id !== id);
      return { ...d, shipMoneyForm: normalizeShipMoneyForm({ entries }) };
    });
    void this.persist('silent');
  }

  private normalizeShipStoresForms(raw: Partial<AppData>): {
    shipStoresForm02: ReturnType<typeof normalizeShipStoresForm02>;
    shipStoresForm03: ReturnType<typeof normalizeShipStoresForm03>;
  } {
    const seedVersion = typeof raw.seedVersion === 'number' ? raw.seedVersion : 0;
    const migrateGermanyTo03 =
      seedVersion < APP_DATA_SCHEMA_VERSION && raw.shipStoresForm03 == null;

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

  private normalizeCrewEffectForms(raw: Partial<AppData>): {
    crewEffectForm02: ReturnType<typeof normalizeCrewEffectForm02>;
    crewEffectForm03: ReturnType<typeof normalizeCrewEffectForm03>;
  } {
    const seedVersion = typeof raw.seedVersion === 'number' ? raw.seedVersion : 0;
    const migrateGermanyTo03 =
      seedVersion < APP_DATA_SCHEMA_VERSION && raw.crewEffectForm03 == null;

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

  private crewEffectNormalize(
    docId: CrewEffectDocId,
  ):
    | typeof normalizeCrewEffectForm
    | typeof normalizeCrewEffectForm02
    | typeof normalizeCrewEffectForm03 {
    if (docId === 'crewEffect03') return normalizeCrewEffectForm03;
    if (docId === 'crewEffect02') return normalizeCrewEffectForm02;
    return normalizeCrewEffectForm;
  }

  private shipStoresRowCount(docId: ShipStoresDocId): number {
    if (docId === 'shipStores03') return SHIP_STORES_03_ROW_COUNT;
    if (docId === 'shipStores02') return SHIP_STORES_02_ROW_COUNT;
    return SHIP_STORES_ROW_COUNT;
  }

  private shipStoresNormalize(
    docId: ShipStoresDocId,
  ): typeof normalizeShipStoresForm | typeof normalizeShipStoresForm02 | typeof normalizeShipStoresForm03 {
    if (docId === 'shipStores03') return normalizeShipStoresForm03;
    if (docId === 'shipStores02') return normalizeShipStoresForm02;
    return normalizeShipStoresForm;
  }

  updateShipStoresRow(
    docId: ShipStoresDocId,
    rowIndex: number,
    partial: Partial<ShipStoresRow>,
  ): void {
    const rowCount = this.shipStoresRowCount(docId);
    if (rowIndex < 0 || rowIndex >= rowCount) return;
    const field = shipStoresFormField(docId);
    this.data.update((d) => {
      const normalize = this.shipStoresNormalize(docId);
      const form = normalize(d[field]);
      const rows = form.rows.map((r, i) => (i === rowIndex ? { ...r, ...partial } : r));
      return { ...d, [field]: normalize({ ...form, rows }) };
    });
    void this.persist('silent');
  }

  private patchShipStoresForm(docId: ShipStoresDocId, partial: Partial<ShipStoresFormSettings>): void {
    const field = shipStoresFormField(docId);
    const normalize = this.shipStoresNormalize(docId);
    this.data.update((d) => ({
      ...d,
      [field]: normalize({ ...d[field], ...partial }),
    }));
    void this.persist('silent');
  }

  addPortCallEntry(entry?: Partial<PortCallHistoryEntry>): PortCallHistoryEntry {
    const newEntry = { ...createEmptyPortCallEntry(), ...entry };
    this.data.update((d) => ({ ...d, portCallHistory: [newEntry, ...d.portCallHistory] }));
    void this.persist('silent');
    this.toast.showPortAdded();
    return newEntry;
  }

  updatePortCallEntry(
    id: string,
    partial: Partial<PortCallHistoryEntry>,
    notify?: 'silent' | 'saved',
  ): void {
    this.data.update((d) => ({
      ...d,
      portCallHistory: d.portCallHistory.map((e) => {
        if (e.id !== id) return e;
        const next = { ...e, ...partial };
        if (partial.secLvl != null) next.secLvl = normalizePortSecLvl(partial.secLvl);
        return next;
      }),
    }));
    const resolved =
      notify ??
      (partial.portName != null ||
      partial.arrivalDate != null ||
      partial.departureDate != null
        ? 'saved'
        : 'silent');
    void this.persist(resolved);
  }

  removePortCallEntry(id: string): void {
    this.data.update((d) => ({
      ...d,
      portCallHistory: d.portCallHistory.filter((e) => e.id !== id),
    }));
    void this.persist('silent');
    this.toast.showPortDeleted();
  }

  addCrewMember(member?: Partial<CrewMember>): CrewMember {
    const newMember = migrateCrewListFlags({
      ...createEmptyCrewMember(),
      ...member,
    });
    this.data.update((d) => ({ ...d, crew: [...d.crew, newMember] }));
    void this.persist('silent');
    return newMember;
  }

  updateCrewMember(
    id: string,
    partial: Partial<CrewMember>,
    notify: 'silent' | 'saved' = 'saved',
  ): void {
    this.data.update((d) => ({
      ...d,
      crew: d.crew.map((m) => (m.id === id ? { ...m, ...partial } : m)),
    }));
    void this.persist(notify);
  }

  addCrewMemberToArrival(member?: Partial<CrewMember>): CrewMember {
    const d = this.data();
    const linked = areCrewListsInSync(d.crew, d.crewArrivalOrder, d.crewDepartureOrder);
    return this.addCrewMember({
      ...member,
      archived: false,
      archivedFromDeparture: false,
      onArrivalList: true,
      onDepartureList: linked,
    });
  }

  addCrewMemberToDeparture(member?: Partial<CrewMember>): CrewMember {
    return this.addCrewMember({
      ...member,
      archived: false,
      archivedFromDeparture: false,
      onArrivalList: false,
      onDepartureList: true,
    });
  }

  addCrewMemberToArchive(member?: Partial<CrewMember>): CrewMember {
    return this.addCrewMember({
      ...member,
      archived: true,
      onArrivalList: false,
      onDepartureList: false,
      archivedFromDeparture: false,
    });
  }

  archiveCrewMember(id: string): void {
    this.updateCrewMember(
      id,
      {
        archived: true,
        onArrivalList: false,
        onDepartureList: false,
        archivedFromDeparture: false,
      },
      'silent',
    );
  }

  restoreCrewMemberToList(id: string, list: CrewListKind): void {
    this.updateCrewMember(id, this.crewRestorePatch(list), 'silent');
  }

  /** Linked lists: restore on arrival adds to both; restore on departure adds to departure only. */
  private crewRestorePatch(list: CrewListKind): Partial<CrewMember> {
    const d = this.data();
    const linked = areCrewListsInSync(d.crew, d.crewArrivalOrder, d.crewDepartureOrder);
    return {
      archived: false,
      archivedFromDeparture: false,
      onArrivalList: list === 'arrival',
      onDepartureList: list === 'departure' || (list === 'arrival' && linked),
    };
  }

  /**
   * Move to archive (both lists). Use removeFromArrivalList / removeFromDepartureList
   * when lists differ and the person should stay on the other list for printing.
   */
  archiveFromCrewList(id: string, _list: CrewListKind): 'archived' {
    const member = this.data().crew.find((m) => m.id === id);
    if (!member || member.archived) return 'archived';
    this.archiveCrewMember(id);
    return 'archived';
  }

  /** FROM ARRIVAL: copy arrival list + archive to departure; merge extra departure archive. */
  syncDepartureFromArrival(): ArrivalToDepartureSyncPreview {
    const preview = this.previewArrivalToDeparture();
    this.data.update((d) => {
      let crew = d.crew.map((m) => this.mapCrewArrivalToDepartureSync(m));
      crew = this.mergeDepartureArchiveIntoArrivalArchive(crew);
      crew = this.reorderCrewLikeList(crew, 'arrival', d.crewArrivalOrder);
      return {
        ...d,
        crew: this.rescueOrphanCrew(crew),
        crewArrivalOrder: undefined,
        crewDepartureOrder: undefined,
      };
    });
    void this.persist('saved');
    return preview;
  }

  previewArrivalToDeparture(): ArrivalToDepartureSyncPreview {
    const active = this.data().crew.filter((m) => !m.archived);
    return {
      onArrival: active.filter((m) => m.onArrivalList).length,
      departureOnlyToArchive: active.filter((m) => m.onDepartureList && !m.onArrivalList).length,
      departureArchiveMerged: this.data().crew.filter(
        (m) => m.archivedFromDeparture && !m.archived,
      ).length,
    };
  }

  /** INTO ARRIVAL: copy departure list to arrival; merge departure archive into arrival archive. */
  applyDepartureToArrival(): DepartureToArrivalSyncPreview {
    const preview = this.previewDepartureToArrival();
    this.data.update((d) => {
      let crew = d.crew.map((m) => this.mapCrewDepartureToArrival(m));
      crew = this.mergeDepartureArchiveIntoArrivalArchive(crew);
      crew = this.reorderCrewLikeList(crew, 'departure', d.crewDepartureOrder);
      return {
        ...d,
        crew: this.rescueOrphanCrew(crew),
        crewArrivalOrder: undefined,
        crewDepartureOrder: undefined,
      };
    });
    void this.persist('saved');
    return preview;
  }

  previewDepartureToArrival(): DepartureToArrivalSyncPreview {
    const active = this.data().crew.filter((m) => !m.archived);
    return {
      onDeparture: active.filter((m) => m.onDepartureList).length,
      arrivalOnlyToArchive: active.filter((m) => m.onArrivalList && !m.onDepartureList).length,
      departureArchiveMerged: this.data().crew.filter(
        (m) => m.archivedFromDeparture && !m.archived,
      ).length,
    };
  }

  /** Active crew on arrival but not departure → archive. Returns count archived. */
  archiveArrivalOnlyCrew(notify: 'silent' | 'saved' = 'saved'): number {
    let count = 0;
    this.data.update((d) => ({
      ...d,
      crew: d.crew.map((m) => {
        if (m.archived || m.onDepartureList || !m.onArrivalList) return m;
        count++;
        return {
          ...m,
          archived: true,
          onArrivalList: false,
          onDepartureList: false,
          archivedFromDeparture: false,
        };
      }),
    }));
    if (count > 0) void this.persist(notify);
    return count;
  }

  private mapCrewDepartureToArrival(m: CrewMember): CrewMember {
    if (m.archived) return m;
    if (m.onDepartureList) {
      return {
        ...m,
        onArrivalList: true,
        onDepartureList: true,
        archivedFromDeparture: false,
      };
    }
    if (m.onArrivalList) {
      return {
        ...m,
        archived: true,
        onArrivalList: false,
        onDepartureList: false,
        archivedFromDeparture: false,
      };
    }
    return m;
  }

  private mapCrewArrivalToDepartureSync(m: CrewMember): CrewMember {
    if (m.archived) {
      return {
        ...m,
        onArrivalList: false,
        onDepartureList: false,
        archivedFromDeparture: true,
      };
    }
    if (m.onArrivalList) {
      return {
        ...m,
        onArrivalList: true,
        onDepartureList: true,
        archivedFromDeparture: false,
      };
    }
    if (m.onDepartureList) {
      return {
        ...m,
        archived: true,
        onArrivalList: false,
        onDepartureList: false,
        archivedFromDeparture: true,
      };
    }
    return m;
  }

  private mergeDepartureArchiveIntoArrivalArchive(crew: CrewMember[]): CrewMember[] {
    return crew.map((m) => {
      if (!m.archivedFromDeparture || m.archived) return m;
      return {
        ...m,
        archived: true,
        onArrivalList: false,
        onDepartureList: false,
      };
    });
  }

  private reorderCrewLikeList(
    crew: CrewMember[],
    list: CrewListKind,
    orderOverride?: readonly string[] | null,
  ): CrewMember[] {
    const ordered = filterActiveCrewList(crew, list, orderOverride);
    const orderedIds = new Set(ordered.map((m) => m.id));
    const rest = crew.filter((m) => !orderedIds.has(m.id));
    return [...ordered, ...rest];
  }

  /** Remove from departure list → departure archive (stays on arrival if listed there). */
  removeFromDepartureList(id: string): void {
    const member = this.data().crew.find((m) => m.id === id);
    if (!member) return;

    const patch: Partial<CrewMember> = {
      onDepartureList: false,
      archivedFromDeparture: true,
    };
    if (!member.onArrivalList) {
      patch.archived = true;
      patch.onArrivalList = false;
    }
    this.updateCrewMember(id, patch, 'silent');
  }

  removeFromArrivalList(id: string): void {
    const d = this.data();
    if (areCrewListsInSync(d.crew, d.crewArrivalOrder, d.crewDepartureOrder)) {
      this.archiveCrewMember(id);
      return;
    }

    const member = this.data().crew.find((m) => m.id === id);
    if (!member) return;

    if (member.archived) {
      this.updateCrewMember(id, { onArrivalList: false }, 'silent');
      return;
    }

    if (member.onDepartureList) {
      this.updateCrewMember(id, { onArrivalList: false }, 'silent');
      return;
    }

    this.archiveCrewMember(id);
  }

  private rescueOrphanCrew(crew: CrewMember[]): CrewMember[] {
    return crew.map((m) => {
      if (m.archived || m.onArrivalList || m.onDepartureList) return m;
      return { ...m, archived: true, onArrivalList: false, onDepartureList: false };
    });
  }

  removeCrewMember(id: string): void {
    this.data.update((d) => ({ ...d, crew: d.crew.filter((m) => m.id !== id) }));
    void this.persist('silent');
  }

  setCrewDocumentAttached(crewId: string, docType: CrewDocumentType, attached: boolean): void {
    this.data.update((d) => ({
      ...d,
      crew: d.crew.map((m) =>
        m.id === crewId
          ? {
              ...m,
              documents: { ...m.documents, [docType]: attached },
            }
          : m,
      ),
    }));
    void this.persist('debounced');
  }

  addPassenger(member?: Partial<PassengerMember>): PassengerMember {
    const newMember = migratePassengerListFlags({
      ...createEmptyPassenger(),
      ...member,
    });
    this.data.update((d) => ({ ...d, passengers: [...d.passengers, newMember] }));
    void this.persist('silent');
    return newMember;
  }

  updatePassenger(
    id: string,
    partial: Partial<PassengerMember>,
    notify: 'silent' | 'saved' = 'saved',
  ): void {
    this.data.update((d) => ({
      ...d,
      passengers: d.passengers.map((m) => (m.id === id ? { ...m, ...partial } : m)),
    }));
    void this.persist(notify);
  }

  addPassengerToArrival(member?: Partial<PassengerMember>): PassengerMember {
    const d = this.data();
    const linked = arePassengerListsInSync(
      d.passengers,
      d.passengerArrivalOrder,
      d.passengerDepartureOrder,
    );
    return this.addPassenger({
      ...member,
      archived: false,
      archivedFromDeparture: false,
      onArrivalList: true,
      onDepartureList: linked,
    });
  }

  addPassengerToDeparture(member?: Partial<PassengerMember>): PassengerMember {
    return this.addPassenger({
      ...member,
      archived: false,
      archivedFromDeparture: false,
      onArrivalList: false,
      onDepartureList: true,
    });
  }

  addPassengerToArchive(member?: Partial<PassengerMember>): PassengerMember {
    return this.addPassenger({
      ...member,
      archived: true,
      onArrivalList: false,
      onDepartureList: false,
      archivedFromDeparture: false,
    });
  }

  archivePassenger(id: string): void {
    this.updatePassenger(
      id,
      {
        archived: true,
        onArrivalList: false,
        onDepartureList: false,
        archivedFromDeparture: false,
      },
      'silent',
    );
  }

  restorePassengerToList(id: string, list: PaxListKind): void {
    this.updatePassenger(id, this.passengerRestorePatch(list), 'silent');
  }

  /** Linked lists: restore on arrival adds to both; restore on departure adds to departure only. */
  private passengerRestorePatch(list: PaxListKind): Partial<PassengerMember> {
    const d = this.data();
    const linked = arePassengerListsInSync(
      d.passengers,
      d.passengerArrivalOrder,
      d.passengerDepartureOrder,
    );
    return {
      archived: false,
      archivedFromDeparture: false,
      onArrivalList: list === 'arrival',
      onDepartureList: list === 'departure' || (list === 'arrival' && linked),
    };
  }

  archiveFromPassengerList(id: string, _list: PaxListKind): 'archived' {
    const member = this.data().passengers.find((m) => m.id === id);
    if (!member || member.archived) return 'archived';
    this.archivePassenger(id);
    return 'archived';
  }

  /** FROM ARRIVAL: copy arrival list + archive to departure; merge extra departure archive. */
  syncPassengerDepartureFromArrival(): ArrivalToDepartureSyncPreview {
    const preview = this.previewPassengerArrivalToDeparture();
    this.data.update((d) => {
      let passengers = d.passengers.map((m) => this.mapPassengerArrivalToDepartureSync(m));
      passengers = this.mergePassengerDepartureArchiveIntoArrivalArchive(passengers);
      passengers = this.reorderPassengerLikeList(passengers, 'arrival', d.passengerArrivalOrder);
      return {
        ...d,
        passengers: this.rescueOrphanPassengers(passengers),
        passengerArrivalOrder: undefined,
        passengerDepartureOrder: undefined,
      };
    });
    void this.persist('saved');
    return preview;
  }

  previewPassengerArrivalToDeparture(): ArrivalToDepartureSyncPreview {
    const active = this.data().passengers.filter((m) => !m.archived);
    return {
      onArrival: active.filter((m) => m.onArrivalList).length,
      departureOnlyToArchive: active.filter((m) => m.onDepartureList && !m.onArrivalList).length,
      departureArchiveMerged: this.data().passengers.filter(
        (m) => m.archivedFromDeparture && !m.archived,
      ).length,
    };
  }

  /** INTO ARRIVAL: copy departure list to arrival; merge departure archive into arrival archive. */
  applyPassengerDepartureToArrival(): DepartureToArrivalSyncPreview {
    const preview = this.previewPassengerDepartureToArrival();
    this.data.update((d) => {
      let passengers = d.passengers.map((m) => this.mapPassengerDepartureToArrival(m));
      passengers = this.mergePassengerDepartureArchiveIntoArrivalArchive(passengers);
      passengers = this.reorderPassengerLikeList(passengers, 'departure', d.passengerDepartureOrder);
      return {
        ...d,
        passengers: this.rescueOrphanPassengers(passengers),
        passengerArrivalOrder: undefined,
        passengerDepartureOrder: undefined,
      };
    });
    void this.persist('saved');
    return preview;
  }

  previewPassengerDepartureToArrival(): DepartureToArrivalSyncPreview {
    const active = this.data().passengers.filter((m) => !m.archived);
    return {
      onDeparture: active.filter((m) => m.onDepartureList).length,
      arrivalOnlyToArchive: active.filter((m) => m.onArrivalList && !m.onDepartureList).length,
      departureArchiveMerged: this.data().passengers.filter(
        (m) => m.archivedFromDeparture && !m.archived,
      ).length,
    };
  }

  archiveArrivalOnlyPassengers(notify: 'silent' | 'saved' = 'saved'): number {
    let count = 0;
    this.data.update((d) => ({
      ...d,
      passengers: d.passengers.map((m) => {
        if (m.archived || m.onDepartureList || !m.onArrivalList) return m;
        count++;
        return {
          ...m,
          archived: true,
          onArrivalList: false,
          onDepartureList: false,
          archivedFromDeparture: false,
        };
      }),
    }));
    if (count > 0) void this.persist(notify);
    return count;
  }

  private mapPassengerDepartureToArrival(m: PassengerMember): PassengerMember {
    if (m.archived) return m;
    if (m.onDepartureList) {
      return {
        ...m,
        onArrivalList: true,
        onDepartureList: true,
        archivedFromDeparture: false,
      };
    }
    if (m.onArrivalList) {
      return {
        ...m,
        archived: true,
        onArrivalList: false,
        onDepartureList: false,
        archivedFromDeparture: false,
      };
    }
    return m;
  }

  private mapPassengerArrivalToDepartureSync(m: PassengerMember): PassengerMember {
    if (m.archived) {
      return {
        ...m,
        onArrivalList: false,
        onDepartureList: false,
        archivedFromDeparture: true,
      };
    }
    if (m.onArrivalList) {
      return {
        ...m,
        onArrivalList: true,
        onDepartureList: true,
        archivedFromDeparture: false,
      };
    }
    if (m.onDepartureList) {
      return {
        ...m,
        archived: true,
        onArrivalList: false,
        onDepartureList: false,
        archivedFromDeparture: true,
      };
    }
    return m;
  }

  private mergePassengerDepartureArchiveIntoArrivalArchive(
    passengers: PassengerMember[],
  ): PassengerMember[] {
    return passengers.map((m) => {
      if (!m.archivedFromDeparture || m.archived) return m;
      return {
        ...m,
        archived: true,
        onArrivalList: false,
        onDepartureList: false,
      };
    });
  }

  private reorderPassengerLikeList(
    passengers: PassengerMember[],
    list: PaxListKind,
    orderOverride?: readonly string[] | null,
  ): PassengerMember[] {
    const ordered = filterActivePassengerList(passengers, list, orderOverride);
    const orderedIds = new Set(ordered.map((m) => m.id));
    const rest = passengers.filter((m) => !orderedIds.has(m.id));
    return [...ordered, ...rest];
  }

  /** Remove from departure list → departure archive (stays on arrival if listed there). */
  removePassengerFromDepartureList(id: string): void {
    const member = this.data().passengers.find((m) => m.id === id);
    if (!member) return;

    const patch: Partial<PassengerMember> = {
      onDepartureList: false,
      archivedFromDeparture: true,
    };
    if (!member.onArrivalList) {
      patch.archived = true;
      patch.onArrivalList = false;
    }
    this.updatePassenger(id, patch, 'silent');
  }

  removePassengerFromArrivalList(id: string): void {
    const d = this.data();
    if (
      arePassengerListsInSync(
        d.passengers,
        d.passengerArrivalOrder,
        d.passengerDepartureOrder,
      )
    ) {
      this.archivePassenger(id);
      return;
    }

    const member = this.data().passengers.find((m) => m.id === id);
    if (!member) return;

    if (member.archived) {
      this.updatePassenger(id, { onArrivalList: false }, 'silent');
      return;
    }

    if (member.onDepartureList) {
      this.updatePassenger(id, { onArrivalList: false }, 'silent');
      return;
    }

    this.archivePassenger(id);
  }

  private rescueOrphanPassengers(passengers: PassengerMember[]): PassengerMember[] {
    return passengers.map((m) => {
      if (m.archived || m.onArrivalList || m.onDepartureList) return m;
      return { ...m, archived: true, onArrivalList: false, onDepartureList: false };
    });
  }

  removePassenger(id: string): void {
    this.data.update((d) => ({ ...d, passengers: d.passengers.filter((m) => m.id !== id) }));
    void this.persist('silent');
  }

  reorderPassengerList(list: PaxListKind, fromIndex: number, toIndex: number): void {
    if (fromIndex === toIndex) return;
    this.data.update((d) => {
      const linked = arePassengerListsInSync(
        d.passengers,
        d.passengerArrivalOrder,
        d.passengerDepartureOrder,
      );
      if (list === 'arrival') {
        if (linked) {
          return {
            ...d,
            passengers: this.reorderMembersInPassengerArray(
              d.passengers,
              'arrival',
              fromIndex,
              toIndex,
            ),
            passengerArrivalOrder: undefined,
            passengerDepartureOrder: undefined,
          };
        }
        const ids = activePassengerListIds(
          d.passengers,
          'arrival',
          d.passengerArrivalOrder,
        );
        return { ...d, passengerArrivalOrder: this.reorderIdList(ids, fromIndex, toIndex) };
      }

      const ids = activePassengerListIds(
        d.passengers,
        'departure',
        d.passengerDepartureOrder,
      );
      const reordered = this.reorderIdList(ids, fromIndex, toIndex);
      if (linked) {
        const arrivalIds = activePassengerListIds(
          d.passengers,
          'arrival',
          d.passengerArrivalOrder,
        );
        return {
          ...d,
          passengerArrivalOrder: arrivalIds,
          passengerDepartureOrder: reordered,
        };
      }
      return { ...d, passengerDepartureOrder: reordered };
    });
    void this.persist('debounced');
  }

  private reorderMembersInPassengerArray(
    passengers: PassengerMember[],
    list: PaxListKind,
    fromIndex: number,
    toIndex: number,
  ): PassengerMember[] {
    const inList = (m: PassengerMember) =>
      list === 'arrival'
        ? !m.archived && m.onArrivalList
        : !m.archived && m.onDepartureList;
    const indices: number[] = [];
    const members: PassengerMember[] = [];
    passengers.forEach((m, i) => {
      if (inList(m)) {
        indices.push(i);
        members.push(m);
      }
    });
    const reordered = [...members];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    const next = [...passengers];
    indices.forEach((idx, j) => {
      next[idx] = reordered[j];
    });
    return next;
  }

  reorderCrewList(list: CrewListKind, fromIndex: number, toIndex: number): void {
    if (fromIndex === toIndex) return;
    this.data.update((d) => {
      const linked = areCrewListsInSync(d.crew, d.crewArrivalOrder, d.crewDepartureOrder);
      if (list === 'arrival') {
        if (linked) {
          return {
            ...d,
            crew: this.reorderMembersInCrewArray(d.crew, 'arrival', fromIndex, toIndex),
            crewArrivalOrder: undefined,
            crewDepartureOrder: undefined,
          };
        }
        const ids = activeCrewListIds(d.crew, 'arrival', d.crewArrivalOrder);
        return { ...d, crewArrivalOrder: this.reorderIdList(ids, fromIndex, toIndex) };
      }

      const ids = activeCrewListIds(d.crew, 'departure', d.crewDepartureOrder);
      const reordered = this.reorderIdList(ids, fromIndex, toIndex);
      if (linked) {
        const arrivalIds = activeCrewListIds(d.crew, 'arrival', d.crewArrivalOrder);
        return {
          ...d,
          crewArrivalOrder: arrivalIds,
          crewDepartureOrder: reordered,
        };
      }
      return { ...d, crewDepartureOrder: reordered };
    });
    void this.persist('debounced');
  }

  replaceAll(data: AppData): void {
    this.data.set(this.normalize(data));
    void this.persist('saved');
  }

  async getDataPath(): Promise<string | null> {
    return (await window.electronAPI?.getDataPath()) ?? null;
  }

  async exportData(): Promise<void> {
    const blob = new Blob([JSON.stringify(this.data(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'crew-data.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async importFromFile(file: File): Promise<void> {
    const text = await file.text();
    const parsed = JSON.parse(text) as AppData;
    this.replaceAll(parsed);
  }
}
