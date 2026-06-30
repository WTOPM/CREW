import { Injectable, inject } from '@angular/core';
import { AppData } from '../models/crew.models';
import { DocumentOverlayId } from '../models/document-overlay.models';
import { PdfCrewArrService } from './pdf-crew-arr.service';
import { PdfCrewListForm01Service } from './pdf-crew-list-form01.service';
import { PdfCrewListForm02Service } from './pdf-crew-list-form02.service';
import { PdfCrewListForm04Service } from './pdf-crew-list-form04.service';
import { PdfCrewListForm03Service } from './pdf-crew-list-form03.service';
import { PdfCrewListForm05Service } from './pdf-crew-list-form05.service';
import { PdfCrewListForm06Service } from './pdf-crew-list-form06.service';
import { PdfCrewListForm07Service } from './pdf-crew-list-form07.service';
import { PdfMdhService } from './pdf-mdh.service';
import { PdfPassengerListForm01Service } from './pdf-passenger-list-form01.service';
import { PdfPassengerListForm02Service } from './pdf-passenger-list-form02.service';
import { PdfPortOfCallService } from './pdf-port-of-call.service';
import { PdfPortOfCallTemplateService } from './pdf-port-of-call-template.service';
import { PdfCrewEffect02Service } from './pdf-crew-effect-02.service';
import { PdfCrewEffect03Service } from './pdf-crew-effect-03.service';
import { PdfCrewEffectService } from './pdf-crew-effect.service';
import { PdfNilListService } from './pdf-nil-list.service';
import { PdfShipMoneyService } from './pdf-ship-money.service';
import { PdfCashAdvanceService } from './pdf-cash-advance.service';
import { PdfCrewMoneyListService } from './pdf-crew-money-list.service';
import { PdfNarcoticListService } from './pdf-narcotic-list.service';
import { PdfSso0108PortCallsService } from './pdf-sso0108-port-calls.service';
import { PdfCrewVaccineService } from './pdf-crew-vaccine.service';
import { PdfShipStoresService } from './pdf-ship-stores.service';
import { PdfShipStores02Service } from './pdf-ship-stores-02.service';
import { PdfShipStores03Service } from './pdf-ship-stores-03.service';
import { StorageService } from './storage.service';

export type MdhOverlayPreviewPage = 'form' | 'attachment';

/** PDF bytes for stamp placement preview (no stamp/signature drawn). */
@Injectable({ providedIn: 'root' })
export class DocumentOverlayPreviewService {
  private readonly storage = inject(StorageService);
  private readonly crewPdf = inject(PdfCrewArrService);
  private readonly passengerListForm01Pdf = inject(PdfPassengerListForm01Service);
  private readonly passengerListForm02Pdf = inject(PdfPassengerListForm02Service);
  private readonly crewListForm01Pdf = inject(PdfCrewListForm01Service);
  private readonly crewListForm02Pdf = inject(PdfCrewListForm02Service);
  private readonly crewListForm04Pdf = inject(PdfCrewListForm04Service);
  private readonly crewListForm03Pdf = inject(PdfCrewListForm03Service);
  private readonly crewListForm05Pdf = inject(PdfCrewListForm05Service);
  private readonly crewListForm06Pdf = inject(PdfCrewListForm06Service);
  private readonly crewListForm07Pdf = inject(PdfCrewListForm07Service);
  private readonly pocPdf = inject(PdfPortOfCallService);
  private readonly pocTemplatePdf = inject(PdfPortOfCallTemplateService);
  private readonly mdhPdf = inject(PdfMdhService);
  private readonly crewVaccinePdf = inject(PdfCrewVaccineService);
  private readonly shipStoresPdf = inject(PdfShipStoresService);
  private readonly shipStores02Pdf = inject(PdfShipStores02Service);
  private readonly shipStores03Pdf = inject(PdfShipStores03Service);
  private readonly crewEffectPdf = inject(PdfCrewEffectService);
  private readonly crewEffect02Pdf = inject(PdfCrewEffect02Service);
  private readonly crewEffect03Pdf = inject(PdfCrewEffect03Service);
  private readonly nilListPdf = inject(PdfNilListService);
  private readonly shipMoneyPdf = inject(PdfShipMoneyService);
  private readonly cashAdvancePdf = inject(PdfCashAdvanceService);
  private readonly crewMoneyListPdf = inject(PdfCrewMoneyListService);
  private readonly narcoticListPdf = inject(PdfNarcoticListService);
  private readonly sso0108PortCallsPdf = inject(PdfSso0108PortCallsService);

