import { Injectable, inject } from '@angular/core';
import { StorageService } from './storage.service';

const IDB_NAME = 'crew-signatures';
const IDB_STORE = 'signatures';
const IDB_VERSION = 1;

const ACCEPT = 'image/png,image/jpeg,.png,.jpg,.jpeg,application/pdf,.pdf';

@Injectable({ providedIn: 'root' })
export class CrewSignatureService {
  private readonly storage = inject(StorageService);
  private idb: IDBDatabase | null = null;

  isElectron(): boolean {
    return !!window.electronAPI?.readCrewSignature;
  }

  async saveFromFile(crewId: string, file: File): Promise<void> {
    if (!this.isAllowedFile(file)) {
      throw new Error('Use PNG, JPEG, or PDF');
    }
    const buf = await file.arrayBuffer();
    await this.saveBytes(crewId, new Uint8Array(buf), file.name);
  }

  async pickAndSave(crewId: string): Promise<boolean> {
    const api = window.electronAPI;
    if (api?.pickCrewSignatureFile) {
      const path = await api.pickCrewSignatureFile();
      if (!path) return false;
      const result = await api.saveCrewSignatureFromPath(crewId, path);
      this.storage.setCrewSignatureAttached(crewId, true, result.fileName);
      return true;
    }
    const file = await this.pickInBrowser();
    if (!file) return false;
    await this.saveFromFile(crewId, file);
    return true;
  }

  async loadBytes(crewId: string): Promise<Uint8Array | null> {
    const api = window.electronAPI;
    if (api?.readCrewSignature) {
      const b64 = await api.readCrewSignature(crewId);
      if (!b64) return null;
      return base64ToBytes(b64);
    }
    const buf = await this.idbGet(crewId);
    return buf ? new Uint8Array(buf) : null;
  }

  async hasSignature(crewId: string): Promise<boolean> {
    const api = window.electronAPI;
    if (api?.crewSignatureExists) return api.crewSignatureExists(crewId);
    const buf = await this.idbGet(crewId);
    return !!buf;
  }

  async remove(crewId: string): Promise<void> {
    const api = window.electronAPI;
    if (api?.deleteCrewSignature) await api.deleteCrewSignature(crewId);
    await this.idbDelete(crewId);
    this.storage.setCrewSignatureAttached(crewId, false, '');
  }

  async deleteForCrew(crewId: string): Promise<void> {
    await this.remove(crewId);
  }

  private async saveBytes(crewId: string, bytes: Uint8Array, fileName: string): Promise<void> {
    const api = window.electronAPI;
    const b64 = bytesToBase64(bytes);
    if (api?.saveCrewSignatureBytes) {
      const result = await api.saveCrewSignatureBytes(crewId, b64, fileName);
      this.storage.setCrewSignatureAttached(crewId, true, result.fileName);
      return;
    }
    await this.idbPut(crewId, bytes.slice().buffer);
    this.storage.setCrewSignatureAttached(crewId, true, fileName);
  }

  private isAllowedFile(file: File): boolean {
    const name = file.name.toLowerCase();
    if (name.endsWith('.pdf') || file.type === 'application/pdf') return true;
    if (name.endsWith('.png') || file.type === 'image/png') return true;
    if (name.endsWith('.jpg') || name.endsWith('.jpeg') || file.type === 'image/jpeg') return true;
    return false;
  }

  pickInBrowser(): Promise<File | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = ACCEPT;
      input.onchange = () => resolve(input.files?.[0] ?? null);
      input.click();
    });
  }

  private async idbOpen(): Promise<IDBDatabase> {
    if (this.idb) return this.idb;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        this.idb = req.result;
        resolve(req.result);
      };
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
    });
  }

  private async idbPut(key: string, value: ArrayBuffer): Promise<void> {
    const db = await this.idbOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  private async idbGet(key: string): Promise<ArrayBuffer | undefined> {
    const db = await this.idbOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve(req.result as ArrayBuffer | undefined);
      req.onerror = () => reject(req.error);
    });
  }

  private async idbDelete(key: string): Promise<void> {
    const db = await this.idbOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
