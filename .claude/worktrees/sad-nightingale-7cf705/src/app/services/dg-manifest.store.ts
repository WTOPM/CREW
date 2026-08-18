// Feature store for the dangerous-goods (DG) domain: the CMA CGM onboard inventory +
// import manifests, the UNIFEEDER onboard inventory + manifests, inventory transfer
// between the two carriers, and CMA prestow position application.
//
// State is shared via AppStateStore. The `dgLibrary` read selector stays on
// StorageService for backward compatibility; this store owns DG mutations.

import { Injectable, inject } from '@angular/core';
import { resolveKnownPortName, resolveManifestPortName } from '../models/crew.models';
import {
  createDgCargoLine,
  createDgManifestDocument,
  createDgOnboardContainer,
  dgDefaultVoyageFromShip,
  formatDgManifestSourceName,
  normalizeDgLibrary,
  onboardContainersFromImportRows,
  findDgManifestDuplicate,
  type DgCargoLine,
  type DgLibrarySettings,
  type DgManifestDocument,
  type DgOnboardContainer,
} from '../models/dg-manifest.models';
import type { DgManifestImportResult } from './dg-manifest-import.service';
import { normalizeDgDualWeightFields } from '../utils/dg-weight-tonnage.util';
import {
  createDgUnifeederRow,
  createDgUnifeederManifestDocument,
  findUnifeederManifestDuplicate,
  resolveUnifeederRowPort,
  type DgUnifeederLibrarySettings,
  type DgUnifeederRow,
} from '../models/dg-unifeeder.models';
import {
  cmaContainersToUnifeederRows,
  unifeederRowsToCmaContainers,
} from '../utils/dg-inventory-transfer.util';
import type { UnifeederPdfParseResult } from '../utils/dg-unifeeder-pdf.util';
import { normalizeReeferLibrary } from '../models/reefer.models';
import { resolveDgPageContextFromSnapshot } from '../utils/page-ship-context.util';
import { AppStateStore } from './app-state.store';

@Injectable({ providedIn: 'root' })
export class DgManifestStore {
  private readonly state = inject(AppStateStore);
  private readonly data = this.state.data;

  setActiveDgDocument(_id: string): void {
    /* deprecated — manifests are import log only */
  }

  updateDgShowDischarged(showDischarged: boolean): void {
    this.updateDgManifestView({ showDischarged });
  }

  updateDgManifestView(
    partial: Partial<
      Pick<
        DgLibrarySettings,
        | 'showDischarged'
        | 'manifestMergeLines'
        | 'manifestUseGrossWeight'
        | 'manifestRoundWeights'
        | 'activeInventoryTab'
      >
    >,
  ): void {
    this.data.update((d) => ({
      ...d,
      dgLibrary: { ...normalizeDgLibrary(d.dgLibrary, undefined, d.ports, d.ship), ...partial },
    }));
    void this.state.persist('silent');
  }

  updateDgPageContext(
    partial: Partial<import('../utils/page-ship-context.util').DgPageContext>,
  ): void {
    this.data.update((d) => {
      const lib = normalizeDgLibrary(d.dgLibrary, undefined, d.ports, d.ship);
      return {
        ...d,
        dgLibrary: {
          ...lib,
          pageContext: { ...lib.pageContext, ...partial },
        },
      };
    });
    void this.state.persist('silent');
  }

  applyDgPageSnapshot(
    dgLibrary: DgLibrarySettings,
    shipCtx: import('../models/dg-page-archive.models').DgPageShipContext,
  ): void {
    this.data.update((d) => {
      const lib = normalizeDgLibrary(structuredClone(dgLibrary), undefined, d.ports);
      const pageContext = resolveDgPageContextFromSnapshot(lib.pageContext, shipCtx);
      return {
        ...d,
        dgLibrary: { ...lib, pageContext },
      };
    });
    void this.state.persist('silent');
  }

