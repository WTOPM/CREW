import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ClickOutsideDirective } from '../../directives/click-outside.directive';
import { DgPageArchiveService } from '../../services/dg-page-archive.service';
import type { DgPageSnapshot } from '../../models/dg-page-archive.models';
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

  protected confirmSave(): void {
    const entry = this.dgArchive.save(this.saveLabel());
    if (!entry) {
      this.toast.showError('Enter a name for the snapshot');
      return;
    }
    this.toast.show(`Saved "${entry.label}"`, 'success');
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
