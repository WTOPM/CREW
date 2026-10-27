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
  APP_SECTIONS,
  AppSection,
  formSessionSlicesChanged,
  mergeSectionFromDisk,
  mergeSectionsForSave,
} from '../utils/app-data-section.util';
import { readLocalStorage, writeLocalStorage } from '../utils/browser-storage.util';
import { commitPendingDomEdits } from '../utils/commit-pending-dom-edits.util';

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
  /** Unsaved section dirtiness that existed before the settings modal opened. */
  private dirtyBeforeFormSession = false;

  /** Pending disk write — memory is already updated; disk waits for flushPersist. */
  private persistDirty = false;
  /**
   * Sections edited in RAM since last successful shared-folder write.
   * Save / Quit must merge ALL of these (not only the active tab).
   */
  private readonly dirtySections = new Set<AppSection>();
  private pendingNotify: PersistNotify = 'silent';
  private pendingSavedMessage: string | undefined;
  private persistInFlight: Promise<void> | null = null;
  private persistQueuedAgain = false;

  /**
   * Shown while Done / Save writes the shared working folder (slow LAN).
   * App shell renders a blocking progress overlay when true.
   */
  readonly formSaveBusy = signal(false);

  /**
   * Load the full crew-data.json once into RAM (all sections: Home/DG/ETA/Fuel/…).
   * Tab switches do not re-read the shared file.
   */
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
            await this.flushFullNormalizedToDisk();
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
          await this.flushFullNormalizedToDisk();
        }
      } catch {
        this.data.set(createEmptyAppData());
        await this.flushFullNormalizedToDisk();
      }
    } else {
      this.data.set(createEmptyAppData());
      await this.flushFullNormalizedToDisk();
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
    await this.flushFullNormalizedToDisk();
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
        await this.flushFullNormalizedToDisk();
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

  /** Reload the full AppData blob from disk (one read — all sections). */
  async reloadAllFromDisk(): Promise<void> {
    const electron = window.electronAPI;
    if (!electron) return;
    const loaded = await electron.readData();
    if (!loaded) return;
    this.data.set(normalizeAppData(loaded));
    // Memory now matches disk — drop stale dirty marks (callers must flush first).
    this.persistDirty = false;
    this.dirtySections.clear();
    this.pendingNotify = 'silent';
    this.pendingSavedMessage = undefined;
    this.formSessionActive = false;
    this.formSessionDirty = false;
    this.formSessionSnapshot = null;
    this.dirtyBeforeFormSession = false;
  }

  /**
   * Mark AppData dirty in memory. Does NOT write the shared/local file unless
   * notify === 'saved' (immediate flush) and no settings modal session is open.
   * Disk write: Save / Done / explicit flushPersist / full Quit.
   */
  async persist(notify: PersistNotify = 'memory', savedMessage?: string): Promise<void> {
    // Settings modals: never hit the network until Done / Discard — even if a
    // caller passes 'saved' (reorder ports, packages, etc.).
    if (this.formSessionActive) {
      this.formSessionDirty = true;
      this.queuePersist(notify === 'saved' ? 'saved' : 'silent', savedMessage);
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

  /**
   * True when a settings modal has real unsaved edits (vs snapshot).
   * Uses slice compare — not the persist flag — so Select-document tab switches
   * alone do not count as dirty (see formSessionSlicesChanged).
   */
  isFormSessionDirty(): boolean {
    if (!this.formSessionActive) return false;
    const snap = this.formSessionSnapshot;
    if (!snap) return this.formSessionDirty;
    // Prefer the persist flag (set on every store write) OR slice compare —
    // slice-only missed some deletes when blur/ClickOutside raced the update.
    return this.formSessionDirty || formSessionSlicesChanged(snap, this.data());
  }

  isFormSessionActive(): boolean {
    return this.formSessionActive;
  }

  /** Open a form-settings modal: snapshot memory so Discard can restore. */
  async beginFormSession(): Promise<void> {
    // Snapshot RAM only — no shared-folder write until Done / Quit (weak LAN).
    this.dirtyBeforeFormSession = this.persistDirty || this.dirtySections.size > 0;
    this.formSessionActive = true;
    this.formSessionDirty = false;
    this.formSessionSnapshot = cloneAppData(this.data());
  }

  /** Done — write to disk only if something changed. */
  async commitFormSession(savedMessage = 'Form changes saved'): Promise<void> {
    const dirty =
      this.formSessionDirty ||
      this.persistDirty ||
      this.dirtyBeforeFormSession ||
      (!!this.formSessionSnapshot && formSessionSlicesChanged(this.formSessionSnapshot, this.data()));
    this.formSessionActive = false;
    this.formSessionSnapshot = null;
    this.formSessionDirty = false;
    this.dirtyBeforeFormSession = false;
    this.toast.cancelDebouncedSaved();
    if (!dirty) return;
    // Document forms live on Home; lists/overlays/packages on Settings.
    this.dirtySections.add('home');
    this.dirtySections.add('settings');
    const active = this.sectionLock.activeSection();
    if (active) this.dirtySections.add(active);
    this.formSaveBusy.set(true);
    try {
      await this.flushPersist('saved', savedMessage);
    } finally {
      this.formSaveBusy.set(false);
    }
  }

  /** Discard modal edits and restore the snapshot from beginFormSession. */
  discardFormSession(): void {
    if (this.formSessionSnapshot) {
      this.data.set(this.formSessionSnapshot);
    }
    this.formSessionActive = false;
    this.formSessionSnapshot = null;
    this.formSessionDirty = false;
    // Keep pre-modal unsaved section dirtiness (Home/Fuel/… edits still in RAM).
    if (this.dirtyBeforeFormSession) {
      this.persistDirty = true;
    } else {
      this.persistDirty = false;
      this.dirtySections.clear();
      this.pendingNotify = 'silent';
      this.pendingSavedMessage = undefined;
    }
    this.dirtyBeforeFormSession = false;
    this.toast.cancelDebouncedSaved();
  }

  /** Close modal with no edits — drop session without toast/write. */
  endFormSessionClean(): void {
    this.formSessionActive = false;
    this.formSessionSnapshot = null;
    this.formSessionDirty = false;
    this.dirtyBeforeFormSession = false;
    this.toast.cancelDebouncedSaved();
  }

  /**
   * Schema upgrade / first localStorage seed: mark every section dirty so the
   * normalized RAM blob is fully merged to disk (not only ship/outputSettings).
   */
  private async flushFullNormalizedToDisk(): Promise<void> {
    for (const section of APP_SECTIONS) this.dirtySections.add(section);
    this.persistDirty = true;
    await this.flushPersist('silent');
  }

  /** Write any pending changes now (Done / Save / Quit / Refresh). */
  async flushPersist(notify?: PersistNotify, savedMessage?: string): Promise<void> {
    // Settings modal owns its write via commitFormSession — don't flush mid-edit
    // (except full Quit — see flushPersistForQuit).
    if (this.formSessionActive && notify !== 'saved') {
      if (notify != null) this.queuePersist(notify, savedMessage);
      return;
    }
    if (notify != null) this.queuePersist(notify, savedMessage);
    // dirtySections alone must still flush (hasPendingPersist can be true without
    // persistDirty after a partial recovery path).
    if (this.dirtySections.size > 0) this.persistDirty = true;
    if (!this.persistDirty && !this.persistInFlight) return;
    await this.runPersistCycle();
  }

  /**
   * Full Quit / force-quit: keep open settings-modal edits and write every
   * dirty section to the shared folder before the on-close backup.
   */
  async flushPersistForQuit(): Promise<void> {
    // Commit focused Settings metres / draft fields before checking dirty.
    await commitPendingDomEdits();
    if (this.formSessionActive) {
      const snap = this.formSessionSnapshot;
      const sessionDirty =
        this.formSessionDirty ||
        this.dirtyBeforeFormSession ||
        this.persistDirty ||
        (!!snap && formSessionSlicesChanged(snap, this.data()));
      this.formSessionActive = false;
      this.formSessionSnapshot = null;
      if (sessionDirty) {
        this.dirtySections.add('home');
        this.dirtySections.add('settings');
        const active = this.sectionLock.activeSection();
        if (active) this.dirtySections.add(active);
        this.persistDirty = true;
      }
      this.formSessionDirty = false;
      this.dirtyBeforeFormSession = false;
    }
    // Ship lives in the settings slice; snapshots in home — always include both
    // when anything is dirty so Quit never drops draft/voyage RAM edits.
    if (this.persistDirty || this.dirtySections.size > 0) {
      this.markSectionsDirty(['home', 'settings']);
    }
    await this.flushPersist('silent');
  }

  private queuePersist(notify: PersistNotify, savedMessage?: string): void {
    this.persistDirty = true;
    const section = this.sectionLock.activeSection();
    if (section) this.dirtySections.add(section);
    const normalized = notify === 'memory' ? 'silent' : notify;
    this.pendingNotify = maxNotify(this.pendingNotify, normalized);
    if (savedMessage) this.pendingSavedMessage = savedMessage;
  }

  /** True when memory has edits not yet written to disk. */
  hasPendingPersist(): boolean {
    return this.persistDirty || !!this.persistInFlight || this.dirtySections.size > 0;
  }

  /**
   * Mark section slice(s) dirty for merge-on-save (e.g. DG archive Save must
   * always write `dgLibrary` + `dgPageArchives`, even if nav lock is unset).
   */
  markSectionsDirty(sections: readonly AppSection[]): void {
    for (const section of sections) this.dirtySections.add(section);
    this.persistDirty = true;
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
    const electron = window.electronAPI;
    if (electron && !this.electronBootstrapComplete) {
      if (notify !== 'silent') {
        this.toast.showError('Database is not ready — complete setup first');
      }
      // Keep dirtiness — setup is not a successful write.
      this.persistDirty = true;
      return;
    }

    const memory = { ...this.data(), seedVersion: APP_DATA_SCHEMA_VERSION };
    const sections = [...this.dirtySections];
    const active = this.sectionLock.activeSection();
    if (active && !sections.includes(active)) sections.push(active);
    // Never flush with an empty section list while dirty — that path only
    // writes ship/outputSettings and silently drops DG/Reefer/Fuel/… RAM edits.
    if (!sections.length) {
      sections.push(...APP_SECTIONS);
    }

    if (electron) {
      // Merge every dirty section into the on-disk blob so edits made on
      // other tabs before Save/Quit are not dropped (no tab-leave flush).
      const loaded = await electron.readData();
      const disk = normalizeAppData(loaded ?? createEmptyAppData());
      const toWrite = mergeSectionsForSave(disk, memory, sections);
      const saved = await this.writeElectronData(toWrite);
      if (!saved) {
        this.persistDirty = true;
        return;
      }
      // Edits during the async write re-set persistDirty — keep their section marks.
      if (!this.persistDirty) this.dirtySections.clear();
    } else {
      writeLocalStorage(STORAGE_KEY, JSON.stringify(memory));
      if (!this.persistDirty) this.dirtySections.clear();
    }
    this.afterPersist(notify, savedMessage);
  }

  /**
   * Save FUEL column-display presets immediately — shared list in the data folder.
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

  /** Save ship/voyage fields — Home/Settings edits stay in RAM until flush (Save / Quit). */
  async persistShip(notify: PersistNotify = 'memory', savedMessage?: string): Promise<void> {
    const electron = window.electronAPI;
    if (electron && !this.electronBootstrapComplete) {
      if (notify === 'saved') {
        this.toast.showError('Database is not ready — complete setup first');
      }
      return;
    }

    // Ship is owned by the settings section slice — always mark it dirty.
    this.markSectionsDirty(['settings']);

    // Typing port / dates / drafts: memory only until Save / Quit.
    if (notify !== 'saved') {
      this.queuePersist('silent', savedMessage);
      return;
    }

    this.markSectionsDirty(['home', 'settings']);
    await this.flushPersist('saved', savedMessage);
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
    // silent flushes (Quit / Refresh) — no toast spam
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
