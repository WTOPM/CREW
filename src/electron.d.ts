import { AppData } from './app/models/crew.models';
import type { CrewDocumentType } from './app/models/crew.models';
import type { ShipAssetKind } from './app/models/document-overlay.models';

export {};

declare global {
  interface Window {
    electronAPI?: {
      readData: () => Promise<AppData | null>;
      writeData: (data: AppData) => Promise<void>;
      getDataPath: () => Promise<string>;
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
