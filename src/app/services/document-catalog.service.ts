import { Injectable, inject } from '@angular/core';
import { AppData, CREW_IDENTITY_PASSPORT, CREW_IDENTITY_SEAMANS_BOOK } from '../models/crew.models';
import { base64ToUint8 } from '../utils/base64.util';
import { StorageService } from './storage.service';
import { PdfCrewArrService } from './pdf-crew-arr.service';
import { PdfCrewListForm01Service } from './pdf-crew-list-form01.service';
import { PdfCrewListForm02Service } from './pdf-crew-list-form02.service';
import { PdfCrewListForm04Service } from './pdf-crew-list-form04.service';
import { PdfCrewListForm03Service } from './pdf-crew-list-form03.service';
import { PdfCrewListForm05Service } from './pdf-crew-list-form05.service';
import { PdfCrewListForm06Service } from './pdf-crew-list-form06.service';
import { PdfCrewListForm07Service } from './pdf-crew-list-form07.service';
import { PdfPassengerListForm01Service } from './pdf-passenger-list-form01.service';
import { PdfPassengerListForm02Service } from './pdf-passenger-list-form02.service';
import { PdfPortOfCallService } from './pdf-port-of-call.service';
import { PdfPortOfCallTemplateService } from './pdf-port-of-call-template.service';
import { PdfSso0108PortCallsService } from './pdf-sso0108-port-calls.service';
import { PdfShipStoresService } from './pdf-ship-stores.service';
import { PdfShipStores02Service } from './pdf-ship-stores-02.service';
import { PdfShipStores03Service } from './pdf-ship-stores-03.service';
import { PdfCrewEffect02Service } from './pdf-crew-effect-02.service';
import { PdfCrewEffect03Service } from './pdf-crew-effect-03.service';
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
  private readonly passengerListForm01 = inject(PdfPassengerListForm01Service);
  private readonly passengerListForm02 = inject(PdfPassengerListForm02Service);
  private readonly crewListForm01 = inject(PdfCrewListForm01Service);
  private readonly crewListForm02 = inject(PdfCrewListForm02Service);
  private readonly crewListForm04 = inject(PdfCrewListForm04Service);
  private readonly crewListForm03 = inject(PdfCrewListForm03Service);
  private readonly crewListForm05 = inject(PdfCrewListForm05Service);
  private readonly crewListForm06 = inject(PdfCrewListForm06Service);
  private readonly crewListForm07 = inject(PdfCrewListForm07Service);
  private readonly poc = inject(PdfPortOfCallService);
  private readonly pocTemplate = inject(PdfPortOfCallTemplateService);
  private readonly sso = inject(PdfSso0108PortCallsService);
  private readonly shipStores = inject(PdfShipStoresService);
  private readonly shipStores02 = inject(PdfShipStores02Service);
  private readonly shipStores03 = inject(PdfShipStores03Service);
  private readonly crewEffect = inject(PdfCrewEffectService);
  private readonly crewEffect02 = inject(PdfCrewEffect02Service);
  private readonly crewEffect03 = inject(PdfCrewEffect03Service);
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
        return this.crewForm01Bytes(base, true);
      case 'crewListDeparturePassport':
        return this.crewForm01Bytes(base, false);
      case 'crewListArrivalSeaman':
        return this.crewForm02Bytes(base, true);
      case 'crewListDepartureSeaman':
        return this.crewForm02Bytes(base, false);
      case 'crewListArrivalAlger':
        return this.crewAlgerBytes(base, true);
      case 'crewListDepartureAlger':
        return this.crewAlgerBytes(base, false);
      case 'crewListArrivalV2': // Form 04 HTML
        return this.crewForm04Bytes(base, true);
      case 'crewListDepartureV2': // Form 04 HTML
        return this.crewForm04Bytes(base, false);
      case 'crewListArrivalV3Sbk':
        return this.crewForm05Bytes(base, true);
      case 'crewListDepartureV3Sbk':
        return this.crewForm05Bytes(base, false);
      case 'crewListArrivalV3SbkP':
        return this.crewForm06Bytes(base, true);
      case 'crewListDepartureV3SbkP':
        return this.crewForm06Bytes(base, false);
      case 'crewListArrivalV3SbkP2':
        return this.crewForm07Bytes(base, true);
      case 'crewListDepartureV3SbkP2':
        return this.crewForm07Bytes(base, false);
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
      case 'crewEffect03':
        return {
          bytes: await this.crewEffect03.buildFinalBytes(base),
          fileName: this.crewEffect03.fileName(base),
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

  /** Form 01 — IMO CREW LIST - P (Passport), arrival or departure. */
  private async crewForm01Bytes(base: AppData, isArrival: boolean): Promise<BuiltPdf> {
    const crew = isArrival ? this.storage.activeCrewArrival() : this.storage.activeCrewDeparture();
    const data: AppData = {
      ...base,
      crewArr: { ...base.crewArr, isArrival, identityDocumentType: CREW_IDENTITY_PASSPORT },
      documentOverlay: {
        ...base.documentOverlay,
        crewList: { ...base.documentOverlay.crewList, listType: 'type1Passport' },
      },
    };
    return {
      bytes: await this.crewListForm01.buildPdfBytes(data, crew, isArrival),
      fileName: this.crewListForm01.fileName(data, isArrival),
    };
  }

  /** Form 02 — IMO CREW LIST - SBK (Seaman's Book), arrival or departure. */
  private async crewForm02Bytes(base: AppData, isArrival: boolean): Promise<BuiltPdf> {
    const crew = isArrival ? this.storage.activeCrewArrival() : this.storage.activeCrewDeparture();
    const data: AppData = {
      ...base,
      crewArr: { ...base.crewArr, isArrival, identityDocumentType: CREW_IDENTITY_SEAMANS_BOOK },
      documentOverlay: {
        ...base.documentOverlay,
        crewList: { ...base.documentOverlay.crewList, listType: 'type1SeamansBook' },
      },
    };
    return {
      bytes: await this.crewListForm02.buildPdfBytes(data, crew, isArrival),
      fileName: this.crewListForm02.fileName(data, isArrival),
    };
  }

  private async crewForm05Bytes(base: AppData, isArrival: boolean): Promise<BuiltPdf> {
    const crew = isArrival ? this.storage.activeCrewArrival() : this.storage.activeCrewDeparture();
    const data: AppData = {
      ...base,
      crewArr: { ...base.crewArr, isArrival },
      documentOverlay: {
        ...base.documentOverlay,
        crewList: { ...base.documentOverlay.crewList, listType: 'type4V3Sbk' },
      },
    };
    return {
      bytes: await this.crewListForm05.buildPdfBytes(data, crew, isArrival),
      fileName: this.crewListForm05.fileName(data, isArrival),
    };
  }

  private async crewForm06Bytes(base: AppData, isArrival: boolean): Promise<BuiltPdf> {
    const crew = isArrival ? this.storage.activeCrewArrival() : this.storage.activeCrewDeparture();
    const data: AppData = {
      ...base,
      crewArr: { ...base.crewArr, isArrival },
      documentOverlay: {
        ...base.documentOverlay,
        crewList: { ...base.documentOverlay.crewList, listType: 'type5V3SbkP' },
      },
    };
    return {
      bytes: await this.crewListForm06.buildPdfBytes(data, crew, isArrival),
      fileName: this.crewListForm06.fileName(data, isArrival),
    };
  }

  private async crewForm07Bytes(base: AppData, isArrival: boolean): Promise<BuiltPdf> {
    const crew = isArrival ? this.storage.activeCrewArrival() : this.storage.activeCrewDeparture();
    const data: AppData = {
      ...base,
      crewArr: { ...base.crewArr, isArrival },
      documentOverlay: {
        ...base.documentOverlay,
        crewList: { ...base.documentOverlay.crewList, listType: 'type6V3SbkP2' },
      },
    };
    return {
      bytes: await this.crewListForm07.buildPdfBytes(data, crew, isArrival),
      fileName: this.crewListForm07.fileName(data, isArrival),
    };
  }

  /** Form 04 — CREW LIST [P][E][PI][G] (HTML editor). */
  private async crewForm04Bytes(base: AppData, isArrival: boolean): Promise<BuiltPdf> {
    const crew = isArrival ? this.storage.activeCrewArrival() : this.storage.activeCrewDeparture();
    const data: AppData = {
      ...base,
      crewArr: { ...base.crewArr, isArrival },
      documentOverlay: {
        ...base.documentOverlay,
        crewList: { ...base.documentOverlay.crewList, listType: 'type3V2' },
      },
    };
    return {
      bytes: await this.crewListForm04.buildPdfBytes(data, crew, isArrival),
      fileName: this.crewListForm04.fileName(data, isArrival),
    };
  }

  /** Form 03 — IMO CREW LIST [P][SBK][J][T]. */
  private async crewAlgerBytes(base: AppData, isArrival: boolean): Promise<BuiltPdf> {
    const crew = isArrival ? this.storage.activeCrewArrival() : this.storage.activeCrewDeparture();
    const data: AppData = {
      ...base,
      crewArr: { ...base.crewArr, isArrival },
      documentOverlay: {
        ...base.documentOverlay,
        crewList: { ...base.documentOverlay.crewList, listType: 'type2Alger' },
      },
    };
    return {
      bytes: await this.crewListForm03.buildPdfBytes(data, crew, isArrival),
      fileName: this.crewListForm03.fileName(data, isArrival),
    };
  }

  private async paxBytes(base: AppData, isArrival: boolean): Promise<BuiltPdf> {
    const passengers = isArrival
      ? this.storage.activePassengersArrival()
      : this.storage.activePassengersDeparture();
    const data: AppData = {
      ...base,
      paxArr: { ...base.paxArr, isArrival },
    };
    return {
      bytes: await this.passengerListForm01.buildPdfBytes(data, passengers, isArrival),
      fileName: this.passengerListForm01.fileName(data, isArrival),
    };
  }

  private async paxV2Bytes(base: AppData, isArrival: boolean): Promise<BuiltPdf> {
    const passengers = isArrival
      ? this.storage.activePassengersArrival()
      : this.storage.activePassengersDeparture();
    const data: AppData = {
      ...base,
      paxArr: { ...base.paxArr, isArrival },
    };
    return {
      bytes: await this.passengerListForm02.buildPdfBytes(data, passengers, isArrival),
      fileName: this.passengerListForm02.fileName(data, isArrival),
    };
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
      crewEffectForm03: this.storage.crewEffectForm03(),
      nilListForm: this.storage.nilListForm(),
      shipMoneyForm: this.storage.shipMoneyForm(),
      cashAdvanceForm: this.storage.cashAdvanceForm(),
      crewMoneyListForm: this.storage.crewMoneyListForm(),
      narcoticListForm: this.storage.narcoticListForm(),
      dgLibrary: this.storage.dgLibrary(),
      reeferLibrary: this.storage.reeferLibrary(),
      etaLibrary: this.storage.etaLibrary(),
      documentOverlay: this.storage.documentOverlay(),
      shipAssets: this.storage.shipAssets(),
      outputSettings: this.storage.outputSettings(),
      printPackages: this.storage.printPackages(),
      customDocuments: this.storage.customDocuments(),
    };
  }
}