  addDgOnboardContainer(partial?: Partial<Omit<DgOnboardContainer, 'id' | 'lines'>>): void {
    this.data.update((d) => {
      const lib = normalizeDgLibrary(d.dgLibrary, undefined, d.ports);
      const loadPort = resolveKnownPortName(partial?.loadPort ?? d.ship.portOfCall ?? '', d.ports);
      const dischargePort = resolveKnownPortName(
        partial?.dischargePort ?? d.ship.nextPortOfCall ?? '',
        d.ports,
      );
      return {
        ...d,
        dgLibrary: {
          ...lib,
          onboard: [
            ...lib.onboard,
            createDgOnboardContainer({
              ...partial,
              loadPort,
              dischargePort,
              status: 'onboard',
              lines: [createDgCargoLine()],
            }),
          ],
        },
      };
    });
    void this.state.persist('silent');
  }

  updateDgOnboardContainer(
    containerId: string,
    partial: Partial<Omit<DgOnboardContainer, 'id' | 'lines' | 'sourceManifestId'>>,
  ): void {
    this.data.update((d) => {
      const lib = normalizeDgLibrary(d.dgLibrary, undefined, d.ports);
      const resolved: typeof partial = { ...partial };
      if ('loadPort' in partial) {
        resolved.loadPort = resolveKnownPortName(partial.loadPort ?? '', d.ports);
      }
      if ('dischargePort' in partial) {
        resolved.dischargePort = resolveKnownPortName(partial.dischargePort ?? '', d.ports);
      }
      return {
        ...d,
        dgLibrary: {
          ...lib,
          onboard: lib.onboard.map((c) => (c.id === containerId ? { ...c, ...resolved } : c)),
        },
      };
    });
    void this.state.persist('silent');
  }

  setDgOnboardContainerStatus(containerId: string, status: 'onboard' | 'discharged'): void {
    this.updateDgOnboardContainer(containerId, { status });
  }

  removeDgOnboardContainer(containerId: string): void {
    this.data.update((d) => {
      const lib = normalizeDgLibrary(d.dgLibrary, undefined, d.ports);
      return {
        ...d,
        dgLibrary: {
          ...lib,
          onboard: lib.onboard.filter((c) => c.id !== containerId),
        },
      };
    });
    void this.state.persist('silent');
  }

  updateDgOnboardCargoLine(
    containerId: string,
    lineId: string,
    partial: Partial<Omit<DgCargoLine, 'id'>>,
  ): void {
    this.data.update((d) => {
      const lib = normalizeDgLibrary(d.dgLibrary, undefined, d.ports);
      return {
        ...d,
        dgLibrary: {
          ...lib,
          onboard: lib.onboard.map((c) =>
            c.id === containerId
              ? {
                  ...c,
                  lines: c.lines.map((l) => (l.id === lineId ? { ...l, ...partial } : l)),
                }
              : c,
          ),
        },
      };
    });
    void this.state.persist('silent');
  }

  addDgOnboardCargoLine(containerId: string, partial?: Partial<Omit<DgCargoLine, 'id'>>): void {
    this.data.update((d) => {
      const lib = normalizeDgLibrary(d.dgLibrary, undefined, d.ports);
      return {
        ...d,
        dgLibrary: {
          ...lib,
          onboard: lib.onboard.map((c) =>
            c.id === containerId ? { ...c, lines: [...c.lines, createDgCargoLine(partial)] } : c,
          ),
        },
      };
    });
    void this.state.persist('silent');
  }

  removeDgOnboardCargoLine(containerId: string, lineId: string): void {
    this.data.update((d) => {
      const lib = normalizeDgLibrary(d.dgLibrary, undefined, d.ports);
      return {
        ...d,
        dgLibrary: {
          ...lib,
          onboard: lib.onboard.map((c) =>
            c.id === containerId ? { ...c, lines: c.lines.filter((l) => l.id !== lineId) } : c,
          ),
        },
      };
    });
    void this.state.persist('silent');
  }

  removeDgManifest(id: string): void {
    this.data.update((d) => {
      const lib = normalizeDgLibrary(d.dgLibrary, undefined, d.ports);
      return {
        ...d,
        dgLibrary: {
          ...lib,
          manifests: lib.manifests.filter((m) => m.id !== id),
          onboard: lib.onboard.filter((c) => c.sourceManifestId !== id),
        },
      };
    });
    void this.state.persist('silent');
  }

