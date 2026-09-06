import { AppData } from './app/models/crew.models';
import type { CrewDocumentType } from './app/models/crew.models';
import type { ShipAssetKind } from './app/models/document-overlay.models';
import type { AppSection } from './app/utils/app-data-section.util';
import type {
  DataPathDebugInfo,
  DataStoreActionResult,
  JsonBackupsListResult,
} from './app/services/app-state.store';

export interface SectionLockRecord {
  section: AppSection;
  clientId: string;
  displayName: string;
  acquiredAt: number;
  heartbeatAt: number;
}

export interface AcquireSectionLockResult {
  ok: boolean;
  lock?: SectionLockRecord;
  heldBy?: SectionLockRecord;
  previousHolder?: SectionLockRecord;
  error?: string;
}

export type SectionLockBannerKind = 'view-only' | 'displaced';

export interface SectionLockBanner {
  kind: SectionLockBannerKind;
  message: string;
}

export interface ElectronLocalPrefs {
  minimizeToTray: boolean;
}

export {};

declare global {
  interface Window {
    electronAPI?: {
      readData: () => Promise<AppData | null>;
      writeData: (data: AppData) => Promise<void>;
      getDataPath: () => Promise<string>;
      getDataPathDebug: () => Promise<DataPathDebugInfo>;
      pickDataDirectory: () => Promise<string | null>;
      setDataDirectory: (dirPath: string) => Promise<DataStoreActionResult>;
      createNewDataStore: () => Promise<DataStoreActionResult>;
      listJsonBackups: () => Promise<JsonBackupsListResult>;
      restoreJsonBackup: (fileName: string) => Promise<DataStoreActionResult>;
      openJsonBackupsFolder: () => Promise<{ ok: boolean; error?: string; path?: string }>;
      getClientInfo: () => Promise<{ hostName: string; userName: string }>;
      acquireSectionLock: (
        section: AppSection,
        clientId: string,
        displayName: string,
      ) => Promise<AcquireSectionLockResult>;
      forceAcquireSectionLock: (
        section: AppSection,
        clientId: string,
        displayName: string,
      ) => Promise<AcquireSectionLockResult>;
      renewSectionLock: (section: AppSection, clientId: string) => Promise<{ ok: boolean }>;
      releaseSectionLock: (section: AppSection, clientId: string) => Promise<{ ok: boolean }>;
      readSectionLock: (section: AppSection) => Promise<SectionLockRecord | null>;
      listSectionLocks: () => Promise<Partial<Record<AppSection, SectionLockRecord>>>;
      /** Write shared-folder signal so every CREW instance using this data folder quits. */
      requestForceQuitAll: () => Promise<{ id: string; at: number; by: string }>;
      readForceQuit: () => Promise<{ id: string; at: number; by: string } | null>;
      /** Fully quit (not minimize to tray). */
      quitApp: () => Promise<{ ok: boolean }>;
      getLocalPrefs: () => Promise<ElectronLocalPrefs>;
      setLocalPrefs: (patch: Partial<ElectronLocalPrefs>) => Promise<ElectronLocalPrefs>;
      onAppRestoredFromTray: (callback: () => void) => () => void;
      pickPdfFile: () => Promise<string | null>;
      pickDirectory: () => Promise<string | null>;
      openDirectory: (dirPath: string) => Promise<{ ok: boolean; error?: string }>;
      openTempFile: (
        fileName: string,
        base64: string,
      ) => Promise<{ ok: boolean; error?: string; path?: string }>;
      listDirectories: (input: string) => Promise<string[]>;
      savePdfToPath: (
        dirPath: string,
        fileName: string,
        base64: string,
      ) => Promise<{ fullPath: string }>;
      pdfExists: (dirPath: string, fileName: string) => Promise<boolean>;
      listPrinters: () => Promise<{ name: string; displayName: string; isDefault: boolean }[]>;
      printPdf: (
        base64: string,
        copies: number,
        deviceName: string,
      ) => Promise<{ ok: boolean; error?: string }>;
      /** Vector PDF from HTML form (Electron printToPDF). */
      captureHtmlFormPdf: (
        relativeUrl: string,
        snapshot: unknown,
        options?: { landscape?: boolean },
      ) => Promise<string>;
      saveCrewPdf: (
        crewId: string,
        docType: CrewDocumentType,
        sourcePath: string,
      ) => Promise<boolean>;
      saveCrewPdfBytes: (
        crewId: string,
        docType: CrewDocumentType,
        base64: string,
      ) => Promise<boolean>;
      readCrewPdf: (crewId: string, docType: CrewDocumentType) => Promise<string | null>;
      crewPdfExists: (crewId: string, docType: CrewDocumentType) => Promise<boolean>;
      deleteCrewPdf: (crewId: string, docType: CrewDocumentType) => Promise<boolean>;
      deleteCrewDocuments: (crewId: string) => Promise<boolean>;
      pickCrewSignatureFile: () => Promise<string | null>;
      saveCrewSignatureFromPath: (
        crewId: string,
        sourcePath: string,
      ) => Promise<{ fileName: string }>;
      saveCrewSignatureBytes: (
        crewId: string,
        base64: string,
        fileName: string,
      ) => Promise<{ fileName: string }>;
      readCrewSignature: (crewId: string) => Promise<string | null>;
      crewSignatureExists: (crewId: string) => Promise<boolean>;
      deleteCrewSignature: (crewId: string) => Promise<boolean>;
      pickShipAssetFile: () => Promise<string | null>;
      saveShipAssetFromPath: (
        kind: ShipAssetKind,
        sourcePath: string,
      ) => Promise<{ fileName: string }>;
      saveShipAssetBytes: (
        kind: ShipAssetKind,
        base64: string,
        fileName: string,
      ) => Promise<{ fileName: string }>;
      readShipAsset: (kind: ShipAssetKind) => Promise<string | null>;
      deleteShipAsset: (kind: ShipAssetKind) => Promise<boolean>;
    };
  }
}
