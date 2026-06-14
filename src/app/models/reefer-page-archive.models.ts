import type { ReeferLibrarySettings } from './reefer.models';

export interface ReeferPageShipContext {
  voyageNumber: string;
  portOfCall: string;
  dateOfDeparture: string;
}

export interface ReeferPageSnapshot {
  id: string;
  label: string;
  savedAt: string;
  ship: ReeferPageShipContext;
  reeferLibrary: ReeferLibrarySettings;
}

export interface ReeferPageLiveBackup {
  ship: ReeferPageShipContext;
  reeferLibrary: ReeferLibrarySettings;
}

export const REEFER_PAGE_ARCHIVE_STORAGE_KEY = 'crew-reefer-page-archives';
