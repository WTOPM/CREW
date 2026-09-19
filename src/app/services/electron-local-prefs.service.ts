import { Injectable, signal } from '@angular/core';
import type { ElectronLocalPrefs } from '../../electron';
import {
  createDefaultFuelLocalUiPrefs,
  normalizeFuelDisplayPresets,
  normalizeFuelLocalUiPrefs,
  type FuelColumnId,
  type FuelDisplayPreset,
  type FuelLocalUiPrefs,
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

  async setFuelVisibleColumns(columns: FuelColumnId[]): Promise<void> {
    await this.setFuelUi({ visibleColumns: columns });
  }

  async setFuelHoursAsHm(enabled: boolean): Promise<void> {
    await this.setFuelUi({ hoursAsHm: enabled });
  }

  private async persistFuelUi(next: FuelLocalUiPrefs): Promise<void> {
    if (this.available) {
      const prefs = await window.electronAPI!.setLocalPrefs({
        fuelVisibleColumns: next.visibleColumns,
        fuelHoursAsHm: next.hoursAsHm,
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
    this.fuelUi.set(
      normalizeFuelLocalUiPrefs({
        visibleColumns: next.fuelVisibleColumns as FuelColumnId[] | undefined,
        hoursAsHm: next.fuelHoursAsHm,
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
