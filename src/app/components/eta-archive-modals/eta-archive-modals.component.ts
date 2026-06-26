import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ClickOutsideDirective } from '../../directives/click-outside.directive';
import {
  defaultEtaSaveName,
  etaPlanDisplayLabel,
  type EtaPlan,
} from '../../models/eta.models';
import { EtaStore } from '../../services/eta.store';
import { StorageService } from '../../services/storage.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-eta-archive-modals',
  imports: [FormsModule, ClickOutsideDirective],
  templateUrl: './eta-archive-modals.component.html',
  styleUrl: './eta-archive-modals.component.css',
})
export class EtaArchiveModalsComponent {
  readonly showSave = input(false);
  readonly showLoad = input(false);
  readonly closeSave = output<void>();
  readonly closeLoad = output<void>();

  private readonly storage = inject(StorageService);
  private readonly etaStore = inject(EtaStore);
  private readonly toast = inject(ToastService);

  protected readonly saveLabel = signal('');
  protected readonly savedPlans = computed(() =>
    [...this.storage.etaLibrary().plans].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  );

  constructor() {
    effect(() => {
      if (this.showSave()) {
        const draft = untracked(() => this.storage.etaLibrary().draft);
        this.saveLabel.set(defaultEtaSaveName(draft));
      }
    });
  }

  protected routeHint(): string {
    const draft = this.storage.etaLibrary().draft;
    const from = draft.fromPort.trim();
    const to = draft.toPort.trim();
    if (from && to) return `Route: ${from} → ${to}`;
    return '';
  }

  protected planRoute(plan: EtaPlan): string {
    const from = plan.fromPort.trim();
    const to = plan.toPort.trim();
    if (from && to) return `${from} → ${to}`;
    return from || to;
  }

  protected cancelSave(): void {
    this.closeSave.emit();
  }

  protected confirmSave(): void {
    const name = this.saveLabel().trim();
    if (!name) {
      this.toast.showError('Enter a voyage name');
      return;
    }
    this.etaStore.saveAs(name);
    this.toast.show(`Saved "${etaPlanDisplayLabel({ ...this.storage.etaLibrary().draft, name })}"`, 'success');
    this.closeSave.emit();
  }

  protected onCloseLoad(): void {
    this.closeLoad.emit();
  }

  protected pickPlan(planId: string): void {
    this.etaStore.loadPlan(planId);
    const plan = this.storage.etaLibrary().plans.find((p) => p.id === planId);
    this.toast.show(`Loaded "${plan ? etaPlanDisplayLabel(plan) : 'voyage'}"`, 'info');
    this.closeLoad.emit();
  }

  protected deletePlan(plan: EtaPlan, event: MouseEvent): void {
    event.stopPropagation();
    if (!confirm(`Delete "${etaPlanDisplayLabel(plan)}"?`)) return;
    this.etaStore.deletePlan(plan.id);
    this.toast.show(`Deleted "${plan.name}"`, 'success');
  }

  protected formatSavedAt(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  }
}
