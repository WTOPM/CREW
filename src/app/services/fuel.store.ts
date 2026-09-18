import { Injectable, inject } from '@angular/core';
import {
  createDefaultFuelLibrary,
  normalizeFuelLibrary,
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
}
