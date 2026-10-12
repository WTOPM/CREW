import { DecimalPipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  FUEL_EVENT_KIND_LABELS,
  filterFuelEvents,
  formatFuelHoursHm,
  formatFuelUtcOffsetLabel,
  fuelTabLocalPrefsAsView,
  shiftFuelDateTime,
  type FuelDisplayEvent,
  type FuelEventKind,
} from '../../models/fuel.models';
import { ElectronLocalPrefsService } from '../../services/electron-local-prefs.service';
import { StorageService } from '../../services/storage.service';
import { formatDisplayDate } from '../../utils/date.util';
import {
  buildFuelStatsSummary,
  describeFuelStatsScope,
  fuelStatsEventsOnDate,
  fuelStatsFilterView,
  sliceFuelStatsByEventBounds,
  sortFuelStatsBunkerRows,
  sortFuelStatsChrono,
  sortFuelStatsDayRows,
  sortFuelStatsEvents,
  sortFuelStatsKindRows,
  type FuelStatsBunkerSortKey,
  type FuelStatsDaySortKey,
  type FuelStatsEventSortKey,
  type FuelStatsKindSortKey,
} from '../../utils/fuel-stats.util';

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

  /** Manual From / To event ids (null = use defaults for current period dates). */
  private readonly boundStartId = signal<string | null>(null);
  private readonly boundEndId = signal<string | null>(null);

  protected readonly kindSort = signal<{ key: FuelStatsKindSortKey; asc: boolean }>({
    key: 'count',
    asc: false,
  });
  protected readonly daySort = signal<{ key: FuelStatsDaySortKey; asc: boolean }>({
    key: 'date',
    asc: true,
  });
  protected readonly eventSort = signal<{ key: FuelStatsEventSortKey; asc: boolean }>({
    key: 'date',
    asc: true,
  });
  protected readonly bunkerSort = signal<{ key: FuelStatsBunkerSortKey; asc: boolean }>({
    key: 'date',
    asc: true,
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.clearUtcPressTimer());
    void this.localPrefs.load().then(async () => {
      await this.localPrefs.ensureFuelTabsSeeded(this.library().view);
    });
  }

  /**
   * View filters + Excel snapshot (before From/To event trim).
   * Date From/To → all rows in range (Show/Last N ignored). No dates → Last N as on Fuel.
   */
  protected readonly filteredRows = computed(() => {
    const lib = this.library();
    const view = fuelStatsFilterView(fuelTabLocalPrefsAsView(this.fuelUi().tabs.view));
    return filterFuelEvents(lib.events, view);
  });

  private readonly chronoFiltered = computed(() => sortFuelStatsChrono(this.filteredRows()));

  protected readonly periodFirstDate = computed(() => this.chronoFiltered()[0]?.date ?? '');
  protected readonly periodLastDate = computed(() => {
    const chrono = this.chronoFiltered();
    return chrono[chrono.length - 1]?.date ?? '';
  });

  /** Events on the first calendar day of the matching set. */
  protected readonly startDayEvents = computed(() =>
    fuelStatsEventsOnDate(this.filteredRows(), this.periodFirstDate()),
  );

  /** Events on the last calendar day of the matching set. */
  protected readonly endDayEvents = computed(() =>
    fuelStatsEventsOnDate(this.filteredRows(), this.periodLastDate()),
  );

  protected readonly effectiveStartId = computed(() => {
    const opts = this.startDayEvents();
    if (!opts.length) return null;
    const pick = this.boundStartId();
    if (pick && opts.some((e) => e.id === pick)) return pick;
    return opts[0]!.id;
  });

  protected readonly effectiveEndId = computed(() => {
    const opts = this.endDayEvents();
    if (!opts.length) return null;
    const pick = this.boundEndId();
    if (pick && opts.some((e) => e.id === pick)) return pick;
    return opts[opts.length - 1]!.id;
  });

  /** Rows counted in statistics (From event → To event inclusive). */
  protected readonly rows = computed(() =>
    sliceFuelStatsByEventBounds(
      this.filteredRows(),
      this.effectiveStartId(),
      this.effectiveEndId(),
    ),
  );

  protected readonly summary = computed(() => buildFuelStatsSummary(this.rows()));

  protected readonly sortedKinds = computed(() => {
    const { key, asc } = this.kindSort();
    return sortFuelStatsKindRows(this.summary().byKind, key, asc);
  });

  protected readonly sortedDays = computed(() => {
    const { key, asc } = this.daySort();
    return sortFuelStatsDayRows(this.summary().byDay, key, asc);
  });

  protected readonly sortedEvents = computed(() => {
    const { key, asc } = this.eventSort();
    return sortFuelStatsEvents(this.rows(), key, asc);
  });

  protected readonly sortedBunkers = computed(() => {
    const { key, asc } = this.bunkerSort();
    return sortFuelStatsBunkerRows(this.summary().bunkers, key, asc);
  });

  protected readonly scopeLabel = computed(() => {
    const view = fuelTabLocalPrefsAsView(this.fuelUi().tabs.view);
    return describeFuelStatsScope(
      view,
      view.visibleKinds.length,
      Object.keys(FUEL_EVENT_KIND_LABELS).length,
    );
  });

  protected readonly rangeEnds = computed(() => {
    const s = this.summary();
    if (!s.rowCount) return null;
    const shift = (date: string, time: string) =>
      this.showUtc()
        ? shiftFuelDateTime(date, time, -this.utcOffsetHours())
        : { date, time };
    const first = shift(s.firstDate, s.firstTime);
    const last = shift(s.lastDate, s.lastTime);
    return {
      from: { date: this.fmtDate(first.date), time: first.time || '—' },
      to: { date: this.fmtDate(last.date), time: last.time || '—' },
      zone: this.showUtc() ? 'UTC' : 'Ship LT',
    };
  });

  protected onBoundStart(ev: Event): void {
    const id = (ev.target as HTMLSelectElement).value;
    this.boundStartId.set(id || null);
  }

  protected onBoundEnd(ev: Event): void {
    const id = (ev.target as HTMLSelectElement).value;
    this.boundEndId.set(id || null);
  }

  protected eventBoundLabel(e: FuelDisplayEvent): string {
    const time = this.eventTimeOnly(e);
    const kind = this.kindLabel(e.kind);
    const place = (e.place || '').trim();
    const raw = (e.rawEvent || '').trim();
    const tail = place || raw;
    return tail ? `${time} · ${kind} · ${tail}` : `${time} · ${kind}`;
  }

  protected sortKind(key: FuelStatsKindSortKey): void {
    this.kindSort.update((cur) =>
      cur.key === key ? { key, asc: !cur.asc } : { key, asc: key === 'label' },
    );
  }

  protected sortDay(key: FuelStatsDaySortKey): void {
    this.daySort.update((cur) =>
      cur.key === key ? { key, asc: !cur.asc } : { key, asc: key === 'date' },
    );
  }

  protected sortEvent(key: FuelStatsEventSortKey): void {
    const textKeys: FuelStatsEventSortKey[] = ['date', 'time', 'place', 'rawEvent', 'kind'];
    this.eventSort.update((cur) =>
      cur.key === key ? { key, asc: !cur.asc } : { key, asc: textKeys.includes(key) },
    );
  }

  protected sortBunker(key: FuelStatsBunkerSortKey): void {
    const textKeys: FuelStatsBunkerSortKey[] = [
      'date',
      'time',
      'place',
      'rawEvent',
      'bunkerRobTank',
    ];
    this.bunkerSort.update((cur) =>
      cur.key === key ? { key, asc: !cur.asc } : { key, asc: textKeys.includes(key) },
    );
  }

  protected bunkerTankLabel(tank: 'rmd' | 'b100' | null): string {
    if (tank === 'rmd') return '→ RMD';
    if (tank === 'b100') return '→ B100';
    return '—';
  }

  protected bunkerStampDate(date: string, time: string): string {
    if (this.showUtc()) {
      return this.fmtDate(shiftFuelDateTime(date, time, -this.utcOffsetHours()).date);
    }
    return this.fmtDate(date);
  }

  protected bunkerStampTime(date: string, time: string): string {
    if (this.showUtc()) {
      return shiftFuelDateTime(date, time, -this.utcOffsetHours()).time || '—';
    }
    return time || '—';
  }

  protected sortMark(
    activeKey: string,
    key: string,
    asc: boolean,
  ): 'asc' | 'desc' | null {
    if (activeKey !== key) return null;
    return asc ? 'asc' : 'desc';
  }

  protected fmtDate(iso: string): string {
    return formatDisplayDate(iso) || iso || '—';
  }

  protected fmtHours(v: number | null | undefined): string {
    if (v == null) return '—';
    return formatFuelHoursHm(v);
  }

  protected fmtHoursLong(v: number | null | undefined): string {
    if (v == null) return '—';
    return `${formatFuelHoursHm(v)} · ${v.toFixed(1)} h`;
  }

  protected fmtMt(v: number | null | undefined): string {
    if (v == null) return '—';
    return v.toFixed(1);
  }

  protected fmtDelta(v: number | null | undefined): string {
    if (v == null) return '—';
    const sign = v > 0 ? '+' : '';
    return `${sign}${v.toFixed(1)}`;
  }

  protected deltaTone(v: number | null | undefined): 'down' | 'up' | 'flat' | 'na' {
    if (v == null) return 'na';
    if (v < 0) return 'down';
    if (v > 0) return 'up';
    return 'flat';
  }

  protected kindLabel(kind: FuelEventKind): string {
    return this.kindLabels[kind] ?? kind;
  }

  protected eventTimeOnly(e: FuelDisplayEvent): string {
    if (this.showUtc()) {
      return shiftFuelDateTime(e.date, e.time, -this.utcOffsetHours()).time || '—';
    }
    return e.time || '—';
  }

  protected eventDateOnly(e: FuelDisplayEvent): string {
    if (this.showUtc()) {
      return this.fmtDate(shiftFuelDateTime(e.date, e.time, -this.utcOffsetHours()).date);
    }
    return this.fmtDate(e.date);
  }

  protected barWidth(pct: number | null | undefined): string {
    if (pct == null || !Number.isFinite(pct)) return '0%';
    return `${Math.max(0, Math.min(100, pct))}%`;
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
