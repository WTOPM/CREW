import { Injectable, inject } from '@angular/core';
import {
  cloneFuelEventList,
  createDefaultFuelLibrary,
  createEmptyFuelLogEvent,
  normalizeFuelLibrary,
  type FuelDisplayPreset,
  type FuelEventKind,
  type FuelLogEvent,
  type FuelMasterSummary,
  type FuelViewPrefs,
} from '../models/fuel.models';
import { AppStateStore } from './app-state.store';

@Injectable({ providedIn: 'root' })
export class FuelStore {
  private readonly state = inject(AppStateStore);
  private readonly data = this.state.data;

  /**
   * View tab: replace Excel snapshot.
   * Edit draft is left alone when editDirty; otherwise Edit is re-seeded from the import.
   */
  replaceFromImport(partial: {
    events: FuelLogEvent[];
    sourcePath: string;
    sourceFileName: string;
    sheetName: string;
    masterSummary?: FuelMasterSummary | null;
  }): void {
    this.data.update((d) => {
      const prev = d.fuelLibrary ?? createDefaultFuelLibrary();
      const imported = cloneFuelEventList(partial.events);
      const keepEdit = prev.editDirty;
      return {
        ...d,
        fuelLibrary: normalizeFuelLibrary({
          ...prev,
          events: imported,
          sourcePath: partial.sourcePath,
          sourceFileName: partial.sourceFileName,
          sheetName: partial.sheetName,
          importedAt: new Date().toISOString(),
          view: prev.view,
          displayPresets: prev.displayPresets,
          masterSummary: partial.masterSummary ?? null,
          editEvents: keepEdit ? prev.editEvents : imported,
          editBaseline: keepEdit ? prev.editBaseline : cloneFuelEventList(imported),
          editDirty: keepEdit,
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

  /** Edit-tab upsert (persists draft; marks dirty). */
  upsertEvent(event: FuelLogEvent): void {
    const normalized = createEmptyFuelLogEvent(event);
    this.data.update((d) => {
      const prev = d.fuelLibrary ?? createDefaultFuelLibrary();
      const idx = prev.editEvents.findIndex((e) => e.id === normalized.id);
      const editEvents =
        idx >= 0
          ? prev.editEvents.map((e, i) => (i === idx ? normalized : e))
          : [...prev.editEvents, normalized];
      return {
        ...d,
        fuelLibrary: normalizeFuelLibrary({
          ...prev,
          editEvents,
          editDirty: true,
        }),
      };
    });
    void this.state.persist('debounced');
  }

  /** Edit-tab patch (persists draft; marks dirty). */
  updateEvent(id: string, partial: Partial<FuelLogEvent>): void {
    this.data.update((d) => {
      const prev = d.fuelLibrary ?? createDefaultFuelLibrary();
      const editEvents = prev.editEvents.map((e) =>
        e.id === id ? createEmptyFuelLogEvent({ ...e, ...partial, id: e.id }) : e,
      );
      return {
        ...d,
        fuelLibrary: normalizeFuelLibrary({
          ...prev,
          editEvents,
          editDirty: true,
        }),
      };
    });
    void this.state.persist('debounced');
  }

  /** Edit-tab delete (persists draft; marks dirty). */
  removeEvent(id: string): void {
    this.data.update((d) => {
      const prev = d.fuelLibrary ?? createDefaultFuelLibrary();
      return {
        ...d,
        fuelLibrary: normalizeFuelLibrary({
          ...prev,
          editEvents: prev.editEvents.filter((e) => e.id !== id),
          editDirty: true,
        }),
      };
    });
    void this.state.persist('debounced');
  }

  /** Clear Edit draft only (View Excel snapshot stays). */
  clearEditEvents(): void {
    this.data.update((d) => {
      const prev = d.fuelLibrary ?? createDefaultFuelLibrary();
      return {
        ...d,
        fuelLibrary: normalizeFuelLibrary({
          ...prev,
          editEvents: [],
          editBaseline: [],
          editDirty: false,
        }),
      };
    });
    void this.state.persist('silent');
  }

  /** @deprecated Use clearEditEvents — kept for older call sites. */
  clearEvents(): void {
    this.clearEditEvents();
  }

  /** Discard Edit draft back to editBaseline (persisted). */
  discardEditDraft(): void {
    this.data.update((d) => {
      const prev = d.fuelLibrary ?? createDefaultFuelLibrary();
      const restored = cloneFuelEventList(prev.editBaseline);
      return {
        ...d,
        fuelLibrary: normalizeFuelLibrary({
          ...prev,
          editEvents: restored,
          editDirty: false,
        }),
      };
    });
    void this.state.persist('saved');
  }

  /**
   * After successful Write to Excel: mark Edit clean, refresh baseline,
   * and sync View snapshot to what was written (other PCs still Update from file).
   */
  markEditWritten(events: readonly FuelLogEvent[]): void {
    const written = cloneFuelEventList(events);
    this.data.update((d) => {
      const prev = d.fuelLibrary ?? createDefaultFuelLibrary();
      return {
        ...d,
        fuelLibrary: normalizeFuelLibrary({
          ...prev,
          events: written,
          editEvents: written,
          editBaseline: cloneFuelEventList(written),
          editDirty: false,
        }),
      };
    });
    void this.state.persist('saved');
  }

  /** Replace Edit events in place (e.g. tests / rare resets). */
  replaceEditEvents(events: FuelLogEvent[], dirty = true): void {
    const next = cloneFuelEventList(events);
    this.data.update((d) => {
      const prev = d.fuelLibrary ?? createDefaultFuelLibrary();
      return {
        ...d,
        fuelLibrary: normalizeFuelLibrary({
          ...prev,
          editEvents: next,
          editBaseline: dirty ? prev.editBaseline : cloneFuelEventList(next),
          editDirty: dirty,
        }),
      };
    });
    void this.state.persist('saved');
  }

  /** @deprecated Prefer discardEditDraft / replaceEditEvents. */
  replaceEvents(events: FuelLogEvent[]): void {
    this.replaceEditEvents(events, false);
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
