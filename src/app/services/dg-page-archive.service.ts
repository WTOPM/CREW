import { Injectable, computed, inject, signal } from '@angular/core';
import {
  DG_PAGE_ARCHIVE_STORAGE_KEY,
  type DgPageLiveBackup,
  type DgPageShipContext,
  type DgPageSnapshot,
} from '../models/dg-page-archive.models';
import { normalizeDgLibrary, type DgLibrarySettings } from '../models/dg-manifest.models';
import type { Port, ShipInfo } from '../models/crew.models';
import { StorageService } from './storage.service';

@Injectable({ providedIn: 'root' })
export class DgPageArchiveService {
  private readonly storage = inject(StorageService);

  readonly entries = signal<DgPageSnapshot[]>(this.readEntries());
  readonly entriesNewestFirst = computed(() => this.sortNewestFirst(this.entries()));
  readonly loaded = signal<DgPageSnapshot | null>(null);
  readonly saving = signal(false);

  private liveBackup: DgPageLiveBackup | null = null;

  save(label: string): DgPageSnapshot | null {
    const trimmed = label.trim();
    if (!trimmed) return null;

    this.saving.set(true);
    try {
      const entry: DgPageSnapshot = {
        id: crypto.randomUUID(),
        label: trimmed,
        savedAt: new Date().toISOString(),
        ship: shipContextFromShip(this.storage.ship()),
        dgLibrary: cloneDgLibrary(this.storage.dgLibrary(), this.storage.ports()),
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
      this.liveBackup = {
        ship: shipContextFromShip(this.storage.ship()),
        dgLibrary: cloneDgLibrary(this.storage.dgLibrary(), this.storage.ports()),
      };
    }

    this.storage.applyDgPageSnapshot(entry.dgLibrary, entry.ship);
    this.loaded.set(structuredClone(entry));
    return true;
  }

  reset(): void {
    if (this.liveBackup) {
      this.storage.applyDgPageSnapshot(this.liveBackup.dgLibrary, this.liveBackup.ship);
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
    const voy = ship.voyageNumber?.trim() || '—';
    const dep = ship.dateOfDeparture?.trim();
    const depLabel = dep ? formatIsoDateLabel(dep) : 'no date';
    return `Voy ${voy} · ${depLabel}`;
  }

  private readEntries(): DgPageSnapshot[] {
    try {
      const raw = localStorage.getItem(DG_PAGE_ARCHIVE_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return this.sortNewestFirst(
        parsed
          .map((item) => this.normalizeEntry(item))
          .filter((e): e is DgPageSnapshot => e != null),
      );
    } catch {
      return [];
    }
  }

  private writeEntries(): void {
    localStorage.setItem(DG_PAGE_ARCHIVE_STORAGE_KEY, JSON.stringify(this.entries()));
  }

  private normalizeEntry(raw: unknown): DgPageSnapshot | null {
    if (!raw || typeof raw !== 'object') return null;
    const o = raw as Record<string, unknown>;
    const id = String(o['id'] ?? '').trim();
    const label = String(o['label'] ?? '').trim();
    const savedAt = String(o['savedAt'] ?? '').trim();
    const shipRaw = o['ship'];
    const libRaw = o['dgLibrary'];
    if (!id || !label || !shipRaw || typeof shipRaw !== 'object' || !libRaw) return null;
    const shipObj = shipRaw as Record<string, unknown>;
    const ship: DgPageShipContext = {
      voyageNumber: String(shipObj['voyageNumber'] ?? '').trim(),
      portOfCall: String(shipObj['portOfCall'] ?? '').trim(),
      nextPortOfCall: String(shipObj['nextPortOfCall'] ?? '').trim(),
      dateOfDeparture: String(shipObj['dateOfDeparture'] ?? '').trim(),
    };
    return {
      id,
      label,
      savedAt: savedAt || new Date().toISOString(),
      ship,
      dgLibrary: normalizeDgLibrary(libRaw as DgLibrarySettings),
    };
  }

  private sortNewestFirst(list: DgPageSnapshot[]): DgPageSnapshot[] {
    return [...list].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }
}

export function shipContextFromShip(ship: ShipInfo): DgPageShipContext {
  return {
    voyageNumber: ship.voyageNumber?.trim() ?? '',
    portOfCall: ship.portOfCall?.trim() ?? '',
    nextPortOfCall: ship.nextPortOfCall?.trim() ?? '',
    dateOfDeparture: ship.dateOfDeparture?.trim() ?? '',
  };
}

function cloneDgLibrary(lib: DgLibrarySettings, ports: readonly Port[]): DgLibrarySettings {
  return normalizeDgLibrary(structuredClone(lib), undefined, ports);
}

function formatIsoDateLabel(iso: string): string {
  const m = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mon = months[parseInt(m[2], 10) - 1] ?? m[2];
  return `${m[3]} ${mon} ${m[1]}`;
}
