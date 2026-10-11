import {
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePickerComponent } from '../date-picker/date-picker.component';
import { TimeInputComponent } from '../time-input/time-input.component';
import { ClickOutsideDirective } from '../../directives/click-outside.directive';
import {
  FUEL_DEFAULT_DENSITY,
  FUEL_EVENT_KIND_LABELS,
  FUEL_RAW_EVENT_OPTIONS,
  FUEL_ROB_TANK_LABELS,
  FUEL_ROB_TANK_TIPS,
  applyFuelEventAutoCalcs,
  createEmptyFuelLogEvent,
  discoverFuelRobTanks,
  findFuelEventBeforePrevious,
  findPreviousFuelEvent,
  formatFuelHoursHm,
  fuelRobValue,
  normalizeFuelDensity,
  type FuelLogEvent,
  type FuelRobTankId,
} from '../../models/fuel.models';
import { StorageService } from '../../services/storage.service';
import {
  acquireModalScrollLock,
  releaseModalScrollLock,
} from '../../utils/modal-scroll-lock.util';

@Component({
  selector: 'app-fuel-event-edit-modal',
  imports: [FormsModule, DatePickerComponent, TimeInputComponent, ClickOutsideDirective],
  templateUrl: './fuel-event-edit-modal.component.html',
  styleUrl: './fuel-event-edit-modal.component.css',
})
export class FuelEventEditModalComponent {
  private readonly storage = inject(StorageService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    acquireModalScrollLock();
    this.destroyRef.onDestroy(() => releaseModalScrollLock());
  }

  readonly seed = input<Partial<FuelLogEvent> | null>(null);
  readonly allEvents = input<readonly FuelLogEvent[]>([]);
  readonly hoursAsHm = input(false);
  /** Last density from library — default for new rows (~0.88). */
  readonly preferredDensity = input<number | null>(FUEL_DEFAULT_DENSITY);
  readonly save = output<FuelLogEvent>();
  readonly cancel = output<void>();

  protected readonly kindLabels = FUEL_EVENT_KIND_LABELS;
  protected readonly eventOptions = FUEL_RAW_EVENT_OPTIONS;
  protected readonly robTankLabels = FUEL_ROB_TANK_LABELS;
  protected readonly robTankTips = FUEL_ROB_TANK_TIPS;

  /**
   * Draft resets only when `seed` identity changes (parent sets it once on open).
   * `allEvents` / `preferredDensity` are read untracked so table refreshes
   * cannot wipe Now / time / fuel edits mid-session.
   */
  protected readonly draft = linkedSignal(() => {
    const seed = this.seed() ?? {};
    const preferred = untracked(
      () => this.preferredDensity() ?? FUEL_DEFAULT_DENSITY,
    );
    const base = createEmptyFuelLogEvent({
      id: seed.id ?? `fuel-new-${Date.now()}`,
      density: preferred,
      ...seed,
    });
    const events = untracked(() => this.allEvents());
    const prev = findPreviousFuelEvent(events, base.date, base.time, base.id);
    const before = findFuelEventBeforePrevious(events, prev);
    return createEmptyFuelLogEvent(
      applyFuelEventAutoCalcs(base, prev, before, preferred),
    );
  });

  protected readonly previous = computed(() => {
    const d = this.draft();
    return findPreviousFuelEvent(this.allEvents(), d.date, d.time, d.id);
  });

  protected readonly beforePrevious = computed(() =>
    findFuelEventBeforePrevious(this.allEvents(), this.previous()),
  );

  protected readonly robTanks = computed(() => discoverFuelRobTanks(this.allEvents()));

  protected readonly robChips = computed(() => {
    const d = this.draft();
    const prev = this.previous();
    return this.robTanks().map((tank) => {
      const value = fuelRobValue(d, tank);
      const prevVal = prev ? fuelRobValue(prev, tank) : null;
      const empty = prevVal != null && prevVal <= 0;
      return {
        tank,
        label: `ROB ${FUEL_ROB_TANK_LABELS[tank]}`,
        value,
        title:
          prevVal == null
            ? `No previous ROB ${FUEL_ROB_TANK_LABELS[tank]}`
            : empty
              ? `Previous ROB ${FUEL_ROB_TANK_LABELS[tank]} is 0 — will not go negative`
              : `Previous ${prevVal} − assigned consumption`,
        empty,
      };
    });
  });

