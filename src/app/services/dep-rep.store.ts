import { Injectable, inject } from '@angular/core';
import {
  createDefaultDepRepLibrary,
  normalizeDepRepDensities,
  normalizeDepRepLibrary,
  normalizeDepRepSession,
  type DepRepDensityEntry,
  type DepRepLibrarySettings,
  type DepRepSessionState,
} from '../models/dep-rep.models';
import { AppStateStore } from './app-state.store';

@Injectable({ providedIn: 'root' })
export class DepRepStore {
  private readonly state = inject(AppStateStore);
  private readonly data = this.state.data;

  private touch(): void {
    this.state.markSectionsDirty(['dg']);
  }

  setSourcePath(path: string): void {
    const p = path.trim();
    this.data.update((d) => {
      const prev = d.depRepLibrary ?? createDefaultDepRepLibrary();
      const fileName = p.replace(/^.*[\\/]/, '') || prev.sourceFileName;
      return {
        ...d,
        depRepLibrary: normalizeDepRepLibrary({
          ...prev,
          sourcePath: p,
          sourceFileName: fileName || prev.sourceFileName,
        }),
      };
    });
    this.touch();
    void this.state.persist('silent');
  }

  setTotalCargo(totalCargo: string): void {
    this.data.update((d) => {
      const prev = d.depRepLibrary ?? createDefaultDepRepLibrary();
      return {
        ...d,
        depRepLibrary: normalizeDepRepLibrary({
          ...prev,
          totalCargo: totalCargo.trim(),
        }),
      };
    });
    this.touch();
    void this.state.persist('silent');
  }

  upsertDensity(port: string, density: string): void {
    const entry: DepRepDensityEntry = {
      port: port.trim().toUpperCase(),
      density: density.trim().replace(',', '.'),
    };
    if (!entry.port) return;
    this.data.update((d) => {
      const prev = d.depRepLibrary ?? createDefaultDepRepLibrary();
      const others = (prev.densities ?? []).filter((x) => x.port !== entry.port);
      return {
        ...d,
        depRepLibrary: normalizeDepRepLibrary({
          ...prev,
          densities: [...others, entry],
        }),
      };
    });
    this.touch();
    void this.state.persist('silent');
  }

  removeDensity(port: string): void {
    const key = port.trim().toUpperCase();
    if (!key) return;
    this.data.update((d) => {
      const prev = d.depRepLibrary ?? createDefaultDepRepLibrary();
      return {
        ...d,
        depRepLibrary: normalizeDepRepLibrary({
          ...prev,
          densities: (prev.densities ?? []).filter((x) => x.port !== key),
        }),
      };
    });
    this.touch();
    void this.state.persist('silent');
  }

  /** Merge Excel/import rows: fill missing ports; keep existing app values. */
  mergeDensities(entries: readonly DepRepDensityEntry[]): void {
    const incoming = normalizeDepRepDensities(entries);
    if (!incoming.length) return;
    this.data.update((d) => {
      const prev = d.depRepLibrary ?? createDefaultDepRepLibrary();
      const map = new Map((prev.densities ?? []).map((x) => [x.port, x]));
      for (const e of incoming) {
        if (!map.has(e.port)) map.set(e.port, e);
      }
      return {
        ...d,
        depRepLibrary: normalizeDepRepLibrary({
          ...prev,
          densities: [...map.values()],
        }),
      };
    });
    this.touch();
    void this.state.persist('silent');
  }

  markWritten(sheetName: string): void {
    this.data.update((d) => {
      const prev = d.depRepLibrary ?? createDefaultDepRepLibrary();
      return {
        ...d,
        depRepLibrary: normalizeDepRepLibrary({
          ...prev,
          lastWrittenSheet: sheetName,
          lastWrittenAt: new Date().toISOString(),
        }),
      };
    });
    this.touch();
    void this.state.persist('silent');
  }

  /** Persist on-screen DEP REP form so reopen / Quit keep what the user left. */
  saveSession(session: DepRepSessionState): void {
    const normalized = normalizeDepRepSession(session);
    this.data.update((d) => {
      const prev = d.depRepLibrary ?? createDefaultDepRepLibrary();
      return {
        ...d,
        depRepLibrary: normalizeDepRepLibrary({
          ...prev,
          session: normalized,
        }),
      };
    });
    this.touch();
    void this.state.persist('silent');
  }

  patch(partial: Partial<DepRepLibrarySettings>): void {
    this.data.update((d) => {
      const prev = d.depRepLibrary ?? createDefaultDepRepLibrary();
      return {
        ...d,
        depRepLibrary: normalizeDepRepLibrary({ ...prev, ...partial }),
      };
    });
    this.touch();
    void this.state.persist('silent');
  }
}
