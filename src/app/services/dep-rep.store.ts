import { Injectable, inject } from '@angular/core';
import {
  createDefaultDepRepLibrary,
  normalizeDepRepDensities,
  normalizeDepRepLibrary,
  type DepRepDensityEntry,
  type DepRepLibrarySettings,
} from '../models/dep-rep.models';
import { AppStateStore } from './app-state.store';

@Injectable({ providedIn: 'root' })
export class DepRepStore {
  private readonly state = inject(AppStateStore);
  private readonly data = this.state.data;

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
    void this.state.persist('silent');
  }
}
