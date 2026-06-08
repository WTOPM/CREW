import { Injectable, computed, inject, signal } from '@angular/core';
import { PortPackage, PortPackageItem } from '../models/crew.models';
import {
  PACKAGE_ARCHIVE_STORAGE_KEY,
  PackageArchiveEntry,
  PackageArchivePdf,
} from '../models/package-archive.models';
import { uint8ToBase64 } from '../utils/base64.util';
import { DocumentCatalogService } from './document-catalog.service';
import { StorageService } from './storage.service';

/** Snapshots for the header package bar — stored separately from crew-data.json. */
@Injectable({ providedIn: 'root' })
export class PackageArchiveService {
  private readonly storage = inject(StorageService);
  private readonly catalog = inject(DocumentCatalogService);

  readonly entries = signal<PackageArchiveEntry[]>(this.readEntries());
  /** Newest snapshots first (for Load modal). */
  readonly entriesNewestFirst = computed(() => this.sortNewestFirst(this.entries()));
  /** When set, Open all / Print all use this snapshot instead of live package config. */
  readonly loaded = signal<PackageArchiveEntry | null>(null);
  readonly saving = signal(false);

  /** Live port package rows with a document id (ignores archive mode). */
  liveDocumentCount(): number {
    const port = this.storage.ship().portOfCall;
    const pkg = this.storage.printPackages().find((p) => p.port === port);
    return this.nonEmptyItems(pkg).length;
  }

  hasFrozenPdfs(entry: PackageArchiveEntry | null | undefined): boolean {
    return (entry?.documents?.length ?? 0) > 0;
  }

  async save(label: string): Promise<PackageArchiveEntry | null> {
    const trimmed = label.trim();
    if (!trimmed) return null;

    const ship = this.storage.ship();
    const port = ship.portOfCall;
    const live = this.storage.printPackages().find((p) => p.port === port);
    const items = this.nonEmptyItems(live);
    if (items.length === 0) return null;

    this.saving.set(true);
    try {
      const documents = await this.buildFrozenPdfs(items);
      if (documents.length === 0) return null;

      const entry: PackageArchiveEntry = {
        id: crypto.randomUUID(),
        label: trimmed,
        portName: port,
        arrivalDate: ship.dateOfArrival,
        savedAt: new Date().toISOString(),
        package: structuredClone(live ?? { port, authorities: [] }),
        documents,
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
    this.loaded.set(structuredClone(entry));
    return true;
  }

  reset(): void {
    this.loaded.set(null);
  }

  remove(id: string): void {
    this.entries.update((list) => list.filter((e) => e.id !== id));
    if (this.loaded()?.id === id) {
      this.loaded.set(null);
    }
    this.writeEntries();
  }

  private nonEmptyItems(pkg: PortPackage | undefined): PortPackageItem[] {
    return (pkg?.authorities ?? []).flatMap((a) => a.items).filter((it) => it.documentId.trim());
  }

  private enabledIds(): Set<string> {
    return new Set(this.catalog.available().filter((d) => d.enabled).map((d) => d.id));
  }

  private async buildFrozenPdfs(items: PortPackageItem[]): Promise<PackageArchivePdf[]> {
    const enabled = this.enabledIds();
    const copiesById = new Map<string, number>();
    const order: string[] = [];
    for (const item of items) {
      const id = item.documentId.trim();
      if (!enabled.has(id)) continue;
      if (!copiesById.has(id)) order.push(id);
      copiesById.set(id, (copiesById.get(id) ?? 0) + Math.max(1, item.copies));
    }

    const documents: PackageArchivePdf[] = [];
    for (const id of order) {
      const { bytes, fileName } = await this.catalog.buildBytes(id);
      documents.push({
        documentId: id,
        label: this.catalog.label(id),
        fileName,
        dataBase64: uint8ToBase64(bytes),
        copies: copiesById.get(id) ?? 1,
      });
    }
    return documents;
  }

  private readEntries(): PackageArchiveEntry[] {
    try {
      const raw = localStorage.getItem(PACKAGE_ARCHIVE_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return this.sortNewestFirst(
        parsed
          .map((item) => this.normalizeEntry(item))
          .filter((e): e is PackageArchiveEntry => e != null),
      );
    } catch {
      return [];
    }
  }

  private writeEntries(): void {
    localStorage.setItem(PACKAGE_ARCHIVE_STORAGE_KEY, JSON.stringify(this.entries()));
  }

  private normalizeEntry(raw: unknown): PackageArchiveEntry | null {
    if (!raw || typeof raw !== 'object') return null;
    const o = raw as Record<string, unknown>;
    const id = String(o['id'] ?? '').trim();
    const label = String(o['label'] ?? '').trim();
    const portName = String(o['portName'] ?? '').trim();
    const arrivalDate = String(o['arrivalDate'] ?? '');
    const savedAt = String(o['savedAt'] ?? '');
    const pkg = o['package'];
    if (!id || !label || !portName || !pkg || typeof pkg !== 'object') return null;
    const p = pkg as Record<string, unknown>;
    const authorities = Array.isArray(p['authorities']) ? p['authorities'] : [];
    const documents = this.normalizeDocuments(o['documents']);
    return {
      id,
      label,
      portName,
      arrivalDate,
      savedAt: savedAt || new Date().toISOString(),
      package: {
        port: String(p['port'] ?? portName),
        authorities: authorities.map((a) => {
          const auth = a as Record<string, unknown>;
          const items = Array.isArray(auth['items']) ? auth['items'] : [];
          return {
            name: String(auth['name'] ?? ''),
            items: items.map((it) => {
              const row = it as Record<string, unknown>;
              return {
                documentId: String(row['documentId'] ?? ''),
                copies: Math.max(1, Number(row['copies']) || 1),
              };
            }),
          };
        }),
      },
      documents,
    };
  }

  private sortNewestFirst(list: PackageArchiveEntry[]): PackageArchiveEntry[] {
    return [...list].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }

  private normalizeDocuments(raw: unknown): PackageArchivePdf[] {
    if (!Array.isArray(raw)) return [];
    const out: PackageArchivePdf[] = [];
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const documentId = String(row['documentId'] ?? '').trim();
      const dataBase64 = String(row['dataBase64'] ?? '').trim();
      if (!documentId || !dataBase64) continue;
      out.push({
        documentId,
        label: String(row['label'] ?? documentId),
        fileName: String(row['fileName'] ?? `${documentId}.pdf`),
        dataBase64,
        copies: Math.max(1, Number(row['copies']) || 1),
      });
    }
    return out;
  }
}
