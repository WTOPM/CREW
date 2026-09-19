import { Injectable, inject } from '@angular/core';
import {
  createDefaultFuelLibrary,
  createEmptyFuelLogEvent,
  normalizeFuelLibrary,
  type FuelDisplayPreset,
  type FuelEventKind,
  type FuelLogEvent,
  type FuelViewPrefs,
} from '../models/fuel.models';
import { AppStateStore } from './app-state.store';

@Injectable({ providedIn: 'root' })
export class FuelStore {
  private readonly state = inject(AppStateStore);
  private readonly data = this.state.data;

  replaceFromImport(partial: {
    events: FuelLogEvent[];
    sourcePath: string;
    sourceFileName: string;
    sheetName: string;
  }): void {
    this.data.update((d) => {
      const prev = d.fuelLibrary ?? createDefaultFuelLibrary();
      return {
        ...d,
        fuelLibrary: normalizeFuelLibrary({
          ...prev,
          events: partial.events,
          sourcePath: partial.sourcePath,
          sourceFileName: partial.sourceFileName,
          sheetName: partial.sheetName,
          importedAt: new Date().toISOString(),
          view: prev.view,
          displayPresets: prev.displayPresets,
        }),
      };
    });
    void this.state.persist('saved');
  }

  setSourcePath(path: string): void {
    const p = path.trim();
    this.data.update((d) => {
      const prev = d.fuelLibrary ?? createDefaultFuelLibrary();
      const fileName = p.replace(/^.*[\\/]/, '') || prev.sourceFileName;
      return {
        ...d,
        fuelLibrary: normalizeFuelLibrary({
          ...prev,
          sourcePath: p,
          sourceFileName: fileName || prev.sourceFileName,
        }),
      };
    });
    void this.state.persist('silent');
  }

  updateView(partial: Partial<FuelViewPrefs>): void {
    this.data.update((d) => {
      const prev = d.fuelLibrary ?? createDefaultFuelLibrary();
      return {
        ...d,
        fuelLibrary: normalizeFuelLibrary({
          ...prev,
          view: { ...prev.view, ...partial },
        }),
      };
    });
    void this.state.persist('silent');
  }

  toggleKind(kind: FuelEventKind): void {
    this.data.update((d) => {
      const prev = d.fuelLibrary ?? createDefaultFuelLibrary();
      const set = new Set(prev.view.visibleKinds);
      if (set.has(kind)) set.delete(kind);
      else set.add(kind);
      return {
        ...d,
        fuelLibrary: normalizeFuelLibrary({
          ...prev,
          view: { ...prev.view, visibleKinds: [...set] },
        }),
      };
    });
    void this.state.persist('silent');
  }

  setVisibleKinds(kinds: FuelEventKind[]): void {
    this.updateView({ visibleKinds: kinds });
  }

  upsertEvent(event: FuelLogEvent): void {
    const normalized = createEmptyFuelLogEvent(event);
    this.data.update((d) => {
      const prev = d.fuelLibrary ?? createDefaultFuelLibrary();
      const idx = prev.events.findIndex((e) => e.id === normalized.id);
      const events =
        idx >= 0
          ? prev.events.map((e, i) => (i === idx ? normalized : e))
          : [...prev.events, normalized];
      return {
        ...d,
        fuelLibrary: normalizeFuelLibrary({ ...prev, events }),
      };
    });
    void this.state.persist('saved');
  }

  updateEvent(id: string, partial: Partial<FuelLogEvent>): void {
    this.data.update((d) => {
      const prev = d.fuelLibrary ?? createDefaultFuelLibrary();
      const events = prev.events.map((e) =>
        e.id === id ? createEmptyFuelLogEvent({ ...e, ...partial, id: e.id }) : e,
      );
      return {
        ...d,
        fuelLibrary: normalizeFuelLibrary({ ...prev, events }),
      };
    });
    void this.state.persist('saved');
  }

  removeEvent(id: string): void {
    this.data.update((d) => {
      const prev = d.fuelLibrary ?? createDefaultFuelLibrary();
      return {
        ...d,
        fuelLibrary: normalizeFuelLibrary({
          ...prev,
          events: prev.events.filter((e) => e.id !== id),
        }),
      };
    });
    void this.state.persist('saved');
  }

  clearEvents(): void {
    this.data.update((d) => {
      const prev = d.fuelLibrary ?? createDefaultFuelLibrary();
      return {
        ...d,
        fuelLibrary: normalizeFuelLibrary({
          ...prev,
          events: [],
          importedAt: '',
          sheetName: '',
        }),
      };
    });
    void this.state.persist('silent');
  }

  findDisplayPresetByName(name: string): FuelDisplayPreset | undefined {
    const key = name.trim().toLowerCase();
    return (this.data().fuelLibrary ?? createDefaultFuelLibrary()).displayPresets.find(
      (p) => p.name.toLowerCase() === key,
    );
  }

  /** Save current local column layout into the shared preset list. */
  saveDisplayPreset(
    name: string,
    layout: { visibleColumns: FuelDisplayPreset['visibleColumns']; hoursAsHm: boolean },
    overwriteId?: string,
  ): FuelDisplayPreset {
    const trimmed = name.trim().slice(0, 80);
    const entry: FuelDisplayPreset = {
      id: overwriteId || `fuel-disp-${Date.now()}`,
      name: trimmed,
      savedAt: new Date().toISOString(),
      visibleColumns: [...layout.visibleColumns],
      hoursAsHm: layout.hoursAsHm,
    };
    this.data.update((d) => {
      const prev = d.fuelLibrary ?? createDefaultFuelLibrary();
      const rest = prev.displayPresets.filter(
        (p) => p.id !== entry.id && p.name.toLowerCase() !== trimmed.toLowerCase(),
      );
      return {
        ...d,
        fuelLibrary: normalizeFuelLibrary({
          ...prev,
          displayPresets: [entry, ...rest],
        }),
      };
    });
    void this.state.persistFuelDisplayPresets('saved');
    return entry;
  }

  deleteDisplayPreset(id: string): void {
    this.data.update((d) => {
      const prev = d.fuelLibrary ?? createDefaultFuelLibrary();
      return {
        ...d,
        fuelLibrary: normalizeFuelLibrary({
          ...prev,
          displayPresets: prev.displayPresets.filter((p) => p.id !== id),
        }),
      };
    });
    void this.state.persistFuelDisplayPresets('silent');
  }

  /** One-shot: merge local-only presets into shared list if shared is empty. */
  importDisplayPresetsIfEmpty(local: FuelDisplayPreset[]): void {
    if (!local.length) return;
    this.data.update((d) => {
      const prev = d.fuelLibrary ?? createDefaultFuelLibrary();
      if (prev.displayPresets.length) return d;
      return {
        ...d,
        fuelLibrary: normalizeFuelLibrary({
          ...prev,
          displayPresets: local,
        }),
      };
    });
    void this.state.persistFuelDisplayPresets('silent');
  }
}