  async build(
    documentId: DocumentOverlayId,
    mdhPage: MdhOverlayPreviewPage = 'form',
  ): Promise<Uint8Array> {
    const data = this.appData();
    switch (documentId) {
      case 'crewList':
        return this.buildCrewList(data);
      case 'pax':
        return this.buildPassengerList(data);
      case 'paxV2':
        return this.buildPassengerListV2(data);
      case 'portOfCall':
        return this.pocPdf.buildPdfBytes(data);
      case 'portsOfCall':
        return this.pocTemplatePdf.build(data);
      case 'mdh':
        return this.mdhPdf.build(data);
      case 'crewVaccine':
        return this.crewVaccinePdf.build(data);
      case 'shipStores':
        return this.shipStoresPdf.buildPdfBytes(data);
      case 'shipStores02':
        return this.shipStores02Pdf.buildPdfBytes(data);
      case 'shipStores03':
        return this.shipStores03Pdf.build(data);
      case 'crewEffect':
        return this.crewEffectPdf.buildPdfBytes(data);
      case 'crewEffect02':
        return this.crewEffect02Pdf.buildPdfBytes(data);
      case 'crewEffect03':
        return this.crewEffect03Pdf.build(data);
      case 'nilList':
        return this.nilListPdf.build(data);
      case 'shipMoney':
        return this.shipMoneyPdf.build(data);
      case 'cashAdvance':
        return this.cashAdvancePdf.build(data);
      case 'crewMoney':
        return this.crewMoneyListPdf.build(data);
      case 'narcoticList':
        return this.narcoticListPdf.build(data);
      case 'sso0108PortCalls':
        return this.sso0108PortCallsPdf.build(data);
      default:
        throw new Error(`Unknown document: ${documentId}`);
    }
  }

  /** 1-based page index for pdf.js (MDH attachment = page 2). */
  pdfJsPageNumber(documentId: DocumentOverlayId, mdhPage: MdhOverlayPreviewPage): number {
    if (
      (documentId === 'mdh' || documentId === 'shipStores03' || documentId === 'crewEffect03') &&
      mdhPage === 'attachment'
    ) {
      return 2;
    }
    return 1;
  }

  private async buildCrewList(data: AppData): Promise<Uint8Array> {
    const listType = data.documentOverlay.crewList.listType;

    if (listType === 'type1Passport') {
      const crew = data.crewArr.isArrival
        ? this.storage.activeCrewArrival()
        : this.storage.activeCrewDeparture();
      return this.crewListForm01Pdf.buildPdfBytes(data, crew, data.crewArr.isArrival);
    }

    if (listType === 'type1SeamansBook') {
      const crew = data.crewArr.isArrival
        ? this.storage.activeCrewArrival()
        : this.storage.activeCrewDeparture();
      return this.crewListForm02Pdf.buildPdfBytes(data, crew, data.crewArr.isArrival);
    }

    if (listType === 'type2Alger') {
      const crew = data.crewArr.isArrival
        ? this.storage.activeCrewArrival()
        : this.storage.activeCrewDeparture();
      return this.crewListForm03Pdf.buildPdfBytes(data, crew, data.crewArr.isArrival);
    }

    if (listType === 'type3V2') {
      const crew = data.crewArr.isArrival
        ? this.storage.activeCrewArrival()
        : this.storage.activeCrewDeparture();
      return this.crewListForm04Pdf.buildPdfBytes(data, crew, data.crewArr.isArrival);
    }

    if (listType === 'type4V3Sbk') {
      const crew = data.crewArr.isArrival
        ? this.storage.activeCrewArrival()
        : this.storage.activeCrewDeparture();
      return this.crewListForm05Pdf.buildPdfBytes(data, crew, data.crewArr.isArrival);
    }

    if (listType === 'type5V3SbkP') {
      const crew = data.crewArr.isArrival
        ? this.storage.activeCrewArrival()
        : this.storage.activeCrewDeparture();
      return this.crewListForm06Pdf.buildPdfBytes(data, crew, data.crewArr.isArrival);
    }

    if (listType === 'type6V3SbkP2') {
      const crew = data.crewArr.isArrival
        ? this.storage.activeCrewArrival()
        : this.storage.activeCrewDeparture();
      return this.crewListForm07Pdf.buildPdfBytes(data, crew, data.crewArr.isArrival);
    }

    throw new Error(`Unknown crew list type: ${listType}`);
  }

  private buildPassengerList(data: AppData): Promise<Uint8Array> {
    const passengers = data.paxArr.isArrival
      ? this.storage.activePassengersArrival()
      : this.storage.activePassengersDeparture();
    return this.passengerListForm01Pdf.buildPdfBytes(data, passengers, data.paxArr.isArrival);
  }

  private buildPassengerListV2(data: AppData): Promise<Uint8Array> {
    const passengers = data.paxArr.isArrival
      ? this.storage.activePassengersArrival()
      : this.storage.activePassengersDeparture();
    return this.passengerListForm02Pdf.buildPdfBytes(data, passengers, data.paxArr.isArrival);
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
