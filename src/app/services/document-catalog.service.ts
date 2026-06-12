import { Injectable, inject } from '@angular/core';
import {
  AppData,
  CREW_IDENTITY_PASSPORT,
  CREW_IDENTITY_SEAMANS_BOOK,
} from '../models/crew.models';
import {
  crewListIdentityPdfFileName,
  passengerListPdfFileName,
} from '../utils/pdf-filename.util';
import { PASSENGER_IDENTITY_DOCUMENT } from '../models/passenger.models';
import { passengersToCrewRows } from '../utils/passenger-pdf.util';
import { base64ToUint8 } from '../utils/base64.util';
import { StorageService } from './storage.service';
import { IMO_PASSENGER_LIST_TITLE, PdfCrewArrService } from './pdf-crew-arr.service';
import { PdfCrewListType2Service } from './pdf-crew-list-type2.service';
import { PdfCrewListV2Service } from './pdf-crew-list-v2.service';
import { PdfCrewListV3SbkService } from './pdf-crew-list-v3-sbk.service';
import { PdfCrewListV3SbkPService } from './pdf-crew-list-v3-sbk-p.service';
import { PdfCrewListV3SbkP2Service } from './pdf-crew-list-v3-sbk-p2.service';
import { PdfPassengerListV2Service } from './pdf-passenger-list-v2.service';
import { PdfPortOfCallService } from './pdf-port-of-call.service';
import { PdfPortOfCallTemplateService } from './pdf-port-of-call-template.service';
import { PdfSso0108PortCallsService } from './pdf-sso0108-port-calls.service';
import { PdfShipStoresService } from './pdf-ship-stores.service';
import { PdfShipStores02Service } from './pdf-ship-stores-02.service';
import { PdfShipStores03Service } from './pdf-ship-stores-03.service';
import { PdfCrewEffect02Service } from './pdf-crew-effect-02.service';
import { PdfCrewEffectService } from './pdf-crew-effect.service';
import { PdfNilListService } from './pdf-nil-list.service';
import { PdfShipMoneyService } from './pdf-ship-money.service';
import { PdfCashAdvanceService } from './pdf-cash-advance.service';
import { PdfCrewMoneyListService } from './pdf-crew-money-list.service';
import { PdfNarcoticListService } from './pdf-narcotic-list.service';
import { PdfMdhService } from './pdf-mdh.service';
import { PdfCrewVaccineService } from './pdf-crew-vaccine.service';
import {
  buildPackageCatalog,
  packageCatalogLabelForId,
} from '../models/document-package-catalog.models';

export interface CatalogDocument {
  id: string;
  label: string;
  enabled: boolean;
}

interface BuiltPdf {
  bytes: Uint8Array;
  fileName: string;
}

/** Central registry: list selectable documents and build final PDF bytes for each. */
@Injectable({ providedIn: 'root' })
export class DocumentCatalogService {
  private readonly storage = inject(StorageService);
  private readonly crewPdf = inject(PdfCrewArrService);
  private readonly passengerListV2 = inject(PdfPassengerListV2Service);
  private readonly type2 = inject(PdfCrewListType2Service);
  private readonly crewListV2 = inject(PdfCrewListV2Service);
  private readonly crewListV3Sbk = inject(PdfCrewListV3SbkService);
  private readonly crewListV3SbkP = inject(PdfCrewListV3SbkPService);
  private readonly crewListV3SbkP2 = inject(PdfCrewListV3SbkP2Service);
  private readonly poc = inject(PdfPortOfCallService);
  private readonly pocTemplate = inject(PdfPortOfCallTemplateService);
  private readonly sso = inject(PdfSso0108PortCallsService);
  private readonly shipStores = inject(PdfShipStoresService);
  private readonly shipStores02 = inject(PdfShipStores02Service);
  private readonly shipStores03 = inject(PdfShipStores03Service);
  private readonly crewEffect = inject(PdfCrewEffectService);
  private readonly crewEffect02 = inject(PdfCrewEffect02Service);
  private readonly nil = inject(PdfNilListService);
  private readonly shipMoney = inject(PdfShipMoneyService);
  private readonly cashAdvance = inject(PdfCashAdvanceService);
  private readonly crewMoney = inject(PdfCrewMoneyListService);
  private readonly narcotic = inject(PdfNarcoticListService);
  private readonly mdh = inject(PdfMdhService);
  private readonly crewVaccine = inject(PdfCrewVaccineService);

