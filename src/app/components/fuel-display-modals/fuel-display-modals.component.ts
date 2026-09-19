import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ClickOutsideDirective } from '../../directives/click-outside.directive';
import type { FuelDisplayPreset } from '../../models/fuel.models';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ElectronLocalPrefsService } from '../../services/electron-local-prefs.service';
import { FuelStore } from '../../services/fuel.store';
import { StorageService } from '../../services/storage.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-fuel-display-modals',
  imports: [FormsModule, ClickOutsideDirective],
  templateUrl: './fuel-display-modals.component.html',
  styleUrl: './fuel-display-modals.component.css',
})
export class FuelDisplayModalsComponent {
  readonly showSave = input(false);
  readonly showLoad = input(false);
  readonly closeSave = output<void>();
  readonly closeLoad = output<void>();

  private readonly storage = inject(StorageService);
  private readonly fuelStore = inject(FuelStore);
  private readonly localPrefs = inject(ElectronLocalPrefsService);
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  protected readonly saveLabel = signal('');
  protected readonly presets = computed(() => this.storage.fuelLibrary().displayPresets);

  constructor() {
    effect(() => {
      if (this.showSave()) {
        const n = untracked(() => this.localPrefs.fuelUi().visibleColumns.length);
        this.saveLabel.set(`Columns · ${n}`);
      }
    });
  }

  protected cancelSave(): void {
    this.closeSave.emit();
  }

  protected async confirmSave(): Promise<void> {
    const name = this.saveLabel().trim();
    if (!name) {
      this.toast.showError('Enter a display name');
      return;
    }
    const layout = this.localPrefs.fuelUi();
    const existing = this.fuelStore.findDisplayPresetByName(name);
    if (existing) {
      const ok = await this.confirmDialog.confirm({
        title: 'Overwrite saved display',
        message:
          `A display named "${name}" already exists (shared).\n\n` +
          'Replace it with the current column layout from this computer?',
        confirmLabel: 'Overwrite',
        variant: 'danger',
      });
      if (!ok) return;
      this.fuelStore.saveDisplayPreset(
        name,
        { visibleColumns: layout.visibleColumns, hoursAsHm: layout.hoursAsHm },
        existing.id,
      );
      this.toast.show(`Updated "${name}"`, 'success');
    } else {
      this.fuelStore.saveDisplayPreset(name, {
        visibleColumns: layout.visibleColumns,
        hoursAsHm: layout.hoursAsHm,
      });
      this.toast.show(`Saved "${name}"`, 'success');
    }
    this.closeSave.emit();
  }

  protected onCloseLoad(): void {
    this.closeLoad.emit();
  }

  protected async pickPreset(id: string): Promise<void> {
    const preset = this.storage.fuelLibrary().displayPresets.find((p) => p.id === id);
    if (!preset) {
      this.toast.showError('Display not found');
      return;
    }
    await this.localPrefs.setFuelUi({
      visibleColumns: [...preset.visibleColumns],
      hoursAsHm: preset.hoursAsHm,
    });
    this.toast.show(`Loaded "${preset.name}"`, 'info');
    this.closeLoad.emit();
  }

  protected async deletePreset(preset: FuelDisplayPreset, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    const ok = await this.confirmDialog.confirm({
      title: 'Delete saved display',
      message: `Delete "${preset.name}" from the shared list?\nThis cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    this.fuelStore.deleteDisplayPreset(preset.id);
    this.toast.show(`Deleted "${preset.name}"`, 'success');
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

  protected presetMeta(preset: FuelDisplayPreset): string {
    const hrs = preset.hoursAsHm ? 'H:MM' : 'decimal hrs';
    return `${preset.visibleColumns.length} columns · ${hrs}`;
  }
}
