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
import { normalizeFuelLibrary } from '../models/fuel.models';
import { SectionLockService } from './section-lock.service';
import {
  AppSection,
  mergeSectionForSave,
  mergeSectionFromDisk,
  APP_SECTIONS,
} from '../utils/app-data-section.util';
import { readLocalStorage, writeLocalStorage } from '../utils/browser-storage.util';

const STORAGE_KEY = 'crew-app-data';

export type PersistNotify = 'silent' | 'saved' | 'debounced' | 'memory';

function notifyRank(n: PersistNotify): number {
  if (n === 'saved') return 2;
  if (n === 'debounced' || n === 'silent') return 1;
  return 0; // memory
}

function maxNotify(a: PersistNotify, b: PersistNotify): PersistNotify {
  return notifyRank(a) >= notifyRank(b) ? a : b;
}

function cloneAppData(data: AppData): AppData {
  return structuredClone(data);
}

export type AppInitResult = 'loaded' | 'missing' | 'error';

export interface DataPathDebugInfo {
  execPath: string;
  exeDir: string;
  dataDir: string;
  dataFile: string;
  dataFileExists: boolean;
  dataPathConfigFile: string;
  dataPathConfigExists: boolean;
  defaultDataDir: string;
  portableExecutableDir: string | null;
  portableExecutableFile: string | null;
}

export interface JsonBackupEntry {
  fileName: string;
  size: number;
  modifiedAt: number;
  category?: string;
}

export interface JsonBackupsListResult {
  backupsDir: string;
  dataFile: string;
  backups: JsonBackupEntry[];
}

export interface DataStoreActionResult {
  ok: boolean;
  error?: string;
  dataDir?: string;
  dataFile?: string;
  restoredFrom?: string;
}

@Injectable({ providedIn: 'root' })
export class AppStateStore {
  private readonly toast = inject(ToastService);
  private readonly sectionLock = inject(SectionLockService);

  /** The single writable source of truth. Feature stores read/update this directly. */
  readonly data = signal<AppData>(createEmptyAppData());

  /** Electron: false until crew-data.json is loaded or user completes first-run setup. */
  private electronBootstrapComplete = false;

  /**
   * Settings-modal session: edits stay in RAM until Done / Save.
   * Snapshot lets backdrop Discard restore prior state.
   */
  private formSessionActive = false;
  private formSessionDirty = false;
  private formSessionSnapshot: AppData | null = null;

  /** Pending disk write — memory is already updated; disk waits for flushPersist. */
  private persistDirty = false;
  private pendingNotify: PersistNotify = 'silent';
  private pendingSavedMessage: string | undefined;
  private persistInFlight: Promise<void> | null = null;
  private persistQueuedAgain = false;

  async init(): Promise<AppInitResult> {
    const electron = window.electronAPI;
    if (electron) {
      try {
        const loaded = await electron.readData();
        if (loaded) {
          const normalized = normalizeAppData(loaded);
          this.data.set(normalized);
          this.electronBootstrapComplete = true;
          if ((loaded.seedVersion ?? 0) < APP_DATA_SCHEMA_VERSION) {
            await this.flushPersist('silent');
          }
          return 'loaded';
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load saved data';
        this.toast.showError(msg);
        this.data.set(createEmptyAppData());
        return 'error';
      }
      this.data.set(createEmptyAppData());
      return 'missing';
    }
    const raw = readLocalStorage(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<AppData>;
        const normalized = normalizeAppData(parsed);
        this.data.set(normalized);
        if ((parsed.seedVersion ?? 0) < APP_DATA_SCHEMA_VERSION) {
          await this.flushPersist('silent');
        }
      } catch {
        this.data.set(createEmptyAppData());
        await this.flushPersist('silent');
      }
    } else {
      this.data.set(createEmptyAppData());
      await this.flushPersist('silent');
    }
    return 'loaded';
  }

