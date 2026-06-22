// Central application-state kernel.
//
// Owns the single source of truth for AppData (one signal, persisted as one blob) and
// the persistence lifecycle (load on init, save on mutation). Feature stores
// (ReferenceListsStore, …) and the broad StorageService all depend on THIS so there is
// exactly one writable signal — no split state, no duplicated persistence.
//
// Persistence target: Electron `electronAPI` when present, otherwise localStorage.

import { Injectable, inject, signal } from '@angular/core';
import { AppData } from '../models/crew.models';
import { APP_DATA_SCHEMA_VERSION, createEmptyAppData } from '../data/empty-app-data';
import { ToastService } from './toast.service';
import { normalizeAppData } from './app-data-normalizer';

const STORAGE_KEY = 'crew-app-data';

export type PersistNotify = 'silent' | 'saved' | 'debounced';

@Injectable({ providedIn: 'root' })
export class AppStateStore {
  private readonly toast = inject(ToastService);

  /** The single writable source of truth. Feature stores read/update this directly. */
  readonly data = signal<AppData>(createEmptyAppData());

  /** Set when a modal form auto-saves silently; cleared after Saved toast on close. */
  private formSessionDirty = false;

  async init(): Promise<void> {
    const electron = window.electronAPI;
    if (electron) {
      const loaded = await electron.readData();
      if (loaded) {
        const normalized = normalizeAppData(loaded);
        this.data.set(normalized);
        if ((loaded.seedVersion ?? 0) < APP_DATA_SCHEMA_VERSION) {
          await this.persist('silent');
        }
        return;
      }
      this.data.set(createEmptyAppData());
      await this.persist('silent');
      return;
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<AppData>;
        const normalized = normalizeAppData(parsed);
        this.data.set(normalized);
        if ((parsed.seedVersion ?? 0) < APP_DATA_SCHEMA_VERSION) {
          await this.persist('silent');
        }
      } catch {
        this.data.set(createEmptyAppData());
        await this.persist('silent');
      }
    } else {
      this.data.set(createEmptyAppData());
      await this.persist('silent');
    }
  }

  async persist(notify: PersistNotify = 'debounced', savedMessage?: string): Promise<void> {
    const payload = { ...this.data(), seedVersion: APP_DATA_SCHEMA_VERSION };
    const electron = window.electronAPI;
    if (electron) {
      await electron.writeData(payload);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    }
    if (notify === 'silent') {
      this.formSessionDirty = true;
    } else if (notify === 'saved') {
      this.toast.cancelDebouncedSaved();
      if (savedMessage) this.toast.show(savedMessage, 'success');
      else this.toast.showSaved();
      this.formSessionDirty = false;
    } else if (notify === 'debounced') {
      this.toast.debouncedSaved();
    }
  }

  /** Call when a Done / backdrop closes a settings modal (after silent auto-save). */
  finishFormSession(): void {
    this.toast.cancelDebouncedSaved();
    if (this.formSessionDirty) {
      this.toast.showSaved();
      this.formSessionDirty = false;
    }
  }
}
