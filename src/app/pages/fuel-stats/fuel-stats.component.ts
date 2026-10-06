import { DecimalPipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  FUEL_EVENT_KIND_LABELS,
  FUEL_LIMIT_OPTIONS,
  filterFuelEvents,
  formatFuelHoursHm,
  formatFuelUtcOffsetLabel,
  shiftFuelDateTime,
  type FuelEventKind,
} from '../../models/fuel.models';
import { ElectronLocalPrefsService } from '../../services/electron-local-prefs.service';
import { StorageService } from '../../services/storage.service';
import { buildFuelStatsSummary, describeFuelStatsScope } from '../../utils/fuel-stats.util';

@Component({
  selector: 'app-fuel-stats',
  imports: [RouterLink, DecimalPipe],
  templateUrl: './fuel-stats.component.html',
  styleUrl: './fuel-stats.component.css',
})
export class FuelStatsComponent {
  private readonly storage = inject(StorageService);
  private readonly localPrefs = inject(ElectronLocalPrefsService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly library = this.storage.fuelLibrary;
  protected readonly kindLabels = FUEL_EVENT_KIND_LABELS;
  protected readonly fuelUi = this.localPrefs.fuelUi;
  protected readonly showUtc = computed(() => this.fuelUi().showUtc);
  protected readonly utcOffsetHours = computed(() => this.fuelUi().utcOffsetHours);
  protected readonly utcOffsetLabel = computed(() => formatFuelUtcOffsetLabel(this.utcOffsetHours()));
  protected readonly utcOffsetMenuOpen = signal(false);
  protected readonly utcPressing = signal(false);
  private utcPressTimer: ReturnType<typeof setTimeout> | null = null;
  private utcLongPressHandled = false;

  constructor() {
    this.destroyRef.onDestroy(() => this.clearUtcPressTimer());
  }

  /** Same filtered set as the Fuel log table (period / events / search / limit). */
  protected readonly rows = computed(() => {
    const lib = this.library();
    return filterFuelEvents(lib.events, lib.view);
  });

  protected readonly summary = computed(() => buildFuelStatsSummary(this.rows()));

  protected readonly scopeLabel = computed(() => {
    const view = this.library().view;
    return describeFuelStatsScope(
      view,
      view.visibleKinds.length,
      Object.keys(FUEL_EVENT_KIND_LABELS).length,
    );
  });

  protected readonly limitLabel = computed(() => {
    const n = this.library().view.limitCount;
    return FUEL_LIMIT_OPTIONS.find((o) => o.value === n)?.label ?? (n > 0 ? `Last ${n}` : 'All');
  });

  protected readonly selectedKindsLabel = computed(() => {
    const kinds = this.library().view.visibleKinds;
    if (!kinds.length) return 'None';
    if (kinds.length === Object.keys(FUEL_EVENT_KIND_LABELS).length) return 'All';
    return kinds.map((k) => FUEL_EVENT_KIND_LABELS[k as FuelEventKind]).join(', ');
  });

  protected readonly rangeLabel = computed(() => {
    const s = this.summary();
    if (!s.rowCount) return '';
    const first = this.showUtc()
      ? shiftFuelDateTime(s.firstDate, s.firstTime, -this.utcOffsetHours())
      : { date: s.firstDate, time: s.firstTime };
    const last = this.showUtc()
      ? shiftFuelDateTime(s.lastDate, s.lastTime, -this.utcOffsetHours())
      : { date: s.lastDate, time: s.lastTime };
    const zone = this.showUtc() ? 'UTC' : 'local';
    return `${first.date} ${first.time} → ${last.date} ${last.time} (${zone})`;
  });

  protected fmtHours(v: number | null | undefined): string {
    if (v == null) return '—';
    return `${formatFuelHoursHm(v)} (${v.toFixed(1)} h)`;
  }

  protected fmtMt(v: number | null | undefined): string {
    if (v == null) return '—';
    return `${v.toFixed(1)}`;
  }

  protected bunkerTotalLabel(): string {
    const s = this.summary();
    if (s.bunkerRmdBioMt == null && s.bunkerDmaMt == null) return '—';
    return ((s.bunkerRmdBioMt ?? 0) + (s.bunkerDmaMt ?? 0)).toFixed(1);
  }

  protected onUtcPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    this.clearUtcPressTimer();
    this.utcLongPressHandled = false;
    this.utcPressing.set(true);
    this.utcPressTimer = setTimeout(() => {
      this.utcPressTimer = null;
      this.utcPressing.set(false);
      this.utcLongPressHandled = true;
      this.utcOffsetMenuOpen.set(true);
    }, 450);
  }

  protected onUtcPointerUp(): void {
    this.clearUtcPressTimer();
    this.utcPressing.set(false);
  }

  protected onUtcPointerCancel(): void {
    this.clearUtcPressTimer();
    this.utcPressing.set(false);
  }

  protected onUtcClick(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.utcLongPressHandled) {
      this.utcLongPressHandled = false;
      return;
    }
    if (this.utcOffsetMenuOpen()) {
      this.utcOffsetMenuOpen.set(false);
      return;
    }
    void this.localPrefs.setFuelUi({ showUtc: !this.showUtc() });
  }

  protected async nudgeUtcOffset(delta: number): Promise<void> {
    await this.localPrefs.setFuelUi({ utcOffsetHours: this.utcOffsetHours() + delta });
  }

  protected closeUtcMenu(): void {
    this.utcOffsetMenuOpen.set(false);
  }

  private clearUtcPressTimer(): void {
    if (this.utcPressTimer != null) {
      clearTimeout(this.utcPressTimer);
      this.utcPressTimer = null;
    }
  }
}
