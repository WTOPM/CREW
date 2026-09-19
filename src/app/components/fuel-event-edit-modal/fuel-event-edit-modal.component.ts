import { Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePickerComponent } from '../date-picker/date-picker.component';
import { ClickOutsideDirective } from '../../directives/click-outside.directive';
import {
  FUEL_EVENT_KIND_LABELS,
  FUEL_RAW_EVENT_OPTIONS,
  applyFuelEventAutoCalcs,
  createEmptyFuelLogEvent,
  findPreviousFuelEvent,
  formatFuelHoursHm,
  type FuelLogEvent,
} from '../../models/fuel.models';
import { StorageService } from '../../services/storage.service';

@Component({
  selector: 'app-fuel-event-edit-modal',
  imports: [FormsModule, DatePickerComponent, ClickOutsideDirective],
  templateUrl: './fuel-event-edit-modal.component.html',
  styleUrl: './fuel-event-edit-modal.component.css',
})
export class FuelEventEditModalComponent {
  private readonly storage = inject(StorageService);

  readonly seed = input<Partial<FuelLogEvent> | null>(null);
  readonly allEvents = input<readonly FuelLogEvent[]>([]);
  readonly hoursAsHm = input(false);
  readonly save = output<FuelLogEvent>();
  readonly cancel = output<void>();

  protected readonly kindLabels = FUEL_EVENT_KIND_LABELS;
  protected readonly eventOptions = FUEL_RAW_EVENT_OPTIONS;

  protected readonly draft = linkedSignal(() =>
    createEmptyFuelLogEvent({
      id: `fuel-new-${Date.now()}`,
      ...this.seed(),
    }),
  );

  protected readonly previous = computed(() => {
    const d = this.draft();
    return findPreviousFuelEvent(this.allEvents(), d.date, d.time, d.id);
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

  protected updateField<K extends keyof FuelLogEvent>(key: K, value: FuelLogEvent[K]): void {
    let next = { ...this.draft(), [key]: value };
    if (key === 'rawEvent') {
      next = applyFuelEventAutoCalcs(next, this.previous());
    } else if (key === 'date' || key === 'time' || key === 'meMt' || key === 'aeMt') {
      next = applyFuelEventAutoCalcs(next, findPreviousFuelEvent(this.allEvents(), next.date, next.time, next.id));
    }
    this.draft.set(createEmptyFuelLogEvent(next));
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

  protected onNum(key: 'meMt' | 'aeMt' | 'boilerMt' | 'totalMt' | 'timeUsedHours', raw: string): void {
    const s = raw.trim();
    if (!s) {
      this.updateField(key, null);
      return;
    }
    if (key === 'timeUsedHours' && this.hoursAsHm() && s.includes(':')) {
      const m = s.match(/^(\d+):([0-5]?\d)$/);
      if (m) {
        this.updateField(key, Number(m[1]) + Number(m[2]) / 60);
        return;
      }
    }
    const n = Number(s.replace(',', '.'));
    this.updateField(key, Number.isFinite(n) ? Math.round(n * 10) / 10 : null);
  }

  protected recalc(): void {
    const next = applyFuelEventAutoCalcs(
      this.draft(),
      findPreviousFuelEvent(this.allEvents(), this.draft().date, this.draft().time, this.draft().id),
    );
    this.draft.set(createEmptyFuelLogEvent(next));
  }

  protected submit(): void {
    const d = this.draft();
    if (!d.date) return;
    if (!d.rawEvent && !d.place) return;
    this.save.emit(createEmptyFuelLogEvent(applyFuelEventAutoCalcs(d, this.previous())));
  }

  protected hoursDisplay(): string {
    const h = this.draft().timeUsedHours;
    if (h == null) return '';
    return this.hoursAsHm() ? formatFuelHoursHm(h) : String(h);
  }
}
