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
  createDefaultPortOfCallSettings,
  createDefaultShipStoresForm,
  createEmptyCrewMember,
  createEmptyPortCallEntry,
  createEmptyShip,
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
  documentOverlay: createDefaultDocumentOverlayPrefs(),
  shipAssets: createEmptyShipAssetsMeta(),
  seedVersion: SEED_VERSION,
};

@Injectable({ providedIn: 'root' })
export class StorageService {
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
  readonly documentOverlay = computed(() => this.data().documentOverlay);
  readonly shipAssets = computed(() => this.data().shipAssets);
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
      documentOverlay: {
        crewList: { ...createDefaultDocumentOverlayPrefs().crewList },
        pax: { ...DEFAULT_DATA.documentOverlay.pax },
        portOfCall: { ...DEFAULT_DATA.documentOverlay.portOfCall },
        mdh: { ...DEFAULT_DATA.documentOverlay.mdh },
        shipStores: { ...DEFAULT_DATA.documentOverlay.shipStores },
        crewEffect: { ...DEFAULT_DATA.documentOverlay.crewEffect },
        nilList: { ...DEFAULT_DATA.documentOverlay.nilList },
        shipMoney: { ...DEFAULT_DATA.documentOverlay.shipMoney },
      },
      shipAssets: { ...DEFAULT_DATA.shipAssets },
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
    let ports = migratePortsRaw(raw.ports);
    ports = mergePorts(
      ports,
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
    const ranks = mergeUniqueList(
      raw.ranks ?? DEFAULT_RANKS,
      ...crew.map((c) => c.rank),
    );
    const nationalities = mergeUniqueList(
      raw.nationalities ?? DEFAULT_NATIONALITIES,
      ship.nationality,
      ...crew.map((c) => c.nationality),
      ...passengers.map((p) => p.nationality),
    );
    const portCallHistory = this.normalizePortCallHistory(raw, ports);
    ports = mergePorts(ports, ...portCallHistory.map((e) => e.portName));
    const portOfCall = this.normalizePortOfCallSettings(raw.portOfCall);
    const shipStoresForm = normalizeShipStoresForm(raw.shipStoresForm);
    const crewEffectForm = normalizeCrewEffectForm(raw.crewEffectForm);
    const nilListForm = normalizeNilListForm(raw.nilListForm);
    const shipMoneyForm = normalizeShipMoneyForm(raw.shipMoneyForm);
    const documentOverlay = this.normalizeDocumentOverlay(raw.documentOverlay);
    const shipAssets = { ...createEmptyShipAssetsMeta(), ...raw.shipAssets };
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
      documentOverlay,
      shipAssets,
      seedVersion: SEED_VERSION,
    };
  }

  private normalizeDocumentOverlay(
    raw: Partial<AppData['documentOverlay']> | undefined,
  ): AppData['documentOverlay'] {
    const defaults = createDefaultDocumentOverlayPrefs();
    const crewDefaults = defaults.crewList;
    const out: AppData['documentOverlay'] = {
      crewList: this.normalizeStampDocumentPrefs(raw?.crewList, crewDefaults, {
        listType: normalizeCrewListType(raw?.crewList ?? {}),
      }),
      pax: this.normalizeStampDocumentPrefs(raw?.pax, defaults.pax),
      portOfCall: this.normalizeStampDocumentPrefs(raw?.portOfCall, defaults.portOfCall),
      mdh: this.normalizeStampDocumentPrefs(raw?.mdh, defaults.mdh),
      shipStores: this.normalizeStampDocumentPrefs(raw?.shipStores, defaults.shipStores),
      crewEffect: this.normalizeStampDocumentPrefs(raw?.crewEffect, defaults.crewEffect),
      nilList: this.normalizeStampDocumentPrefs(raw?.nilList, defaults.nilList),
      shipMoney: this.normalizeStampDocumentPrefs(raw?.shipMoney, defaults.shipMoney),
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
    if (notify === 'saved') this.toast.showSaved();
    if (notify === 'debounced') this.toast.debouncedSaved();
  }

  updateShip(partial: Partial<AppData['ship']>): void {
    this.data.update((d) => {
      const ship = { ...d.ship, ...partial };
      const ports = mergePorts(
        d.ports,
        ship.portOfCall,
        ship.lastPortOfCall,
        ship.nextPortOfCall,
        ship.homeport,
        ship.waterTestPort,
        ship.sanitationCertificateIssuedAt,
      );
      const nationalities = mergeUniqueList(d.nationalities, ship.nationality);
      return { ...d, ship, ports, nationalities };
    });
    void this.persist('debounced');
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
  ): void {
    this.data.update((d) => ({
      ...d,
      documentOverlay: {
        ...d.documentOverlay,
        [documentId]: { ...d.documentOverlay[documentId], ...partial },
      },
    }));
    void this.persist('saved');
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
      },
    }));
    void this.persist('saved');
  }

  updateShipAssets(partial: Partial<AppData['shipAssets']>): void {
    this.data.update((d) => ({
      ...d,
      shipAssets: { ...d.shipAssets, ...partial },
    }));
    void this.persist('saved');
  }

  updatePortOfCallSettings(partial: Partial<AppData['portOfCall']>): void {
    this.data.update((d) => ({
      ...d,
      portOfCall: this.normalizePortOfCallSettings({ ...d.portOfCall, ...partial }),
    }));
    void this.persist('saved');
  }

  updateShipStoresPlaceOfStorage(placeOfStorage: string): void {
    this.patchShipStoresForm({ placeOfStorage });
  }

  updateCrewEffectForm(partial: Partial<CrewEffectFormSettings>): void {
    this.data.update((d) => ({
      ...d,
      crewEffectForm: normalizeCrewEffectForm({ ...d.crewEffectForm, ...partial }),
    }));
    void this.persist('saved');
  }

  updateNilListPhrase(id: string, partial: { text?: string; enabled?: boolean }): void {
    this.data.update((d) => {
      const form = normalizeNilListForm(d.nilListForm);
      const phrases = form.phrases.map((p) => (p.id === id ? { ...p, ...partial } : p));
      return { ...d, nilListForm: normalizeNilListForm({ phrases }) };
    });
    void this.persist('saved');
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
    void this.persist('saved');
  }

  removeNilListPhrase(id: string): void {
    this.data.update((d) => {
      const form = normalizeNilListForm(d.nilListForm);
      const phrases = form.phrases.filter((p) => p.id !== id);
      return { ...d, nilListForm: normalizeNilListForm({ phrases }) };
    });
    void this.persist('saved');
  }

  updateShipMoneyEntry(id: string, partial: { amount?: string; currency?: string }): void {
    this.data.update((d) => {
      const form = normalizeShipMoneyForm(d.shipMoneyForm);
      const entries = form.entries.map((e) => (e.id === id ? { ...e, ...partial } : e));
      return { ...d, shipMoneyForm: normalizeShipMoneyForm({ entries }) };
    });
    void this.persist('saved');
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
    void this.persist('saved');
  }

  removeShipMoneyEntry(id: string): void {
    this.data.update((d) => {
      const form = normalizeShipMoneyForm(d.shipMoneyForm);
      const entries = form.entries.filter((e) => e.id !== id);
      return { ...d, shipMoneyForm: normalizeShipMoneyForm({ entries }) };
    });
    void this.persist('saved');
  }

  updateShipStoresRow(rowIndex: number, partial: Partial<ShipStoresRow>): void {
    if (rowIndex < 0 || rowIndex >= 27) return;
    this.data.update((d) => {
      const form = normalizeShipStoresForm(d.shipStoresForm);
      const rows = form.rows.map((r, i) => (i === rowIndex ? { ...r, ...partial } : r));
      return { ...d, shipStoresForm: normalizeShipStoresForm({ ...form, rows }) };
    });
    void this.persist('saved');
  }

  private patchShipStoresForm(partial: Partial<ShipStoresFormSettings>): void {
    this.data.update((d) => ({
      ...d,
      shipStoresForm: normalizeShipStoresForm({ ...d.shipStoresForm, ...partial }),
    }));
    void this.persist('saved');
  }

  addPortCallEntry(entry?: Partial<PortCallHistoryEntry>): PortCallHistoryEntry {
    const newEntry = { ...createEmptyPortCallEntry(), ...entry };
    this.data.update((d) => {
      const ports = mergePorts(d.ports, newEntry.portName);
      return { ...d, portCallHistory: [newEntry, ...d.portCallHistory], ports };
    });
    void this.persist('silent');
    this.toast.showPortAdded();
    return newEntry;
  }

  updatePortCallEntry(id: string, partial: Partial<PortCallHistoryEntry>): void {
    this.data.update((d) => {
      const portCallHistory = d.portCallHistory.map((e) => (e.id === id ? { ...e, ...partial } : e));
      const updated = portCallHistory.find((e) => e.id === id);
      const ports = mergePorts(d.ports, updated?.portName);
      return { ...d, portCallHistory, ports };
    });
    void this.persist('saved');
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
    this.data.update((d) => {
      const ports = mergePorts(d.ports, newMember.joiningPort);
      const ranks = mergeUniqueList(d.ranks, newMember.rank);
      const nationalities = mergeUniqueList(d.nationalities, newMember.nationality);
      return { ...d, crew: [...d.crew, newMember], ports, ranks, nationalities };
    });
    void this.persist('silent');
    return newMember;
  }

  updateCrewMember(
    id: string,
    partial: Partial<CrewMember>,
    notify: 'silent' | 'saved' = 'saved',
  ): void {
    this.data.update((d) => {
      const crew = d.crew.map((m) => (m.id === id ? { ...m, ...partial } : m));
      const updated = crew.find((m) => m.id === id);
      const ports = mergePorts(d.ports, updated?.joiningPort);
      const ranks = mergeUniqueList(d.ranks, updated?.rank);
      const nationalities = mergeUniqueList(d.nationalities, updated?.nationality);
      return { ...d, crew, ports, ranks, nationalities };
    });
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
    this.data.update((d) => {
      const nationalities = mergeUniqueList(d.nationalities, newMember.nationality);
      const ranks = mergeUniqueList(d.ranks, PASSENGER_RANK);
      return { ...d, passengers: [...d.passengers, newMember], ranks, nationalities };
    });
    void this.persist('silent');
    return newMember;
  }

  updatePassenger(
    id: string,
    partial: Partial<PassengerMember>,
    notify: 'silent' | 'saved' = 'saved',
  ): void {
    this.data.update((d) => {
      const passengers = d.passengers.map((m) => (m.id === id ? { ...m, ...partial } : m));
      const updated = passengers.find((m) => m.id === id);
      const nationalities = mergeUniqueList(d.nationalities, updated?.nationality);
      return { ...d, passengers, nationalities };
    });
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