  protected readonly autoHint = computed(() => {
    const prev = this.previous();
    if (!prev) return 'No previous event — enter hours manually.';
    const hrs = this.draft().timeUsedHours;
    const hrsLabel = this.hoursAsHm() ? formatFuelHoursHm(hrs) : hrs == null ? '—' : String(hrs);
    return `Previous: ${prev.place || '—'} · ${prev.rawEvent || prev.kind} · ${prev.date} ${prev.time || ''} → Hrs ${hrsLabel}`;
  });

  /** Sea + reference ports + places already used in the fuel log. */
  protected readonly placeOptions = computed(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    const add = (raw: string) => {
      const v = String(raw ?? '').trim();
      if (!v) return;
      const key = v.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push(v);
    };

    add('Sea');
    for (const p of this.storage.ports()) add(p.name);
    for (const e of this.allEvents()) add(e.place);
    add(this.draft().place);
    return out;
  });

  protected readonly customEvent = signal(false);

  private applyAuto(next: FuelLogEvent): FuelLogEvent {
    const prev = findPreviousFuelEvent(this.allEvents(), next.date, next.time, next.id);
    const before = findFuelEventBeforePrevious(this.allEvents(), prev);
    return createEmptyFuelLogEvent(
      applyFuelEventAutoCalcs(next, prev, before, this.preferredDensity()),
    );
  }

  protected updateField<K extends keyof FuelLogEvent>(key: K, value: FuelLogEvent[K]): void {
    let next = { ...this.draft(), [key]: value };
    if (
      key === 'rawEvent' ||
      key === 'date' ||
      key === 'time' ||
      key === 'density' ||
      key === 'meMt' ||
      key === 'aeMt' ||
      key === 'boilerMt' ||
      key === 'meRobTank' ||
      key === 'aeRobTank' ||
      key === 'boilerRobTank'
    ) {
      next = this.applyAuto(next);
    } else {
      next = createEmptyFuelLogEvent(next);
    }
    this.draft.set(next);
  }

  protected onDensity(raw: string): void {
    const n = normalizeFuelDensity(raw);
    this.updateField('density', n);
  }

  protected nudgeDensity(dir: 1 | -1): void {
    const cur = this.draft().density ?? this.preferredDensity() ?? FUEL_DEFAULT_DENSITY;
    const next = normalizeFuelDensity(Math.round((cur + dir * 0.001) * 1000) / 1000);
    if (next != null) this.updateField('density', next);
  }

  protected onRawEventPick(value: string): void {
    if (value === '__custom__') {
      this.customEvent.set(true);
      return;
    }
    this.customEvent.set(false);
    this.updateField('rawEvent', value);
  }

  protected backToEventList(): void {
    this.customEvent.set(false);
  }

  protected onNum(key: 'meMt' | 'aeMt' | 'boilerMt', raw: string): void {
    const s = raw.trim();
    if (!s) {
      this.updateField(key, null);
      return;
    }
    const n = Number(s.replace(',', '.'));
    this.updateField(key, Number.isFinite(n) ? Math.round(n * 10) / 10 : null);
  }

  /** ↑/↓ on fuel mt fields: step ±0.1 (clamped at 0). */
  protected onMtArrow(event: KeyboardEvent, key: 'meMt' | 'aeMt' | 'boilerMt'): void {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    this.nudgeMt(key, event.key === 'ArrowUp' ? 1 : -1);
  }

  protected nudgeMt(key: 'meMt' | 'aeMt' | 'boilerMt', dir: 1 | -1): void {
    const cur = this.draft()[key];
    const base = cur == null || !Number.isFinite(cur) ? 0 : cur;
    const next = Math.max(0, Math.round((base + dir * 0.1) * 10) / 10);
    this.updateField(key, next);
  }

  protected onRobTank(field: 'meRobTank' | 'aeRobTank' | 'boilerRobTank', raw: string): void {
    const tank = (raw === 'rmd' || raw === 'b100' || raw === 'dma' ? raw : null) as FuelRobTankId | null;
    this.updateField(field, tank);
  }

  protected submit(): void {
    const d = this.draft();
    if (!d.date) return;
    if (!d.rawEvent && !d.place) return;
    this.save.emit(this.applyAuto(d));
  }

  protected hoursDisplay(): string {
    const h = this.draft().timeUsedHours;
    if (h == null) return '';
    return this.hoursAsHm() ? formatFuelHoursHm(h) : String(h);
  }

  protected fmtRob(v: number | null | undefined): string {
    if (v == null || !Number.isFinite(v)) return '—';
    return (Math.round(v * 10) / 10).toFixed(1);
  }

  /** Ship-local clock: fill date + HH:MM from now (recalculates Hrs + ROB). */
  protected setNow(): void {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    this.draft.set(this.applyAuto({ ...this.draft(), date, time }));
  }
}
