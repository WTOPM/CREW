// Feature store for document output configuration: per-document stamp/signature overlay
// prefs, the bulk stamp toggle, ship stamp/signature assets, output (folder/printer)
// settings, custom uploaded documents, and per-port print packages (authorities + items).
//
// State is shared via AppStateStore. Read selectors (documentOverlay, shipAssets,
// outputSettings, printPackages, customDocuments) stay on StorageService for backward
// compatibility; this store owns the mutations.

import { Injectable, inject } from '@angular/core';
import {
  AppData,
  DocumentOverlayId,
  DocumentOverlayPrefs,
  DocumentStampOptions,
  PortPackage,
  PortAuthority,
  PortPackageItem,
} from '../models/crew.models';
import {
  crewListVariantPatch,
  CREW_LIST_TYPE_IDS,
  getCrewListVariantSettings,
  CrewListOverlayUpdate,
} from '../models/document-overlay.models';
import { normalizeOutputSettings } from './app-data-normalizer';
import { AppStateStore } from './app-state.store';

@Injectable({ providedIn: 'root' })
export class DocumentSettingsStore {
  private readonly state = inject(AppStateStore);
  private readonly data = this.state.data;

  updateDocumentOverlay(
    documentId: DocumentOverlayId,
    partial: Partial<DocumentOverlayPrefs[DocumentOverlayId]>,
    notify: 'silent' | 'saved' = 'silent',
  ): void {
    if (documentId === 'crewList') {
      this.updateCrewListOverlay(
        partial as Partial<AppData['documentOverlay']['crewList']>,
        notify,
      );
      return;
    }
    this.data.update((d) => ({
      ...d,
      documentOverlay: {
        ...d.documentOverlay,
        [documentId]: { ...d.documentOverlay[documentId], ...partial },
      },
    }));
    void this.state.persist(notify);
  }

  private updateCrewListOverlay(
    partial: CrewListOverlayUpdate,
    notify: 'silent' | 'saved' = 'silent',
  ): void {
    const variantPatch = crewListVariantPatch(partial);

    this.data.update((d) => {
      const current = d.documentOverlay.crewList;
      const nextListType = partial.listType ?? current.listType;
      const byType = { ...current.byType };

      if (variantPatch) {
        const activeType = current.listType;
        byType[activeType] = {
          ...getCrewListVariantSettings(current, activeType),
          ...variantPatch,
        };
      }

      return {
        ...d,
        documentOverlay: {
          ...d.documentOverlay,
          crewList: { listType: nextListType, byType },
        },
      };
    });
    void this.state.persist(notify);
  }

  /** Apply stamp/signature toggles to all document types at once. */
  applyStampTogglesToAllDocuments(useStamp: boolean, useSignature: boolean): void {
    const patch: Pick<
      DocumentStampOptions,
      'useStamp' | 'useSignature' | 'useStampAttachment' | 'useSignatureAttachment'
    > = {
      useStamp,
      useSignature,
      useStampAttachment: useStamp,
      useSignatureAttachment: useSignature,
    };
    this.data.update((d) => {
      const crewList = d.documentOverlay.crewList;
      const byType = { ...crewList.byType };
      for (const id of CREW_LIST_TYPE_IDS) {
        byType[id] = { ...getCrewListVariantSettings(crewList, id), ...patch };
      }
      return {
        ...d,
        documentOverlay: {
          crewList: { ...crewList, byType },
          pax: { ...d.documentOverlay.pax, ...patch },
          paxV2: { ...d.documentOverlay.paxV2, ...patch },
          portOfCall: { ...d.documentOverlay.portOfCall, ...patch },
          portsOfCall: { ...d.documentOverlay.portsOfCall, ...patch },
          mdh: { ...d.documentOverlay.mdh, ...patch },
          crewVaccine: { ...d.documentOverlay.crewVaccine, ...patch },
          shipStores: { ...d.documentOverlay.shipStores, ...patch },
          shipStores02: { ...d.documentOverlay.shipStores02, ...patch },
          shipStores03: { ...d.documentOverlay.shipStores03, ...patch },
          crewEffect: { ...d.documentOverlay.crewEffect, ...patch },
          crewEffect02: { ...d.documentOverlay.crewEffect02, ...patch },
          crewEffect03: { ...d.documentOverlay.crewEffect03, ...patch },
          nilList: { ...d.documentOverlay.nilList, ...patch },
          shipMoney: { ...d.documentOverlay.shipMoney, ...patch },
          cashAdvance: { ...d.documentOverlay.cashAdvance, ...patch },
          crewMoney: { ...d.documentOverlay.crewMoney, ...patch },
          narcoticList: { ...d.documentOverlay.narcoticList, ...patch },
          sso0108PortCalls: { ...d.documentOverlay.sso0108PortCalls, ...patch },
        },
      };
    });
    void this.state.persist('silent');
  }