  /** Selectable documents: built-ins plus user-uploaded PDFs. */
  available(): CatalogDocument[] {
    return buildPackageCatalog(this.storage.customDocuments()).map((entry) => ({
      id: entry.id,
      label: entry.label,
      enabled: true,
    }));
  }

  label(id: string): string {
    return packageCatalogLabelForId(id, this.storage.customDocuments());
  }

  /** Build the final (overlaid) PDF bytes + filename for a document id. */
  async buildBytes(id: string): Promise<BuiltPdf> {
    if (id.startsWith('custom:')) {
      return this.customBytes(id.slice('custom:'.length));
    }
    const base = this.appData();
    switch (id) {
      case 'crewListArrivalPassport':
        return this.crewType1Bytes(base, true, CREW_IDENTITY_PASSPORT);
      case 'crewListDeparturePassport':
        return this.crewType1Bytes(base, false, CREW_IDENTITY_PASSPORT);
      case 'crewListArrivalSeaman':
        return this.crewType1Bytes(base, true, CREW_IDENTITY_SEAMANS_BOOK);
      case 'crewListDepartureSeaman':
        return this.crewType1Bytes(base, false, CREW_IDENTITY_SEAMANS_BOOK);
      case 'crewListArrivalAlger':
        return this.crewAlgerBytes(base);
      case 'crewListArrivalV2':
        return this.crewV2Bytes(base, true);
      case 'crewListDepartureV2':
        return this.crewV2Bytes(base, false);
      case 'crewListArrivalV3Sbk':
        return this.crewV3SbkBytes(base, true);
      case 'crewListDepartureV3Sbk':
        return this.crewV3SbkBytes(base, false);
      case 'crewListArrivalV3SbkP':
        return this.crewV3SbkPBytes(base, true);
      case 'crewListDepartureV3SbkP':
        return this.crewV3SbkPBytes(base, false);
      case 'crewListArrivalV3SbkP2':
        return this.crewV3SbkP2Bytes(base, true);
      case 'crewListDepartureV3SbkP2':
        return this.crewV3SbkP2Bytes(base, false);
      case 'paxArrival':
        return this.paxBytes(base, true);
      case 'paxDeparture':
        return this.paxBytes(base, false);
      case 'paxArrivalV2':
        return this.paxV2Bytes(base, true);
      case 'paxDepartureV2':
        return this.paxV2Bytes(base, false);
      case 'portOfCall':
        return { bytes: await this.poc.buildFinalBytes(base), fileName: this.poc.fileName(base) };
      case 'portsOfCall':
        return {
          bytes: await this.pocTemplate.buildFinalBytes(base),
          fileName: this.pocTemplate.fileName(base),
        };
      case 'sso0108':
        return { bytes: await this.sso.buildFinalBytes(base), fileName: this.sso.fileName(base) };
      case 'shipStores':
        return {
          bytes: await this.shipStores.buildFinalBytes(base),
          fileName: this.shipStores.fileName(base),
        };
      case 'shipStores02':
        return {
          bytes: await this.shipStores02.buildFinalBytes(base),
          fileName: this.shipStores02.fileName(base),
        };
      case 'shipStores03':
        return {
          bytes: await this.shipStores03.buildFinalBytes(base),
          fileName: this.shipStores03.fileName(base),
        };
      case 'crewEffect':
        return {
          bytes: await this.crewEffect.buildFinalBytes(base),
          fileName: this.crewEffect.fileName(base),
        };
      case 'crewEffect02':
        return {
          bytes: await this.crewEffect02.buildFinalBytes(base),
          fileName: this.crewEffect02.fileName(base),
        };
      case 'nilList':
        return { bytes: await this.nil.buildFinalBytes(base), fileName: this.nil.fileName(base) };
      case 'shipMoney':
        return {
          bytes: await this.shipMoney.buildFinalBytes(base),
          fileName: this.shipMoney.fileName(base),
        };
      case 'cashAdvance':
        return {
          bytes: await this.cashAdvance.buildFinalBytes(base),
          fileName: this.cashAdvance.fileName(base),
        };
      case 'crewMoney':
        return {
          bytes: await this.crewMoney.buildFinalBytes(base),
          fileName: this.crewMoney.fileName(base),
        };
      case 'narcotic':
        return {
          bytes: await this.narcotic.buildFinalBytes(base),
          fileName: this.narcotic.fileName(base),
        };
      case 'mdh':
        return { bytes: await this.mdh.buildFinalBytes(base), fileName: this.mdh.fileName(base) };
      case 'crewVaccine':
        return {
          bytes: await this.crewVaccine.buildFinalBytes(base),
          fileName: this.crewVaccine.fileName(base),
        };
      default:
        throw new Error(`Unknown document: ${id}`);
    }
  }

