import { Injectable, inject } from '@angular/core';
import {
  createDefaultAdWorkspace,
  normalizeAdWorkspace,
  type AdWorkspace,
} from '../models/a-and-d.models';
import { AppStateStore } from './app-state.store';

/**
 * A&D workspace (folder + draft + palette defaults).
 * Keeps AppData in RAM only while editing — disk write is explicit
 * (Excel Save / Quit / force-quit). Weak LAN cannot afford per-keystroke flush.
 */
@Injectable({ providedIn: 'root' })
export class AdStore {
  private readonly state = inject(AppStateStore);
  private readonly data = this.state.data;
  /** Skip no-op RAM writes without re-normalizing prev every time. */
  private lastFinger = '';

  saveWorkspace(workspace: AdWorkspace): void {
    const next = normalizeAdWorkspace(workspace);
    const finger = JSON.stringify(next);
    if (finger === this.lastFinger) return;
    this.lastFinger = finger;
    this.data.update((d) => ({
      ...d,
      adWorkspace: next,
    }));
    // Fuel section owns adWorkspace — mark even if nav lock is unset.
    this.state.markSectionsDirty(['fuel']);
    void this.state.persist('memory');
  }

  /** Push pending fuel/A&D (and other dirty) sections to the shared/local file. */
  flushToDisk(notify: 'silent' | 'saved' = 'silent'): Promise<void> {
    return this.state.flushPersist(notify);
  }

  clearWorkspace(): void {
    this.saveWorkspace(createDefaultAdWorkspace());
  }
}
