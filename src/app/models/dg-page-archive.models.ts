import type { DgLibrarySettings } from './dg-manifest.models';
import { groupUnifeederRawRowsByContainer } from '../utils/dg-unifeeder-merge.util';

/** Ship header fields shown on the DG page. */
export interface DgPageShipContext {
  voyageNumber: string;
  portOfCall: string;
  nextPortOfCall: string;
  dateOfDeparture: string;
  dateOfArrival: string;
}

/**
 * Unique containers in a DG library for the active inventory tab
 * (Unifeeder onboard is cargo lines — group by container number).
 */
export function dgLibraryActiveContainerCount(lib: DgLibrarySettings): number {
  if (lib.activeInventoryTab === 'unifeeder') {
    return groupUnifeederRawRowsByContainer(lib.unifeeder?.onboard ?? []).length;
  }
  return lib.onboard?.length ?? 0;
}

/** Match key for overwrite prompt: port + voyage + container count (+ inventory tab). */
export function dgPageSnapshotMatchKey(
  ship: Pick<DgPageShipContext, 'portOfCall' | 'voyageNumber'>,
  lib: DgLibrarySettings,
): string {
  const port = ship.portOfCall.trim().toLowerCase();
  const voyage = ship.voyageNumber.trim().toLowerCase();
  const tab = lib.activeInventoryTab === 'unifeeder' ? 'unifeeder' : 'cmaCgm';
  const count = dgLibraryActiveContainerCount(lib);
  return `${tab}|${port}|${voyage}|${count}`;
}

/** Saved DG page snapshot (inventory + voyage strip context). */
export interface DgPageSnapshot {
  id: string;
  label: string;
  savedAt: string;
  ship: DgPageShipContext;
  dgLibrary: DgLibrarySettings;
}

export interface DgPageLiveBackup {
  ship: DgPageShipContext;
  dgLibrary: DgLibrarySettings;
}

export const DG_PAGE_ARCHIVE_STORAGE_KEY = 'crew-dg-page-archives';
export const DG_PAGE_ARCHIVE_SESSION_KEY = 'crew-dg-page-archive-session';

export interface DgPageArchiveSession {
  loadedId: string;
  liveBackup: DgPageLiveBackup;
}
