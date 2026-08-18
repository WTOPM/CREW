import { Component, inject, OnInit, output, signal } from '@angular/core';
import { DataBackupService } from '../../services/data-backup.service';
import { AppStateStore } from '../../services/app-state.store';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ToastService } from '../../services/toast.service';
import type { JsonBackupEntry } from '../../services/app-state.store';

@Component({
  selector: 'app-data-backups-modal',
  templateUrl: './data-backups-modal.component.html',
  styleUrl: './data-backups-modal.component.css',
})
export class DataBackupsModalComponent implements OnInit {
  private readonly backupsApi = inject(DataBackupService);
  private readonly appState = inject(AppStateStore);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);

  readonly closed = output<void>();
  readonly restored = output<void>();

  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly backups = signal<JsonBackupEntry[]>([]);
  protected readonly dataFile = signal<string | null>(null);
  protected readonly backupsDir = signal<string | null>(null);

  ngOnInit(): void {
    void this.refresh();
  }

  protected close(): void {
    this.closed.emit();
  }

  protected async openFolder(): Promise<void> {
    const res = await this.backupsApi.openFolder();
    if (res && !res.ok) {
      this.toast.showError(res.error ?? 'Could not open backup folder');
    }
  }

  protected async restore(fileName: string): Promise<void> {
    if (this.busy()) return;
    const ok = await this.confirmDialog.confirm({
      title: 'Restore database backup?',
      message:
        `Replace the current crew-data.json with this backup?\n\n${fileName}\n\n` +
        'PDFs and signatures already on disk are kept. Settings and lists will reload from the restored JSON.',
      confirmLabel: 'Restore',
      cancelLabel: 'Cancel',
      variant: 'danger',
    });
    if (!ok) return;

    this.busy.set(true);
    try {
      const res = await this.backupsApi.restore(fileName);
      if (!res?.ok) {
        this.toast.showError(res?.error ?? 'Could not restore backup');
        return;
      }
      const loaded = await this.appState.reloadEntireAppFromDisk();
      if (!loaded) {
        this.toast.showError('Backup was written but could not be loaded');
        return;
      }
      this.toast.show('Database restored from backup', 'success');
      this.restored.emit();
      this.close();
    } finally {
      this.busy.set(false);
    }
  }

  protected formatWhen(ms: number): string {
    return new Date(ms).toLocaleString();
  }

  protected formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  protected formatCategory(category?: string): string {
    switch (category) {
      case 'pre-write-current':
        return 'Pre-write · current hour';
      case 'pre-write-previous':
        return 'Pre-write · previous hour';
      case 'pre-write':
        return 'Pre-write';
      case 'on-close':
        return 'On close';
      case 'on-tray':
        return 'On tray';
      case 'safety':
        return 'Safety';
      default:
        return 'Backup';
    }
  }

  private async refresh(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.backupsApi.list();
      this.dataFile.set(res?.dataFile ?? null);
      this.backupsDir.set(res?.backupsDir ?? null);
      this.backups.set(res?.backups ?? []);
    } finally {
      this.loading.set(false);
    }
  }
}
