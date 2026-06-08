import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PackageArchiveEntry } from '../../models/package-archive.models';
import { formatDisplayDate } from '../../utils/date.util';
import { ClickOutsideDirective } from '../../directives/click-outside.directive';
import { PackageArchiveService } from '../../services/package-archive.service';
import { PackageRunnerService } from '../../services/package-runner.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-pkg-bar',
  imports: [FormsModule, ClickOutsideDirective],
  templateUrl: './pkg-bar.component.html',
  styleUrl: './pkg-bar.component.css',
})
export class PkgBarComponent {
  protected readonly packageRunner = inject(PackageRunnerService);
  protected readonly archive = inject(PackageArchiveService);
  private readonly toast = inject(ToastService);

  protected readonly showSavePanel = signal(false);
  protected readonly showLoadPanel = signal(false);
  protected saveLabel = '';

  protected startSave(): void {
    if (!this.canSave()) return;
    this.showLoadPanel.set(false);
    this.saveLabel = '';
    this.showSavePanel.set(true);
  }

  protected cancelSave(): void {
    this.showSavePanel.set(false);
    this.saveLabel = '';
  }

  protected canSave(): boolean {
    return this.packageRunner.liveSavableCount() > 0 && !this.archive.saving() && !this.packageRunner.busy();
  }

  protected confirmSave(): void {
    if (!this.canSave()) {
      this.toast.showError('No documents assigned to this port');
      return;
    }
    void this.archive.save(this.saveLabel).then((entry) => {
      if (!entry) {
        this.toast.showError('Enter a name for the snapshot');
        return;
      }
      this.showSavePanel.set(false);
      this.saveLabel = '';
      this.toast.show(`Saved "${entry.label}" (${entry.documents.length} PDFs)`, 'success');
    });
  }

  protected toggleLoad(): void {
    this.showSavePanel.set(false);
    this.showLoadPanel.update((v) => !v);
  }

  protected closeLoad(): void {
    this.showLoadPanel.set(false);
  }

  protected pickArchive(entry: PackageArchiveEntry): void {
    if (this.archive.load(entry.id)) {
      this.showLoadPanel.set(false);
      if (entry.documents.length === 0) {
        this.toast.show(
          'This snapshot has no frozen PDFs — re-save it to open archived documents',
          'warning',
        );
      } else {
        this.toast.show(`Loaded archive "${entry.label}"`, 'success');
      }
    }
  }

  protected resetArchive(): void {
    this.archive.reset();
    this.toast.show('Back to live package', 'success');
  }

  protected formatDate(iso: string): string {
    if (!iso) return '—';
    return formatDisplayDate(iso) || iso;
  }

  protected formatSavedAt(iso: string): string {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  }
}
