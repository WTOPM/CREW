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
  resolvePortRef,
  crewRankOrder,
  filterActiveCrewList,
  sortCrewByRank,
  shipFieldPersistNotify,
  areCrewListsInSync,
  crewListDiffCounts,
  normalizePortSecLvl,
  type CrewEffectDocId,
  type ShipStoresDocId,
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
} from '../models/passenger.models';
import { APP_DATA_SCHEMA_VERSION, createEmptyAppData } from '../data/empty-app-data';
import { POC_MAX_ROW_COUNT, POC_MIN_ROW_COUNT } from './port-of-call-coordinates';
import {
  normalizeCrewEffectForm,
  normalizeCrewEffectForm02,
  type CrewEffectForm02Settings,
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
  SHIP_STORES_02_ROW_COUNT,
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
  crewListVariantPatch,
  CREW_LIST_TYPE_IDS,
  getCrewListVariantSettings,
  normalizeCrewListDocumentPrefs,
  CrewListOverlayUpdate,
} from '../models/document-overlay.models';
import { isValidStampBox } from '../utils/overlay-stamp-box.util';

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
  readonly crewEffectForm = computed(() => this.data().crewEffectForm);
  readonly crewEffectForm02 = computed(() => this.data().crewEffectForm02);
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
  readonly crewListsInSync = computed(() => areCrewListsInSync(this.data().crew));
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
    this.data().passengers.filter((m) => !m.archived && m.onArrivalList),
  );
  readonly activePassengersDeparture = computed(() =>
    this.data().passengers.filter((m) => !m.archived && m.onDepartureList),
  );
  readonly passengerListsInSync = computed(() => arePassengerListsInSync(this.data().passengers));
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
    const shipStoresForm02 = normalizeShipStoresForm02(raw.shipStoresForm02);
    const crewEffectForm = normalizeCrewEffectForm(raw.crewEffectForm);
    const crewEffectForm02 = normalizeCrewEffectForm02(raw.crewEffectForm02);
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
      shipStoresForm02,
      crewEffectForm,
      crewEffectForm02,
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
      seedVersion: APP_DATA_SCHEMA_VERSION,
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
          });
        }
      }
    }
    return [...map.values()];
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
      paxV2: this.normalizeStampDocumentPrefs(raw?.paxV2, defaults.paxV2),
      portOfCall: this.normalizeStampDocumentPrefs(raw?.portOfCall, defaults.portOfCall),
      portsOfCall: this.normalizeStampDocumentPrefs(raw?.portsOfCall, defaults.portsOfCall),
      mdh: this.normalizeStampDocumentPrefs(raw?.mdh, defaults.mdh),
      crewVaccine: this.normalizeStampDocumentPrefs(raw?.crewVaccine, defaults.crewVaccine),
      shipStores: this.normalizeStampDocumentPrefs(raw?.shipStores, defaults.shipStores),
      shipStores02: this.normalizeStampDocumentPrefs(raw?.shipStores02, defaults.shipStores02),
      crewEffect: this.normalizeStampDocumentPrefs(raw?.crewEffect, defaults.crewEffect),
      crewEffect02: this.normalizeStampDocumentPrefs(raw?.crewEffect02, defaults.crewEffect02),
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
    const patch: Pick<DocumentStampOptions, 'useStamp' | 'useSignature'> = {
      useStamp,
      useSignature,
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
          crewEffect: { ...d.documentOverlay.crewEffect, ...patch },
          crewEffect02: { ...d.documentOverlay.crewEffect02, ...patch },
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

  updateShipStoresPlaceOfStorage(docId: ShipStoresDocId, placeOfStorage: string): void {
    this.patchShipStoresForm(docId, { placeOfStorage });
  }

  updateCrewEffectForm(
    docId: CrewEffectDocId,
    partial: Partial<CrewEffectFormSettings> | Partial<CrewEffectForm02Settings>,
    notify?: 'silent' | 'saved',
  ): void {
    const field = docId === 'crewEffect02' ? ('crewEffectForm02' as const) : ('crewEffectForm' as const);
    const normalize =
      docId === 'crewEffect02' ? normalizeCrewEffectForm02 : normalizeCrewEffectForm;
    this.data.update((d) => ({
      ...d,
      [field]: normalize({ ...d[field], ...partial }),
    }));
    const resolved =
      notify ??
      (docId === 'crewEffect02'
        ? 'nilCigars' in partial ||
          'nilWeapons' in partial ||
          'nilAmmunition' in partial ||
          partial.nilCigarettes !== undefined ||
          partial.nilSpirits !== undefined
          ? 'saved'
          : 'silent'
        : partial.nilCigarettes !== undefined ||
            partial.nilSpirits !== undefined ||
            'nilWines' in partial && partial.nilWines !== undefined
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

  updateShipStoresRow(
    docId: ShipStoresDocId,
    rowIndex: number,
    partial: Partial<ShipStoresRow>,
  ): void {
    const rowCount = docId === 'shipStores02' ? SHIP_STORES_02_ROW_COUNT : SHIP_STORES_ROW_COUNT;
    if (rowIndex < 0 || rowIndex >= rowCount) return;
    const field =
      docId === 'shipStores02' ? ('shipStoresForm02' as const) : ('shipStoresForm' as const);
    this.data.update((d) => {
      const normalize =
        docId === 'shipStores02' ? normalizeShipStoresForm02 : normalizeShipStoresForm;
      const form = normalize(d[field]);
      const rows = form.rows.map((r, i) => (i === rowIndex ? { ...r, ...partial } : r));
      return { ...d, [field]: normalize({ ...form, rows }) };
    });
    void this.persist('silent');
  }

  private patchShipStoresForm(docId: ShipStoresDocId, partial: Partial<ShipStoresFormSettings>): void {
    const field =
      docId === 'shipStores02' ? ('shipStoresForm02' as const) : ('shipStoresForm' as const);
    const normalize =
      docId === 'shipStores02' ? normalizeShipStoresForm02 : normalizeShipStoresForm;
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
    const linked = areCrewListsInSync(this.data().crew);
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

  /** When lists are linked, restore/add puts the person on both lists. */
  private crewRestorePatch(list: CrewListKind): Partial<CrewMember> {
    const linked = areCrewListsInSync(this.data().crew);
    return {
      archived: false,
      archivedFromDeparture: false,
      onArrivalList: list === 'arrival' || linked,
      onDepartureList: list === 'departure' || linked,
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
      crew = this.reorderCrewLikeList(crew, 'arrival');
      return { ...d, crew: this.rescueOrphanCrew(crew) };
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
      crew = this.reorderCrewLikeList(crew, 'departure');
      return { ...d, crew: this.rescueOrphanCrew(crew) };
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

  private reorderCrewLikeList(crew: CrewMember[], list: CrewListKind): CrewMember[] {
    const ordered = filterActiveCrewList(crew, list);
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
    if (areCrewListsInSync(this.data().crew)) {
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
    const linked = arePassengerListsInSync(this.data().passengers);
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

  /** When lists are linked, restore/add puts the person on both lists. */
  private passengerRestorePatch(list: PaxListKind): Partial<PassengerMember> {
    const linked = arePassengerListsInSync(this.data().passengers);
    return {
      archived: false,
      archivedFromDeparture: false,
      onArrivalList: list === 'arrival' || linked,
      onDepartureList: list === 'departure' || linked,
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
      passengers = this.reorderPassengerLikeList(passengers, 'arrival');
      return { ...d, passengers: this.rescueOrphanPassengers(passengers) };
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
      passengers = this.reorderPassengerLikeList(passengers, 'departure');
      return { ...d, passengers: this.rescueOrphanPassengers(passengers) };
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
  ): PassengerMember[] {
    const ordered = filterActivePassengerList(passengers, list);
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
    if (arePassengerListsInSync(this.data().passengers)) {
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
}
