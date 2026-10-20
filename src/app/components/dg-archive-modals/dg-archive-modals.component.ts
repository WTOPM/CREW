import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ClickOutsideDirective } from '../../directives/click-outside.directive';
import { DgPageArchiveService } from '../../services/dg-page-archive.service';
import {
  dgLibraryActiveContainerCount,
  type DgPageSnapshot,
} from '../../models/dg-page-archive.models';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ToastService } from '../../services/toast.service';

/**
 * Save / load snapshot modals for the DG page archive. Visibility is driven by the
 * parent (toolbar buttons); this component owns the save-name field and all
 * confirm/load/delete actions against the page-archive service.
 */
@Component({
  selector: 'app-dg-archive-modals',
  imports: [FormsModule, ClickOutsideDirective],
  templateUrl: './dg-archive-modals.component.html',
})
export class DgArchiveModalsComponent {
  readonly showSave = input(false);
  readonly showLoad = input(false);
  readonly closeSave = output<void>();
  readonly closeLoad = output<void>();

  protected readonly dgArchive = inject(DgPageArchiveService);
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  protected readonly saveLabel = signal('');

  constructor() {
    // Seed the snapshot name with a sensible default each time the Save modal opens.
    effect(() => {
      if (this.showSave()) {
        this.saveLabel.set(untracked(() => this.dgArchive.defaultSaveLabel()));
      }
    });
  }

  protected cancelSave(): void {
    this.closeSave.emit();
  }

  protected async confirmSave(): Promise<void> {
    const label = this.saveLabel();
    const existing = this.dgArchive.findMatchingSnapshot();
    let overwriteId: string | undefined;
    if (existing) {
      const result = await this.confirmDialog.confirm({
        title: 'Overwrite snapshot',
        message:
          `A snapshot for the same port, voyage and container count already exists:\n` +
          `"${existing.label}"\n\n` +
          'Replace it with the current page (e.g. after re-sorting)?',
        confirmLabel: 'Overwrite',
        cancelLabel: 'Cancel',
        altLabel: 'Save as new',
        variant: 'danger',
      });
      if (!result) return;
      if (result === true) overwriteId = existing.id;
      // 'alt' → Save as new (no overwriteId)
    }

    const entry = await this.dgArchive.save(label, overwriteId ? { overwriteId } : undefined);
    if (!entry) {
      this.toast.showError('Enter a name for the snapshot');
      return;
    }
    // Toast comes from persist('saved') inside archive.save
    this.closeSave.emit();
  }

  protected onCloseLoad(): void {
    this.closeLoad.emit();
  }

  protected pickSnapshot(entry: DgPageSnapshot): void {
    if (this.dgArchive.load(entry.id)) {
      this.toast.show(`Page state loaded from archive: "${entry.label}"`, 'info');
      this.closeLoad.emit();
    }
  }

  protected deleteSnapshot(entry: DgPageSnapshot, event: MouseEvent): void {
    event.stopPropagation();
    const wasLoaded = this.dgArchive.loaded()?.id === entry.id;
    this.dgArchive.remove(entry.id);
    this.toast.show(
      wasLoaded ? `Deleted "${entry.label}" — back to live page` : `Deleted "${entry.label}"`,
      'success',
    );
  }

  /**
   * CAPS meta chips for Load cards (voyage / containers / saved).
   * Counts only the inventory tab active when the snapshot was saved
   * (DP WORLD → unique containers, not CMA; CMA → CMA only).
   */
  protected archiveLoadMeta(entry: DgPageSnapshot): {
    voyage: string;
    containers: string;
    saved: string;
  } {
    const count = dgLibraryActiveContainerCount(entry.dgLibrary);
    const voy = entry.ship.voyageNumber?.trim();
    const saved = this.formatSavedAt(entry.savedAt);
    return {
      voyage: voy ? `VOY ${voy}` : '',
      containers: `${count} CONTAINER(S)`,
      saved: saved ? `SAVED ${saved}` : '',
    };
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