  updateUnifeederViewSettings(
    partial: Partial<
      Pick<
        DgUnifeederLibrarySettings,
        'showDischarged' | 'mergeLines' | 'useGrossWeight' | 'roundWeights'
      >
    >,
  ): void {
    this.data.update((d) => {
      const lib = normalizeDgLibrary(d.dgLibrary, undefined, d.ports, d.ship);
      return {
        ...d,
        dgLibrary: {
          ...lib,
          unifeeder: { ...lib.unifeeder, ...partial },
        },
      };
    });
    void this.state.persist('silent');
  }

  /** Replace UNIFEEDER inventory with a copy of the CMA CGM onboard list. */
  transferCmaDgInventoryToUnifeeder(): number {
    let count = 0;
    this.data.update((d) => {
      const lib = normalizeDgLibrary(d.dgLibrary, undefined, d.ports, d.ship);
      const rows = cmaContainersToUnifeederRows(lib.onboard);
      count = rows.length;
      return {
        ...d,
        dgLibrary: {
          ...lib,
          unifeeder: {
            ...lib.unifeeder,
            manifests: [],
            onboard: rows,
            showDischarged: lib.showDischarged,
            mergeLines: lib.manifestMergeLines,
            useGrossWeight: lib.manifestUseGrossWeight,
            roundWeights: lib.manifestRoundWeights,
          },
        },
      };
    });
    void this.state.persist('silent');
    return count;
  }

  /** Replace CMA CGM inventory with a copy of the UNIFEEDER onboard list. */
  transferUnifeederDgInventoryToCma(): number {
    let count = 0;
    this.data.update((d) => {
      const lib = normalizeDgLibrary(d.dgLibrary, undefined, d.ports, d.ship);
      const containers = unifeederRowsToCmaContainers(lib.unifeeder.onboard);
      count = containers.length;
      return {
        ...d,
        dgLibrary: {
          ...lib,
          manifests: [],
          onboard: containers,
          showDischarged: lib.unifeeder.showDischarged,
          manifestMergeLines: lib.unifeeder.mergeLines,
          manifestUseGrossWeight: lib.unifeeder.useGrossWeight,
          manifestRoundWeights: lib.unifeeder.roundWeights,
        },
      };
    });
    void this.state.persist('silent');
    return count;
  }

  /** Clear CMA CGM onboard list and import history. */
  clearCmaDgInventory(): void {
    this.data.update((d) => {
      const lib = normalizeDgLibrary(d.dgLibrary, undefined, d.ports, d.ship);
      return {
        ...d,
        dgLibrary: {
          ...lib,
          manifests: [],
          onboard: [],
        },
      };
    });
    void this.state.persist('silent');
  }

  /** Clear UNIFEEDER onboard list and import history. */
  clearUnifeederDgInventory(): void {
    this.data.update((d) => {
      const lib = normalizeDgLibrary(d.dgLibrary, undefined, d.ports, d.ship);
      return {
        ...d,
        dgLibrary: {
          ...lib,
          unifeeder: {
            ...lib.unifeeder,
            manifests: [],
            onboard: [],
          },
        },
      };
    });
    void this.state.persist('silent');
  }

  addUnifeederRow(partial?: Partial<Omit<DgUnifeederRow, 'id' | 'sourceManifestId'>>): void {
    this.data.update((d) => {
      const lib = normalizeDgLibrary(d.dgLibrary, undefined, d.ports, d.ship);
      const ctx = lib.pageContext;
      const loadPort = resolveUnifeederRowPort(partial?.loadPort ?? ctx.portOfCall ?? '', d.ports);
      const dischargePort = resolveUnifeederRowPort(
        partial?.dischargePort ?? ctx.nextPortOfCall ?? '',
        d.ports,
      );
      return {
        ...d,
        dgLibrary: {
          ...lib,
          unifeeder: {
            ...lib.unifeeder,
            onboard: [
              ...lib.unifeeder.onboard,
              createDgUnifeederRow({
                ...partial,
                loadPort,
                dischargePort,
                status: 'onboard',
              }),
            ],
          },
        },
      };
    });
    void this.state.persist('silent');
  }

