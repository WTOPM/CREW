import { Injectable, inject, computed } from '@angular/core';
import {
  AppData,
  ShipInfo,
  crewRankOrder,
  filterActiveCrewList,
  sortCrewByRank,
  shipFieldPersistNotify,
  areCrewListsInSync,
  crewListDiffCounts,
  normalizeShipStoresDocId,
} from '../models/crew.models';
import {
  sortPassengersByName,
  arePassengerListsInSync,
  passengerListDiffCounts,
  filterActivePassengerList,
} from '../models/passenger.models';
import { createEmptyAppData } from '../data/empty-app-data';
import { extractMainAppSnapshot, mergeMainAppSnapshotIntoLive } from '../utils/app-snapshot.util';
import { normalizeAppData } from './app-data-normalizer';
import { AppStateStore, type PersistNotify } from './app-state.store';

@Injectable({ providedIn: 'root' })
export class StorageService {
  /** Central state kernel: owns the data signal + persistence (shared with feature stores). */
  private readonly state = inject(AppStateStore);
  private readonly data = this.state.data;

  readonly ship = computed(() => this.data().ship);
  readonly crewArr = computed(() => this.data().crewArr);
  readonly ports = computed(() => this.data().ports);
  readonly ranks = computed(() => this.data().ranks);
  readonly nationalities = computed(() => this.data().nationalities);
  readonly portCallHistory = computed(() => this.data().portCallHistory);
  readonly portOfCall = computed(() => this.data().portOfCall);
  readonly shipStoresSettingsDocId = computed(() =>
    normalizeShipStoresDocId(this.data().shipStoresSettingsDocId),
  );
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
  readonly etaLibrary = computed(() => this.data().etaLibrary);
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
    filterActivePassengerList(this.data().passengers, 'arrival', this.data().passengerArrivalOrder),
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

  init(): Promise<void> {
    return this.state.init();
  }

  private persist(notify: PersistNotify = 'debounced', savedMessage?: string): Promise<void> {
    return this.state.persist(notify, savedMessage);
  }

  /** Call when a Done / backdrop closes a settings modal (after silent auto-save). */
  finishFormSession(): void {
    this.state.finishFormSession();
  }

  updateShip(
    partial: Partial<AppData['ship']>,
    notify?: 'silent' | 'saved' | 'debounced',
    savedMessage?: string,
  ): void {
    // Ports/nationalities are user-managed (Settings) — do not auto-add referenced values.
    this.data.update((d) => ({ ...d, ship: { ...d.ship, ...partial } }));
    const fields = Object.keys(partial) as (keyof ShipInfo)[];
    const mode = notify ?? (fields.length === 1 ? shipFieldPersistNotify(fields[0]) : 'debounced');
    void this.state.persistShip(mode, savedMessage);
  }

  updateCrewArr(partial: Partial<AppData['crewArr']>, notify: 'silent' | 'saved' = 'saved'): void {
    this.data.update((d) => ({ ...d, crewArr: { ...d.crewArr, ...partial } }));
    void this.persist(notify);
  }

  updatePaxArr(partial: Partial<AppData['paxArr']>, notify: 'silent' | 'saved' = 'saved'): void {
    this.data.update((d) => ({ ...d, paxArr: { ...d.paxArr, ...partial } }));
    void this.persist(notify);
  }

  captureMainAppSnapshot(): import('../models/app-snapshot.models').AppMainSnapshot {
    return extractMainAppSnapshot(this.data());
  }

  applyMainAppSnapshot(snapshot: import('../models/app-snapshot.models').AppMainSnapshot): void {
    this.data.update((d) => {
      const merged = mergeMainAppSnapshotIntoLive(d, snapshot);
      return normalizeAppData({
        ...merged,
        dgLibrary: d.dgLibrary,
        reeferLibrary: d.reeferLibrary,
      });
    });
    void this.persist('silent');
  }

  coerceStoredMainSnapshot(
    raw: unknown,
  ): import('../models/app-snapshot.models').AppMainSnapshot | null {
    if (!raw || typeof raw !== 'object') return null;
    try {
      const empty = createEmptyAppData();
      const merged: Partial<AppData> = {
        ...(raw as Partial<AppData>),
        dgLibrary: empty.dgLibrary,
        reeferLibrary: empty.reeferLibrary,
      };
      return extractMainAppSnapshot(normalizeAppData(merged));
    } catch {
      return null;
    }
  }

  replaceAll(data: AppData): void {
    this.data.set(normalizeAppData(data));
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
