import { Injectable, computed, inject, signal } from '@angular/core';
import { normalizeDgLibrary, type DgOnboardContainer } from '../models/dg-manifest.models';
import type { DgUnifeederRow } from '../models/dg-unifeeder.models';
import { AppStateStore } from './app-state.store';
import { DgManifestStore } from './dg-manifest.store';

interface DgInventoryUndoSnapshot {
  cmaOnboard: DgOnboardContainer[];
  unifeederOnboard: DgUnifeederRow[];
}

const MAX_UNDO = 40;

/**
 * Session undo for DG inventory mutations that opt in (VIEW paste batches).
 * Restores CMA + DP WORLD onboard lists only — not view settings / manifests.
 */
@Injectable({ providedIn: 'root' })
export class DgInventoryUndoStore {
  private readonly state = inject(AppStateStore);
  private readonly dg = inject(DgManifestStore);
  private readonly stack = signal<DgInventoryUndoSnapshot[]>([]);

  readonly depth = computed(() => this.stack().length);
  readonly canUndo = computed(() => this.stack().length > 0);

  /** Capture current onboard inventories before a reversible batch. */
  push(): void {
    const d = this.state.data();
    const lib = normalizeDgLibrary(d.dgLibrary, undefined, d.ports, d.ship);
    const next: DgInventoryUndoSnapshot = {
      cmaOnboard: structuredClone(lib.onboard),
      unifeederOnboard: structuredClone(lib.unifeeder.onboard),
    };
    this.stack.update((s) => {
      const out = [...s, next];
      return out.length > MAX_UNDO ? out.slice(out.length - MAX_UNDO) : out;
    });
  }

  /** Drop the last push when a batch applied nothing. */
  discardLast(): void {
    this.stack.update((s) => (s.length ? s.slice(0, -1) : s));
  }

  undo(): boolean {
    const s = this.stack();
    if (!s.length) return false;
    const snap = s[s.length - 1]!;
    this.stack.set(s.slice(0, -1));
    this.dg.restoreDgOnboardInventories({
      cmaOnboard: structuredClone(snap.cmaOnboard),
      unifeederOnboard: structuredClone(snap.unifeederOnboard),
    });
    return true;
  }

  clear(): void {
    this.stack.set([]);
  }
}
