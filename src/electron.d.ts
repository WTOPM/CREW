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
  /** Per-machine FUEL table column layout (not shared via data folder). */
  fuelVisibleColumns?: string[];
  /** Show FUEL hour fields as H:MM instead of decimal. */
  fuelHoursAsHm?: boolean;
  /** Show FUEL date/time as UTC (local − fuelUtcOffsetHours). */
  fuelShowUtc?: boolean;
  /** Ship local = UTC+N (hours). */
  fuelUtcOffsetHours?: number;
  /**
   * @deprecated Migrated into shared fuelLibrary.displayPresets.
   * Still read once for migration, then cleared.
   */
  fuelDisplayPresets?: Array<{
    id: string;
    name: string;
    savedAt: string;
    visibleColumns: string[];
    hoursAsHm: boolean;
  }>;
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
      /** Float the main window above other apps (legacy; GPS uses openGpsFloat). */
      setWindowAlwaysOnTop: (enabled: boolean) => Promise<{ ok: boolean; enabled?: boolean }>;
      getWindowActive: () => Promise<boolean>;
      onAppWindowActive: (callback: (active: boolean) => void) => () => void;
      openGpsFloat: (payload: {
        targetKey: string;
        legId?: string;
        label: string;
        lat: { deg: string; min: string; sec: string; hemi: string };
        lon: { deg: string; min: string; sec: string; hemi: string };
      }) => Promise<{ ok: boolean }>;
      closeGpsFloat: () => Promise<{ ok: boolean }>;
      isGpsFloatOpen: () => Promise<boolean>;
      onGpsFloatCommit: (
        callback: (payload: {
          targetKey: string;
          legId?: string;
          lat: { deg: string; min: string; sec: string; hemi: string };
          lon: { deg: string; min: string; sec: string; hemi: string };
          dirty?: boolean;
          clear?: boolean;
        }) => void,
      ) => () => void;
      onGpsFloatClosed: (
        callback: (
          payload: {
            save?: boolean;
            clear?: boolean;
            targetKey?: string;
            legId?: string;
            lat?: { deg: string; min: string; sec: string; hemi: string };
            lon?: { deg: string; min: string; sec: string; hemi: string };
            dirty?: boolean;
          } | null,
        ) => void,
      ) => () => void;
      pickPdfFile: () => Promise<string | null>;
      pickExcelFile: (defaultPath?: string) => Promise<string | null>;
      readFileBase64: (
        filePath: string,
      ) => Promise<{ ok: boolean; base64?: string; error?: string }>;
      writeFileBase64: (
        filePath: string,
        base64: string,
      ) => Promise<{ ok: boolean; error?: string }>;
      /**
       * Identical Excel Worksheet.Copy + data fill for DEP REP.xlsx (COM).
       * Preserves density Tables and ship drawings; never rewrites K:L.
       */
      writeDepRepSheet: (
        filePath: string,
        payload: {
          sheetName: string;
          updates: Array<{
            address: string;
            kind: string;
            value?: string | number;
            formula?: string;
            iso?: string;
          }>;
        },
      ) => Promise<{ ok: boolean; created?: boolean; sheetName?: string; error?: string }>;
      /** Delete one DEP REP worksheet; returns the new leftmost sheet name when any remain. */
      deleteDepRepSheet: (
        filePath: string,
        sheetName: string,
      ) => Promise<{ ok: boolean; deleted?: string; latestSheetName?: string; error?: string }>;
      /** Excel ExportAsFixedFormat for a DEP REP sheet → PDF base64 (print layout as in Excel). */
      exportDepRepPdf: (
        filePath: string,
        sheetName: string,
      ) => Promise<{ ok: boolean; base64?: string; sheetName?: string; error?: string }>;
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
