import { Injectable, inject } from '@angular/core';
import { CrewDocumentType } from '../models/crew.models';
import { openPdfBlobPreview } from '../utils/pdf-blob.util';
import { CrewStore } from './crew.store';
import { PassengerStore } from './passenger.store';

const IDB_NAME = 'crew-documents';
const IDB_STORE = 'pdfs';
const IDB_VERSION = 1;

export type DocumentOwner = 'crew' | 'passenger';

function storageKey(memberId: string, docType: CrewDocumentType): string {
  return `${memberId}:${docType}`;
}

@Injectable({ providedIn: 'root' })
export class CrewDocumentService {
  private readonly crew = inject(CrewStore);
  private readonly passengers = inject(PassengerStore);
  private idb: IDBDatabase | null = null;

  isElectron(): boolean {
    return !!window.electronAPI;
  }

  async attachFromFile(
    memberId: string,
    docType: CrewDocumentType,
    file: File,
    owner: DocumentOwner = 'crew',
  ): Promise<void> {
    const name = file.name.toLowerCase();
    if (!name.endsWith('.pdf') && file.type !== 'application/pdf') {
      throw new Error('Only PDF files are supported');
    }
    this.assertOwnerDocType(owner, docType);
    const buf = await file.arrayBuffer();
    await this.saveBytes(memberId, docType, buf, owner);
  }

  async attachFromPath(
    memberId: string,
    docType: CrewDocumentType,
    sourcePath: string,
    owner: DocumentOwner = 'crew',
  ): Promise<void> {
    this.assertOwnerDocType(owner, docType);
    const api = window.electronAPI;
    if (!api) throw new Error('File path attach works in desktop app only');
    await api.saveCrewPdf(memberId, docType, sourcePath);
    this.setAttachedFlag(memberId, docType, true, owner);
  }

  async pickAndAttach(
    memberId: string,
    docType: CrewDocumentType,
    owner: DocumentOwner = 'crew',
  ): Promise<boolean> {
    this.assertOwnerDocType(owner, docType);
    const api = window.electronAPI;
    if (api) {
      const path = await api.pickPdfFile();
      if (!path) return false;
      await this.attachFromPath(memberId, docType, path, owner);
      return true;
    }
    const file = await this.pickPdfInBrowser();
    if (!file) return false;
    await this.attachFromFile(memberId, docType, file, owner);
    return true;
  }

  async loadPdfBytes(memberId: string, docType: CrewDocumentType): Promise<Uint8Array | null> {
    const api = window.electronAPI;
    if (api) {
      const b64 = await api.readCrewPdf(memberId, docType);
      if (!b64) return null;
      return base64ToBytes(b64);
    }
    const buf = await this.idbGet(storageKey(memberId, docType));
    return buf ? new Uint8Array(buf) : null;
  }

  async hasPdf(memberId: string, docType: CrewDocumentType): Promise<boolean> {
    const api = window.electronAPI;
    if (api) return api.crewPdfExists(memberId, docType);
    const buf = await this.idbGet(storageKey(memberId, docType));
    return !!buf;
  }

  async remove(
    memberId: string,
    docType: CrewDocumentType,
    owner: DocumentOwner = 'crew',
  ): Promise<void> {
    this.assertOwnerDocType(owner, docType);
    const api = window.electronAPI;
    if (api) await api.deleteCrewPdf(memberId, docType);
    await this.idbDelete(storageKey(memberId, docType));
    this.setAttachedFlag(memberId, docType, false, owner);
  }

  async deleteAllForCrew(crewId: string): Promise<void> {
    const api = window.electronAPI;
    if (api) await api.deleteCrewDocuments(crewId);
    for (const type of ['passport', 'seamansBook', 'cyprusPassport'] as CrewDocumentType[]) {
      await this.idbDelete(storageKey(crewId, type));
    }
  }

  /** Passenger scans are passport-only. */
  async deletePassportForPassenger(passengerId: string): Promise<void> {
    const api = window.electronAPI;
    if (api) await api.deleteCrewPdf(passengerId, 'passport');
    await this.idbDelete(storageKey(passengerId, 'passport'));
  }

  /** Opens scan in a new browser window (same as Crew List PDF). */
  async openPreview(memberId: string, docType: CrewDocumentType): Promise<boolean> {
    const bytes = await this.loadPdfBytes(memberId, docType);
    if (!bytes?.length) return false;
    return openPdfBlobPreview(bytes);
  }

  private assertOwnerDocType(owner: DocumentOwner, docType: CrewDocumentType): void {
    if (owner === 'passenger' && docType !== 'passport') {
      throw new Error('Passengers only support passport scans');
    }
  }

  private setAttachedFlag(
    memberId: string,
    docType: CrewDocumentType,
    attached: boolean,
    owner: DocumentOwner,
  ): void {
    if (owner === 'passenger') {
      this.passengers.setPassengerPassportAttached(memberId, attached);
      return;
    }
    this.crew.setCrewDocumentAttached(memberId, docType, attached);
  }

  private async saveBytes(
    memberId: string,
    docType: CrewDocumentType,
    buffer: ArrayBuffer,
    owner: DocumentOwner,
  ): Promise<void> {
    const api = window.electronAPI;
    const b64 = bytesToBase64(new Uint8Array(buffer));
    if (api) {
      await api.saveCrewPdfBytes(memberId, docType, b64);
    } else {
      await this.idbPut(storageKey(memberId, docType), buffer);
    }
    this.setAttachedFlag(memberId, docType, true, owner);
  }

  pickPdfInBrowser(): Promise<File | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/pdf,.pdf';
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
