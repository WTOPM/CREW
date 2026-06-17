import { Injectable, computed, inject, signal } from '@angular/core';
import {
  APP_SNAPSHOT_SESSION_KEY,
  APP_SNAPSHOT_STORAGE_KEY,
  type AppMainSnapshot,
  type AppSnapshotEntry,
  type AppSnapshotSession,
} from '../models/app-snapshot.models';
import { cloneMainAppSnapshot, extractMainAppSnapshot } from '../utils/app-snapshot.util';
import { StorageService } from './storage.service';

/** Full app snapshots (except DG / Reefer) — stored separately from crew-data.json. */
@Injectable({ providedIn: 'root' })
export class AppSnapshotArchiveService {
  private readonly storage = inject(StorageService);

  readonly entries = signal<AppSnapshotEntry[]>(this.readEntries());
  readonly entriesNewestFirst = computed(() => this.sortNewestFirst(this.entries()));
  readonly loaded = signal<AppSnapshotEntry | null>(null);
  readonly saving = signal(false);

  private liveBackup: AppMainSnapshot | null = null;

  save(label: string): AppSnapshotEntry | null {
    const trimmed = label.trim();
    if (!trimmed) return null;

    this.saving.set(true);
    try {
      const ship = this.storage.ship();
      const data = this.storage.captureMainAppSnapshot();
      const entry: AppSnapshotEntry = {
        id: crypto.randomUUID(),
        label: trimmed,
        savedAt: new Date().toISOString(),
        portName: ship.portOfCall?.trim() ?? '',
        voyageNumber: ship.voyageNumber?.trim() ?? '',
        arrivalDate: ship.dateOfArrival?.trim() ?? '',
        data: cloneMainAppSnapshot(data),
      };

      this.entries.update((list) => [entry, ...list]);
      this.writeEntries();
      return entry;
    } finally {
      this.saving.set(false);
    }
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
    this.entries.update((list) => list.filter((e) => e.id !== id));
    this.writeEntries();
    if (wasLoaded) {
      this.reset();
    }
  }

  defaultSaveLabel(): string {
    const ship = this.storage.ship();
    const voy = ship.voyageNumber?.trim() || '—';
    const port = ship.portOfCall?.trim() || '—';
    const dep = ship.dateOfDeparture?.trim();
    const depLabel = dep ? formatIsoDateLabel(dep) : 'no date';
    return `Voy ${voy} · ${port} · ${depLabel}`;
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
    localStorage.setItem(APP_SNAPSHOT_SESSION_KEY, JSON.stringify(session));
  }

  private clearSession(): void {
    localStorage.removeItem(APP_SNAPSHOT_SESSION_KEY);
  }

  private readSession(): AppSnapshotSession | null {
    try {
      const raw = localStorage.getItem(APP_SNAPSHOT_SESSION_KEY);
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

  private readEntries(): AppSnapshotEntry[] {
    try {
      const raw = localStorage.getItem(APP_SNAPSHOT_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return this.sortNewestFirst(
        parsed
          .map((item) => this.normalizeEntry(item))
          .filter((e): e is AppSnapshotEntry => e != null),
      );
    } catch {
      return [];
    }
  }

  private writeEntries(): void {
    localStorage.setItem(APP_SNAPSHOT_STORAGE_KEY, JSON.stringify(this.entries()));
  }

  private normalizeEntry(raw: unknown): AppSnapshotEntry | null {
    if (!raw || typeof raw !== 'object') return null;
    const o = raw as Record<string, unknown>;
    const id = String(o['id'] ?? '').trim();
    const label = String(o['label'] ?? '').trim();
    const savedAt = String(o['savedAt'] ?? '').trim();
    const dataRaw = o['data'];
    if (!id || !label || !dataRaw) return null;
    const data = this.storage.coerceStoredMainSnapshot(dataRaw);
    if (!data) return null;
    return {
      id,
      label,
      savedAt: savedAt || new Date().toISOString(),
      portName: String(o['portName'] ?? data.ship.portOfCall ?? '').trim(),
      voyageNumber: String(o['voyageNumber'] ?? data.ship.voyageNumber ?? '').trim(),
      arrivalDate: String(o['arrivalDate'] ?? data.ship.dateOfArrival ?? '').trim(),
      data,
    };
  }

  private sortNewestFirst(list: AppSnapshotEntry[]): AppSnapshotEntry[] {
    return [...list].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }
}

function formatIsoDateLabel(iso: string): string {
  const m = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mon = months[parseInt(m[2], 10) - 1] ?? m[2];
  return `${m[3]} ${mon} ${m[1]}`;
}
