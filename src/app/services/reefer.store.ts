// Feature store for the reefer (refrigerated container) domain: onboard units +
// import manifests, monitoring signers, view settings, and page-snapshot application.
//
// State is shared via AppStateStore. The `reeferLibrary` read selector stays on
// StorageService for backward compatibility; this store owns reefer mutations.

import { Injectable, inject } from '@angular/core';
import { resolveKnownPortName, resolveManifestPortName } from '../models/crew.models';
import {
  createReeferManifestDocument,
  createReeferOnboardUnit,
  findReeferManifestDuplicate,
  mergeReeferImportIntoOnboard,
  normalizeReeferLibrary,
  reeferUnitsFromImportRows,
  type ReeferLibrarySettings,
  type ReeferOnboardUnit,
} from '../models/reefer.models';
import type { ReeferImportResult } from './reefer-import.service';
import { resolveReeferPageContextFromSnapshot } from '../utils/page-ship-context.util';
import { AppStateStore } from './app-state.store';

@Injectable({ providedIn: 'root' })
export class ReeferStore {
  private readonly state = inject(AppStateStore);
  private readonly data = this.state.data;

  applyReeferPageSnapshot(
    reeferLibrary: ReeferLibrarySettings,
    shipCtx: import('../models/reefer-page-archive.models').ReeferPageShipContext,
  ): void {
    this.data.update((d) => {
      const lib = normalizeReeferLibrary(structuredClone(reeferLibrary), d.ports);
      const pageContext = resolveReeferPageContextFromSnapshot(lib.pageContext, shipCtx);
      return {
        ...d,
        reeferLibrary: { ...lib, pageContext },
      };
    });
    void this.state.persist('silent');
  }

  updateReeferViewSettings(
    partial: Partial<
      Pick<
        ReeferLibrarySettings,
        | 'showDischarged'
        | 'monitoringAddNextDays'
        | 'monitoringNextDays'
        | 'inventorySortColumn'
        | 'inventorySortDirection'
      >
    >,
  ): void {
    this.data.update((d) => ({
      ...d,
      reeferLibrary: { ...normalizeReeferLibrary(d.reeferLibrary, d.ports, d.ship), ...partial },
    }));
    void this.state.persist('silent');
  }

  updateReeferPageContext(
    partial: Partial<import('../utils/page-ship-context.util').ReeferPageContext>,
  ): void {
    this.data.update((d) => {
      const lib = normalizeReeferLibrary(d.reeferLibrary, d.ports, d.ship);
      return {
        ...d,
        reeferLibrary: {
          ...lib,
          pageContext: { ...lib.pageContext, ...partial },
        },
      };
    });
    void this.state.persist('silent');
  }

  updateReeferMonitoringSigner(
    which: 'morning' | 'evening',
    index: number,
    field: 'rank' | 'name',
    value: string,
  ): void {
    if (index < 0 || index >= 2) return;
    this.data.update((d) => {
      const lib = normalizeReeferLibrary(d.reeferLibrary, d.ports, d.ship);
      const key = which === 'morning' ? 'monitoringMorningSigners' : 'monitoringEveningSigners';
      const signers = lib[key].map((s, i) =>
        i === index ? { ...s, [field]: value } : s,
      );
      return {
        ...d,
        reeferLibrary: { ...lib, [key]: signers },
      };
    });
    void this.state.persist('silent');
  }

  updateReeferShowDischarged(showDischarged: boolean): void {
    this.updateReeferViewSettings({ showDischarged });
  }

  setReeferUnitStatus(unitId: string, status: 'onboard' | 'discharged'): void {
    this.updateReeferUnit(unitId, { status });
  }

