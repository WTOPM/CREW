import { Component, computed, input, linkedSignal, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  FUEL_EVENT_KIND_LABELS,
  type FuelEventKind,
} from '../../models/fuel.models';
import {
  annotateEtaFuelVoyagePreviewRows,
  shiftEtaFuelVoyagePreviewAfterPrevious,
  type EtaFuelVoyagePreview,
  type EtaFuelVoyagePreviewRow,
} from '../../utils/eta-to-fuel-voyage.util';
import { formatDisplayDate } from '../../utils/date.util';

@Component({
  selector: 'app-fuel-eta-voyage-preview-modal',
  imports: [FormsModule],
  templateUrl: './fuel-eta-voyage-preview-modal.component.html',
  styleUrl: './fuel-eta-voyage-preview-modal.component.css',
})
export class FuelEtaVoyagePreviewModalComponent {
  readonly preview = input.required<EtaFuelVoyagePreview>();
  readonly confirm = output<EtaFuelVoyagePreviewRow[]>();
  readonly cancel = output<void>();

  protected readonly kindLabels = FUEL_EVENT_KIND_LABELS;

  protected readonly rows = linkedSignal(() =>
    this.preview().rows.map((r) => ({ ...r })),
  );

  protected readonly annotated = computed(() =>
    annotateEtaFuelVoyagePreviewRows(this.rows(), this.preview().previousEvent),
  );

  protected readonly includedCount = computed(
    () => this.annotated().filter((r) => r.included).length,
  );

  protected readonly hasTimeConflict = computed(() =>
    this.annotated().some((r) => r.included && r.beforePrevious),
  );

  protected readonly hasDuplicates = computed(() =>
    this.annotated().some((r) => !!r.duplicateOf),
  );

  protected readonly shipOffsetLabel = computed(() => {
    const h = this.preview().shipUtcOffsetHours;
    return `${h >= 0 ? '+' : ''}${h}`;
  });

  protected formatDate(iso: string): string {
    return formatDisplayDate(iso) || iso || '—';
  }

  protected kindLabel(kind: FuelEventKind): string {
    return this.kindLabels[kind] ?? 'Other';
  }

  protected toggleRow(key: string): void {
    this.rows.update((list) =>
      list.map((r) => (r.key === key ? { ...r, included: !r.included } : r)),
    );
  }

  protected onDateChange(key: string, date: string): void {
    this.rows.update((list) =>
      list.map((r) => (r.key === key ? { ...r, date } : r)),
    );
  }

  protected onTimeChange(key: string, time: string): void {
    this.rows.update((list) =>
      list.map((r) => (r.key === key ? { ...r, time } : r)),
    );
  }

  protected excludeAllDuplicates(): void {
    this.rows.update((list) =>
      list.map((r) => (r.duplicateOf ? { ...r, included: false } : r)),
    );
  }

  protected includeAll(): void {
    this.rows.update((list) => list.map((r) => ({ ...r, included: true })));
  }

  protected excludeAll(): void {
    this.rows.update((list) => list.map((r) => ({ ...r, included: false })));
  }

  protected shiftAfterPrevious(): void {
    const shifted = shiftEtaFuelVoyagePreviewAfterPrevious(
      this.annotated(),
      this.preview().previousEvent,
      1,
    );
    this.rows.set(shifted.map((r) => ({ ...r })));
  }

  protected onCancel(): void {
    this.cancel.emit();
  }

  protected onConfirm(): void {
    if (!this.includedCount()) return;
    this.confirm.emit(this.annotated());
  }
}
