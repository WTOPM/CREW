import { Injectable, signal } from '@angular/core';

export interface SavedFolder {
  id: string;
  name: string;
}

interface StoredFolder extends SavedFolder {
  handle: FileSystemDirectoryHandle;
}

interface StoredState {
  activeId: string;
  folders: StoredFolder[];
}

const MAX_FOLDERS = 5;

/**
 * Browser folder saving via the File System Access API (Chrome/Edge).
 *
 * A website cannot write to a typed path (e.g. C:\CREW) — the browser forbids it.
 * Instead the user picks folders through a native dialog; the granted handles let
 * us write PDFs straight into them. Up to 5 folders are remembered (with their
 * handles) in IndexedDB so the choices survive reloads; permission is re-confirmed
 * on the next save, which always happens inside a user click.
 */
@Injectable({ providedIn: 'root' })
export class FolderAccessService {
  /** Folder list shown in the header dropdown (newest first). */
  readonly folders = signal<SavedFolder[]>([]);
  readonly activeId = signal<string>('');

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

    // Reuse an existing entry with the same name, else create one.
    let entry = this.folders().find((f) => f.name === handle.name);
    if (!entry) {
      entry = { id: crypto.randomUUID(), name: handle.name };
    }
    this.handles.set(entry.id, handle);

    const next = [entry, ...this.folders().filter((f) => f.id !== entry!.id)].slice(0, MAX_FOLDERS);
    // Drop handles that fell off the end.
    for (const id of [...this.handles.keys()]) {
      if (!next.some((f) => f.id === id)) this.handles.delete(id);
    }
    this.folders.set(next);
    this.activeId.set(entry.id);
    await this.persist();
    return entry.name;
  }

  setActive(id: string): void {
    if (this.folders().some((f) => f.id === id)) {
      this.activeId.set(id);
      void this.persist();
    }
  }

  async remove(id: string): Promise<void> {
    this.handles.delete(id);
    const next = this.folders().filter((f) => f.id !== id);
    this.folders.set(next);
    if (this.activeId() === id) this.activeId.set(next[0]?.id ?? '');
    await this.persist();
  }

  /** Reload saved folders + handles (call once on startup). */
  async restore(): Promise<void> {
    try {
      const state = await this.load();
      if (!state) return;
      this.handles.clear();
      for (const f of state.folders) this.handles.set(f.id, f.handle);
      this.folders.set(state.folders.map(({ id, name }) => ({ id, name })));
      this.activeId.set(state.activeId);
    } catch {
      /* ignore */
    }
  }

  /** Does a file with this name already exist in the active folder? */
  async fileExists(fileName: string): Promise<boolean> {
    const handle = this.handles.get(this.activeId());
    if (!handle) return false;
    try {
      await handle.getFileHandle(fileName);
      return true;
    } catch {
      return false;
    }
  }

  /** Write bytes into the active folder; returns "<folder>/<file>". */
  async write(fileName: string, bytes: Uint8Array): Promise<string> {
    const handle = this.handles.get(this.activeId());
    if (!handle) throw new Error('No folder selected');
    if (!(await this.ensurePermission(handle))) throw new Error('Folder permission denied');
    const fileHandle = await handle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(new Blob([bytes.slice()], { type: 'application/pdf' }));
    await writable.close();
    return `${handle.name}/${fileName}`;
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

  private async persist(): Promise<void> {
    const folders: StoredFolder[] = this.folders().flatMap((f) => {
      const handle = this.handles.get(f.id);
      return handle ? [{ ...f, handle }] : [];
    });
    const state: StoredState = { activeId: this.activeId(), folders };
    const db = await this.openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(FolderAccessService.STORE, 'readwrite');
      tx.objectStore(FolderAccessService.STORE).put(state, FolderAccessService.KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }

  private async load(): Promise<StoredState | null> {
    const db = await this.openDb();
    const state = await new Promise<StoredState | null>((resolve, reject) => {
      const tx = db.transaction(FolderAccessService.STORE, 'readonly');
      const req = tx.objectStore(FolderAccessService.STORE).get(FolderAccessService.KEY);
      req.onsuccess = () => resolve((req.result as StoredState) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return state;
  }
}