  async bootstrapCreateNew(): Promise<boolean> {
    const electron = window.electronAPI;
    if (!electron?.createNewDataStore) return false;
    const res = await electron.createNewDataStore();
    if (!res.ok) {
      this.toast.showError(res.error ?? 'Could not create database');
      return false;
    }
    this.data.set(createEmptyAppData());
    await this.flushPersist('silent');
    this.electronBootstrapComplete = true;
    return true;
  }

  async bootstrapUseExistingDirectory(dir: string): Promise<boolean> {
    const electron = window.electronAPI;
    if (!electron?.setDataDirectory) return false;
    const res = await electron.setDataDirectory(dir);
    if (!res.ok) {
      this.toast.showError(res.error ?? 'Could not use this folder');
      return false;
    }
    return this.completeBootstrapFromDisk();
  }

  /** Reload full AppData from disk (e.g. after restoring a JSON backup). */
  reloadEntireAppFromDisk(): Promise<boolean> {
    return this.completeBootstrapFromDisk();
  }

  private async completeBootstrapFromDisk(): Promise<boolean> {
    const electron = window.electronAPI;
    if (!electron) return false;
    try {
      const loaded = await electron.readData();
      if (!loaded) {
        this.toast.showError('Database file not found after setup');
        return false;
      }
      const normalized = normalizeAppData(loaded);
      this.data.set(normalized);
      if ((loaded.seedVersion ?? 0) < APP_DATA_SCHEMA_VERSION) {
        await this.flushPersist('silent');
      }
      this.electronBootstrapComplete = true;
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load saved data';
      this.toast.showError(msg);
      return false;
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

  /**
   * Mark AppData dirty in memory. Does NOT write the shared/local file unless
   * notify === 'saved' (immediate flush). Call flushPersist on Done / Save /
   * tab switch / close / minimize.
   */
  async persist(notify: PersistNotify = 'memory', savedMessage?: string): Promise<void> {
    if (this.formSessionActive && notify !== 'saved') {
      this.formSessionDirty = true;
      this.queuePersist('silent', savedMessage);
      return;
    }
    if (notify === 'saved') {
      this.queuePersist('saved', savedMessage);
      await this.flushPersist();
      return;
    }
    // memory / silent / debounced → RAM only until an explicit flush
    this.queuePersist(notify === 'memory' ? 'silent' : notify, savedMessage);
  }

  /** True when a settings modal has unsaved in-memory edits. */
  isFormSessionDirty(): boolean {
    return this.formSessionActive && this.formSessionDirty;
  }

  isFormSessionActive(): boolean {
    return this.formSessionActive;
  }

  /** Open a form-settings modal: snapshot memory so Discard can restore. */
  async beginFormSession(): Promise<void> {
    // Write any prior Home/ETA edits first so Discard only reverts this modal.
    await this.flushPersist('silent');
    this.formSessionActive = true;
    this.formSessionDirty = false;
    this.formSessionSnapshot = cloneAppData(this.data());
  }

  /** Done — write to disk only if something changed. */
  async commitFormSession(savedMessage = 'Form changes saved'): Promise<void> {
    const dirty = this.formSessionDirty || this.persistDirty;
    this.formSessionActive = false;
    this.formSessionSnapshot = null;
    this.formSessionDirty = false;
    this.toast.cancelDebouncedSaved();
    if (!dirty) return;
    await this.flushPersist('saved', savedMessage);
  }

  /** Discard modal edits and restore the snapshot from beginFormSession. */
  discardFormSession(): void {
    if (this.formSessionSnapshot) {
      this.data.set(this.formSessionSnapshot);
    }
    this.formSessionActive = false;
    this.formSessionSnapshot = null;
    this.formSessionDirty = false;
    this.persistDirty = false;
    this.pendingNotify = 'silent';
    this.pendingSavedMessage = undefined;
    this.toast.cancelDebouncedSaved();
  }

  /** Close modal with no edits — drop session without toast/write. */
  endFormSessionClean(): void {
    this.formSessionActive = false;
    this.formSessionSnapshot = null;
    this.formSessionDirty = false;
    this.toast.cancelDebouncedSaved();
  }

  /** Write any pending changes now (navigation, quit, Done, Save). */
  async flushPersist(notify?: PersistNotify, savedMessage?: string): Promise<void> {
    // Settings modal owns its write via commitFormSession — don't flush mid-edit
    // (minimize/blur would otherwise persist before Done / Discard).
    if (this.formSessionActive && notify !== 'saved') {
      if (notify != null) this.queuePersist(notify, savedMessage);
      return;
    }
    if (notify != null) this.queuePersist(notify, savedMessage);
    if (!this.persistDirty && !this.persistInFlight) return;
    await this.runPersistCycle();
  }

  private queuePersist(notify: PersistNotify, savedMessage?: string): void {
    this.persistDirty = true;
    const normalized = notify === 'memory' ? 'silent' : notify;
    this.pendingNotify = maxNotify(this.pendingNotify, normalized);
    if (savedMessage) this.pendingSavedMessage = savedMessage;
  }

  /** True when memory has edits not yet written to disk. */
  hasPendingPersist(): boolean {
    return this.persistDirty || !!this.persistInFlight;
  }

  private async runPersistCycle(): Promise<void> {
    if (this.persistInFlight) {
      this.persistQueuedAgain = true;
      await this.persistInFlight;
      return;
    }
    if (!this.persistDirty) return;

    this.persistDirty = false;
    const notify = this.pendingNotify;
    const savedMessage = this.pendingSavedMessage;
    this.pendingNotify = 'silent';
    this.pendingSavedMessage = undefined;

    this.persistInFlight = this.writePersistNow(notify, savedMessage);
    try {
      await this.persistInFlight;
    } finally {
      this.persistInFlight = null;
    }

    if (this.persistQueuedAgain || this.persistDirty) {
      this.persistQueuedAgain = false;
      if (this.persistDirty) {
        await this.runPersistCycle();
      }
    }
  }

  private async writePersistNow(notify: PersistNotify, savedMessage?: string): Promise<void> {
    if (!this.sectionLock.canPersist()) {
      if (notify !== 'silent') {
        this.toast.show(
          'View only — another user is editing this section. Changes were not saved.',
          'warning',
        );
      }
      return;
    }

    const electron = window.electronAPI;
    if (electron && !this.electronBootstrapComplete) {
      if (notify !== 'silent') {
        this.toast.showError('Database is not ready — complete setup first');
      }
      return;
    }

    const memory = { ...this.data(), seedVersion: APP_DATA_SCHEMA_VERSION };
    const section = this.sectionLock.activeSection();

    if (electron) {
      let toWrite: AppData = memory;
      if (this.sectionLock.cooperativeMode() && section) {
        const loaded = await electron.readData();
        const disk = normalizeAppData(loaded ?? createEmptyAppData());
        toWrite = mergeSectionForSave(disk, memory, section);
      }
      const saved = await this.writeElectronData(toWrite);
      if (!saved) return;
    } else {
      writeLocalStorage(STORAGE_KEY, JSON.stringify(memory));
    }
    this.afterPersist(notify, savedMessage);
  }

  /**
   * Save folder/printer output settings immediately — not tied to the active section lock
   * (top-bar control is available on Home / DG / Reefer).
   */
  async persistOutputSettings(
    notify: PersistNotify = 'silent',
    savedMessage?: string,
  ): Promise<void> {
    const electron = window.electronAPI;
    if (electron && !this.electronBootstrapComplete) {
      if (notify !== 'silent') {
        this.toast.showError('Database is not ready — complete setup first');
      }
      return;
    }

    // Flush coalesced AppData first so we don't clobber a pending section write.
    await this.flushPersist('silent');

    const memory = this.data();
    if (electron) {
      const loaded = await electron.readData();
      const disk = normalizeAppData(loaded ?? createEmptyAppData());
      const saved = await this.writeElectronData({
        ...disk,
        outputSettings: memory.outputSettings,
        seedVersion: APP_DATA_SCHEMA_VERSION,
      });
      if (!saved) return;
    } else {
      writeLocalStorage(
        STORAGE_KEY,
        JSON.stringify({ ...memory, seedVersion: APP_DATA_SCHEMA_VERSION }),
      );
    }
    this.afterPersist(notify, savedMessage);
  }

  /**
   * Save FUEL column-display presets immediately — shared list in the data folder
   * (FUEL has no cooperative lock).
   */
  async persistFuelDisplayPresets(
    notify: PersistNotify = 'silent',
    savedMessage?: string,
  ): Promise<void> {
    const electron = window.electronAPI;
    if (electron && !this.electronBootstrapComplete) {
      if (notify !== 'silent') {
        this.toast.showError('Database is not ready — complete setup first');
      }
      return;
    }

    await this.flushPersist('silent');

    const memory = this.data();
    if (electron) {
      const loaded = await electron.readData();
      const disk = normalizeAppData(loaded ?? createEmptyAppData());
      const diskFuel = normalizeFuelLibrary(disk.fuelLibrary);
      const memFuel = normalizeFuelLibrary(memory.fuelLibrary);
      const saved = await this.writeElectronData({
        ...disk,
        fuelLibrary: {
          ...diskFuel,
          displayPresets: memFuel.displayPresets,
        },
        seedVersion: APP_DATA_SCHEMA_VERSION,
      });
      if (!saved) return;
    } else {
      writeLocalStorage(
        STORAGE_KEY,
        JSON.stringify({ ...memory, seedVersion: APP_DATA_SCHEMA_VERSION }),
      );
    }
    this.afterPersist(notify, savedMessage);
  }

  /** Save ship/voyage fields — Home edits stay in RAM until flush (tab/Save/close). */
  async persistShip(notify: PersistNotify = 'memory', savedMessage?: string): Promise<void> {
    if (!this.sectionLock.canPersist()) {
      if (notify === 'saved') {
        this.toast.show(
          'View only — another user is editing this section. Changes were not saved.',
          'warning',
        );
      }
      return;
    }

    const electron = window.electronAPI;
    if (electron && !this.electronBootstrapComplete) {
      if (notify === 'saved') {
        this.toast.showError('Database is not ready — complete setup first');
      }
      return;
    }

    // Typing port / dates / crew voyage fields: memory only.
    if (notify !== 'saved') {
      this.queuePersist('silent', savedMessage);
      return;
    }

    await this.flushPersist('silent');

    const memory = this.data();
    if (electron) {
      const loaded = await electron.readData();
      const disk = normalizeAppData(loaded ?? createEmptyAppData());
      const saved = await this.writeElectronData({
        ...disk,
        ship: memory.ship,
        seedVersion: APP_DATA_SCHEMA_VERSION,
      });
      if (!saved) return;
    } else {
      writeLocalStorage(
        STORAGE_KEY,
        JSON.stringify({ ...memory, seedVersion: APP_DATA_SCHEMA_VERSION }),
      );
    }
    this.afterPersist(notify, savedMessage);
  }

  private async writeElectronData(toWrite: AppData): Promise<boolean> {
    const electron = window.electronAPI;
    if (!electron) return true;
    try {
      await electron.writeData({ ...toWrite, seedVersion: APP_DATA_SCHEMA_VERSION });
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not save data';
      this.toast.showError(msg);
      return false;
    }
  }

  private afterPersist(notify: PersistNotify, savedMessage?: string): void {
    if (notify === 'saved') {
      this.toast.cancelDebouncedSaved();
      if (savedMessage) this.toast.show(savedMessage, 'success');
      else this.toast.showSaved();
      return;
    }
    // silent / debounced flushes (tab switch, minimize) — no toast spam
  }

  /**
   * @deprecated Use beginFormSession / commitFormSession / discardFormSession.
   * Kept so older call sites still clear toast state.
   */
  finishFormSession(): void {
    if (this.formSessionActive) {
      void this.commitFormSession();
      return;
    }
    this.toast.cancelDebouncedSaved();
  }
}
