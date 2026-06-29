import {
  AppData,
  createDefaultCrewArrSettings,
  createDefaultCustomDocuments,
  createDefaultOutputSettings,
  createDefaultPortOfCallSettings,
  createDefaultPrintPackages,
  createEmptyShip,
} from '../models/crew.models';
import { createDefaultPaxArrSettings } from '../models/passenger.models';
import {
  createDefaultDocumentOverlayPrefs,
  createEmptyShipAssetsMeta,
} from '../models/document-overlay.models';
import {
  createDefaultCrewEffectForm,
  createDefaultCrewEffectForm02,
  createDefaultCrewEffectForm03,
} from '../models/crew-effect.models';
import { createDefaultNilListForm } from '../models/nil-list.models';
import { createDefaultShipMoneyForm } from '../models/ship-money.models';
import { createDefaultCashAdvanceForm } from '../models/cash-advance.models';
import { createDefaultCrewMoneyListForm } from '../models/crew-money-list.models';
import { createDefaultNarcoticListForm } from '../models/narcotic-list.models';
import { createDefaultDgLibrary } from '../models/dg-manifest.models';
import { createDefaultReeferLibrary } from '../models/reefer.models';
import { createDefaultEtaLibrary } from '../models/eta.models';
import {
  createDefaultShipStoresForm,
  createDefaultShipStoresForm02,
  createDefaultShipStoresForm03,
} from '../models/ship-stores.models';

/** Bump when saved JSON shape migrations are required (no bundled sample data). */
export const APP_DATA_SCHEMA_VERSION = 17;

/** Fresh install — no ship, crew, ports, or forms pre-filled. */
export function createEmptyAppData(): AppData {
  return {
    ship: createEmptyShip(),
    crew: [],
    crewArr: createDefaultCrewArrSettings(),
    passengers: [],
    paxArr: createDefaultPaxArrSettings(),
    ports: [],
    ranks: [],
    nationalities: [],
    portCallHistory: [],
    portOfCall: createDefaultPortOfCallSettings(),
    shipStoresSettingsDocId: 'shipStores',
    shipStoresForm: createDefaultShipStoresForm(),
    shipStoresForm02: createDefaultShipStoresForm02(),
    shipStoresForm03: createDefaultShipStoresForm03(),
    crewEffectForm: createDefaultCrewEffectForm(),
    crewEffectForm02: createDefaultCrewEffectForm02(),
    crewEffectForm03: createDefaultCrewEffectForm03(),
    nilListForm: createDefaultNilListForm(),
    shipMoneyForm: createDefaultShipMoneyForm(),
    cashAdvanceForm: createDefaultCashAdvanceForm(),
    crewMoneyListForm: createDefaultCrewMoneyListForm(),
    narcoticListForm: createDefaultNarcoticListForm(),
    dgLibrary: createDefaultDgLibrary(),
    reeferLibrary: createDefaultReeferLibrary(),
    etaLibrary: createDefaultEtaLibrary(),
    documentOverlay: createDefaultDocumentOverlayPrefs(),
    shipAssets: createEmptyShipAssetsMeta(),
    outputSettings: createDefaultOutputSettings(),
    printPackages: createDefaultPrintPackages(),
    customDocuments: createDefaultCustomDocuments(),
    seedVersion: APP_DATA_SCHEMA_VERSION,
  };
}
