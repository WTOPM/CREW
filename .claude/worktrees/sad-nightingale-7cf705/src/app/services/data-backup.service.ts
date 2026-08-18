import { Injectable } from '@angular/core';
import type { DataStoreActionResult, JsonBackupsListResult } from './app-state.store';

@Injectable({ providedIn: 'root' })
export class DataBackupService {
  list(): Promise<JsonBackupsListResult | null> {
    return window.electronAPI?.listJsonBackups() ?? Promise.resolve(null);
  }

  restore(fileName: string): Promise<DataStoreActionResult | null> {
    return window.electronAPI?.restoreJsonBackup(fileName) ?? Promise.resolve(null);
  }

  openFolder(): Promise<{ ok: boolean; error?: string; path?: string } | null> {
    return window.electronAPI?.openJsonBackupsFolder() ?? Promise.resolve(null);
  }
}
