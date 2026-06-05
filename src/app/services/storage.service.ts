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
  DEFAULT_NATIONALITIES,
  DEFAULT_PORTS,
  DEFAULT_RANKS,
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
  CrewDocumentType,
  migrateCrewListFlags,
  normalizeCrewDocuments,
  migrateCrewMember,
  migratePortsRaw,
  resolvePortRef,
  crewRankOrder,
  filterActiveCrewList,
  sortCrewByRank,
  shipFieldPersistNotify,
} from '../models/crew.models';
import { ToastService } from './toast.service';
import {
  PassengerMember,
  PaxListKind,
  createDefaultPaxArrSettings,
  PASSENGER_RANK,
  createEmptyPassenger,
  migratePassengerListFlags,
  migratePassengerMember,
  sortPassengersByName,
} from '../models/passenger.models';
import { SEED_SHIP, SEED_VERSION, createSeedCrew } from '../data/default-crew.seed';
import { SEED_PORT_CALL_HISTORY } from '../data/default-port-call.seed';
import { POC_MAX_ROW_COUNT, POC_MIN_ROW_COUNT } from './port-of-call-coordinates';
import {
  normalizeCrewEffectForm,
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
  crewListPlacementKey,
  crewListPlacementPatch,
  createDefaultCrewListPrefs,
  CrewListVariantPlacement,
  normalizeCrewListByPlacement,
} from '../models/document-overlay.models';
import { isValidStampBox } from '../utils/overlay-stamp-box.util';

const STORAGE_KEY = 'crew-app-data';
/** Bump when public/crew-data.json is regenerated from DOCUMENT.xlsx */
const DOCUMENT_IMPORT_ID = 'document-xlsx-2026-06-04';
const DOCUMENT_IMPORT_KEY = 'crew-last-document-import';

const DEFAULT_DATA: AppData = {
  ship: { ...SEED_SHIP },
  crew: createSeedCrew(),
  crewArr: createDefaultCrewArrSettings(),
  passengers: [],
  paxArr: createDefaultPaxArrSettings(),
  ports: [...DEFAULT_PORTS],
  ranks: [...DEFAULT_RANKS],
  nationalities: [...DEFAULT_NATIONALITIES],
  portCallHistory: SEED_PORT_CALL_HISTORY.map((e) => ({ ...e })),
  portOfCall: createDefaultPortOfCallSettings(),
  shipStoresForm: createDefaultShipStoresForm(),
  crewEffectForm: createDefaultCrewEffectForm(),
  nilListForm: createDefaultNilListForm(),
  shipMoneyForm: createDefaultShipMoneyForm(),
  cashAdvanceForm: createDefaultCashAdvanceForm(),
  crewMoneyListForm: createDefaultCrewMoneyListForm(),
  narcoticListForm: createDefaultNarcoticListForm(),
  documentOverlay: createDefaultDocumentOverlayPrefs(),
  shipAssets: createEmptyShipAssetsMeta(),
  outputSettings: createDefaultOutputSettings(),
  printPackages: createDefaultPrintPackages(),
  customDocuments: createDefaultCustomDocuments(),
  seedVersion: SEED_VERSION,
};

@Injectable({ providedIn: 'root' })
export class StorageService {
  /** Set when a modal form auto-saves silently; cleared after Saved toast on close. */
  private formSessionDirty = false;
  private readonly toast = inject(ToastService);
  private readonly data = signal<AppData>(this.loadInitial());

