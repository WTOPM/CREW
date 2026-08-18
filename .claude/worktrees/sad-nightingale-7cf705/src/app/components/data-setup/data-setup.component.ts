import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { StorageService } from '../../services/storage.service';
import type { AppInitResult, DataPathDebugInfo } from '../../services/app-state.store';

@Component({
  selector: 'app-data-setup',
  templateUrl: './data-setup.component.html',
  styleUrl: './data-setup.component.css',
})
export class DataSetupComponent implements OnInit {
  private readonly storage = inject(StorageService);

  readonly reason = input.required<AppInitResult>();

  readonly resolved = output<void>();

  protected readonly busy = signal(false);
  protected readonly debug = signal<DataPathDebugInfo | null>(null);

  protected readonly title = computed(() =>
    this.reason() === 'error' ? 'Could not read database' : 'Database not found',
  );

  protected readonly message = computed(() => {
    if (this.reason() === 'error') {
      return (
        'The data file exists but could not be read. No changes were made.\n\n' +
        'Choose an existing folder with a valid crew-data.json, or create a new database ' +
        '(only if you are starting fresh).'
      );
    }
    return (
      'No crew-data.json was found at the expected location. Nothing was overwritten.\n\n' +
      'Create a new empty database next to the app, or open the folder that already ' +
      'contains your crew-data.json.'
    );
  });

  ngOnInit(): void {
    void window.electronAPI?.getDataPathDebug().then((info) => this.debug.set(info));
  }

  protected async createNew(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const ok = await this.storage.bootstrapCreateNew();
      if (ok) this.resolved.emit();
    } finally {
      this.busy.set(false);
    }
  }

  protected async openExisting(): Promise<void> {
    if (this.busy()) return;
    const picked = await window.electronAPI?.pickDataDirectory();
    if (!picked) return;
    this.busy.set(true);
    try {
      const ok = await this.storage.bootstrapUseExistingDirectory(picked);
      if (ok) this.resolved.emit();
    } finally {
      this.busy.set(false);
    }
  }
}
