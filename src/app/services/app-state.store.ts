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
import { SectionLockService } from './section-lock.service';
import { AppSection, mergeSectionForSave, mergeSectionFromDisk, APP_SECTIONS } from '../utils/app-data-section.util';

const STORAGE_KEY = 'crew-app-data';

export type PersistNotify = 'silent' | 'saved' | 'debounced';

@Injectable({ providedIn: 'root' })
export class AppStateStore {
  private readonly toast = inject(ToastService);
  private readonly sectionLock = inject(SectionLockService);

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

  async reloadSectionFromDisk(section: AppSection): Promise<void> {
    const electron = window.electronAPI;
    if (!electron) return;
    const loaded = await electron.readData();
    if (!loaded) return;
    const fromDisk = normalizeAppData(loaded);
    const merged = mergeSectionFromDisk(this.data(), fromDisk, section);
    this.data.set(merged);
  }

  /** Reload every section from disk (e.g. after restoring from system tray). */
  async reloadAllFromDisk(): Promise<void> {
    const electron = window.electronAPI;
    if (!electron) return;
    const loaded = await electron.readData();
    if (!loaded) return;
    const fromDisk = normalizeAppData(loaded);
    let merged = this.data();
    for (const section of APP_SECTIONS) {
      merged = mergeSectionFromDisk(merged, fromDisk, section);
    }
    this.data.set(merged);
  }

  async persist(notify: PersistNotify = 'debounced', savedMessage?: string): Promise<void> {
    if (!this.sectionLock.canPersist()) {
      if (notify !== 'silent') {
        this.toast.show(
          'View only — another user is editing this section. Changes were not saved.',
          'warning',
        );
      }
      return;
    }

    const memory = { ...this.data(), seedVersion: APP_DATA_SCHEMA_VERSION };
    const electron = window.electronAPI;
    const section = this.sectionLock.activeSection();

    if (electron) {
      let toWrite: AppData = memory;
      if (this.sectionLock.cooperativeMode() && section) {
        const loaded = await electron.readData();
        const disk = normalizeAppData(loaded ?? createEmptyAppData());
        toWrite = mergeSectionForSave(disk, memory, section);
      }
      await electron.writeData({ ...toWrite, seedVersion: APP_DATA_SCHEMA_VERSION });
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
    }
    this.afterPersist(notify, savedMessage);
  }

  /**
   * Save folder/printer output settings immediately — not tied to the active section lock
   * (top-bar control is available on every tab).
   */
  async persistOutputSettings(
    notify: PersistNotify = 'silent',
    savedMessage?: string,
  ): Promise<void> {
    const memory = this.data();
    const electron = window.electronAPI;
    if (electron) {
      const loaded = await electron.readData();
      const disk = normalizeAppData(loaded ?? createEmptyAppData());
      await electron.writeData({
        ...disk,
        outputSettings: memory.outputSettings,
        seedVersion: APP_DATA_SCHEMA_VERSION,
      });
    } else {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...memory, seedVersion: APP_DATA_SCHEMA_VERSION }),
      );
    }
    this.afterPersist(notify, savedMessage);
  }

  /** Save ship/voyage fields immediately — edited on Home, stored under Settings in the slice map. */
  async persistShip(notify: PersistNotify = 'silent', savedMessage?: string): Promise<void> {
    if (!this.sectionLock.canPersist()) {
      if (notify !== 'silent') {
        this.toast.show(
          'View only — another user is editing this section. Changes were not saved.',
          'warning',
        );
      }
      return;
    }

    const memory = this.data();
    const electron = window.electronAPI;
    if (electron) {
      const loaded = await electron.readData();
      const disk = normalizeAppData(loaded ?? createEmptyAppData());
      await electron.writeData({
        ...disk,
        ship: memory.ship,
        seedVersion: APP_DATA_SCHEMA_VERSION,
      });
    } else {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...memory, seedVersion: APP_DATA_SCHEMA_VERSION }),
      );
    }
    this.afterPersist(notify, savedMessage);
  }

  private afterPersist(notify: PersistNotify, savedMessage?: string): void {
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