  readonly ship = computed(() => this.data().ship);
  readonly crewArr = computed(() => this.data().crewArr);
  readonly ports = computed(() => this.data().ports);
  readonly ranks = computed(() => this.data().ranks);
  readonly nationalities = computed(() => this.data().nationalities);
  readonly portCallHistory = computed(() => this.data().portCallHistory);
  readonly portOfCall = computed(() => this.data().portOfCall);
  readonly shipStoresForm = computed(() => this.data().shipStoresForm);
  readonly crewEffectForm = computed(() => this.data().crewEffectForm);
  readonly nilListForm = computed(() => this.data().nilListForm);
  readonly shipMoneyForm = computed(() => this.data().shipMoneyForm);
  readonly cashAdvanceForm = computed(() => this.data().cashAdvanceForm);
  readonly crewMoneyListForm = computed(() => this.data().crewMoneyListForm);
  readonly narcoticListForm = computed(() => this.data().narcoticListForm);
  readonly documentOverlay = computed(() => this.data().documentOverlay);
  readonly shipAssets = computed(() => this.data().shipAssets);
  readonly outputSettings = computed(() => this.data().outputSettings);
  readonly printPackages = computed(() => this.data().printPackages);
  readonly customDocuments = computed(() => this.data().customDocuments);
  readonly activeCrewArrival = computed(() => filterActiveCrewList(this.data().crew, 'arrival'));
  readonly activeCrewDeparture = computed(() => filterActiveCrewList(this.data().crew, 'departure'));
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
    this.data().passengers.filter((m) => !m.archived && m.onArrivalList),
  );
  readonly activePassengersDeparture = computed(() =>
    this.data().passengers.filter((m) => !m.archived && m.onDepartureList),
  );
  readonly archivedPassengers = computed(() =>
    sortPassengersByName(this.data().passengers.filter((m) => m.archived)),
  );
  readonly allPassengers = computed(() => this.data().passengers);

  private loadInitial(): AppData {
    return {
      ...DEFAULT_DATA,
      crew: [...DEFAULT_DATA.crew],
      ports: [...DEFAULT_DATA.ports],
      ranks: [...DEFAULT_DATA.ranks],
      nationalities: [...DEFAULT_DATA.nationalities],
      portCallHistory: [...DEFAULT_DATA.portCallHistory],
      portOfCall: { ...DEFAULT_DATA.portOfCall },
      shipStoresForm: {
        placeOfStorage: DEFAULT_DATA.shipStoresForm.placeOfStorage,
        rows: DEFAULT_DATA.shipStoresForm.rows.map((r) => ({ ...r })),
      },
      crewEffectForm: { ...DEFAULT_DATA.crewEffectForm },
      nilListForm: {
        phrases: DEFAULT_DATA.nilListForm.phrases.map((p) => ({ ...p })),
      },
      shipMoneyForm: {
        entries: DEFAULT_DATA.shipMoneyForm.entries.map((e) => ({ ...e })),
      },
      cashAdvanceForm: { ...DEFAULT_DATA.cashAdvanceForm, byCrewId: { ...DEFAULT_DATA.cashAdvanceForm.byCrewId } },
      crewMoneyListForm: { byCrewId: { ...DEFAULT_DATA.crewMoneyListForm.byCrewId } },
      narcoticListForm: {
        entries: DEFAULT_DATA.narcoticListForm.entries.map((e) => ({ ...e })),
      },
      documentOverlay: {
        crewList: { ...createDefaultDocumentOverlayPrefs().crewList },
        pax: { ...DEFAULT_DATA.documentOverlay.pax },
        portOfCall: { ...DEFAULT_DATA.documentOverlay.portOfCall },
        mdh: { ...DEFAULT_DATA.documentOverlay.mdh },
        shipStores: { ...DEFAULT_DATA.documentOverlay.shipStores },
        crewEffect: { ...DEFAULT_DATA.documentOverlay.crewEffect },
        nilList: { ...DEFAULT_DATA.documentOverlay.nilList },
        shipMoney: { ...DEFAULT_DATA.documentOverlay.shipMoney },
        cashAdvance: { ...DEFAULT_DATA.documentOverlay.cashAdvance },
        crewMoney: { ...DEFAULT_DATA.documentOverlay.crewMoney },
        narcoticList: { ...DEFAULT_DATA.documentOverlay.narcoticList },
        sso0108PortCalls: { ...DEFAULT_DATA.documentOverlay.sso0108PortCalls },
      },
      shipAssets: { ...DEFAULT_DATA.shipAssets },
      outputSettings: {
        ...DEFAULT_DATA.outputSettings,
        savedPaths: [...DEFAULT_DATA.outputSettings.savedPaths],
      },
      printPackages: DEFAULT_DATA.printPackages.map((p) => ({
        ...p,
        authorities: p.authorities.map((a) => ({ ...a, items: [...a.items] })),
      })),
      customDocuments: DEFAULT_DATA.customDocuments.map((d) => ({ ...d })),
      crewArr: { ...DEFAULT_DATA.crewArr },
      passengers: [],
      paxArr: { ...DEFAULT_DATA.paxArr },
    };
  }

  async init(): Promise<void> {
    const electron = window.electronAPI;
    if (electron) {
      const loaded = await electron.readData();
      if (loaded) {
        const normalized = this.normalize(loaded);
        this.data.set(normalized);
        if ((loaded.seedVersion ?? 0) < SEED_VERSION) {
          await this.persist('silent');
        }
        return;
      }
      const imported = await this.tryLoadDocumentImport();
      if (imported) return;
    } else {
      const needsImport = localStorage.getItem(DOCUMENT_IMPORT_KEY) !== DOCUMENT_IMPORT_ID;
      if (needsImport) {
        const imported = await this.tryLoadDocumentImport();
        if (imported) return;
      }
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<AppData>;
        const normalized = this.normalize(parsed);
        this.data.set(normalized);
        if ((parsed.seedVersion ?? 0) < SEED_VERSION) {
          await this.persist('silent');
        }
      } catch {
        this.data.set(this.loadInitial());
      }
    } else {
      await this.persist('silent');
    }
  }

  private normalize(raw: Partial<AppData> & { ports?: unknown }): AppData {
    const ship = { ...createEmptyShip(), ...SEED_SHIP, ...raw.ship };
    let crew = (raw.crew ?? []).map((m) => this.normalizeMember(m, raw.ports));
    if ((raw.seedVersion ?? 0) < 3) {
      Object.assign(ship, SEED_SHIP);
      crew = createSeedCrew();
    }
    const crewArr = { ...createDefaultCrewArrSettings(), ...raw.crewArr };
    // Ports/ranks/nationalities are user-managed suggestion lists: keep exactly what
    // was saved (so Settings deletions are permanent) and only derive from referenced
    // data / defaults on first run, when the field is absent.
    const portsProvided = Array.isArray(raw.ports);
    let ports = portsProvided
      ? (raw.ports as unknown[]).length
        ? migratePortsRaw(raw.ports)
        : []
      : mergePorts(
          migratePortsRaw(undefined),
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
    crew = this.ensureDepartureBaseline(crew);
    crew = this.rescueOrphanCrew(crew);
    let passengers = (raw.passengers ?? []).map((m) => this.normalizePassenger(m, raw.ports));
    passengers = this.ensureDepartureBaselinePassengers(passengers);
    passengers = this.rescueOrphanPassengers(passengers);
    const paxArr = { ...createDefaultPaxArrSettings(), ...raw.paxArr };
    const ranks = Array.isArray(raw.ranks)
      ? mergeUniqueList(raw.ranks)
      : mergeUniqueList(DEFAULT_RANKS, ...crew.map((c) => c.rank));
    const nationalities = Array.isArray(raw.nationalities)
      ? mergeUniqueList(raw.nationalities)
      : mergeUniqueList(
          DEFAULT_NATIONALITIES,
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
    const crewEffectForm = normalizeCrewEffectForm(raw.crewEffectForm);
    const nilListForm = normalizeNilListForm(raw.nilListForm);
    const shipMoneyForm = normalizeShipMoneyForm(raw.shipMoneyForm);
    const cashAdvanceForm = normalizeCashAdvanceForm(raw.cashAdvanceForm);
    const crewMoneyListForm = normalizeCrewMoneyListForm(raw.crewMoneyListForm);
    const narcoticListForm = normalizeNarcoticListForm(raw.narcoticListForm);
    const documentOverlay = this.normalizeDocumentOverlay(raw.documentOverlay);
    const shipAssets = { ...createEmptyShipAssetsMeta(), ...raw.shipAssets };
    const outputSettings = this.normalizeOutputSettings(raw.outputSettings);
    const printPackages = this.normalizePrintPackages(raw.printPackages);
    const customDocuments = this.normalizeCustomDocuments(raw.customDocuments);
    return {
      ship,
      crew,
      crewArr,
      passengers,
      paxArr,
      ports,
      ranks: mergeUniqueList(ranks),
      nationalities: mergeUniqueList(nationalities),
      portCallHistory,
      portOfCall,
      shipStoresForm,
      crewEffectForm,
      nilListForm,
      shipMoneyForm,
      cashAdvanceForm,
      crewMoneyListForm,
      narcoticListForm,
      documentOverlay,
      shipAssets,
      outputSettings,
      printPackages,
      customDocuments,
      seedVersion: SEED_VERSION,
    };
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

  private normalizePrintPackages(raw: unknown): PortPackage[] {
    if (!Array.isArray(raw)) return [];
    const normItems = (items: unknown): PortPackageItem[] =>
      Array.isArray(items)
        ? items
            .map((it) => ({
              documentId: String((it as PortPackageItem)?.documentId ?? '').trim(),
              copies: Math.max(1, Math.min(99, Math.round(Number((it as PortPackageItem)?.copies) || 1))),
            }))
            .filter((it) => it.documentId)
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
        }));
      } else if (Array.isArray((pkg as { items?: unknown }).items)) {
        // Legacy: flat items -> single "General" authority.
        authorities = [{ name: 'General', items: normItems((pkg as { items?: unknown }).items) }];
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
  ): AppData['documentOverlay'] {
    const defaults = createDefaultDocumentOverlayPrefs();
    const out: AppData['documentOverlay'] = {
      crewList: this.normalizeCrewListPrefs(raw?.crewList),
      pax: this.normalizeStampDocumentPrefs(raw?.pax, defaults.pax),
      portOfCall: this.normalizeStampDocumentPrefs(raw?.portOfCall, defaults.portOfCall),
      mdh: this.normalizeStampDocumentPrefs(raw?.mdh, defaults.mdh),
      shipStores: this.normalizeStampDocumentPrefs(raw?.shipStores, defaults.shipStores),
      crewEffect: this.normalizeStampDocumentPrefs(raw?.crewEffect, defaults.crewEffect),
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
    const defaults = createDefaultCrewListPrefs();
    const listType = normalizeCrewListType(raw ?? {});
    const legacy: CrewListVariantPlacement = {};
    if (typeof raw?.overlayRotation === 'number') {
      legacy.overlayRotation = raw.overlayRotation;
    }
    if (isValidStampBox(raw?.stampBox)) {
      legacy.stampBox = { ...raw!.stampBox! };
    }
    if (isValidStampBox(raw?.signatureBox)) {
      legacy.signatureBox = { ...raw!.signatureBox! };
    }
    return {
      listType,
      useStamp: raw?.useStamp ?? defaults.useStamp,
      useSignature: raw?.useSignature ?? defaults.useSignature,
      byPlacement: normalizeCrewListByPlacement(raw?.byPlacement, legacy),
    };
  }

  private normalizePortCallHistory(
    raw: Partial<AppData>,
    ports: Port[],
  ): PortCallHistoryEntry[] {
    const useSeed =
      !raw.portCallHistory?.length ||
      (raw.portCallHistory.length < 10 && (raw.seedVersion ?? 0) < SEED_VERSION);

    let history: PortCallHistoryEntry[];
    if (useSeed) {
      history = SEED_PORT_CALL_HISTORY.map((e) => ({ ...e, id: e.id || crypto.randomUUID() }));
    } else {
      history = raw.portCallHistory!.map((entry) => ({
        ...createEmptyPortCallEntry(),
        ...entry,
        id: entry.id || crypto.randomUUID(),
      }));
    }

    return history.map((entry) => ({
      ...entry,
      portName: resolvePortRef(entry.portName, ports)?.name ?? entry.portName,
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
    const payload = { ...this.data(), seedVersion: SEED_VERSION };
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
    partial: Partial<AppData['documentOverlay']['crewList']>,
    notify: 'silent' | 'saved' = 'silent',
  ): void {
    const placementPatch = crewListPlacementPatch(partial);
    const { overlayRotation, stampBox, signatureBox, byPlacement: _bp, ...meta } = partial;

    this.data.update((d) => {
      const current = d.documentOverlay.crewList;
      let next: AppData['documentOverlay']['crewList'] = {
        ...current,
        ...(meta.listType != null ? { listType: meta.listType } : {}),
        ...(meta.useStamp != null ? { useStamp: meta.useStamp } : {}),
        ...(meta.useSignature != null ? { useSignature: meta.useSignature } : {}),
      };

      if (placementPatch) {
        const key = crewListPlacementKey(
          (meta.listType as typeof current.listType | undefined) ?? current.listType,
        );
        const byPlacement = { ...current.byPlacement };
        byPlacement[key] = { ...byPlacement[key], ...placementPatch };
        next = { ...next, byPlacement };
      }

      return {
        ...d,
        documentOverlay: { ...d.documentOverlay, crewList: next },
      };
    });
    void this.persist(notify);
  }

  /** Apply stamp/signature toggles to all document types at once. */
  applyStampTogglesToAllDocuments(useStamp: boolean, useSignature: boolean): void {
    const patch: Pick<DocumentStampOptions, 'useStamp' | 'useSignature'> = {
      useStamp,
      useSignature,
    };
    this.data.update((d) => ({
      ...d,
      documentOverlay: {
        crewList: { ...d.documentOverlay.crewList, ...patch },
        pax: { ...d.documentOverlay.pax, ...patch },
        portOfCall: { ...d.documentOverlay.portOfCall, ...patch },
        mdh: { ...d.documentOverlay.mdh, ...patch },
        shipStores: { ...d.documentOverlay.shipStores, ...patch },
        crewEffect: { ...d.documentOverlay.crewEffect, ...patch },
        nilList: { ...d.documentOverlay.nilList, ...patch },
        shipMoney: { ...d.documentOverlay.shipMoney, ...patch },
        cashAdvance: { ...d.documentOverlay.cashAdvance, ...patch },
        crewMoney: { ...d.documentOverlay.crewMoney, ...patch },
        narcoticList: { ...d.documentOverlay.narcoticList, ...patch },
        sso0108PortCalls: { ...d.documentOverlay.sso0108PortCalls, ...patch },
      },
    }));
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
      authorities: [...pkg.authorities, { name, items: [] }],
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

  updateShipStoresPlaceOfStorage(placeOfStorage: string): void {
    this.patchShipStoresForm({ placeOfStorage });
  }

  updateCrewEffectForm(
    partial: Partial<CrewEffectFormSettings>,
    notify?: 'silent' | 'saved',
  ): void {
    this.data.update((d) => ({
      ...d,
      crewEffectForm: normalizeCrewEffectForm({ ...d.crewEffectForm, ...partial }),
    }));
    const resolved =
      notify ??
      (partial.nilCigarettes !== undefined ||
      partial.nilSpirits !== undefined ||
      partial.nilWines !== undefined
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

  updateShipStoresRow(rowIndex: number, partial: Partial<ShipStoresRow>): void {
    if (rowIndex < 0 || rowIndex >= 27) return;
    this.data.update((d) => {
      const form = normalizeShipStoresForm(d.shipStoresForm);
      const rows = form.rows.map((r, i) => (i === rowIndex ? { ...r, ...partial } : r));
      return { ...d, shipStoresForm: normalizeShipStoresForm({ ...form, rows }) };
    });
    void this.persist('silent');
  }

  private patchShipStoresForm(partial: Partial<ShipStoresFormSettings>): void {
    this.data.update((d) => ({
      ...d,
      shipStoresForm: normalizeShipStoresForm({ ...d.shipStoresForm, ...partial }),
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
      portCallHistory: d.portCallHistory.map((e) => (e.id === id ? { ...e, ...partial } : e)),
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
    return this.addCrewMember({
      ...member,
      archived: false,
      onArrivalList: true,
      onDepartureList: true,
    });
  }

  addCrewMemberToArchive(member?: Partial<CrewMember>): CrewMember {
    return this.addCrewMember({
      ...member,
      archived: true,
      onArrivalList: false,
      onDepartureList: false,
    });
  }

  archiveCrewMember(id: string): void {
    this.updateCrewMember(
      id,
      { archived: true, onArrivalList: false, onDepartureList: false },
      'silent',
    );
  }

  restoreCrewMemberToList(id: string, list: CrewListKind): void {
    const patch =
      list === 'arrival'
        ? { archived: false, onArrivalList: true, onDepartureList: true }
        : { archived: false, onArrivalList: false, onDepartureList: true };
    this.updateCrewMember(id, patch, 'silent');
  }

  /** Departure list = arrival list (same people for this port). Departure-only → archive. */
  syncDepartureFromArrival(): number {
    let archived = 0;
    this.data.update((d) => ({
      ...d,
      crew: this.rescueOrphanCrew(
        d.crew.map((m) => {
          const next = this.mapCrewArrivalToDepartureSync(m);
          if (!m.archived && next.archived && m.onDepartureList && !m.onArrivalList) {
            archived++;
          }
          return next;
        }),
      ),
    }));
    void this.persist('saved');
    return archived;
  }

  /** Who would be affected by departure → arrival sync (active crew only). */
  previewDepartureToArrival(): DepartureToArrivalSyncPreview {
    const active = this.data().crew.filter((m) => !m.archived);
    return {
      onDeparture: active.filter((m) => m.onDepartureList).length,
      arrivalOnlyToArchive: active.filter((m) => m.onArrivalList && !m.onDepartureList).length,
    };
  }

  /**
   * Next port: departure list → new arrival baseline.
   * On arrival but not on departure → archive (not left in limbo).
   */
  applyDepartureToArrival(): DepartureToArrivalSyncPreview {
    const preview = this.previewDepartureToArrival();
    this.data.update((d) => ({
      ...d,
      crew: d.crew.map((m) => this.mapCrewDepartureToArrival(m)),
    }));
    void this.persist('saved');
    return preview;
  }

  /** Active crew on arrival but not departure → archive. Returns count archived. */
  archiveArrivalOnlyCrew(notify: 'silent' | 'saved' = 'saved'): number {
    let count = 0;
    this.data.update((d) => ({
      ...d,
      crew: d.crew.map((m) => {
        const patch = this.archiveIfArrivalOnly(m);
        if (patch) count++;
        return patch ?? m;
      }),
    }));
    if (count > 0) void this.persist(notify);
    return count;
  }

  private mapCrewDepartureToArrival(m: CrewMember): CrewMember {
    if (m.archived) return m;
    const archived = this.archiveIfArrivalOnly(m);
    if (archived) return archived;
    if (m.onDepartureList) {
      return { ...m, onArrivalList: true, onDepartureList: true };
    }
    return m;
  }

  private archiveIfArrivalOnly(m: CrewMember): CrewMember | null {
    if (m.archived || m.onDepartureList || !m.onArrivalList) return null;
    return { ...m, archived: true, onArrivalList: false, onDepartureList: false };
  }

  private mapCrewArrivalToDepartureSync(m: CrewMember): CrewMember {
    if (m.archived) return m;
    const archived = this.archiveIfDepartureOnly(m);
    if (archived) return archived;
    if (m.onArrivalList) {
      return { ...m, onDepartureList: true };
    }
    return m;
  }

  private archiveIfDepartureOnly(m: CrewMember): CrewMember | null {
    if (m.archived || m.onArrivalList || !m.onDepartureList) return null;
    return { ...m, archived: true, onArrivalList: false, onDepartureList: false };
  }

  /**
   * Remove from departure list. If also on arrival — stays on arrival (swap workflow).
   * Departure-only members go to the archive.
   */
  removeFromDepartureList(id: string): void {
    const member = this.data().crew.find((m) => m.id === id);
    if (!member) return;

    if (member.archived) {
      this.updateCrewMember(id, { onDepartureList: false }, 'silent');
      return;
    }

    if (member.onArrivalList) {
      this.updateCrewMember(id, { onDepartureList: false }, 'silent');
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

  private ensureDepartureBaseline(crew: CrewMember[]): CrewMember[] {
    const hasArrival = crew.some((m) => !m.archived && m.onArrivalList);
    const hasDeparture = crew.some((m) => !m.archived && m.onDepartureList);
    if (!hasArrival || hasDeparture) return crew;
    return crew.map((m) =>
      !m.archived && m.onArrivalList ? { ...m, onDepartureList: true } : m,
    );
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
    return this.addPassenger({
      ...member,
      archived: false,
      onArrivalList: true,
      onDepartureList: true,
    });
  }

  addPassengerToArchive(member?: Partial<PassengerMember>): PassengerMember {
    return this.addPassenger({
      ...member,
      archived: true,
      onArrivalList: false,
      onDepartureList: false,
    });
  }

  archivePassenger(id: string): void {
    this.updatePassenger(
      id,
      { archived: true, onArrivalList: false, onDepartureList: false },
      'silent',
    );
  }

  restorePassengerToList(id: string, list: PaxListKind): void {
    const patch =
      list === 'arrival'
        ? { archived: false, onArrivalList: true, onDepartureList: true }
        : { archived: false, onArrivalList: false, onDepartureList: true };
    this.updatePassenger(id, patch, 'silent');
  }

  syncPassengerDepartureFromArrival(): number {
    let archived = 0;
    this.data.update((d) => ({
      ...d,
      passengers: this.rescueOrphanPassengers(
        d.passengers.map((m) => {
          const next = this.mapPassengerArrivalToDepartureSync(m);
          if (!m.archived && next.archived && m.onDepartureList && !m.onArrivalList) {
            archived++;
          }
          return next;
        }),
      ),
    }));
    void this.persist('saved');
    return archived;
  }

  previewPassengerDepartureToArrival(): DepartureToArrivalSyncPreview {
    const active = this.data().passengers.filter((m) => !m.archived);
    return {
      onDeparture: active.filter((m) => m.onDepartureList).length,
      arrivalOnlyToArchive: active.filter((m) => m.onArrivalList && !m.onDepartureList).length,
    };
  }

  applyPassengerDepartureToArrival(): DepartureToArrivalSyncPreview {
    const preview = this.previewPassengerDepartureToArrival();
    this.data.update((d) => ({
      ...d,
      passengers: d.passengers.map((m) => this.mapPassengerDepartureToArrival(m)),
    }));
    void this.persist('saved');
    return preview;
  }

  archiveArrivalOnlyPassengers(notify: 'silent' | 'saved' = 'saved'): number {
    let count = 0;
    this.data.update((d) => ({
      ...d,
      passengers: d.passengers.map((m) => {
        const patch = this.archivePassengerIfArrivalOnly(m);
        if (patch) count++;
        return patch ?? m;
      }),
    }));
    if (count > 0) void this.persist(notify);
    return count;
  }

  private mapPassengerDepartureToArrival(m: PassengerMember): PassengerMember {
    if (m.archived) return m;
    const archived = this.archivePassengerIfArrivalOnly(m);
    if (archived) return archived;
    if (m.onDepartureList) {
      return { ...m, onArrivalList: true, onDepartureList: true };
    }
    return m;
  }

  private archivePassengerIfArrivalOnly(m: PassengerMember): PassengerMember | null {
    if (m.archived || m.onDepartureList || !m.onArrivalList) return null;
    return { ...m, archived: true, onArrivalList: false, onDepartureList: false };
  }

  private mapPassengerArrivalToDepartureSync(m: PassengerMember): PassengerMember {
    if (m.archived) return m;
    const archived = this.archivePassengerIfDepartureOnly(m);
    if (archived) return archived;
    if (m.onArrivalList) {
      return { ...m, onDepartureList: true };
    }
    return m;
  }

  private archivePassengerIfDepartureOnly(m: PassengerMember): PassengerMember | null {
    if (m.archived || m.onArrivalList || !m.onDepartureList) return null;
    return { ...m, archived: true, onArrivalList: false, onDepartureList: false };
  }

  removePassengerFromDepartureList(id: string): void {
    const member = this.data().passengers.find((m) => m.id === id);
    if (!member) return;

    if (member.archived) {
      this.updatePassenger(id, { onDepartureList: false }, 'silent');
      return;
    }

    if (member.onArrivalList) {
      this.updatePassenger(id, { onDepartureList: false }, 'silent');
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

  private ensureDepartureBaselinePassengers(passengers: PassengerMember[]): PassengerMember[] {
    const hasArrival = passengers.some((m) => !m.archived && m.onArrivalList);
    const hasDeparture = passengers.some((m) => !m.archived && m.onDepartureList);
    if (!hasArrival || hasDeparture) return passengers;
    return passengers.map((m) =>
      !m.archived && m.onArrivalList ? { ...m, onDepartureList: true } : m,
    );
  }

  removePassenger(id: string): void {
    this.data.update((d) => ({ ...d, passengers: d.passengers.filter((m) => m.id !== id) }));
    void this.persist('silent');
  }

  reorderPassengerList(list: PaxListKind, fromIndex: number, toIndex: number): void {
    if (fromIndex === toIndex) return;
    const inList = (m: PassengerMember) =>
      list === 'arrival'
        ? !m.archived && m.onArrivalList
        : !m.archived && m.onDepartureList;

    this.data.update((d) => {
      const indices: number[] = [];
      const members: PassengerMember[] = [];
      d.passengers.forEach((m, i) => {
        if (inList(m)) {
          indices.push(i);
          members.push(m);
        }
      });
      const reordered = [...members];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, moved);
      const passengers = [...d.passengers];
      indices.forEach((idx, j) => {
        passengers[idx] = reordered[j];
      });
      return { ...d, passengers };
    });
    void this.persist('debounced');
  }

  reorderCrewList(list: CrewListKind, fromIndex: number, toIndex: number): void {
    if (fromIndex === toIndex) return;
    const inList = (m: CrewMember) =>
      list === 'arrival'
        ? !m.archived && m.onArrivalList
        : !m.archived && m.onDepartureList;

    this.data.update((d) => {
      const indices: number[] = [];
      const members: CrewMember[] = [];
      d.crew.forEach((m, i) => {
        if (inList(m)) {
          indices.push(i);
          members.push(m);
        }
      });
      const reordered = [...members];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, moved);
      const crew = [...d.crew];
      indices.forEach((idx, j) => {
        crew[idx] = reordered[j];
      });
      return { ...d, crew };
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

  /** Load crew-data.json produced by scripts/import-document-xlsx.mjs */
  private async tryLoadDocumentImport(): Promise<boolean> {
    try {
      const res = await fetch('/crew-data.json', { cache: 'no-store' });
      if (!res.ok) return false;
      const parsed = (await res.json()) as Partial<AppData>;
      this.replaceAll(parsed as AppData);
      if (!window.electronAPI) {
        localStorage.setItem(DOCUMENT_IMPORT_KEY, DOCUMENT_IMPORT_ID);
      }
      return true;
    } catch {
      return false;
    }
  }
}
