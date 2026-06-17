import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { AppSnapshotEntry } from '../../models/app-snapshot.models';
import { formatDisplayDate } from '../../utils/date.util';
import { ClickOutsideDirective } from '../../directives/click-outside.directive';
import { AppSnapshotArchiveService } from '../../services/app-snapshot-archive.service';
import { PackageRunnerService } from '../../services/package-runner.service';
import { ToastService } from '../../services/toast.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';

@Component({
  selector: 'app-pkg-bar',
  imports: [FormsModule, ClickOutsideDirective],
  templateUrl: './pkg-bar.component.html',
  styleUrl: './pkg-bar.component.css',
})
export class PkgBarComponent {
  protected readonly packageRunner = inject(PackageRunnerService);
  protected readonly archive = inject(AppSnapshotArchiveService);
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  protected readonly showSavePanel = signal(false);
  protected readonly showLoadModal = signal(false);
  protected saveLabel = '';

  protected startSave(): void {
    if (!this.canSave()) return;
    this.showLoadModal.set(false);
    this.saveLabel = this.archive.defaultSaveLabel();
    this.showSavePanel.set(true);
  }

  protected cancelSave(): void {
    this.showSavePanel.set(false);
    this.saveLabel = '';
  }

  protected canSave(): boolean {
    return !this.archive.saving() && !this.packageRunner.busy();
  }

  protected confirmSave(): void {
    if (!this.canSave()) return;
    const entry = this.archive.save(this.saveLabel);
    if (!entry) {
      this.toast.showError('Enter a name for the snapshot');
      return;
    }
    this.showSavePanel.set(false);
    this.saveLabel = '';
    this.toast.show(`Saved snapshot "${entry.label}"`, 'success');
  }

  protected openLoad(): void {
    this.showSavePanel.set(false);
    this.showLoadModal.set(true);
  }

  protected closeLoad(): void {
    this.showLoadModal.set(false);
  }

  protected pickArchive(entry: AppSnapshotEntry): void {
    if (this.archive.load(entry.id)) {
      this.showLoadModal.set(false);
      this.toast.show(`Loaded snapshot "${entry.label}"`, 'success');
    }
  }

  protected resetArchive(): void {
    this.archive.reset();
    this.toast.show('Back to live data', 'success');
  }

  protected async commitArchiveAsLive(): Promise<void> {
    const snap = this.archive.loaded();
    if (!snap) return;

    const ok = await this.confirmDialog.confirm({
      title: 'Apply snapshot as live data',
      message:
        `Make the current app state (from "${snap.label}", including any edits) your live data? ` +
        'DG and Reefer inventories are not affected. The previous live data will be lost. This cannot be undone.',
      confirmLabel: 'Apply as live',
      variant: 'danger',
    });
    if (!ok) return;

    this.archive.commitLoadedAsLive();
    this.toast.show('Snapshot is now live app data', 'success');
  }

  protected deleteSnapshot(entry: AppSnapshotEntry, event: MouseEvent): void {
    event.stopPropagation();
    const wasLoaded = this.archive.loaded()?.id === entry.id;
    this.archive.remove(entry.id);
    if (wasLoaded) {
      this.toast.show(`Deleted "${entry.label}" — back to live data`, 'success');
    } else {
      this.toast.show(`Deleted "${entry.label}"`, 'success');
    }
  }

  protected formatDate(iso: string): string {
    if (!iso) return '—';
    return formatDisplayDate(iso) || iso;
  }

  protected formatSavedAt(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${months[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm}`;
  }
}
