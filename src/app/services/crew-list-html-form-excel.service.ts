import { Injectable, inject } from '@angular/core';
import { AppData, CrewMember, createEmptyCrewMember } from '../models/crew.models';
import {
  CREW_FORM_01,
  CREW_FORM_02,
  CREW_FORM_03,
  CREW_FORM_04,
  CREW_FORM_05,
  CREW_FORM_06,
  CREW_FORM_07,
  CrewListTypeId,
  CrewListVariantSettings,
} from '../models/document-overlay.models';
import {
  HTML_FORM_EXCEL_STORAGE_KEY,
  HtmlFormExcelSnapshot,
  parseHtmlFormExcelSnapshot,
} from '../models/html-form-excel-snapshot.model';
import { openExcelBytes } from '../utils/excel-open.util';
import {
  buildAlgerCrewListExcel,
  buildCrewListVariantExcel,
} from '../utils/crew-list-variant-excel.util';
import { buildImoCrewListExcelBytes } from '../utils/imo-crew-list-excel-layout.util';
import {
  crewListForm04PdfFileName,
  crewListForm05PdfFileName,
  crewListForm06PdfFileName,
  crewListForm07PdfFileName,
  crewListIdentityPdfFileName,
  crewListType2PdfFileName,
} from '../utils/pdf-filename.util';
import { CREW_IDENTITY_PASSPORT, CREW_IDENTITY_SEAMANS_BOOK } from '../models/crew.models';
import { StorageService } from './storage.service';

type HtmlCrewFormType =
  | typeof CREW_FORM_01
  | typeof CREW_FORM_02
  | typeof CREW_FORM_03
  | typeof CREW_FORM_04
  | typeof CREW_FORM_05
  | typeof CREW_FORM_06
  | typeof CREW_FORM_07;
type VariantListType = 'type3V2' | 'type4V3Sbk' | 'type5V3SbkP' | 'type6V3SbkP2';

export interface HtmlFormExcelBuildResult {
  fileName: string;
  bytes: Uint8Array;
}

@Injectable({ providedIn: 'root' })
export class CrewListHtmlFormExcelService {
  private readonly storage = inject(StorageService);

  isHtmlFormType(listType: CrewListTypeId): listType is HtmlCrewFormType {
    return (
      listType === CREW_FORM_01 ||
      listType === CREW_FORM_02 ||
      listType === CREW_FORM_03 ||
      listType === CREW_FORM_04 ||
      listType === CREW_FORM_05 ||
      listType === CREW_FORM_06 ||
      listType === CREW_FORM_07
    );
  }

  /** Build .xlsx bytes from a sessionStorage snapshot written by an HTML form editor. */
  async buildFromSessionStorage(): Promise<HtmlFormExcelBuildResult | null> {
    const snapshot = parseHtmlFormExcelSnapshot(
      sessionStorage.getItem(HTML_FORM_EXCEL_STORAGE_KEY),
    );
    sessionStorage.removeItem(HTML_FORM_EXCEL_STORAGE_KEY);
    if (!snapshot || !this.isHtmlFormType(snapshot.listType)) {
      return null;
    }
    return this.buildFromSnapshot(snapshot);
  }

  /** Called from documents-nav when returning from an HTML form editor export request. */
  async openFromSessionStorage(): Promise<boolean> {
    const built = await this.buildFromSessionStorage();
    if (!built) {
      return false;
    }
    return openExcelBytes(built.fileName, built.bytes);
  }

  async openForListType(listType: HtmlCrewFormType): Promise<boolean> {
    const isArrival = this.storage.crewArr().isArrival;
    const crew = isArrival ? this.storage.activeCrewArrival() : this.storage.activeCrewDeparture();
    const data = this.appData(isArrival);
    const bytes = await this.buildStructuredExcelBytes(listType, data, crew);
    return openExcelBytes(this.fileName(listType, data, isArrival), bytes);
  }

  async buildFromSnapshot(
    snapshot: HtmlFormExcelSnapshot,
  ): Promise<HtmlFormExcelBuildResult | null> {
    if (!this.isHtmlFormType(snapshot.listType)) {
      return null;
    }
    const listType = snapshot.listType;
    const data = this.appData(snapshot.isArrival);
    const crew = snapshot.crew.map((row) => this.toCrewMember(row));
    this.mergeOverlaySnapshot(data, snapshot);
    const bytes = await this.buildStructuredExcelBytes(listType, data, crew);
    const fileName = snapshot.fileName?.trim() || this.fileName(listType, data, snapshot.isArrival);
    return { fileName, bytes };
  }

  async openFromSnapshot(snapshot: HtmlFormExcelSnapshot): Promise<boolean> {
    const built = await this.buildFromSnapshot(snapshot);
    if (!built) {
      return false;
    }
    return openExcelBytes(built.fileName, built.bytes);
  }

