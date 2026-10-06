// Feature store for the IMDG UN number reference (DG reference page).
//
// The app ships with a baseline UN list compiled into the bundle. The IMDG Code is
// reissued every two years, so the user can import chapter 3.2 from the official PDF;
// the result is persisted with AppData and survives app updates.
//
// Entries are full Dangerous Goods List rows — the same UN may appear several times
// with different packing groups / proper shipping names.

import { Injectable, computed, effect, inject } from '@angular/core';
import { createDefaultDgUnReference } from '../models/dg-un-reference.models';
import {
  compareUnNumberReferenceRows,
  getBundledUnNumberRows,
  setUnNumberReferenceOverride,
  type UnNumberReferenceRow,
} from '../utils/dg-un-number.util';
import { unNumberReferenceVariantKey } from '../utils/dg-un-reference-variant.util';
import type { ImdgChapter32Entry } from '../utils/dg-imdg-chapter32-pdf.util';
import { AppStateStore } from './app-state.store';
import { ToastService } from './toast.service';

/**
 * How an import is folded into the existing reference.
 * - `replace` — the reference becomes exactly what the PDF says (extra entries dropped).
 * - `merge` — add new entries and correct changed ones, but keep entries the PDF omits.
 * - `addOnly` — add missing list rows, leave every existing entry untouched.
 */
export type DgUnReferenceApplyMode = 'replace' | 'merge' | 'addOnly';

export function toUnNumberReferenceRow(entry: ImdgChapter32Entry): UnNumberReferenceRow {
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
  return [...rows].sort(compareUnNumberReferenceRows);
}

function indexByVariant(rows: readonly UnNumberReferenceRow[]): Map<string, UnNumberReferenceRow> {
  const map = new Map<string, UnNumberReferenceRow>();
  for (const row of rows) map.set(unNumberReferenceVariantKey(row), row);
  return map;
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
    entries: readonly ImdgChapter32Entry[],
    mode: DgUnReferenceApplyMode,
    meta: { fileName: string; amendment: string },
  ): void {
    const imported = entries.map(toUnNumberReferenceRow);
    const current = indexByVariant(this.rows());
    let next: Map<string, UnNumberReferenceRow>;

    if (mode === 'replace') {
      next = indexByVariant(imported);
    } else if (mode === 'merge') {
      next = new Map(current);
      for (const row of imported) next.set(unNumberReferenceVariantKey(row), row);
    } else {
      next = new Map(current);
      for (const row of imported) {
        const key = unNumberReferenceVariantKey(row);
        if (!next.has(key)) next.set(key, row);
      }
    }

    const sorted = sortRows([...next.values()]);
    this.data.update((d) => ({
      ...d,
      dgUnReference: {
        origin: 'custom',
        entries: sorted,
        fileName: meta.fileName,
        amendment: meta.amendment,
        updatedAt: new Date().toISOString(),
      },
    }));
    void this.state.persist('silent');
    this.toast.show(`UN reference updated — ${sorted.length} list entries`, 'success');
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
      `Restored the built-in UN reference — ${getBundledUnNumberRows().length} list entries`,
      'success',
    );
  }
}