  addReeferUnit(partial?: Partial<Omit<ReeferOnboardUnit, 'id' | 'sourceManifestId'>>): void {
    this.data.update((d) => {
      const lib = normalizeReeferLibrary(d.reeferLibrary, d.ports);
      const loadPort = resolveKnownPortName(partial?.loadPort ?? d.ship.portOfCall ?? '', d.ports);
      const dischargePort = resolveKnownPortName(
        partial?.dischargePort ?? d.ship.nextPortOfCall ?? '',
        d.ports,
      );
      return {
        ...d,
        reeferLibrary: {
          ...lib,
          onboard: [
            ...lib.onboard,
            createReeferOnboardUnit({
              ...partial,
              loadPort,
              dischargePort,
              sourceManifestId: '',
              status: 'onboard',
            }),
          ],
        },
      };
    });
    void this.state.persist('silent');
  }

  updateReeferUnit(
    unitId: string,
    partial: Partial<Omit<ReeferOnboardUnit, 'id' | 'sourceManifestId'>>,
  ): void {
    this.data.update((d) => {
      const lib = normalizeReeferLibrary(d.reeferLibrary, d.ports);
      const resolved: typeof partial = { ...partial };
      if ('loadPort' in partial) {
        resolved.loadPort = resolveKnownPortName(partial.loadPort ?? '', d.ports);
      }
      if ('dischargePort' in partial) {
        resolved.dischargePort = resolveKnownPortName(partial.dischargePort ?? '', d.ports);
      }
      return {
        ...d,
        reeferLibrary: {
          ...lib,
          onboard: lib.onboard.map((u) => (u.id === unitId ? { ...u, ...resolved } : u)),
        },
      };
    });
    void this.state.persist('silent');
  }

  removeReeferUnit(unitId: string): void {
    this.data.update((d) => {
      const lib = normalizeReeferLibrary(d.reeferLibrary, d.ports);
      return {
        ...d,
        reeferLibrary: {
          ...lib,
          onboard: lib.onboard.filter((u) => u.id !== unitId),
        },
      };
    });
    void this.state.persist('silent');
  }

  removeReeferManifest(id: string): void {
    this.data.update((d) => {
      const lib = normalizeReeferLibrary(d.reeferLibrary, d.ports);
      return {
        ...d,
        reeferLibrary: {
          ...lib,
          manifests: lib.manifests.filter((m) => m.id !== id),
          onboard: lib.onboard.filter((u) => u.sourceManifestId !== id),
        },
      };
    });
    void this.state.persist('silent');
  }

  applyReeferImport(
    result: ReeferImportResult,
    sourceName: string,
    fingerprints?: { contentFingerprint?: string; pdfBytesFingerprint?: string },
  ): import('../models/reefer.models').ReeferManifestDocument | null {
    const lib = normalizeReeferLibrary(this.data().reeferLibrary, this.data().ports);
    const duplicate = findReeferManifestDuplicate(lib.manifests, fingerprints ?? {});
    if (duplicate) return duplicate;

    this.data.update((d) => {
      const libInner = normalizeReeferLibrary(d.reeferLibrary, d.ports);
      const loadPort = resolveManifestPortName(result.header.portOfDeparture ?? '', d.ports);
      const dischargePort = resolveManifestPortName(result.header.portOfArrival ?? '', d.ports);
      const doc = createReeferManifestDocument({
        sourceName: sourceName.replace(/\.pdf$/i, '').trim() || 'PDF import',
        voyageNumber: result.header.voyageNumber?.trim() || d.ship.voyageNumber?.trim() || '',
        documentDate: result.header.documentDate?.trim() ?? '',
        loadPort,
        dischargePort,
        contentFingerprint: fingerprints?.contentFingerprint?.trim() ?? '',
        pdfBytesFingerprint: fingerprints?.pdfBytesFingerprint?.trim() ?? '',
      });
      const imported = reeferUnitsFromImportRows(
        result.rows,
        doc.id,
        loadPort,
        dischargePort,
        d.ports,
      );
      return {
        ...d,
        reeferLibrary: {
          ...libInner,
          manifests: [{ ...doc, unitCount: imported.length }, ...libInner.manifests],
          onboard: mergeReeferImportIntoOnboard(libInner.onboard, imported),
        },
      };
    });
    void this.state.persist('silent');
    return null;
  }
}
