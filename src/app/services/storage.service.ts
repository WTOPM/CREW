import { Injectable, Injector, inject, computed } from '@angular/core';
import {
  AppData,
  ShipInfo,
  createDefaultHomeListViewSettings,
  normalizeHomeListViewSettings,
  crewRankOrder,
  filterActiveCrewList,
  sortCrewByRank,
  shipFieldPersistNotify,
  areCrewListsInSync,
  crewListDiffCounts,
  normalizeShipStoresDocId,
  type HomeListViewSettings,
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
import { AppStateStore, type PersistNotify, type AppInitResult } from './app-state.store';
import { ConfirmDialogService } from './confirm-dialog.service';

@Injectable({ providedIn: 'root' })
export class StorageService {
  /** Central state kernel: owns the data signal + persistence (shared with feature stores). */
  private readonly state = inject(AppStateStore);
  private readonly confirmDialog = inject(ConfirmDialogService);
  /** Lazy resolve — AppSnapshotArchiveService also injects StorageService. */
  private readonly injector = inject(Injector);
  private readonly data = this.state.data;

  readonly ship = computed(() => this.data().ship);
  readonly crewArr = computed(() => this.data().crewArr);
  readonly homeListView = computed(() =>
    normalizeHomeListViewSettings(this.data().homeListView ?? createDefaultHomeListViewSettings()),
  );
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
  readonly dgUnReference = computed(() => this.data().dgUnReference);
  readonly dgEmsReference = computed(() => this.data().dgEmsReference);
  readonly reeferLibrary = computed(() => this.data().reeferLibrary);
  readonly etaLibrary = computed(() => this.data().etaLibrary);
  readonly fuelLibrary = computed(() => this.data().fuelLibrary);
  readonly phoneLibrary = computed(() => this.data().phoneLibrary);
  readonly depRepLibrary = computed(() => this.data().depRepLibrary);
  readonly appSnapshots = computed(() => this.data().appSnapshots);
  readonly dgPageArchives = computed(() => this.data().dgPageArchives);
  readonly reeferPageArchives = computed(() => this.data().reeferPageArchives);
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

  init(): Promise<AppInitResult> {
    return this.state.init();
  }

  bootstrapCreateNew(): Promise<boolean> {
    return this.state.bootstrapCreateNew();
  }

  bootstrapUseExistingDirectory(dir: string): Promise<boolean> {
    return this.state.bootstrapUseExistingDirectory(dir);
  }

  reloadEntireAppFromDisk(): Promise<boolean> {
    return this.state.reloadEntireAppFromDisk();
  }

  getDataPathDebug() {
    return window.electronAPI?.getDataPathDebug() ?? Promise.resolve(null);
  }

  private persist(notify: PersistNotify = 'memory', savedMessage?: string): Promise<void> {
    return this.state.persist(notify, savedMessage);
  }

  flushPersist(notify?: PersistNotify, savedMessage?: string): Promise<void> {
    return this.state.flushPersist(notify, savedMessage);
  }

  /**
   * Write open settings-modal + RAM edits to disk, then leave the SPA for an HTML form.
   * Without this, Form 02/01 reads stale crew-data.json (deletes / Ports in PDF lost).
   */
  async flushThenNavigate(url: string): Promise<void> {
    await this.state.flushPersistForQuit();
    window.location.href = url;
  }

  beginFormSession(): Promise<void> {
    return this.state.beginFormSession();
  }

  private finishFormUiInFlight: Promise<void> | null = null;

  /**
   * Close a settings modal.
   * - done: write only if dirty
   * - backdrop: discard quietly if clean; ask Save/Discard if dirty
   */
  async finishFormUi(reason: 'done' | 'backdrop'): Promise<void> {
    if (this.finishFormUiInFlight) return this.finishFormUiInFlight;
    this.finishFormUiInFlight = this.runFinishFormUi(reason).finally(() => {
      this.finishFormUiInFlight = null;
    });
    return this.finishFormUiInFlight;
  }

  private async runFinishFormUi(reason: 'done' | 'backdrop'): Promise<void> {
    // Flush focused cell / input into the store before dirty check (ClickOutside races blur).
    await this.flushActiveFormField();

    if (!this.state.isFormSessionActive()) {
      this.state.endFormSessionClean();
      return;
    }
    if (!this.state.isFormSessionDirty()) {
      this.state.endFormSessionClean();
      return;
    }
    if (reason === 'done') {
      // Keep loaded Home snapshot in sync with Port of Call / form edits (RAM only;
      // commitFormSession writes appSnapshots with the home slice).
      try {
        const { AppSnapshotArchiveService } = await import('./app-snapshot-archive.service');
        this.injector.get(AppSnapshotArchiveService).syncLoadedFromLiveMemory();
      } catch {
        /* archive optional during early boot */
      }
      await this.state.commitFormSession('Settings saved');
      return;
    }
    const ok = await this.confirmDialog.confirm({
      title: 'Unsaved changes',
      message: 'You changed settings. Save them to the working folder, or discard?',
      confirmLabel: 'Save',
      cancelLabel: 'Discard',
      // Must pick Save or Discard — backdrop / Escape must not silently close.
      dismissOnBackdrop: false,
      dismissOnEscape: false,
    });
    if (ok) await this.state.commitFormSession('Settings saved');
    else this.state.discardFormSession();
  }

  /** Let (blur) / ngModel handlers commit the active field before we read dirty state. */
  private async flushActiveFormField(): Promise<void> {
    const el = document.activeElement;
    if (el instanceof HTMLElement) el.blur();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  /** @deprecated Prefer finishFormUi('done' | 'backdrop'). */
  finishFormSession(): void {
    void this.finishFormUi('done');
  }

  updateShip(
    partial: Partial<AppData['ship']>,
    notify?: PersistNotify,
    savedMessage?: string,
  ): void {
    // Ports/nationalities are user-managed (Settings) — do not auto-add referenced values.
    this.data.update((d) => ({ ...d, ship: { ...d.ship, ...partial } }));
    const fields = Object.keys(partial) as (keyof ShipInfo)[];
    const mode = notify ?? (fields.length === 1 ? shipFieldPersistNotify(fields[0]) : 'memory');
    void this.state.persistShip(mode, savedMessage);
  }

  updateCrewArr(partial: Partial<AppData['crewArr']>, notify: PersistNotify = 'memory'): void {
    this.data.update((d) => ({ ...d, crewArr: { ...d.crewArr, ...partial } }));
    void this.persist(notify);
  }

  updateHomeListView(
    partial: Partial<HomeListViewSettings>,
    notify: PersistNotify = 'silent',
  ): void {
    this.data.update((d) => ({
      ...d,
      homeListView: normalizeHomeListViewSettings({
        ...createDefaultHomeListViewSettings(),
        ...d.homeListView,
        ...partial,
      }),
    }));
    void this.persist(notify);
  }

  updatePaxArr(partial: Partial<AppData['paxArr']>, notify: PersistNotify = 'memory'): void {
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
        dgUnReference: d.dgUnReference,
        dgEmsReference: d.dgEmsReference,
        reeferLibrary: d.reeferLibrary,
        appSnapshots: d.appSnapshots,
        dgPageArchives: d.dgPageArchives,
        reeferPageArchives: d.reeferPageArchives,
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
        dgUnReference: empty.dgUnReference,
        dgEmsReference: empty.dgEmsReference,
        reeferLibrary: empty.reeferLibrary,
        appSnapshots: [],
        dgPageArchives: [],
        reeferPageArchives: [],
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
