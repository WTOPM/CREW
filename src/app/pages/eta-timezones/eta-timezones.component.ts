import { DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { StorageService } from '../../services/storage.service';
import {
  buildTimezoneRows,
  formatNextChangeLabel,
  searchTimezoneRows,
  type TimezoneRow,
  uniqueOffsetLabels,
} from '../../utils/timezone-browser.util';

@Component({
  selector: 'app-eta-timezones',
  imports: [RouterLink, FormsModule, DecimalPipe],
  templateUrl: './eta-timezones.component.html',
  styleUrl: './eta-timezones.component.css',
})
export class EtaTimezonesComponent {
  private readonly storage = inject(StorageService);

  protected readonly search = signal('');
  protected readonly offsetFilter = signal<string | null>(null);
  protected readonly regionFilter = signal<string | null>(null);
  protected readonly seasonFilter = signal<'summer' | 'winter' | 'none' | null>(null);
  /** ISO date — DST / offset / next change are evaluated for this day. */
  protected readonly atDate = signal(this.todayIso());
  /** zoneId → next clock-change label (filled in idle batches). */
  protected readonly nextChangeById = signal<ReadonlyMap<string, string>>(new Map());
  protected readonly nextChangeBusy = signal(false);

  private nextChangeGen = 0;

  protected readonly atInstant = computed(() => {
    const iso = this.atDate();
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      return new Date(`${iso}T12:00:00`);
    }
    return new Date();
  });

  protected readonly allRows = computed(() =>
    buildTimezoneRows(this.atInstant(), this.storage.ports()),
  );

  protected readonly regions = computed(() => {
    const set = new Set(this.allRows().map((r) => r.region));
    return [...set].sort((a, b) => a.localeCompare(b));
  });

  protected readonly offsetLabels = computed(() => uniqueOffsetLabels(this.allRows()));

  protected readonly filteredRows = computed(() => {
    let rows = searchTimezoneRows(this.allRows(), this.search());
    const offset = this.offsetFilter();
    if (offset) rows = rows.filter((r) => r.offsetLabel === offset);
    const region = this.regionFilter();
    if (region) rows = rows.filter((r) => r.region === region);
    const season = this.seasonFilter();
    if (season) rows = rows.filter((r) => r.dstSeason === season);
    return rows;
  });

  protected readonly resultCount = computed(() => this.filteredRows().length);

  /** Prefer filling next-change for what the user actually sees. */
  private readonly scheduleNextChanges = effect((onCleanup) => {
    const at = this.atInstant();
    const ids = this.filteredRows()
      .slice(0, 100)
      .map((r) => r.id);
    const gen = ++this.nextChangeGen;
    this.nextChangeById.set(new Map());
    this.nextChangeBusy.set(ids.length > 0);

    let index = 0;
    const batchSize = 8;
    let timer = 0;

    const pump = () => {
      if (gen !== this.nextChangeGen) return;
      const slice = ids.slice(index, index + batchSize);
      if (!slice.length) {
        this.nextChangeBusy.set(false);
        return;
      }
      const patch = new Map(this.nextChangeById());
      for (const id of slice) {
        patch.set(id, formatNextChangeLabel(id, at));
      }
      this.nextChangeById.set(patch);
      index += batchSize;
      timer = window.setTimeout(pump, 0);
    };

    timer = window.setTimeout(pump, 0);
    onCleanup(() => {
      window.clearTimeout(timer);
      if (gen === this.nextChangeGen) this.nextChangeBusy.set(false);
    });
  });

  protected nextChangeLabel(row: TimezoneRow): string {
    return this.nextChangeById().get(row.id) || (this.nextChangeBusy() ? '…' : '—');
  }

  protected clearFilters(): void {
    this.search.set('');
    this.offsetFilter.set(null);
    this.regionFilter.set(null);
    this.seasonFilter.set(null);
  }

  protected setOffsetFilter(label: string | null): void {
    this.offsetFilter.set(label);
  }

  protected setRegionFilter(region: string | null): void {
    this.regionFilter.set(region);
  }

  protected setSeasonFilter(season: 'summer' | 'winter' | 'none' | null): void {
    this.seasonFilter.set(season);
  }

  protected useToday(): void {
    this.atDate.set(this.todayIso());
  }

  protected trackRow(_index: number, row: TimezoneRow): string {
    return row.id;
  }

  private todayIso(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
