import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ClickOutsideDirective } from '../../directives/click-outside.directive';
import {
  defaultEtaSaveName,
  etaPlanDisplayLabel,
  type EtaPlan,
} from '../../models/eta.models';
import { EtaStore } from '../../services/eta.store';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
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
  private readonly confirmDialog = inject(ConfirmDialogService);

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

  protected async confirmSave(): Promise<void> {
    const name = this.saveLabel().trim();
    if (!name) {
      this.toast.showError('Enter a voyage name');
      return;
    }

    const existing = this.etaStore.findPlanByName(name);
    if (existing) {
      const route = this.planRoute(existing);
      const routeLine = route ? `\nSaved route: ${route}.` : '';
      const ok = await this.confirmDialog.confirm({
        title: 'Overwrite saved voyage',
        message:
          `A voyage named "${name}" already exists.${routeLine}\n\n` +
          'Replace it with the current calculation? The previous data will be lost.',
        confirmLabel: 'Overwrite',
        variant: 'danger',
      });
      if (!ok) return;
      this.etaStore.saveAs(name, { overwritePlanId: existing.id });
      this.toast.show(`Updated "${etaPlanDisplayLabel({ ...this.storage.etaLibrary().draft, name })}"`, 'success');
    } else {
      this.etaStore.saveAs(name);
      this.toast.show(`Saved "${etaPlanDisplayLabel({ ...this.storage.etaLibrary().draft, name })}"`, 'success');
    }
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

  protected async deletePlan(plan: EtaPlan, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    const label = etaPlanDisplayLabel(plan);
    const ok = await this.confirmDialog.confirm({
      title: 'Delete saved voyage',
      message:
        `Delete "${label}"?\nThe saved ETA calculation will be removed permanently. This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
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
