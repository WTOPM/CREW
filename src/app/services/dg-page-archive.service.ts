import { Injectable, computed, inject, signal } from '@angular/core';
import {
  DG_PAGE_ARCHIVE_SESSION_KEY,
  DG_PAGE_ARCHIVE_STORAGE_KEY,
  type DgPageArchiveSession,
  type DgPageLiveBackup,
  type DgPageShipContext,
  type DgPageSnapshot,
} from '../models/dg-page-archive.models';
import { normalizeDgLibrary, type DgLibrarySettings } from '../models/dg-manifest.models';
import type { Port, ShipInfo } from '../models/crew.models';
import { dgPageShipContextFromLibrary } from '../utils/page-ship-context.util';
import { formatDisplayDate } from '../utils/date.util';
import {
  readLocalStorage,
  removeLocalStorage,
  writeLocalStorage,
} from '../utils/browser-storage.util';
import { normalizeDgPageArchiveEntries } from './app-data-normalizer';
import { AppStateStore } from './app-state.store';
import { StorageService } from './storage.service';
import { DgManifestStore } from './dg-manifest.store';

@Injectable({ providedIn: 'root' })
export class DgPageArchiveService {
  private readonly storage = inject(StorageService);
  private readonly dg = inject(DgManifestStore);
  private readonly state = inject(AppStateStore);

  readonly entries = computed(() => this.state.data().dgPageArchives);
  readonly entriesNewestFirst = computed(() => this.sortNewestFirst(this.entries()));
  readonly loaded = signal<DgPageSnapshot | null>(null);
  readonly saving = signal(false);

  private liveBackup: DgPageLiveBackup | null = null;

  /** Move browser-local DG snapshots into shared AppData. Call after storage.init(). */
  migrateLegacyLocalStorage(): void {
    const legacy = this.readLegacyLocalEntries();
    if (legacy.length === 0) {
      removeLocalStorage(DG_PAGE_ARCHIVE_STORAGE_KEY);
      return;
    }
    const current = this.state.data().dgPageArchives;
    const byId = new Map<string, DgPageSnapshot>();
    for (const e of current) byId.set(e.id, e);
    let added = 0;
    for (const e of legacy) {
      if (byId.has(e.id)) continue;
      byId.set(e.id, e);
      added += 1;
    }
    removeLocalStorage(DG_PAGE_ARCHIVE_STORAGE_KEY);
    if (added === 0) return;
    const merged = this.sortNewestFirst([...byId.values()]);
    this.state.data.update((d) => ({ ...d, dgPageArchives: merged }));
    void this.state.persist('silent');
  }

  save(label: string): DgPageSnapshot | null {
    const trimmed = label.trim();
    if (!trimmed) return null;

    this.saving.set(true);
    try {
      const ship = this.storage.ship();
      const dgLibrary = this.storage.dgLibrary();
      const entry: DgPageSnapshot = {
        id: crypto.randomUUID(),
        label: trimmed,
        savedAt: new Date().toISOString(),
        ship: dgPageShipContextFromLibrary(ship, dgLibrary.pageContext),
        dgLibrary: cloneDgLibrary(dgLibrary, this.storage.ports()),
      };

      this.state.data.update((d) => ({
        ...d,
        dgPageArchives: this.sortNewestFirst([entry, ...d.dgPageArchives]),
      }));
      void this.state.persist('silent');
      return entry;
    } finally {
      this.saving.set(false);
    }
  }

  load(id: string): boolean {
    const entry = this.entries().find((e) => e.id === id);
    if (!entry) return false;

    if (!this.loaded()) {
      const ship = this.storage.ship();
      const dgLibrary = this.storage.dgLibrary();
      this.liveBackup = {
        ship: dgPageShipContextFromLibrary(ship, dgLibrary.pageContext),
        dgLibrary: cloneDgLibrary(dgLibrary, this.storage.ports()),
      };
    }

    this.dg.applyDgPageSnapshot(entry.dgLibrary, entry.ship);
    this.loaded.set(structuredClone(entry));
    this.persistSession();
    return true;
  }

  reset(): void {
    if (this.liveBackup) {
      this.dg.applyDgPageSnapshot(this.liveBackup.dgLibrary, this.liveBackup.ship);
      this.liveBackup = null;
    }
    this.loaded.set(null);
    this.clearSession();
  }

  /** Keep current page data (incl. edits) as live; discard the pre-load backup. */
  commitLoadedAsLive(): boolean {
    if (!this.loaded()) return false;
    this.liveBackup = null;
    this.loaded.set(null);
    this.clearSession();
    return true;
  }