  updateShipAssets(partial: Partial<AppData['shipAssets']>): void {
    this.data.update((d) => ({
      ...d,
      shipAssets: { ...d.shipAssets, ...partial },
    }));
    void this.state.persist('silent');
  }

  updateOutputSettings(
    partial: Partial<AppData['outputSettings']>,
    notify: 'silent' | 'saved' = 'silent',
  ): void {
    this.data.update((d) => ({
      ...d,
      outputSettings: normalizeOutputSettings({ ...d.outputSettings, ...partial }),
    }));
    void this.state.persist(notify);
  }

  /** Remember a folder path and make it the active output target. */
  addSavedPath(path: string): void {
    const p = path.trim();
    if (!p) return;
    this.data.update((d) => ({
      ...d,
      outputSettings: normalizeOutputSettings({
        ...d.outputSettings,
        activePath: p,
        // Newest first, keep only the last 5 (normalize caps to 5).
        savedPaths: [p, ...d.outputSettings.savedPaths.filter((x) => x !== p)],
      }),
    }));
    void this.state.persist('saved');
  }

  removeSavedPath(path: string): void {
    this.data.update((d) => {
      const savedPaths = d.outputSettings.savedPaths.filter((p) => p !== path);
      const activePath = d.outputSettings.activePath === path ? '' : d.outputSettings.activePath;
      return {
        ...d,
        outputSettings: normalizeOutputSettings({
          ...d.outputSettings,
          activePath,
          savedPaths,
        }),
      };
    });
    void this.state.persist('silent');
  }

  setPrinterName(printerName: string): void {
    this.updateOutputSettings({ printerName });
  }

  addCustomDocument(name: string, dataBase64: string): void {
    const n = name.trim();
    if (!n || !dataBase64) return;
    this.data.update((d) => ({
      ...d,
      customDocuments: [...d.customDocuments, { id: crypto.randomUUID(), name: n, dataBase64 }],
    }));
    void this.state.persist('saved');
  }

  removeCustomDocument(id: string): void {
    this.data.update((d) => ({
      ...d,
      customDocuments: d.customDocuments.filter((doc) => doc.id !== id),
    }));
    void this.state.persist('silent');
  }

  /** Create an empty package for a port if it doesn't exist yet. */
  upsertPortPackage(port: string): void {
    const p = port.trim();
    if (!p) return;
    this.data.update((d) => {
      if (d.printPackages.some((pkg) => pkg.port === p)) return d;
      return { ...d, printPackages: [...d.printPackages, { port: p, authorities: [] }] };
    });
    void this.state.persist('saved');
  }

  removePortPackage(port: string): void {
    this.data.update((d) => ({
      ...d,
      printPackages: d.printPackages.filter((pkg) => pkg.port !== port),
    }));
    void this.state.persist('silent');
  }

  addAuthority(port: string, name = 'New authority'): void {
    this.mutatePackage(port, (pkg) => ({
      ...pkg,
      authorities: [...pkg.authorities, { name, items: [], includeInPrint: true }],
    }));
  }

  removeAuthority(port: string, authIndex: number): void {
    this.mutatePackage(port, (pkg) => ({
      ...pkg,
      authorities: pkg.authorities.filter((_, i) => i !== authIndex),
    }));
  }

  renameAuthority(port: string, authIndex: number, name: string): void {
    this.mutateAuthority(port, authIndex, (a) => ({ ...a, name }));
  }

  setAuthorityIncludeInPrint(port: string, authIndex: number, includeInPrint: boolean): void {
    this.mutateAuthority(port, authIndex, (a) => ({ ...a, includeInPrint }));
  }

  setAuthorityItems(port: string, authIndex: number, items: PortPackageItem[]): void {
    this.mutateAuthority(port, authIndex, (a) => ({ ...a, items: items.map((it) => ({ ...it })) }));
  }

  private mutatePackage(port: string, fn: (pkg: PortPackage) => PortPackage): void {
    this.data.update((d) => ({
      ...d,
      printPackages: d.printPackages.map((pkg) => (pkg.port === port ? fn(pkg) : pkg)),
    }));
    void this.state.persist('silent');
  }

  private mutateAuthority(
    port: string,
    authIndex: number,
    fn: (a: PortAuthority) => PortAuthority,
  ): void {
    this.mutatePackage(port, (pkg) => ({
      ...pkg,
      authorities: pkg.authorities.map((a, i) => (i === authIndex ? fn(a) : a)),
    }));
  }
}
