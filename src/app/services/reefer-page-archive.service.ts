import { Injectable, computed, inject, signal } from '@angular/core';
import {
  REEFER_PAGE_ARCHIVE_STORAGE_KEY,
  type ReeferPageLiveBackup,
  type ReeferPageShipContext,
  type ReeferPageSnapshot,
} from '../models/reefer-page-archive.models';
import { normalizeReeferLibrary, type ReeferLibrarySettings } from '../models/reefer.models';
import type { Port, ShipInfo } from '../models/crew.models';
import { reeferPageShipContextFromLibrary } from '../utils/page-ship-context.util';
import { StorageService } from './storage.service';

@Injectable({ providedIn: 'root' })
export class ReeferPageArchiveService {
  private readonly storage = inject(StorageService);

  readonly entries = signal<ReeferPageSnapshot[]>(this.readEntries());
  readonly entriesNewestFirst = computed(() => this.sortNewestFirst(this.entries()));
  readonly loaded = signal<ReeferPageSnapshot | null>(null);
  readonly saving = signal(false);

  private liveBackup: ReeferPageLiveBackup | null = null;

  save(label: string): ReeferPageSnapshot | null {
    const trimmed = label.trim();
    if (!trimmed) return null;

    this.saving.set(true);
    try {
      const ship = this.storage.ship();
      const reeferLibrary = this.storage.reeferLibrary();
      const entry: ReeferPageSnapshot = {
        id: crypto.randomUUID(),
        label: trimmed,
        savedAt: new Date().toISOString(),
        ship: reeferPageShipContextFromLibrary(ship, reeferLibrary.pageContext),
        reeferLibrary: cloneReeferLibrary(reeferLibrary, this.storage.ports()),
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
      const ship = this.storage.ship();
      const reeferLibrary = this.storage.reeferLibrary();
      this.liveBackup = {
        ship: reeferPageShipContextFromLibrary(ship, reeferLibrary.pageContext),
        reeferLibrary: cloneReeferLibrary(reeferLibrary, this.storage.ports()),
      };
    }

    this.storage.applyReeferPageSnapshot(entry.reeferLibrary, entry.ship);
    this.loaded.set(structuredClone(entry));
    return true;
  }

  reset(): void {
    if (this.liveBackup) {
      this.storage.applyReeferPageSnapshot(this.liveBackup.reeferLibrary, this.liveBackup.ship);
      this.liveBackup = null;
    }
    this.loaded.set(null);
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
    const ctx = this.storage.reeferLibrary().pageContext;
    const voy = ship.voyageNumber?.trim() || '—';
    const dep = ctx.dateOfDeparture?.trim();
    const depLabel = dep ? formatIsoDateLabel(dep) : 'no date';
    return `Voy ${voy} · ${depLabel}`;
  }

  private readEntries(): ReeferPageSnapshot[] {
    try {
      const raw = localStorage.getItem(REEFER_PAGE_ARCHIVE_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return this.sortNewestFirst(
        parsed
          .map((item) => this.normalizeEntry(item))
          .filter((e): e is ReeferPageSnapshot => e != null),
      );
    } catch {
      return [];
    }
  }

  private writeEntries(): void {
    localStorage.setItem(REEFER_PAGE_ARCHIVE_STORAGE_KEY, JSON.stringify(this.entries()));
  }

  private normalizeEntry(raw: unknown): ReeferPageSnapshot | null {
    if (!raw || typeof raw !== 'object') return null;
    const o = raw as Record<string, unknown>;
    const id = String(o['id'] ?? '').trim();
    const label = String(o['label'] ?? '').trim();
    const savedAt = String(o['savedAt'] ?? '').trim();
    const shipRaw = o['ship'];
    const libRaw = o['reeferLibrary'];
    if (!id || !label || !shipRaw || typeof shipRaw !== 'object' || !libRaw) return null;
    const shipObj = shipRaw as Record<string, unknown>;
    const ship: ReeferPageShipContext = {
      voyageNumber: String(shipObj['voyageNumber'] ?? '').trim(),
      portOfCall: String(shipObj['portOfCall'] ?? '').trim(),
      dateOfDeparture: String(shipObj['dateOfDeparture'] ?? '').trim(),
    };
    return {
      id,
      label,
      savedAt: savedAt || new Date().toISOString(),
      ship,
      reeferLibrary: normalizeReeferLibrary(libRaw as ReeferLibrarySettings),
    };
  }

  private sortNewestFirst(list: ReeferPageSnapshot[]): ReeferPageSnapshot[] {
    return [...list].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }
}

function cloneReeferLibrary(lib: ReeferLibrarySettings, ports: readonly Port[]): ReeferLibrarySettings {
  return normalizeReeferLibrary(structuredClone(lib), ports);
}

function formatIsoDateLabel(iso: string): string {
  const m = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mon = months[parseInt(m[2], 10) - 1] ?? m[2];
  return `${m[3]} ${mon} ${m[1]}`;
}

/** @deprecated Use reeferPageShipContextFromLibrary */
export function shipContextFromShip(ship: ShipInfo): ReeferPageShipContext {
  return {
    voyageNumber: ship.voyageNumber?.trim() ?? '',
    portOfCall: ship.portOfCall?.trim() ?? '',
    dateOfDeparture: ship.dateOfDeparture?.trim() ?? '',
  };
}