  restoreSession(): void {
    const session = this.readSession();
    if (!session) return;

    const entry = this.entries().find((e) => e.id === session.loadedId);
    if (!entry) {
      if (session.liveBackup) {
        this.dg.applyDgPageSnapshot(session.liveBackup.dgLibrary, session.liveBackup.ship);
      }
      this.clearSession();
      return;
    }

    this.liveBackup = cloneLiveBackup(session.liveBackup, this.storage.ports());
    this.loaded.set(structuredClone(entry));
  }

  remove(id: string): void {
    const wasLoaded = this.loaded()?.id === id;
    this.state.data.update((d) => ({
      ...d,
      dgPageArchives: d.dgPageArchives.filter((e) => e.id !== id),
    }));
    void this.state.persist('silent');
    if (wasLoaded) {
      this.reset();
    }
  }

  defaultSaveLabel(): string {
    const ctx = this.storage.dgLibrary().pageContext;
    const port = ctx.portOfCall?.trim() || '—';
    const dep = ctx.dateOfDeparture?.trim();
    const depLabel = dep ? formatDisplayDate(dep) : '—';
    return `${port} · ${depLabel}`;
  }

  private persistSession(): void {
    const loaded = this.loaded();
    if (!loaded || !this.liveBackup) {
      this.clearSession();
      return;
    }
    const session: DgPageArchiveSession = {
      loadedId: loaded.id,
      liveBackup: cloneLiveBackup(this.liveBackup, this.storage.ports()),
    };
    writeLocalStorage(DG_PAGE_ARCHIVE_SESSION_KEY, JSON.stringify(session));
  }

  private clearSession(): void {
    removeLocalStorage(DG_PAGE_ARCHIVE_SESSION_KEY);
  }

  private readSession(): DgPageArchiveSession | null {
    try {
      const raw = readLocalStorage(DG_PAGE_ARCHIVE_SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object') return null;
      const o = parsed as Record<string, unknown>;
      const loadedId = String(o['loadedId'] ?? '').trim();
      const liveBackupRaw = o['liveBackup'];
      if (!loadedId || !liveBackupRaw || typeof liveBackupRaw !== 'object') return null;
      const backup = liveBackupRaw as Record<string, unknown>;
      const shipRaw = backup['ship'];
      const libRaw = backup['dgLibrary'];
      if (!shipRaw || typeof shipRaw !== 'object' || !libRaw) return null;
      const shipObj = shipRaw as Record<string, unknown>;
      return {
        loadedId,
        liveBackup: {
          ship: {
            voyageNumber: String(shipObj['voyageNumber'] ?? '').trim(),
            portOfCall: String(shipObj['portOfCall'] ?? '').trim(),
            nextPortOfCall: String(shipObj['nextPortOfCall'] ?? '').trim(),
            dateOfDeparture: String(shipObj['dateOfDeparture'] ?? '').trim(),
            dateOfArrival: String(shipObj['dateOfArrival'] ?? '').trim(),
          },
          dgLibrary: normalizeDgLibrary(libRaw as DgLibrarySettings),
        },
      };
    } catch {
      return null;
    }
  }

  private readLegacyLocalEntries(): DgPageSnapshot[] {
    try {
      const raw = readLocalStorage(DG_PAGE_ARCHIVE_STORAGE_KEY);
      if (!raw) return [];
      return normalizeDgPageArchiveEntries(JSON.parse(raw) as unknown, this.storage.ports());
    } catch {
      return [];
    }
  }

  private sortNewestFirst(list: DgPageSnapshot[]): DgPageSnapshot[] {
    return [...list].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }
}

function cloneDgLibrary(lib: DgLibrarySettings, ports: readonly Port[]): DgLibrarySettings {
  return normalizeDgLibrary(structuredClone(lib), undefined, ports);
}

function cloneLiveBackup(backup: DgPageLiveBackup, ports: readonly Port[]): DgPageLiveBackup {
  return {
    ship: { ...backup.ship },
    dgLibrary: cloneDgLibrary(backup.dgLibrary, ports),
  };
}

/** @deprecated Use dgPageShipContextFromLibrary */
export function shipContextFromShip(ship: ShipInfo): DgPageShipContext {
  return {
    voyageNumber: ship.voyageNumber?.trim() ?? '',
    portOfCall: ship.portOfCall?.trim() ?? '',
    nextPortOfCall: ship.nextPortOfCall?.trim() ?? '',
    dateOfDeparture: ship.dateOfDeparture?.trim() ?? '',
    dateOfArrival: ship.dateOfArrival?.trim() ?? '',
  };
}
