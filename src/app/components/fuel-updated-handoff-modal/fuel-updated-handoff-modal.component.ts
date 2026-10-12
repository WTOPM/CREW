import { Component, computed, inject, input, linkedSignal, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePickerComponent } from '../date-picker/date-picker.component';
import {
  createDefaultFuelUpdatedHandoff,
  normalizeFuelUpdatedHandoff,
  seedFuelUpdatedHandoffItemsFromMaster,
  type FuelMasterSummary,
  type FuelUpdatedHandoff,
  type FuelUpdatedHandoffItem,
  type FuelUpdatedHandoffStatus,
} from '../../models/fuel.models';
import { FuelStore } from '../../services/fuel.store';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-fuel-updated-handoff-modal',
  imports: [FormsModule, DatePickerComponent],
  templateUrl: './fuel-updated-handoff-modal.component.html',
  styleUrl: './fuel-updated-handoff-modal.component.css',
})
export class FuelUpdatedHandoffModalComponent {
  readonly handoff = input.required<FuelUpdatedHandoff>();
  readonly masterSummary = input<FuelMasterSummary | null>(null);
  /** Active Fuel tab — roles for status actions. */
  readonly mode = input<'view' | 'edit'>('view');
  readonly placeChoices = input<string[]>([]);
  readonly close = output<void>();

  private readonly fuelStore = inject(FuelStore);
  private readonly toast = inject(ToastService);

  protected readonly draft = linkedSignal(() => {
    const src = normalizeFuelUpdatedHandoff(this.handoff());
    if (src.items.length) return { ...src, items: src.items.map((i) => ({ ...i })) };
    const seeded = seedFuelUpdatedHandoffItemsFromMaster(this.masterSummary());
    return {
      ...src,
      items: seeded.length ? seeded : [{ id: `upd-${Date.now()}`, label: '', value: '' }],
    };
  });

  protected readonly isView = computed(() => this.mode() === 'view');
  protected readonly isEdit = computed(() => this.mode() === 'edit');

  protected readonly statusLabel = computed(() => {
    switch (this.draft().status) {
      case 'needs_update':
        return 'Needs update';
      case 'done':
        return 'Done';
      default:
        return 'Idle';
    }
  });

  protected patchDraft(partial: Partial<FuelUpdatedHandoff>): void {
    this.draft.update((d) => ({ ...d, ...partial }));
  }

  protected setStatus(status: FuelUpdatedHandoffStatus): void {
    this.patchDraft({ status });
  }

  protected onDate(value: string): void {
    this.patchDraft({ date: value });
  }

  protected patchItem(id: string, partial: Partial<FuelUpdatedHandoffItem>): void {
    this.draft.update((d) => ({
      ...d,
      items: d.items.map((it) => (it.id === id ? { ...it, ...partial } : it)),
    }));
  }

  protected addItem(): void {
    this.draft.update((d) => ({
      ...d,
      items: [...d.items, { id: `upd-${Date.now()}`, label: '', value: '' }],
    }));
  }

  protected removeItem(id: string): void {
    this.draft.update((d) => {
      const next = d.items.filter((it) => it.id !== id);
      return {
        ...d,
        items: next.length ? next : [{ id: `upd-${Date.now()}`, label: '', value: '' }],
      };
    });
  }

  protected seedFromMaster(): void {
    const items = seedFuelUpdatedHandoffItemsFromMaster(this.masterSummary());
    if (!items.length) {
      this.toast.showError('No S1–AC4 data — import Excel first');
      return;
    }
    this.patchDraft({ items });
    this.toast.show('Loaded labels/values from S1–AC4', 'info');
  }

  protected clearAll(): void {
    this.draft.set(createDefaultFuelUpdatedHandoff());
  }

  protected save(): void {
    const next = normalizeFuelUpdatedHandoff(this.draft());
    if (next.status === 'needs_update' && !next.date && !next.port) {
      this.toast.showError('Set date and/or port for Needs update');
      return;
    }
    this.fuelStore.setUpdatedHandoff(next);
    this.toast.show(
      next.status === 'needs_update'
        ? 'Marked Needs update — Edit will see red UPDATED'
        : next.status === 'done'
          ? 'Marked Done'
          : 'Updated saved',
      'success',
    );
    this.close.emit();
  }

  protected cancel(): void {
    this.close.emit();
  }
}
