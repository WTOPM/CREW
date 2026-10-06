// Feature store for EmS Guide fire / spillage schedule → page tables.
// Bundled baseline ships with the app; user can import official EmS PDF extracts.

import { Injectable, computed, effect, inject } from '@angular/core';
import {
  MFAG_FIRE_SCHEDULE_REFS,
  MFAG_SPILLAGE_SCHEDULE_REFS,
  type MfagScheduleRef,
} from '../data/dg-mfag-reference';
import { createDefaultDgEmsReference } from '../models/dg-ems-reference.models';
import type { EmsScheduleKind } from '../utils/dg-ems-schedule-pdf.util';
import { setEmsScheduleOverride } from '../utils/dg-mfag-schedule.util';
import { AppStateStore } from './app-state.store';
import { ToastService } from './toast.service';

function sortFire(rows: readonly MfagScheduleRef[]): MfagScheduleRef[] {
  return [...rows].sort((a, b) => a.code.localeCompare(b.code));
}

function sortSpillage(rows: readonly MfagScheduleRef[]): MfagScheduleRef[] {
  return [...rows].sort((a, b) => a.code.localeCompare(b.code));
}

@Injectable({ providedIn: 'root' })
export class DgEmsReferenceStore {
  private readonly state = inject(AppStateStore);
  private readonly toast = inject(ToastService);
  private readonly data = this.state.data;

  readonly library = computed(() => this.data().dgEmsReference);
  readonly isCustom = computed(() => this.library().origin === 'custom');

  readonly fireRows = computed<readonly MfagScheduleRef[]>(() => {
    const library = this.library();
    return library.origin === 'custom' && library.fire.length
      ? library.fire
      : MFAG_FIRE_SCHEDULE_REFS;
  });

  readonly spillageRows = computed<readonly MfagScheduleRef[]>(() => {
    const library = this.library();
    return library.origin === 'custom' && library.spillage.length
      ? library.spillage
      : MFAG_SPILLAGE_SCHEDULE_REFS;
  });

  constructor() {
    effect(() => {
      const library = this.library();
      if (library.origin === 'custom' && (library.fire.length || library.spillage.length)) {
        setEmsScheduleOverride({
          fire: library.fire.length ? library.fire : MFAG_FIRE_SCHEDULE_REFS,
          spillage: library.spillage.length ? library.spillage : MFAG_SPILLAGE_SCHEDULE_REFS,
        });
      } else {
        setEmsScheduleOverride(null);
      }
    });
  }

  applyImport(
    kind: EmsScheduleKind,
    rows: readonly MfagScheduleRef[],
    meta: { fileName: string },
  ): void {
    const current = this.library();
    const fire = kind === 'fire' ? sortFire(rows) : current.fire.length ? current.fire : [];
    const spillage =
      kind === 'spillage' ? sortSpillage(rows) : current.spillage.length ? current.spillage : [];

    this.data.update((d) => ({
      ...d,
      dgEmsReference: {
        origin: 'custom',
        fire,
        spillage,
        fireFileName: kind === 'fire' ? meta.fileName : current.fireFileName,
        spillageFileName: kind === 'spillage' ? meta.fileName : current.spillageFileName,
        updatedAt: new Date().toISOString(),
      },
    }));
    void this.state.persist('silent');
    this.toast.show(
      kind === 'fire'
        ? `Fire schedules updated (${rows.length} codes).`
        : `Spillage schedules updated (${rows.length} codes).`,
      'success',
    );
  }

  restoreBundled(): void {
    this.data.update((d) => ({
      ...d,
      dgEmsReference: createDefaultDgEmsReference(),
    }));
    void this.state.persist('silent');
    this.toast.show('EmS schedules restored to built-in tables.', 'success');
  }
}
