import { Injectable, computed, inject, signal } from '@angular/core';
import {
  APP_SNAPSHOT_SESSION_KEY,
  APP_SNAPSHOT_STORAGE_KEY,
  type AppMainSnapshot,
  type AppSnapshotEntry,
  type AppSnapshotSession,
} from '../models/app-snapshot.models';
import {
  cloneMainAppSnapshot,
  findAppSnapshotByVoyageKey,
} from '../utils/app-snapshot.util';
import {
  readLocalStorage,
  removeLocalStorage,
  writeLocalStorage,
} from '../utils/browser-storage.util';
import {
  normalizeAppSnapshotEntries,
} from './app-data-normalizer';
import { AppStateStore } from './app-state.store';
import { StorageService } from './storage.service';

/** Full app snapshots (except DG / Reefer) — stored in shared crew-data.json. */
@Injectable({ providedIn: 'root' })
export class AppSnapshotArchiveService {
  private readonly storage = inject(StorageService);
  private readonly state = inject(AppStateStore);

  readonly entries = computed(() => this.state.data().appSnapshots);
  readonly entriesNewestFirst = computed(() => this.sortNewestFirst(this.entries()));
  readonly loaded = signal<AppSnapshotEntry | null>(null);
  readonly saving = signal(false);

  private liveBackup: AppMainSnapshot | null = null;

  /**
   * One-time: move browser-local snapshots into shared AppData so other PCs see them.
   * Call after storage.init(), before restoreSession().
   */
  migrateLegacyLocalStorage(): void {
    const legacy = this.readLegacyLocalEntries();
    if (legacy.length === 0) {
      removeLocalStorage(APP_SNAPSHOT_STORAGE_KEY);
      return;
    }
    const current = this.state.data().appSnapshots;
    const byId = new Map<string, AppSnapshotEntry>();
    for (const e of current) byId.set(e.id, e);
    let added = 0;
    for (const e of legacy) {
      if (byId.has(e.id)) continue;
      byId.set(e.id, e);
      added += 1;
    }
    removeLocalStorage(APP_SNAPSHOT_STORAGE_KEY);
    if (added === 0) return;
    const merged = this.sortNewestFirst([...byId.values()]);
    this.state.data.update((d) => ({ ...d, appSnapshots: merged }));
    void this.state.persist('silent');
  }

  save(label: string, options?: { overwriteId?: string }): AppSnapshotEntry | null {
    const trimmed = label.trim();
    if (!trimmed) return null;

    this.saving.set(true);
    try {
      const ship = this.storage.ship();
      const data = this.storage.captureMainAppSnapshot();
      const portName = ship.portOfCall?.trim() ?? '';
      const voyageNumber = ship.voyageNumber?.trim() ?? '';
      const arrivalDate = ship.dateOfArrival?.trim() ?? '';
      const now = new Date().toISOString();
      const existing = options?.overwriteId
        ? this.entries().find((e) => e.id === options.overwriteId)
        : undefined;

      const entry: AppSnapshotEntry = {
        id: existing?.id ?? crypto.randomUUID(),
        label: trimmed,
        savedAt: now,
        portName,
        voyageNumber,
        arrivalDate,
        data: cloneMainAppSnapshot(data),
      };

      this.state.data.update((d) => {
        if (existing) {
          return {
            ...d,
            appSnapshots: this.sortNewestFirst(
              d.appSnapshots.map((e) => (e.id === existing.id ? entry : e)),
            ),
          };
        }
        return {
          ...d,
          appSnapshots: this.sortNewestFirst([entry, ...d.appSnapshots]),
        };
      });
      void this.state.persist('silent');
      return entry;
    } finally {
      this.saving.set(false);
    }
  }

  /** Match by current ship port + voyage + arrival date (all must be set). */
  findByCurrentVoyageKey(): AppSnapshotEntry | undefined {
    const ship = this.storage.ship();
    return findAppSnapshotByVoyageKey(this.entries(), {
      portName: ship.portOfCall,
      voyageNumber: ship.voyageNumber,
      arrivalDate: ship.dateOfArrival,
    });
  }