  /** A user-uploaded static PDF (stored as base64). */
  private async customBytes(docId: string): Promise<BuiltPdf> {
    const doc = this.storage.customDocuments().find((d) => d.id === docId);
    if (!doc) throw new Error('Uploaded document not found');
    const fileName = /\.pdf$/i.test(doc.name) ? doc.name : `${doc.name}.pdf`;
    return { bytes: base64ToUint8(doc.dataBase64), fileName };
  }

  /** Type 1 crew list (Passport or Seaman's Book), arrival or departure. */
  private async crewType1Bytes(
    base: AppData,
    isArrival: boolean,
    identity: string,
  ): Promise<BuiltPdf> {
    const listType: AppData['documentOverlay']['crewList']['listType'] =
      identity === CREW_IDENTITY_SEAMANS_BOOK ? 'type1SeamansBook' : 'type1Passport';
    const crew = isArrival
      ? this.storage.activeCrewArrival()
      : this.storage.activeCrewDeparture();
    // Force the variant's type so rendering + per-type stamp placement match it,
    // regardless of which type the main-screen radio currently has selected.
    const data: AppData = {
      ...base,
      crewArr: { ...base.crewArr, isArrival, identityDocumentType: identity },
      documentOverlay: {
        ...base.documentOverlay,
        crewList: { ...base.documentOverlay.crewList, listType },
      },
    };
    const { ship } = base;
    const voyageDate = isArrival ? ship.dateOfArrival : ship.dateOfDeparture;
    const fileName = crewListIdentityPdfFileName(
      ship.name,
      ship.portOfCall,
      voyageDate,
      isArrival,
      identity,
    );
    const bytes = await this.crewPdf.buildPdfBytes(data, crew, { overlayId: 'crewList', fileName });
    return { bytes, fileName };
  }

  private async crewV3SbkBytes(base: AppData, isArrival: boolean): Promise<BuiltPdf> {
    const crew = isArrival
      ? this.storage.activeCrewArrival()
      : this.storage.activeCrewDeparture();
    const data: AppData = {
      ...base,
      crewArr: { ...base.crewArr, isArrival },
      documentOverlay: {
        ...base.documentOverlay,
        crewList: { ...base.documentOverlay.crewList, listType: 'type4V3Sbk' },
      },
    };
    return {
      bytes: await this.crewListV3Sbk.buildPreviewBytes(data, crew),
      fileName: this.crewListV3Sbk.fileName(data),
    };
  }

  private async crewV3SbkPBytes(base: AppData, isArrival: boolean): Promise<BuiltPdf> {
    const crew = isArrival
      ? this.storage.activeCrewArrival()
      : this.storage.activeCrewDeparture();
    const data: AppData = {
      ...base,
      crewArr: { ...base.crewArr, isArrival },
      documentOverlay: {
        ...base.documentOverlay,
        crewList: { ...base.documentOverlay.crewList, listType: 'type5V3SbkP' },
      },
    };
    return {
      bytes: await this.crewListV3SbkP.buildPreviewBytes(data, crew),
      fileName: this.crewListV3SbkP.fileName(data),
    };
  }

  private async crewV3SbkP2Bytes(base: AppData, isArrival: boolean): Promise<BuiltPdf> {
    const crew = isArrival
      ? this.storage.activeCrewArrival()
      : this.storage.activeCrewDeparture();
    const data: AppData = {
      ...base,
      crewArr: { ...base.crewArr, isArrival },
      documentOverlay: {
        ...base.documentOverlay,
        crewList: { ...base.documentOverlay.crewList, listType: 'type6V3SbkP2' },
      },
    };
    return {
      bytes: await this.crewListV3SbkP2.buildPreviewBytes(data, crew),
      fileName: this.crewListV3SbkP2.fileName(data),
    };
  }

