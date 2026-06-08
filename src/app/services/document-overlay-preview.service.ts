import { Injectable, inject } from '@angular/core';
import {
  AppData,
  CREW_IDENTITY_PASSPORT,
  CREW_IDENTITY_SEAMANS_BOOK,
} from '../models/crew.models';
import { DocumentOverlayId } from '../models/document-overlay.models';
import { passengersToCrewRows } from '../utils/passenger-pdf.util';
import { PdfCrewArrService } from './pdf-crew-arr.service';
import { PdfCrewListType2Service } from './pdf-crew-list-type2.service';
import { PdfCrewListV2Service } from './pdf-crew-list-v2.service';
import { PdfMdhService } from './pdf-mdh.service';
import { PdfPortOfCallService } from './pdf-port-of-call.service';
import { PdfCrewEffectService } from './pdf-crew-effect.service';
import { PdfNilListService } from './pdf-nil-list.service';
import { PdfShipMoneyService } from './pdf-ship-money.service';
import { PdfCashAdvanceService } from './pdf-cash-advance.service';
import { PdfCrewMoneyListService } from './pdf-crew-money-list.service';
import { PdfNarcoticListService } from './pdf-narcotic-list.service';
import { PdfSso0108PortCallsService } from './pdf-sso0108-port-calls.service';
import { PdfCrewVaccineService } from './pdf-crew-vaccine.service';
import { PdfShipStoresService } from './pdf-ship-stores.service';
import { StorageService } from './storage.service';

export type MdhOverlayPreviewPage = 'form' | 'attachment';

/** PDF bytes for stamp placement preview (no stamp/signature drawn). */
@Injectable({ providedIn: 'root' })
export class DocumentOverlayPreviewService {
  private readonly storage = inject(StorageService);
  private readonly crewPdf = inject(PdfCrewArrService);
  private readonly crewListType2Pdf = inject(PdfCrewListType2Service);
  private readonly crewListV2Pdf = inject(PdfCrewListV2Service);
  private readonly pocPdf = inject(PdfPortOfCallService);
  private readonly mdhPdf = inject(PdfMdhService);
  private readonly crewVaccinePdf = inject(PdfCrewVaccineService);
  private readonly shipStoresPdf = inject(PdfShipStoresService);
  private readonly crewEffectPdf = inject(PdfCrewEffectService);
  private readonly nilListPdf = inject(PdfNilListService);
  private readonly shipMoneyPdf = inject(PdfShipMoneyService);
  private readonly cashAdvancePdf = inject(PdfCashAdvanceService);
  private readonly crewMoneyListPdf = inject(PdfCrewMoneyListService);
  private readonly narcoticListPdf = inject(PdfNarcoticListService);
  private readonly sso0108PortCallsPdf = inject(PdfSso0108PortCallsService);

  async build(documentId: DocumentOverlayId, mdhPage: MdhOverlayPreviewPage = 'form'): Promise<Uint8Array> {
    const data = this.appData();
    switch (documentId) {
      case 'crewList':
        return this.buildCrewList(data);
      case 'pax':
        return this.buildPassengerList(data);
      case 'portOfCall':
        return this.pocPdf.buildPdfBytes(data);
      case 'mdh':
        return this.mdhPdf.build(data);
      case 'crewVaccine':
        return this.crewVaccinePdf.build(data);
      case 'shipStores':
        return this.shipStoresPdf.build(data);
      case 'crewEffect':
        return this.crewEffectPdf.build(data);
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
    if (documentId === 'mdh' && mdhPage === 'attachment') {
      return 2;
    }
    return 1;
  }

  private async buildCrewList(data: AppData): Promise<Uint8Array> {
    const listType = data.documentOverlay.crewList.listType;
    const crew = this.storage.activeCrewArrival();

    if (listType === 'type2Alger') {
      const arrivalData: AppData = {
        ...data,
        crewArr: { ...data.crewArr, isArrival: true },
      };
      return this.crewListType2Pdf.build(arrivalData, crew);
    }

    if (listType === 'type3V2') {
      return this.crewListV2Pdf.build(data);
    }

    const identityDocumentType =
      listType === 'type1SeamansBook' ? CREW_IDENTITY_SEAMANS_BOOK : CREW_IDENTITY_PASSPORT;
    const pdfData: AppData = {
      ...data,
      crewArr: { ...data.crewArr, isArrival: true, identityDocumentType },
    };
    return this.crewPdf.buildPdfBytes(pdfData, crew);
  }

  private buildPassengerList(data: AppData): Promise<Uint8Array> {
    const passengers = this.storage.activePassengersArrival();
    const pdfData: AppData = {
      ...data,
      crewArr: { ...data.crewArr, isArrival: data.paxArr.isArrival },
    };
    return this.crewPdf.buildPdfBytes(pdfData, passengersToCrewRows(passengers), { overlayId: 'pax' });
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
      crewEffectForm: this.storage.crewEffectForm(),
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