  load(id: string): boolean {
    const entry = this.entries().find((e) => e.id === id);
    if (!entry) return false;

    if (!this.loaded()) {
      this.liveBackup = cloneMainAppSnapshot(this.storage.captureMainAppSnapshot());
    }

    this.storage.applyMainAppSnapshot(entry.data);
    this.loaded.set(structuredClone(entry));
    this.persistSession();
    return true;
  }

  reset(): void {
    if (this.liveBackup) {
      this.storage.applyMainAppSnapshot(this.liveBackup);
      this.liveBackup = null;
    }
    this.loaded.set(null);
    this.clearSession();
  }

  /** Keep current app data (incl. edits) as live; discard the pre-load backup. */
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
        this.storage.applyMainAppSnapshot(session.liveBackup);
      }
      this.clearSession();
      return;
    }

    this.liveBackup = cloneMainAppSnapshot(session.liveBackup);
    this.loaded.set(structuredClone(entry));
  }

  remove(id: string): void {
    const wasLoaded = this.loaded()?.id === id;
    this.state.data.update((d) => ({
      ...d,
      appSnapshots: d.appSnapshots.filter((e) => e.id !== id),
    }));
    void this.state.persist('silent');
    if (wasLoaded) {
      this.reset();
    }
  }

  defaultSaveLabel(): string {
    const ship = this.storage.ship();
    const parts: string[] = [];
    const name = ship.name?.trim();
    const port = ship.portOfCall?.trim();
    const voy = ship.voyageNumber?.trim();
    const dateIso = ship.dateOfArrival?.trim() || ship.dateOfDeparture?.trim();
    if (name) parts.push(name);
    if (port) parts.push(port);
    if (voy) parts.push(`Voy ${voy}`);
    if (dateIso) parts.push(formatIsoDateLabel(dateIso));
    return parts.length > 0 ? parts.join(' · ') : 'App snapshot';
  }

  private persistSession(): void {
    const loaded = this.loaded();
    if (!loaded || !this.liveBackup) {
      this.clearSession();
      return;
    }
    const session: AppSnapshotSession = {
      loadedId: loaded.id,
      liveBackup: cloneMainAppSnapshot(this.liveBackup),
    };
    writeLocalStorage(APP_SNAPSHOT_SESSION_KEY, JSON.stringify(session));
  }

  private clearSession(): void {
    removeLocalStorage(APP_SNAPSHOT_SESSION_KEY);
  }

  private readSession(): AppSnapshotSession | null {
    try {
      const raw = readLocalStorage(APP_SNAPSHOT_SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object') return null;
      const o = parsed as Record<string, unknown>;
      const loadedId = String(o['loadedId'] ?? '').trim();
      const liveBackupRaw = o['liveBackup'];
      if (!loadedId || !liveBackupRaw || typeof liveBackupRaw !== 'object') return null;
      const liveBackup = this.storage.coerceStoredMainSnapshot(liveBackupRaw);
      if (!liveBackup) return null;
      return { loadedId, liveBackup };
    } catch {
      return null;
    }
  }

  private readLegacyLocalEntries(): AppSnapshotEntry[] {
    try {
      const raw = readLocalStorage(APP_SNAPSHOT_STORAGE_KEY);
      if (!raw) return [];
      return normalizeAppSnapshotEntries(JSON.parse(raw) as unknown);
    } catch {
      return [];
    }
  }

  private sortNewestFirst(list: AppSnapshotEntry[]): AppSnapshotEntry[] {
    return [...list].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }
}

function formatIsoDateLabel(iso: string): string {
  const m = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const mon = months[parseInt(m[2], 10) - 1] ?? m[2];
  return `${m[3]} ${mon} ${m[1]}`;
}
