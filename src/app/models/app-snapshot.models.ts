import type { AppData } from './crew.models';

/**
 * Voyage/home payload inside a snapshot — excludes inventories and the snapshot
 * lists themselves (those live on live AppData / shared crew-data.json).
 */
export type AppMainSnapshot = Omit<
  AppData,
  | 'dgLibrary'
  | 'reeferLibrary'
  | 'seedVersion'
  | 'appSnapshots'
  | 'dgPageArchives'
  | 'reeferPageArchives'
>;

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
