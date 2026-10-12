import { DecimalPipe } from '@angular/common';
import { Component, computed, input, linkedSignal, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { formatFuelHoursHm } from '../../models/fuel.models';
import {
  createEmptyFuelDistanceLeg,
  defaultFoRateMtPerHour,
  projectFuelDistanceForecast,
  type FuelDistanceForecastLeg,
} from '../../utils/fuel-distance-forecast.util';

@Component({
  selector: 'app-fuel-distance-forecast-modal',
  imports: [FormsModule, DecimalPipe],
  templateUrl: './fuel-distance-forecast-modal.component.html',
  styleUrl: './fuel-distance-forecast-modal.component.css',
})
export class FuelDistanceForecastModalComponent {
  /** Seed legs (usually from ETA). */
  readonly seedLegs = input.required<FuelDistanceForecastLeg[]>();
  /** Starting FO ROB (RMD+B100) from last View row. */
  readonly seedStartRobMt = input<number | null>(null);
  readonly planName = input<string>('');
  readonly close = output<void>();

  protected readonly legs = linkedSignal(() => this.seedLegs().map((l) => ({ ...l })));
  protected readonly startRobMt = linkedSignal(() => this.seedStartRobMt());

  protected readonly summary = computed(() =>
    projectFuelDistanceForecast(this.legs(), this.startRobMt()),
  );

  protected fmtHours(v: number | null | undefined): string {
    if (v == null) return '—';
    return formatFuelHoursHm(v);
  }

  protected onStartRob(raw: string): void {
    const t = raw.trim();
    if (!t) {
      this.startRobMt.set(null);
      return;
    }
    const n = Number(t.replace(',', '.'));
    this.startRobMt.set(Number.isFinite(n) ? Math.round(n * 10) / 10 : null);
  }

  protected patchLeg(id: string, partial: Partial<FuelDistanceForecastLeg>): void {
    this.legs.update((list) =>
      list.map((l) => {
        if (l.id !== id) return l;
        const next = { ...l, ...partial };
        // When speed changes and rate still matches the old default, refresh rate.
        if (partial.speedKnots !== undefined && partial.rateMtPerHour === undefined) {
          const oldDefault = defaultFoRateMtPerHour(l.speedKnots);
          if (l.rateMtPerHour === oldDefault) {
            next.rateMtPerHour = defaultFoRateMtPerHour(next.speedKnots);
          }
        }
        return next;
      }),
    );
  }

  protected onNum(
    id: string,
    field: 'distanceNm' | 'speedKnots' | 'rateMtPerHour',
    raw: string,
  ): void {
    const t = raw.trim();
    if (!t) {
      this.patchLeg(id, { [field]: 0 });
      return;
    }
    const n = Number(t.replace(',', '.'));
    if (!Number.isFinite(n) || n < 0) return;
    this.patchLeg(id, { [field]: Math.round(n * 100) / 100 });
  }

  protected addLeg(): void {
    const last = this.legs()[this.legs().length - 1];
    this.legs.update((list) => [
      ...list,
      createEmptyFuelDistanceLeg({
        fromPort: last?.toPort ?? '',
        speedKnots: last?.speedKnots ?? 15,
      }),
    ]);
  }

  protected removeLeg(id: string): void {
    this.legs.update((list) => (list.length <= 1 ? list : list.filter((l) => l.id !== id)));
  }

  protected resetFromSeed(): void {
    this.legs.set(this.seedLegs().map((l) => ({ ...l })));
    this.startRobMt.set(this.seedStartRobMt());
  }
}
