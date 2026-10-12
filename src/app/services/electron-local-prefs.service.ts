import { Injectable, signal } from '@angular/core';
import type { ElectronLocalPrefs } from '../../electron';
import {
  createDefaultFuelLocalUiPrefs,
  createDefaultFuelTabLocalPrefs,
  fuelTabLocalPrefsAsView,
  normalizeFuelDisplayPresets,
  normalizeFuelLocalUiPrefs,
  type FuelColumnId,
  type FuelDisplayPreset,
  type FuelEventKind,
  type FuelLocalUiPrefs,
  type FuelPageTab,
  type FuelTabLocalPrefs,
  type FuelViewPrefs,
} from '../models/fuel.models';

const LS_KEY = 'crew-fuel-local-ui';

const DEFAULT_PREFS: ElectronLocalPrefs = { minimizeToTray: false };

@Injectable({ providedIn: 'root' })
export class ElectronLocalPrefsService {
  readonly available = !!window.electronAPI?.getLocalPrefs;
  readonly prefs = signal<ElectronLocalPrefs>({ ...DEFAULT_PREFS });
  readonly minimizeToTray = signal(false);
  readonly fuelUi = signal<FuelLocalUiPrefs>(createDefaultFuelLocalUiPrefs());

  /** Legacy local presets (migrated once into shared fuelLibrary). */
  private pendingLegacyPresets: FuelDisplayPreset[] = [];

  private loaded = false;

