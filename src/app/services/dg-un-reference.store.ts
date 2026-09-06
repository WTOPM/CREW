// Feature store for the IMDG UN number reference (DG reference page).
//
// The app ships with a baseline UN list compiled into the bundle. The IMDG Code is
// reissued every two years, so the user can import chapter 3.2 from the official PDF;
// the result is persisted with AppData and survives app updates.
//
// The lookup helpers in `dg-un-number.util` read a module signal, which this store keeps
// in sync with AppData — so tooltips and DG autofill immediately use the imported list.

import { Injectable, computed, effect, inject } from '@angular/core';
import { createDefaultDgUnReference } from '../models/dg-un-reference.models';
import {
  getBundledUnNumberRows,
  setUnNumberReferenceOverride,
  type UnNumberReferenceRow,
} from '../utils/dg-un-number.util';
import type { ImdgChapter32Entry } from '../utils/dg-imdg-chapter32-pdf.util';
import { AppStateStore } from './app-state.store';
import { ToastService } from './toast.service';

/**
 * How an import is folded into the existing reference.
 * - `replace` — the reference becomes exactly what the PDF says (extra entries dropped).
 * - `merge` — add new entries and correct changed ones, but keep entries the PDF omits.
 * - `addOnly` — add missing UN numbers, leave every existing entry untouched.
 */
export type DgUnReferenceApplyMode = 'replace' | 'merge' | 'addOnly';

function toRow(entry: ImdgChapter32Entry): UnNumberReferenceRow {
  return {
    unNo: entry.unNo,
    description: entry.description,
    dgClass: entry.dgClass,
    packingGroup: entry.packingGroup,
    subRisk: entry.subRisk,
    fire: entry.fire,
    spillage: entry.spillage,
    marinePollutant: entry.marinePollutant,
  };
}

function sortRows(rows: readonly UnNumberReferenceRow[]): UnNumberReferenceRow[] {
  return [...rows].sort((a, b) => a.unNo.localeCompare(b.unNo, undefined, { numeric: true }));
}

@Injectable({ providedIn: 'root' })
export class DgUnReferenceStore {
  private readonly state = inject(AppStateStore);
  private readonly toast = inject(ToastService);
  private readonly data = this.state.data;

  readonly library = computed(() => this.data().dgUnReference);
  readonly isCustom = computed(() => this.library().origin === 'custom');

  /** Rows currently in force — the imported list when present, otherwise the bundled one. */
  readonly rows = computed<readonly UnNumberReferenceRow[]>(() => {
    const library = this.library();
    return library.origin === 'custom' ? library.entries : getBundledUnNumberRows();
  });

  constructor() {
    // Keep the pure lookup helpers (tooltips, DG autofill) on the active list.
    effect(() => {
      const library = this.library();
      setUnNumberReferenceOverride(library.origin === 'custom' ? library.entries : null);
    });
  }

  /** Fold a parsed chapter 3.2 list into the reference and persist it. */
  applyImport(
    entries: ReadonlyMap<string, ImdgChapter32Entry>,
    mode: DgUnReferenceApplyMode,
    meta: { fileName: string; amendment: string },
  ): void {
    const current = new Map(this.rows().map((row) => [row.unNo, row] as const));
    let next: Map<string, UnNumberReferenceRow>;

    if (mode === 'replace') {
      next = new Map([...entries].map(([unNo, entry]) => [unNo, toRow(entry)]));
    } else if (mode === 'merge') {
      next = new Map(current);
      for (const [unNo, entry] of entries) next.set(unNo, toRow(entry));
    } else {
      next = new Map(current);
      for (const [unNo, entry] of entries) {
        if (!next.has(unNo)) next.set(unNo, toRow(entry));
      }
    }

    this.data.update((d) => ({
      ...d,
      dgUnReference: {
        origin: 'custom',
        entries: sortRows([...next.values()]),
        fileName: meta.fileName,
        amendment: meta.amendment,
        updatedAt: new Date().toISOString(),
      },
    }));
    void this.state.persist('silent');
    this.toast.show(`UN reference updated — ${next.size} entries`, 'success');
  }

  /** Drop every entry so the next import starts from a clean list. */
  clearAllEntries(): void {
    this.data.update((d) => ({
      ...d,
      dgUnReference: {
        origin: 'custom',
        entries: [],
        fileName: '',
        amendment: '',
        updatedAt: new Date().toISOString(),
      },
    }));
    void this.state.persist('silent');
    this.toast.show('UN reference cleared — import an IMDG PDF to fill it', 'warning');
  }

  /** Go back to the list that ships with the app. */
  restoreBundled(): void {
    this.data.update((d) => ({ ...d, dgUnReference: createDefaultDgUnReference() }));
    void this.state.persist('silent');
    this.toast.show(
      `Restored the built-in UN reference — ${getBundledUnNumberRows().length} entries`,
      'success',
    );
  }
}
