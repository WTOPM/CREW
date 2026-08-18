import { APP_DATA_SCHEMA_VERSION } from '../data/empty-app-data';
import { AppData } from '../models/crew.models';

/** Main nav sections — one cooperative lock each when sharing a data folder. */
export type AppSection = 'home' | 'dg' | 'reefer' | 'eta' | 'settings';

export const APP_SECTIONS: AppSection[] = ['home', 'dg', 'reefer', 'eta', 'settings'];

export const APP_SECTION_LABELS: Record<AppSection, string> = {
  home: 'Home',
  dg: 'DG',
  reefer: 'REEFER',
  eta: 'ETA',
  settings: 'Settings',
};

export function sectionFromRoutePath(urlPath: string): AppSection | null {
  const path = urlPath.split('?')[0].split('#')[0];
  if (path === '' || path === '/') return 'home';
  if (path === '/dg' || path.startsWith('/dg/')) return 'dg';
  if (path === '/reefer' || path.startsWith('/reefer/')) return 'reefer';
  if (path === '/eta' || path.startsWith('/eta/')) return 'eta';
  if (path === '/settings' || path.startsWith('/settings/')) return 'settings';
  return null;
}

/** Fields owned by a section for merge-on-save / reload-on-tab. */
export function pickSectionSlice(data: AppData, section: AppSection): Partial<AppData> {
  switch (section) {
    case 'home':
      return {
        crew: data.crew,
        crewArrivalOrder: data.crewArrivalOrder,
        crewDepartureOrder: data.crewDepartureOrder,
        crewArr: data.crewArr,
        passengers: data.passengers,
        passengerArrivalOrder: data.passengerArrivalOrder,
        passengerDepartureOrder: data.passengerDepartureOrder,
        paxArr: data.paxArr,
        portCallHistory: data.portCallHistory,
        portOfCall: data.portOfCall,
        shipStoresSettingsDocId: data.shipStoresSettingsDocId,
        shipStoresForm: data.shipStoresForm,
        shipStoresForm02: data.shipStoresForm02,
        shipStoresForm03: data.shipStoresForm03,
        crewEffectForm: data.crewEffectForm,
        crewEffectForm02: data.crewEffectForm02,
        crewEffectForm03: data.crewEffectForm03,
        nilListForm: data.nilListForm,
        shipMoneyForm: data.shipMoneyForm,
        cashAdvanceForm: data.cashAdvanceForm,
        crewMoneyListForm: data.crewMoneyListForm,
        narcoticListForm: data.narcoticListForm,
      };
    case 'dg':
      return { dgLibrary: data.dgLibrary };
    case 'reefer':
      return { reeferLibrary: data.reeferLibrary };
    case 'eta':
      return { etaLibrary: data.etaLibrary };
    case 'settings':
      return {
        ship: data.ship,
        ports: data.ports,
        ranks: data.ranks,
        nationalities: data.nationalities,
        documentOverlay: data.documentOverlay,
        shipAssets: data.shipAssets,
        outputSettings: data.outputSettings,
        printPackages: data.printPackages,
        customDocuments: data.customDocuments,
      };
  }
}

/** Overlay disk section slice onto in-memory state; always refresh shared ship from disk. */
export function mergeSectionFromDisk(target: AppData, source: AppData, section: AppSection): AppData {
  return {
    ...target,
    ...pickSectionSlice(source, section),
    ship: source.ship,
    seedVersion: source.seedVersion ?? target.seedVersion,
  };
}

/** Merge in-memory section edits into on-disk snapshot before write. */
export function mergeSectionForSave(disk: AppData, memory: AppData, section: AppSection): AppData {
  return {
    ...disk,
    ...pickSectionSlice(memory, section),
    /** Voyage fields edited on Home; output folder from the top bar on any tab. */
    ship: memory.ship,
    outputSettings: memory.outputSettings,
    /** Document overlay prefs edited from Home document menus. */
    ...(section === 'home'
      ? {
          documentOverlay: memory.documentOverlay,
          shipAssets: memory.shipAssets,
        }
      : {}),
    seedVersion: APP_DATA_SCHEMA_VERSION,
  };
}