  async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    if (this.available) {
      const prefs = await window.electronAPI!.getLocalPrefs();
      this.apply(prefs);
      return;
    }
    this.applyFuelFromLocalStorage();
  }

  /** One-shot hand-off of presets that used to live only on this PC. */
  takeLegacyFuelDisplayPresets(): FuelDisplayPreset[] {
    const out = this.pendingLegacyPresets;
    this.pendingLegacyPresets = [];
    return out;
  }

  async setMinimizeToTray(enabled: boolean): Promise<void> {
    if (!this.available) return;
    const prefs = await window.electronAPI!.setLocalPrefs({ minimizeToTray: enabled });
    this.apply(prefs);
  }

  async setFuelUi(partial: Partial<FuelLocalUiPrefs>): Promise<void> {
    const next = normalizeFuelLocalUiPrefs({ ...this.fuelUi(), ...partial });
    this.fuelUi.set(next);
    await this.persistFuelUi(next);
  }

  /** Active tab’s Events / Columns / date / Show / search (this PC only). */
  activeTabPrefs(): FuelTabLocalPrefs {
    const ui = this.fuelUi();
    return ui.tabs[ui.activeTab === 'edit' ? 'edit' : 'view'];
  }

  /** View-tab prefs as `FuelViewPrefs` (Stats always follows View). */
  viewTabAsViewPrefs(): FuelViewPrefs {
    return fuelTabLocalPrefsAsView(this.fuelUi().tabs.view);
  }

  async updateActiveTabPrefs(partial: Partial<FuelTabLocalPrefs>): Promise<void> {
    const ui = this.fuelUi();
    const tab: FuelPageTab = ui.activeTab === 'edit' ? 'edit' : 'view';
    await this.updateTabPrefs(tab, partial);
  }

  async updateTabPrefs(tab: FuelPageTab, partial: Partial<FuelTabLocalPrefs>): Promise<void> {
    const ui = this.fuelUi();
    const cur = ui.tabs[tab];
    const nextTab = createDefaultFuelTabLocalPrefs(
      partial.visibleColumns ?? cur.visibleColumns,
      { ...fuelTabLocalPrefsAsView(cur), ...partial },
    );
    const tabs = { ...ui.tabs, [tab]: nextTab };
    await this.setFuelUi({
      tabs,
      tabsReady: true,
      // Keep deprecated mirror in sync with View tab columns.
      visibleColumns: [...tabs.view.visibleColumns],
    });
  }

  async setFuelVisibleColumns(columns: FuelColumnId[]): Promise<void> {
    await this.updateActiveTabPrefs({ visibleColumns: columns });
  }

  async toggleKindOnActiveTab(kind: FuelEventKind): Promise<void> {
    const cur = this.activeTabPrefs();
    const set = new Set(cur.visibleKinds);
    if (set.has(kind)) set.delete(kind);
    else set.add(kind);
    await this.updateActiveTabPrefs({ visibleKinds: [...set] });
  }

  async setVisibleKindsOnActiveTab(kinds: FuelEventKind[]): Promise<void> {
    await this.updateActiveTabPrefs({ visibleKinds: [...kinds] });
  }

  /**
   * One-time: copy shared `fuelLibrary.view` + current columns into both local tabs
   * so existing filters are not lost when moving to per-PC / per-tab prefs.
   */
  async ensureFuelTabsSeeded(sharedView: FuelViewPrefs): Promise<void> {
    const ui = this.fuelUi();
    if (ui.tabsReady) return;
    const cols = ui.visibleColumns.length
      ? ui.visibleColumns
      : ui.tabs.view.visibleColumns;
    const seeded = createDefaultFuelTabLocalPrefs(cols, sharedView);
    const tabView = { ...seeded, visibleColumns: [...seeded.visibleColumns] };
    const tabEdit = { ...seeded, visibleColumns: [...seeded.visibleColumns] };
    await this.setFuelUi({
      tabs: { view: tabView, edit: tabEdit },
      visibleColumns: [...tabView.visibleColumns],
      tabsReady: true,
    });
  }

  async setFuelHoursAsHm(enabled: boolean): Promise<void> {
    await this.setFuelUi({ hoursAsHm: enabled });
  }

  private async persistFuelUi(next: FuelLocalUiPrefs): Promise<void> {
    if (this.available) {
      const prefs = await window.electronAPI!.setLocalPrefs({
        fuelVisibleColumns: next.tabs.view.visibleColumns,
        fuelHoursAsHm: next.hoursAsHm,
        fuelShowUtc: next.showUtc,
        fuelUtcOffsetHours: next.utcOffsetHours,
        fuelActiveTab: next.activeTab,
        fuelTabPrefs: {
          view: next.tabs.view,
          edit: next.tabs.edit,
          tabsReady: next.tabsReady,
        },
        // Clear legacy shared-looking field so it is not re-imported forever.
        fuelDisplayPresets: [],
      });
      this.apply(prefs);
      return;
    }
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota */
    }
  }

  private apply(prefs: ElectronLocalPrefs): void {
    const next = { ...DEFAULT_PREFS, ...prefs };
    this.prefs.set(next);
    this.minimizeToTray.set(!!next.minimizeToTray);
    // Preserve in-memory fuel UI when Electron omits a field (partial prefs / older files).
    const prevUi = this.fuelUi();
    const tabBundle = next.fuelTabPrefs;
    const tabsFromDisk =
      tabBundle && typeof tabBundle === 'object'
        ? {
            view: tabBundle.view,
            edit: tabBundle.edit,
          }
        : prevUi.tabs;
    this.fuelUi.set(
      normalizeFuelLocalUiPrefs({
        visibleColumns:
          (next.fuelVisibleColumns as FuelColumnId[] | undefined) ?? prevUi.visibleColumns,
        hoursAsHm:
          typeof next.fuelHoursAsHm === 'boolean' ? next.fuelHoursAsHm : prevUi.hoursAsHm,
        showUtc: typeof next.fuelShowUtc === 'boolean' ? next.fuelShowUtc : prevUi.showUtc,
        utcOffsetHours:
          typeof next.fuelUtcOffsetHours === 'number'
            ? next.fuelUtcOffsetHours
            : prevUi.utcOffsetHours,
        activeTab:
          next.fuelActiveTab === 'edit' || next.fuelActiveTab === 'view'
            ? next.fuelActiveTab
            : prevUi.activeTab,
        tabs: tabsFromDisk as FuelLocalUiPrefs['tabs'],
        tabsReady:
          typeof tabBundle?.tabsReady === 'boolean' ? tabBundle.tabsReady : prevUi.tabsReady,
      }),
    );
    const legacy = normalizeFuelDisplayPresets(next.fuelDisplayPresets);
    if (legacy.length) this.pendingLegacyPresets = legacy;
  }

  private applyFuelFromLocalStorage(): void {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<FuelLocalUiPrefs> & {
        displayPresets?: FuelDisplayPreset[];
      };
      this.fuelUi.set(normalizeFuelLocalUiPrefs(parsed));
      const legacy = normalizeFuelDisplayPresets(parsed.displayPresets);
      if (legacy.length) this.pendingLegacyPresets = legacy;
    } catch {
      /* ignore */
    }
  }
}
