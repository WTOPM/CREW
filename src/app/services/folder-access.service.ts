import { Injectable, signal } from '@angular/core';
import type { OutputFolderSection } from '../models/crew.models';
import { OUTPUT_FOLDER_SECTIONS } from '../models/crew.models';
import { sanitizePathSegment } from '../utils/package-save-path.util';

export interface SavedFolder {
  id: string;
  name: string;
}

interface StoredFolder extends SavedFolder {
  handle: FileSystemDirectoryHandle;
}

interface SectionState {
  activeId: string;
  folders: SavedFolder[];
}

interface SectionStoredState {
  activeId: string;
  folders: StoredFolder[];
}

interface StoredStateV2 {
  version: 2;
  bySection: Record<OutputFolderSection, SectionStoredState>;
}

/** Legacy flat IndexedDB shape (pre per-tab folders). */
interface StoredStateV1 {
  activeId: string;
  folders: StoredFolder[];
}

type StoredState = StoredStateV1 | StoredStateV2;

const MAX_FOLDERS = 5;

function emptySectionState(): SectionState {
  return { activeId: '', folders: [] };
}

function emptyBySection(): Record<OutputFolderSection, SectionState> {
  return {
    home: emptySectionState(),
    dg: emptySectionState(),
    reefer: emptySectionState(),
  };
}

/**
 * Browser folder saving via the File System Access API (Chrome/Edge).
 *
 * A website cannot write to a typed path (e.g. C:\CREW) — the browser forbids it.
 * Instead the user picks folders through a native dialog; the granted handles let
 * us write PDFs straight into them. Up to 5 folders per tab (Home / DG / Reefer)
 * are remembered in IndexedDB.
 */
@Injectable({ providedIn: 'root' })
export class FolderAccessService {
  /** Folder list shown in the header dropdown for the active tab (newest first). */
  readonly folders = signal<SavedFolder[]>([]);
  readonly activeId = signal<string>('');

  private section: OutputFolderSection = 'home';
  private readonly bySection = emptyBySection();

  /** id -> live handle (kept out of the signal; not template-serialisable). */
  private readonly handles = new Map<string, FileSystemDirectoryHandle>();

  private static readonly DB = 'crew-fs';
  private static readonly STORE = 'handles';
  private static readonly KEY = 'output-dirs';

  get supported(): boolean {
    return (
      typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker ===
      'function'
    );
  }

  /** Switch which tab's folder list is shown in the header. */
  setSection(section: OutputFolderSection): void {
    this.section = section;
    this.publishSection(section);
  }

  hasFolder(): boolean {
    return !!this.activeId() && this.handles.has(this.activeId());
  }

  activeName(): string {
    return this.folders().find((f) => f.id === this.activeId())?.name ?? '';
  }

  /** Prompt the user to add a folder. Returns its name, or null if cancelled. */
  async pick(): Promise<string | null> {
    if (!this.supported) return null;
    const picker = (
      window as unknown as {
        showDirectoryPicker: (opts?: { mode?: string }) => Promise<FileSystemDirectoryHandle>;
      }
    ).showDirectoryPicker;
    const handle = await picker({ mode: 'readwrite' });

    const bucket = this.bySection[this.section];
    let entry: SavedFolder | undefined = bucket.folders.find((f) => f.name === handle.name);
    if (!entry) {
      entry = { id: crypto.randomUUID(), name: handle.name };
    }
    const selected = entry;
    this.handles.set(selected.id, handle);

    const nextFolders = [selected, ...bucket.folders.filter((f) => f.id !== selected.id)].slice(
      0,
      MAX_FOLDERS,
    );
    this.bySection[this.section] = { activeId: selected.id, folders: nextFolders };
    this.pruneOrphanHandles();
    this.publishSection(this.section);
    await this.persist();
    return selected.name;
  }

  setActive(id: string): void {
    const bucket = this.bySection[this.section];
    if (bucket.folders.some((f) => f.id === id)) {
      this.bySection[this.section] = { ...bucket, activeId: id };
      this.publishSection(this.section);
      void this.persist();
    }
  }

  async remove(id: string): Promise<void> {
    const bucket = this.bySection[this.section];
    const nextFolders = bucket.folders.filter((f) => f.id !== id);
    const activeId = bucket.activeId === id ? (nextFolders[0]?.id ?? '') : bucket.activeId;
    this.bySection[this.section] = { activeId, folders: nextFolders };
    this.pruneOrphanHandles();
    this.publishSection(this.section);
    await this.persist();
  }

  /** Reload saved folders + handles (call once on startup). */
  async restore(): Promise<void> {
    try {
      const state = await this.load();
      if (!state) return;
      this.handles.clear();
      const bySection = this.normalizeStored(state);
      for (const section of OUTPUT_FOLDER_SECTIONS) {
        this.bySection[section] = {
          activeId: bySection[section].activeId,
          folders: bySection[section].folders.map(({ id, name }) => ({ id, name })),
        };
        for (const f of bySection[section].folders) {
          this.handles.set(f.id, f.handle);
        }
      }
      this.publishSection(this.section);
    } catch {
      /* ignore */
    }
  }

