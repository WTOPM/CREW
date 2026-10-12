import { Injectable, inject } from '@angular/core';
import {
  cloneFuelCylinderList,
  cloneFuelEventList,
  createDefaultFuelLibrary,
  createEmptyFuelCylinderRow,
  createEmptyFuelLogEvent,
  fillMissingPeriodTotals,
  mergeMissingFuelPeriodFields,
  normalizeFuelCylinderFactor,
  normalizeFuelLibrary,
  recomputeFuelCylinderChain,
  type FuelCylinderRow,
  type FuelDisplayPreset,
  type FuelEventKind,
  type FuelLogEvent,
  type FuelMasterSummary,
  type FuelUpdatedHandoff,
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
    cylinderRows?: FuelCylinderRow[];
    cylinderFactor?: number;
  }): void {
    this.data.update((d) => {
      const prev = d.fuelLibrary ?? createDefaultFuelLibrary();
      const imported = cloneFuelEventList(partial.events);
      const keepEdit = prev.editDirty;
      // Dirty Edit keeps user rows, but pull missing Total m³/t from the new View snapshot.
      const editEvents = keepEdit
        ? fillMissingPeriodTotals(mergeMissingFuelPeriodFields(prev.editEvents, imported))
        : imported;
      const prevCyl = prev.fuelCylinder;
      const factor = normalizeFuelCylinderFactor(
        partial.cylinderFactor ?? prevCyl.fmToLitersFactor,
      );
      const cylImported =
        partial.cylinderRows != null
          ? recomputeFuelCylinderChain(partial.cylinderRows, factor)
          : prevCyl.rows;
      const keepCylEdit = prevCyl.editDirty;
      const cylEdit = keepCylEdit
        ? recomputeFuelCylinderChain(prevCyl.editRows, factor)
        : cloneFuelCylinderList(cylImported);
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
          editEvents,
          editBaseline: keepEdit ? prev.editBaseline : cloneFuelEventList(imported),
          editDirty: keepEdit,
          fuelCylinder: {
            rows: cylImported,
            editRows: cylEdit,
            editBaseline: keepCylEdit
              ? prevCyl.editBaseline
              : cloneFuelCylinderList(cylImported),
            editDirty: keepCylEdit,
            fmToLitersFactor: factor,
          },
        }),
      };
    });
    void this.state.persist('saved');
  }

  /**
   * Heal Edit Total m³ / Total t from View + FM without discarding the draft.
   * Safe to call on Fuel page open (silent).
   */
  healEditPeriodTotals(): void {
    this.data.update((d) => {
      const prev = d.fuelLibrary ?? createDefaultFuelLibrary();
      if (!prev.editEvents.length) return d;
      const merged = mergeMissingFuelPeriodFields(prev.editEvents, prev.events);
      const editEvents = fillMissingPeriodTotals(merged);
      const changed = editEvents.some((e, i) => {
        const before = prev.editEvents[i];
        return (
          !before ||
          before.totalM3 !== e.totalM3 ||
          before.totalMt !== e.totalMt ||
          before.density !== e.density ||
          before.fmMeAe !== e.fmMeAe
        );
      });
      if (!changed && editEvents.length === prev.editEvents.length) return d;
      return {
        ...d,
        fuelLibrary: normalizeFuelLibrary({
          ...prev,
          editEvents,
          editDirty: prev.editDirty,
        }),
      };
    });
    void this.state.persist('silent');
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

  /** Remember last density used on Add / Total t drag (default for new rows). */
  setLastDensity(density: number | null): void {
    this.data.update((d) => {
      const prev = d.fuelLibrary ?? createDefaultFuelLibrary();
      return {
        ...d,
        fuelLibrary: normalizeFuelLibrary({
          ...prev,
          lastDensity: density,
        }),
      };
    });
    void this.state.persist('silent');
  }

  /** Shared View↔Edit “Updated” handoff (status / date / port / parameter list). */
  setUpdatedHandoff(next: FuelUpdatedHandoff): void {
    this.data.update((d) => {
      const prev = d.fuelLibrary ?? createDefaultFuelLibrary();
      return {
        ...d,
        fuelLibrary: normalizeFuelLibrary({
          ...prev,
          updatedHandoff: {
            ...next,
            changedAt: new Date().toISOString(),
          },
        }),
      };
    });
    void this.state.persist('saved');
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
    void this.state.persist('memory');
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
    void this.state.persist('memory');
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
    void this.state.persist('memory');
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
   * After successful Write of `ready` rows: mark those synced (with Excel
   * sourceRow), keep drafts in Edit, merge written into View snapshot.
   * editDirty stays true while any draft/ready rows remain.
   */
  markEditPartialWritten(written: readonly FuelLogEvent[]): void {
    const writtenList = cloneFuelEventList(
      written.map((e) =>
        createEmptyFuelLogEvent({
          ...e,
          writeStatus: 'synced',
          // Leave voyage link — Ready/Write clears chain membership for that row.
          voyageChainId: null,
          voyageChainIndex: null,
          voyageChainPredict: false,
        }),
      ),
    );
    const byId = new Map(writtenList.map((e) => [e.id, e]));
    this.data.update((d) => {
      const prev = d.fuelLibrary ?? createDefaultFuelLibrary();
      const editEvents = prev.editEvents.map((e) => byId.get(e.id) ?? e);
      let events = prev.events.map((e) => byId.get(e.id) ?? e);
      for (const w of writtenList) {
        if (!events.some((e) => e.id === w.id)) events = [...events, w];
      }
      let editBaseline = prev.editBaseline.map((e) => byId.get(e.id) ?? e);
      for (const w of writtenList) {
        if (!editBaseline.some((e) => e.id === w.id)) {
          editBaseline = [...editBaseline, w];
        }
      }
      const editDirty = editEvents.some((e) => e.writeStatus !== 'synced');
      return {
        ...d,
        fuelLibrary: normalizeFuelLibrary({
          ...prev,
          events,
          editEvents,
          editBaseline,
          editDirty,
        }),
      };
    });
    void this.state.persist('saved');
  }

  /** @deprecated Prefer markEditPartialWritten (ready-only Write). */
  markEditWritten(events: readonly FuelLogEvent[]): void {
    this.markEditPartialWritten(events);
  }

  /**
   * Replace Edit events in place (ROB cascade, tests, resets).
   * `dirty=true` → draft memory persist; `dirty=false` → also refresh baseline.
   */
  replaceEditEvents(events: readonly FuelLogEvent[], dirty = true): void {
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
    void this.state.persist(dirty ? 'memory' : 'saved');
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

  setCylinderFactor(factor: number): void {
    this.data.update((d) => {
      const prev = d.fuelLibrary ?? createDefaultFuelLibrary();
      const f = normalizeFuelCylinderFactor(factor);
      const cyl = prev.fuelCylinder;
      return {
        ...d,
        fuelLibrary: normalizeFuelLibrary({
          ...prev,
          fuelCylinder: {
            ...cyl,
            fmToLitersFactor: f,
            rows: recomputeFuelCylinderChain(cyl.rows, f),
            editRows: recomputeFuelCylinderChain(cyl.editRows, f),
            editBaseline: recomputeFuelCylinderChain(cyl.editBaseline, f),
          },
        }),
      };
    });
    void this.state.persist('silent');
  }

  replaceCylinderEditRows(rows: readonly FuelCylinderRow[], dirty = true): void {
    this.data.update((d) => {
      const prev = d.fuelLibrary ?? createDefaultFuelLibrary();
      const cyl = prev.fuelCylinder;
      const next = recomputeFuelCylinderChain(rows, cyl.fmToLitersFactor);
      return {
        ...d,
        fuelLibrary: normalizeFuelLibrary({
          ...prev,
          fuelCylinder: {
            ...cyl,
            editRows: next,
            editBaseline: dirty ? cyl.editBaseline : cloneFuelCylinderList(next),
            editDirty: dirty,
          },
        }),
      };
    });
    void this.state.persist(dirty ? 'memory' : 'saved');
  }

  upsertCylinderRow(row: FuelCylinderRow): void {
    const cylLib = (this.data().fuelLibrary ?? createDefaultFuelLibrary()).fuelCylinder;
    const normalized = createEmptyFuelCylinderRow(row);
    const idx = cylLib.editRows.findIndex((r) => r.id === normalized.id);
    const editRows =
      idx >= 0
        ? cylLib.editRows.map((r, i) => (i === idx ? normalized : r))
        : [...cylLib.editRows, normalized];
    this.replaceCylinderEditRows(editRows, true);
  }

  updateCylinderRow(id: string, partial: Partial<FuelCylinderRow>): void {
    const cylLib = (this.data().fuelLibrary ?? createDefaultFuelLibrary()).fuelCylinder;
    const editRows = cylLib.editRows.map((r) =>
      r.id === id ? createEmptyFuelCylinderRow({ ...r, ...partial, id: r.id }) : r,
    );
    this.replaceCylinderEditRows(editRows, true);
  }

  removeCylinderRow(id: string): void {
    const cylLib = (this.data().fuelLibrary ?? createDefaultFuelLibrary()).fuelCylinder;
    this.replaceCylinderEditRows(
      cylLib.editRows.filter((r) => r.id !== id),
      true,
    );
  }

  discardCylinderDraft(): void {
    this.data.update((d) => {
      const prev = d.fuelLibrary ?? createDefaultFuelLibrary();
      const cyl = prev.fuelCylinder;
      const restored = recomputeFuelCylinderChain(cyl.editBaseline, cyl.fmToLitersFactor);
      return {
        ...d,
        fuelLibrary: normalizeFuelLibrary({
          ...prev,
          fuelCylinder: {
            ...cyl,
            editRows: restored,
            editDirty: false,
          },
        }),
      };
    });
    void this.state.persist('saved');
  }

  markCylinderPartialWritten(written: readonly FuelCylinderRow[]): void {
    const writtenList = recomputeFuelCylinderChain(
      written.map((r) => createEmptyFuelCylinderRow({ ...r, writeStatus: 'synced' })),
      (this.data().fuelLibrary ?? createDefaultFuelLibrary()).fuelCylinder.fmToLitersFactor,
    );
    const byId = new Map(writtenList.map((r) => [r.id, r]));
    this.data.update((d) => {
      const prev = d.fuelLibrary ?? createDefaultFuelLibrary();
      const cyl = prev.fuelCylinder;
      const factor = cyl.fmToLitersFactor;
      const editRows = recomputeFuelCylinderChain(
        cyl.editRows.map((r) => byId.get(r.id) ?? r),
        factor,
      );
      let rows = recomputeFuelCylinderChain(
        cyl.rows.map((r) => byId.get(r.id) ?? r),
        factor,
      );
      for (const w of writtenList) {
        if (!rows.some((r) => r.id === w.id)) rows = [...rows, w];
      }
      rows = recomputeFuelCylinderChain(rows, factor);
      let editBaseline = recomputeFuelCylinderChain(
        cyl.editBaseline.map((r) => byId.get(r.id) ?? r),
        factor,
      );
      for (const w of writtenList) {
        if (!editBaseline.some((r) => r.id === w.id)) {
          editBaseline = [...editBaseline, w];
        }
      }
      editBaseline = recomputeFuelCylinderChain(editBaseline, factor);
      return {
        ...d,
        fuelLibrary: normalizeFuelLibrary({
          ...prev,
          fuelCylinder: {
            ...cyl,
            rows,
            editRows,
            editBaseline,
            editDirty: editRows.some((r) => r.writeStatus !== 'synced'),
          },
        }),
      };
    });
    void this.state.persist('saved');
  }
}
