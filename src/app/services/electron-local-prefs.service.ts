import { Injectable, signal } from '@angular/core';
import type { ElectronLocalPrefs } from '../../electron';

const DEFAULT_PREFS: ElectronLocalPrefs = { minimizeToTray: false };

@Injectable({ providedIn: 'root' })
export class ElectronLocalPrefsService {
  readonly available = !!window.electronAPI?.getLocalPrefs;
  readonly prefs = signal<ElectronLocalPrefs>({ ...DEFAULT_PREFS });
  readonly minimizeToTray = signal(false);

  private loaded = false;

  async load(): Promise<void> {
    if (!this.available || this.loaded) return;
    this.loaded = true;
    const prefs = await window.electronAPI!.getLocalPrefs();
    this.apply(prefs);
  }

  async setMinimizeToTray(enabled: boolean): Promise<void> {
    if (!this.available) return;
    const prefs = await window.electronAPI!.setLocalPrefs({ minimizeToTray: enabled });
    this.apply(prefs);
  }

  private apply(prefs: ElectronLocalPrefs): void {
    const next = { ...DEFAULT_PREFS, ...prefs };
    this.prefs.set(next);
    this.minimizeToTray.set(!!next.minimizeToTray);
  }
}