  updateUnifeederRow(
    rowId: string,
    partial: Partial<Omit<DgUnifeederRow, 'id' | 'sourceManifestId'>>,
  ): void {
    this.data.update((d) => {
      const lib = normalizeDgLibrary(d.dgLibrary, undefined, d.ports, d.ship);
      const resolved: typeof partial = { ...partial };
      if ('loadPort' in partial) {
        resolved.loadPort = resolveUnifeederRowPort(partial.loadPort ?? '', d.ports);
      }
      if ('dischargePort' in partial) {
        resolved.dischargePort = resolveUnifeederRowPort(partial.dischargePort ?? '', d.ports);
      }
      return {
        ...d,
        dgLibrary: {
          ...lib,
          unifeeder: {
            ...lib.unifeeder,
            onboard: lib.unifeeder.onboard.map((row) =>
              row.id === rowId ? createDgUnifeederRow({ ...row, ...resolved, id: row.id }) : row,
            ),
          },
        },
      };
    });
    void this.state.persist('silent');
  }

  setUnifeederRowStatus(rowId: string, status: 'onboard' | 'discharged'): void {
    this.updateUnifeederRow(rowId, { status });
  }

  removeUnifeederRow(rowId: string): void {
    this.data.update((d) => {
      const lib = normalizeDgLibrary(d.dgLibrary, undefined, d.ports, d.ship);
      return {
        ...d,
        dgLibrary: {
          ...lib,
          unifeeder: {
            ...lib.unifeeder,
            onboard: lib.unifeeder.onboard.filter((row) => row.id !== rowId),
          },
        },
      };
    });
    void this.state.persist('silent');
  }

  removeUnifeederManifest(id: string): void {
    this.data.update((d) => {
      const lib = normalizeDgLibrary(d.dgLibrary, undefined, d.ports, d.ship);
      return {
        ...d,
        dgLibrary: {
          ...lib,
          unifeeder: {
            ...lib.unifeeder,
            manifests: lib.unifeeder.manifests.filter((m) => m.id !== id),
            onboard: lib.unifeeder.onboard.filter((row) => row.sourceManifestId !== id),
          },
        },
      };
    });
    void this.state.persist('silent');
  }

  applyUnifeederImport(
    result: UnifeederPdfParseResult,
    sourceName: string,
    fingerprints?: { contentFingerprint?: string; pdfBytesFingerprint?: string },
  ): import('../models/dg-unifeeder.models').DgUnifeederManifestDocument | null {
    const lib = normalizeDgLibrary(
      this.data().dgLibrary,
      undefined,
      this.data().ports,
      this.data().ship,
    );
    const duplicate = findUnifeederManifestDuplicate(lib.unifeeder.manifests, fingerprints ?? {});
    if (duplicate) return duplicate;

    this.data.update((d) => {
      const libInner = normalizeDgLibrary(d.dgLibrary, undefined, d.ports, d.ship);
      const loadPort = resolveUnifeederRowPort(result.header.portOfDeparture ?? '', d.ports);
      const dischargePort = resolveUnifeederRowPort(result.header.portOfArrival ?? '', d.ports);
      const documentDate = (result.header.departureDate ?? '').trim();
      const doc = createDgUnifeederManifestDocument({
        sourceName: formatDgManifestSourceName(loadPort, documentDate, sourceName),
        rowCount: result.rows.length,
        contentFingerprint: fingerprints?.contentFingerprint?.trim() ?? '',
        pdfBytesFingerprint: fingerprints?.pdfBytesFingerprint?.trim() ?? '',
      });
      const imported = result.rows
        .filter((row) => row.containerNo.trim())
        .map((row) =>
          createDgUnifeederRow({
            ...row,
            loadPort: resolveUnifeederRowPort(
              row.loadPort || result.header.portOfDeparture || '',
              d.ports,
            ),
            dischargePort: resolveUnifeederRowPort(
              row.dischargePort || result.header.portOfArrival || '',
              d.ports,
            ),
            status: 'onboard',
            sourceManifestId: doc.id,
          }),
        );
      const containerCount = new Set(imported.map((row) => row.containerNo).filter(Boolean)).size;
      const docWithCount = {
        ...doc,
        rowCount: imported.length,
        containerCount,
        voyageNumber: (result.header.voyageNumber ?? '').trim(),
        documentDate,
        loadPort,
        dischargePort,
        pdfImoNetWeightKg: result.summary?.totalImoNetWeightKg ?? 0,
        pdfImoGrossWeightKg: result.summary?.totalImoGrossWeightKg ?? 0,
      };
      const pageContext = { ...libInner.pageContext };
      if (loadPort) pageContext.portOfCall = loadPort;
      if (dischargePort) pageContext.nextPortOfCall = dischargePort;
      if (result.header.departureDate?.trim()) {
        pageContext.dateOfDeparture = result.header.departureDate.trim();
      }
      return {
        ...d,
        dgLibrary: {
          ...libInner,
          pageContext,
          unifeeder: {
            ...libInner.unifeeder,
            manifests: [docWithCount, ...libInner.unifeeder.manifests],
            onboard: [...libInner.unifeeder.onboard, ...imported],
          },
        },
      };
    });
    void this.state.persist('silent');
    return null;
  }

