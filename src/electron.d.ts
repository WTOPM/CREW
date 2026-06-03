import { AppData } from './app/models/crew.models';
import type { CrewDocumentType } from './app/models/crew.models';

export {};

declare global {
  interface Window {
    electronAPI?: {
      readData: () => Promise<AppData | null>;
      writeData: (data: AppData) => Promise<void>;
      getDataPath: () => Promise<string>;
      pickPdfFile: () => Promise<string | null>;
      saveCrewPdf: (crewId: string, docType: CrewDocumentType, sourcePath: string) => Promise<boolean>;
      saveCrewPdfBytes: (crewId: string, docType: CrewDocumentType, base64: string) => Promise<boolean>;
      readCrewPdf: (crewId: string, docType: CrewDocumentType) => Promise<string | null>;
      crewPdfExists: (crewId: string, docType: CrewDocumentType) => Promise<boolean>;
      deleteCrewPdf: (crewId: string, docType: CrewDocumentType) => Promise<boolean>;
      deleteCrewDocuments: (crewId: string) => Promise<boolean>;
    };
  }
}
