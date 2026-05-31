import { AppData } from './app/models/crew.models';

export {};

declare global {
  interface Window {
    electronAPI?: {
      readData: () => Promise<AppData | null>;
      writeData: (data: AppData) => Promise<void>;
      getDataPath: () => Promise<string>;
    };
  }
}
