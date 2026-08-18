import type { DgLibrarySettings } from './dg-manifest.models';

/** Ship header fields shown on the DG page. */
export interface DgPageShipContext {
  voyageNumber: string;
  portOfCall: string;
  nextPortOfCall: string;
  dateOfDeparture: string;
  dateOfArrival: string;
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
