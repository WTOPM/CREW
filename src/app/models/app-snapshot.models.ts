import type { AppData } from './crew.models';

/** All persisted app data except DG and Reefer inventories. */
export type AppMainSnapshot = Omit<AppData, 'dgLibrary' | 'reeferLibrary' | 'seedVersion'>;

export interface AppSnapshotEntry {
  id: string;
  label: string;
  savedAt: string;
  portName: string;
  voyageNumber: string;
  arrivalDate: string;
  data: AppMainSnapshot;
}

export interface AppSnapshotSession {
  loadedId: string;
  liveBackup: AppMainSnapshot;
}

export const APP_SNAPSHOT_STORAGE_KEY = 'crew-app-snapshots';
export const APP_SNAPSHOT_SESSION_KEY = 'crew-app-snapshot-session';