  /** Does a file with this name already exist in the active folder (optional subdir). */
  async fileExists(fileName: string, subdir?: string): Promise<boolean> {
    const root = this.handles.get(this.activeId());
    if (!root) return false;
    try {
      const dir = await this.resolveDir(root, subdir, false);
      if (!dir) return false;
      await dir.getFileHandle(fileName);
      return true;
    } catch {
      return false;
    }
  }

  /** Write bytes into the active folder (optional authority subdir); returns path label. */
  async write(fileName: string, bytes: Uint8Array, subdir?: string): Promise<string> {
    const root = this.handles.get(this.activeId());
    if (!root) throw new Error('No folder selected');
    if (!(await this.ensurePermission(root))) throw new Error('Folder permission denied');
    const dir = await this.resolveDir(root, subdir, true);
    if (!dir) throw new Error('Could not open output folder');
    const fileHandle = await dir.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(new Blob([bytes.slice()], { type: 'application/pdf' }));
    await writable.close();
    const folderLabel = subdir?.trim()
      ? `${root.name}/${sanitizePathSegment(subdir)}`
      : root.name;
    return `${folderLabel}/${fileName}`;
  }

  private publishSection(section: OutputFolderSection): void {
    const bucket = this.bySection[section];
    this.folders.set(bucket.folders.map(({ id, name }) => ({ id, name })));
    this.activeId.set(bucket.activeId);
  }

  private pruneOrphanHandles(): void {
    const keep = new Set<string>();
    for (const section of OUTPUT_FOLDER_SECTIONS) {
      for (const f of this.bySection[section].folders) keep.add(f.id);
    }
    for (const id of [...this.handles.keys()]) {
      if (!keep.has(id)) this.handles.delete(id);
    }
  }

  private normalizeStored(state: StoredState): Record<OutputFolderSection, SectionStoredState> {
    const out: Record<OutputFolderSection, SectionStoredState> = {
      home: { activeId: '', folders: [] },
      dg: { activeId: '', folders: [] },
      reefer: { activeId: '', folders: [] },
    };
    if ('version' in state && state.version === 2) {
      for (const section of OUTPUT_FOLDER_SECTIONS) {
        const bucket = state.bySection?.[section];
        out[section] = {
          activeId: bucket?.activeId ?? '',
          folders: Array.isArray(bucket?.folders) ? bucket.folders.slice(0, MAX_FOLDERS) : [],
        };
      }
      return out;
    }
    // Migrate legacy flat list into Home.
    const legacy = state as StoredStateV1;
    out.home = {
      activeId: legacy.activeId ?? '',
      folders: Array.isArray(legacy.folders) ? legacy.folders.slice(0, MAX_FOLDERS) : [],
    };
    return out;
  }

  private async persist(): Promise<void> {
    const bySection: Record<OutputFolderSection, SectionStoredState> = {
      home: { activeId: '', folders: [] },
      dg: { activeId: '', folders: [] },
      reefer: { activeId: '', folders: [] },
    };
    for (const section of OUTPUT_FOLDER_SECTIONS) {
      const bucket = this.bySection[section];
      bySection[section] = {
        activeId: bucket.activeId,
        folders: bucket.folders.flatMap((f) => {
          const handle = this.handles.get(f.id);
          return handle ? [{ ...f, handle }] : [];
        }),
      };
    }
    const state: StoredStateV2 = { version: 2, bySection };
    const db = await this.openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(FolderAccessService.STORE, 'readwrite');
      tx.objectStore(FolderAccessService.STORE).put(state, FolderAccessService.KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }

  private async resolveDir(
    root: FileSystemDirectoryHandle,
    subdir: string | undefined,
    create: boolean,
  ): Promise<FileSystemDirectoryHandle | null> {
    if (!subdir?.trim()) return root;
    const name = sanitizePathSegment(subdir);
    try {
      return await root.getDirectoryHandle(name, create ? { create: true } : undefined);
    } catch {
      return null;
    }
  }

  private async ensurePermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
    const h = handle as unknown as {
      queryPermission: (o: { mode: string }) => Promise<PermissionState>;
      requestPermission: (o: { mode: string }) => Promise<PermissionState>;
    };
    const opts = { mode: 'readwrite' };
    if ((await h.queryPermission(opts)) === 'granted') return true;
    return (await h.requestPermission(opts)) === 'granted';
  }

  // ---- IndexedDB persistence ----

  private openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(FolderAccessService.DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(FolderAccessService.STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  private async load(): Promise<StoredState | null> {
    const db = await this.openDb();
    const state = await new Promise<StoredState | null>((resolve, reject) => {
      const tx = db.transaction(FolderAccessService.STORE, 'readonly');
      const req = tx.objectStore(FolderAccessService.STORE).get(FolderAccessService.KEY);
      req.onsuccess = () => resolve((req.result as StoredState | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return state;
  }
}