  applyDgManifestImport(
    result: DgManifestImportResult,
    sourceName: string,
    fingerprints?: { contentFingerprint?: string; pdfBytesFingerprint?: string },
  ): DgManifestDocument | null {
    const lib = normalizeDgLibrary(this.data().dgLibrary, undefined, this.data().ports);
    const duplicate = findDgManifestDuplicate(lib.manifests, fingerprints ?? {});
    if (duplicate) return duplicate;

    this.data.update((d) => {
      const libInner = normalizeDgLibrary(d.dgLibrary, undefined, d.ports);
      const loadPort = resolveManifestPortName(result.header.portOfDeparture ?? '', d.ports);
      const dischargePort = resolveManifestPortName(result.header.portOfArrival ?? '', d.ports);
      const documentDate = result.header.departureDate?.trim() ?? '';
      const doc = createDgManifestDocument({
        sourceName: formatDgManifestSourceName(loadPort, documentDate, sourceName),
        voyageNumber: result.header.voyageNumber?.trim() || dgDefaultVoyageFromShip(d.ship),
        documentDate,
        loadPort,
        dischargePort,
        contentFingerprint: fingerprints?.contentFingerprint?.trim() ?? '',
        pdfBytesFingerprint: fingerprints?.pdfBytesFingerprint?.trim() ?? '',
      });
      const normalizedRows = result.rows.map((row) => ({
        ...row,
        ...normalizeDgDualWeightFields(row, libInner.manifestUseGrossWeight),
      }));
      const added = onboardContainersFromImportRows(
        normalizedRows,
        doc.id,
        loadPort,
        dischargePort,
        d.ports,
      );
      return {
        ...d,
        dgLibrary: {
          ...libInner,
          manifests: [{ ...doc, containerCount: added.length }, ...libInner.manifests],
          onboard: [...libInner.onboard, ...added],
        },
      };
    });
    void this.state.persist('silent');
    return null;
  }

  applyCmaPrestowPositions(positions: readonly { containerNo: string; position: string }[]): {
    dgUpdated: number;
    reeferUpdated: number;
    unmatched: string[];
  } {
    const byContainer = new Map(
      positions.map((row) => [row.containerNo.trim().toUpperCase(), row.position.trim()]),
    );
    const matched = new Set<string>();
    let dgUpdated = 0;
    let reeferUpdated = 0;

    this.data.update((d) => {
      const dgLib = normalizeDgLibrary(d.dgLibrary, undefined, d.ports);
      const reeferLib = normalizeReeferLibrary(d.reeferLibrary, d.ports);

      const onboardDg = dgLib.onboard.map((container) => {
        const key = container.containerNo.trim().toUpperCase();
        const position = byContainer.get(key);
        if (!position || container.status !== 'onboard') return container;
        matched.add(key);
        if (container.stowage.trim() === position) return container;
        dgUpdated += 1;
        return { ...container, stowage: position };
      });

      const onboardReefer = reeferLib.onboard.map((unit) => {
        const key = unit.containerNo.trim().toUpperCase();
        const position = byContainer.get(key);
        if (!position || unit.status !== 'onboard') return unit;
        matched.add(key);
        if (unit.position.trim() === position) return unit;
        reeferUpdated += 1;
        return { ...unit, position };
      });

      return {
        ...d,
        dgLibrary: { ...dgLib, onboard: onboardDg },
        reeferLibrary: { ...reeferLib, onboard: onboardReefer },
      };
    });

    void this.state.persist('silent');
    return {
      dgUpdated,
      reeferUpdated,
      unmatched: [...byContainer.keys()].filter((key) => !matched.has(key)).sort(),
    };
  }
}