  private async buildStructuredExcelBytes(
    listType: HtmlCrewFormType,
    data: AppData,
    crew: CrewMember[],
  ): Promise<Uint8Array> {
    if (listType === CREW_FORM_01 || listType === CREW_FORM_02) {
      return buildImoCrewListExcelBytes(data, crew, listType);
    }
    if (listType === CREW_FORM_03) {
      return buildAlgerCrewListExcel(data, crew);
    }
    if (listType === CREW_FORM_04) {
      return buildCrewListVariantExcel('type3V2' satisfies VariantListType, data, crew);
    }
    if (listType === CREW_FORM_05) {
      return buildCrewListVariantExcel('type4V3Sbk' satisfies VariantListType, data, crew);
    }
    if (listType === CREW_FORM_06) {
      return buildCrewListVariantExcel('type5V3SbkP' satisfies VariantListType, data, crew);
    }
    return buildCrewListVariantExcel('type6V3SbkP2' satisfies VariantListType, data, crew);
  }

  private mergeOverlaySnapshot(data: AppData, snapshot: HtmlFormExcelSnapshot): void {
    const typeKey = snapshot.listType;
    const prev: CrewListVariantSettings | undefined = data.documentOverlay.crewList.byType[typeKey];
    const { overlay } = snapshot;
    data.documentOverlay = {
      ...data.documentOverlay,
      crewList: {
        ...data.documentOverlay.crewList,
        listType: snapshot.listType,
        byType: {
          ...data.documentOverlay.crewList.byType,
          [typeKey]: {
            useStamp: !!overlay.stamp?.visible,
            useSignature: !!overlay.sig?.visible,
            overlayRotation: prev?.overlayRotation,
            stampBox: overlay.stamp?.visible ? this.cssBox(overlay.stamp) : prev?.stampBox,
            signatureBox: overlay.sig?.visible ? this.cssBox(overlay.sig) : prev?.signatureBox,
            cellStyles: overlay.cellStyles ?? prev?.cellStyles,
            footerSignatureDate: prev?.footerSignatureDate,
          },
        },
      },
    };
  }

  private cssBox(box: {
    left?: string;
    top?: string;
    width?: string;
    height?: string;
  }): { left: string; top: string; width: string; height: string } | undefined {
    if (!box.left || !box.top || !box.width || !box.height) return undefined;
    return {
      left: box.left,
      top: box.top,
      width: box.width,
      height: box.height,
    };
  }

  private toCrewMember(row: HtmlFormExcelSnapshot['crew'][number]): CrewMember {
    return {
      ...createEmptyCrewMember(),
      familyName: row.familyName ?? '',
      givenNames: row.givenNames ?? '',
      rank: row.rank ?? '',
      nationality: row.nationality ?? '',
      dateOfBirth: row.dateOfBirth ?? '',
      placeOfBirth: row.placeOfBirth ?? '',
      passport: row.passport ?? '',
      passportExpiryDate: row.passportExpiryDate ?? '',
      passportPlaceOfIssue: row.passportPlaceOfIssue ?? '',
      gender: row.gender === 'MALE' || row.gender === 'FEMALE' ? row.gender : '',
      seamansBook: row.seamansBook ?? '',
      seamansBookPlaceOfIssue: row.seamansBookPlaceOfIssue ?? '',
      sbookExpiryDate: row.sbookExpiryDate ?? '',
      joiningDate: row.joiningDate ?? '',
      joiningPort: row.joiningPort ?? '',
    };
  }

  private fileName(listType: HtmlCrewFormType, data: AppData, isArrival: boolean): string {
    const { ship } = data;
    const voyageDate = isArrival ? ship.dateOfArrival : ship.dateOfDeparture;
    const pdfName = (() => {
      switch (listType) {
        case CREW_FORM_01:
          return crewListIdentityPdfFileName(
            ship.name,
            ship.portOfCall,
            voyageDate,
            isArrival,
            CREW_IDENTITY_PASSPORT,
          );
        case CREW_FORM_02:
          return crewListIdentityPdfFileName(
            ship.name,
            ship.portOfCall,
            voyageDate,
            isArrival,
            CREW_IDENTITY_SEAMANS_BOOK,
          );
        case CREW_FORM_03:
          return crewListType2PdfFileName(ship.name, ship.portOfCall, voyageDate, isArrival);
        case CREW_FORM_04:
          return crewListForm04PdfFileName(ship.name, ship.portOfCall, voyageDate, isArrival);
        case CREW_FORM_05:
          return crewListForm05PdfFileName(ship.name, ship.portOfCall, voyageDate, isArrival);
        case CREW_FORM_06:
          return crewListForm06PdfFileName(ship.name, ship.portOfCall, voyageDate, isArrival);
        case CREW_FORM_07:
          return crewListForm07PdfFileName(ship.name, ship.portOfCall, voyageDate, isArrival);
      }
    })();
    return pdfName.replace(/\.pdf$/i, '.xlsx');
  }

  private appData(isArrival: boolean): AppData {
    return {
      ship: this.storage.ship(),
      crew: this.storage.allCrew(),
      crewArr: { ...this.storage.crewArr(), isArrival },
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
      dgUnReference: this.storage.dgUnReference(),
      reeferLibrary: this.storage.reeferLibrary(),
      etaLibrary: this.storage.etaLibrary(),
      documentOverlay: structuredClone(this.storage.documentOverlay()),
      shipAssets: this.storage.shipAssets(),
      outputSettings: this.storage.outputSettings(),
      printPackages: this.storage.printPackages(),
      customDocuments: this.storage.customDocuments(),
    };
  }
}