  /** Crew List v2. */
  private async crewV2Bytes(base: AppData, isArrival: boolean): Promise<BuiltPdf> {
    const crew = isArrival
      ? this.storage.activeCrewArrival()
      : this.storage.activeCrewDeparture();
    const data: AppData = {
      ...base,
      crewArr: { ...base.crewArr, isArrival },
      documentOverlay: {
        ...base.documentOverlay,
        crewList: { ...base.documentOverlay.crewList, listType: 'type3V2' },
      },
    };
    return {
      bytes: await this.crewListV2.buildPreviewBytes(data, crew),
      fileName: this.crewListV2.fileName(data),
    };
  }

  /** Type 2 — Alger crew list (arrival only). */
  private async crewAlgerBytes(base: AppData): Promise<BuiltPdf> {
    const crew = this.storage.activeCrewArrival();
    const data: AppData = {
      ...base,
      crewArr: { ...base.crewArr, isArrival: true },
      documentOverlay: {
        ...base.documentOverlay,
        crewList: { ...base.documentOverlay.crewList, listType: 'type2Alger' },
      },
    };
    return {
      bytes: await this.type2.buildPreviewBytes(data, crew),
      fileName: this.type2.fileName(data),
    };
  }

  private async paxBytes(base: AppData, isArrival: boolean): Promise<BuiltPdf> {
    const passengers = isArrival
      ? this.storage.activePassengersArrival()
      : this.storage.activePassengersDeparture();
    const data: AppData = {
      ...base,
      crewArr: { ...base.crewArr, isArrival, identityDocumentType: PASSENGER_IDENTITY_DOCUMENT },
      paxArr: { ...base.paxArr, isArrival },
    };
    const { ship } = base;
    const voyageDate = isArrival ? ship.dateOfArrival : ship.dateOfDeparture;
    const fileName = passengerListPdfFileName(ship.name, ship.portOfCall, voyageDate, isArrival);
    const bytes = await this.crewPdf.buildPdfBytes(data, passengersToCrewRows(passengers), {
      overlayId: 'pax',
      title: IMO_PASSENGER_LIST_TITLE,
      fileName,
    });
    return { bytes, fileName };
  }

  private async paxV2Bytes(base: AppData, isArrival: boolean): Promise<BuiltPdf> {
    const passengers = isArrival
      ? this.storage.activePassengersArrival()
      : this.storage.activePassengersDeparture();
    const data: AppData = {
      ...base,
      paxArr: { ...base.paxArr, isArrival },
    };
    const fileName = this.passengerListV2.fileName(data);
    const bytes = await this.passengerListV2.buildPdfBytes(data, passengers);
    return { bytes, fileName };
  }

  private appData(): AppData {
    return {
      ship: this.storage.ship(),
      crew: this.storage.allCrew(),
      crewArr: this.storage.crewArr(),
      passengers: this.storage.allPassengers(),
      paxArr: this.storage.paxArr(),
      ports: this.storage.ports(),
      ranks: this.storage.ranks(),
      nationalities: this.storage.nationalities(),
      portCallHistory: this.storage.portCallHistory(),
      portOfCall: this.storage.portOfCall(),
      shipStoresForm: this.storage.shipStoresForm(),
      shipStoresForm02: this.storage.shipStoresForm02(),
      shipStoresForm03: this.storage.shipStoresForm03(),
      crewEffectForm: this.storage.crewEffectForm(),
      crewEffectForm02: this.storage.crewEffectForm02(),
      nilListForm: this.storage.nilListForm(),
      shipMoneyForm: this.storage.shipMoneyForm(),
      cashAdvanceForm: this.storage.cashAdvanceForm(),
      crewMoneyListForm: this.storage.crewMoneyListForm(),
      narcoticListForm: this.storage.narcoticListForm(),
      documentOverlay: this.storage.documentOverlay(),
      shipAssets: this.storage.shipAssets(),
      outputSettings: this.storage.outputSettings(),
      printPackages: this.storage.printPackages(),
      customDocuments: this.storage.customDocuments(),
    };
  }
}
