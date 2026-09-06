import { Injectable, inject } from '@angular/core';
import ExcelJS from 'exceljs';
import {
  AppData,
  CREW_IDENTITY_PASSPORT,
  CREW_IDENTITY_SEAMANS_BOOK,
  CrewMember,
} from '../models/crew.models';
import { CREW_LIST_TYPE_LABELS, CrewListTypeId } from '../models/document-overlay.models';
import { formatDisplayDate } from '../utils/date.util';
import { workbookToBytes } from '../utils/crew-list-excel-layout.util';
import {
  IMO_CREW_LIST_SHEET,
  addImoFalFormNote,
  buildImoCrewListFormLayout,
  chunkCrewForExcel,
  configureImoCrewListPrint,
  drawImoCrewListNil,
  fillImoCrewListHeader,
  fillImoCrewListRows,
} from '../utils/imo-crew-list-excel-layout.util';
import { openExcelBytes } from '../utils/excel-open.util';
import {
  crewListForm04PdfFileName,
  crewListType2PdfFileName,
  crewListForm05PdfFileName,
  crewListForm06PdfFileName,
  crewListForm07PdfFileName,
  pdfFileDate,
  pdfFileToken,
} from '../utils/pdf-filename.util';
import { StorageService } from './storage.service';
import { CREW_LIST_ROW_COUNT } from './crew-list-coordinates';
import { CrewListHtmlFormExcelService } from './crew-list-html-form-excel.service';

@Injectable({ providedIn: 'root' })
export class CrewListExcelService {
  private readonly storage = inject(StorageService);
  private readonly htmlFormExcel = inject(CrewListHtmlFormExcelService);

  async openForListType(listType: CrewListTypeId): Promise<boolean> {
    if (this.htmlFormExcel.isHtmlFormType(listType)) {
      return this.htmlFormExcel.openForListType(listType);
    }

    const base = this.appData();
    const bytes = await this.buildType1(base, listType);

    const fileName = this.fileName(base, listType);
    return openExcelBytes(fileName, bytes);
  }

  private async buildType1(base: AppData, listType: CrewListTypeId): Promise<Uint8Array> {
    const isArrival = base.crewArr.isArrival;
    const identity =
      listType === 'type1SeamansBook' ? CREW_IDENTITY_SEAMANS_BOOK : CREW_IDENTITY_PASSPORT;
    const crew = isArrival ? this.storage.activeCrewArrival() : this.storage.activeCrewDeparture();

    const { ship, crewArr } = base;
    const voyageDate = formatDisplayDate(isArrival ? ship.dateOfArrival : ship.dateOfDeparture);
    const pages = chunkCrewForExcel(crew);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'CREW Documents';

    pages.forEach((pageCrew, pageIndex) => {
      const sheetName =
        pageIndex === 0 ? IMO_CREW_LIST_SHEET : `${IMO_CREW_LIST_SHEET} (${pageIndex + 1})`;
      const ws = wb.addWorksheet(sheetName, {
        pageSetup: { paperSize: 9, orientation: 'portrait' },
      });

      const layout = buildImoCrewListFormLayout(ws, identity);
      fillImoCrewListHeader(ws, {
        ship,
        isArrival,
        identityDocumentType: identity,
        voyageDate,
        pageNo: pageIndex + 1,
      });

      if (pageCrew.length === 0) {
        drawImoCrewListNil(ws, layout);
      } else {
        fillImoCrewListRows(
          ws,
          pageCrew,
          crewArr.identityDocumentType || identity,
          layout.dataStart,
          pageIndex * CREW_LIST_ROW_COUNT,
        );
      }

      if (pageCrew.length < CREW_LIST_ROW_COUNT) {
        addImoFalFormNote(ws, layout.dataEnd);
      }
      configureImoCrewListPrint(ws, layout.lastRow);
    });

    return workbookToBytes(wb);
  }

  private fileName(base: AppData, listType: CrewListTypeId): string {
    const { ship, crewArr } = base;
    const isArrival = crewArr.isArrival;
    const voyageDate = isArrival ? ship.dateOfArrival : ship.dateOfDeparture;
    const pdfName = (() => {
      switch (listType) {
        case 'type1Passport':
        case 'type1SeamansBook':
          return this.type1PdfFileName(base, listType);
        case 'type2Alger':
          return crewListType2PdfFileName(ship.name, ship.portOfCall, voyageDate, isArrival);
        case 'type3V2':
          return crewListForm04PdfFileName(ship.name, ship.portOfCall, voyageDate, isArrival);
        case 'type4V3Sbk':
          return crewListForm05PdfFileName(ship.name, ship.portOfCall, voyageDate, isArrival);
        case 'type5V3SbkP':
          return crewListForm06PdfFileName(ship.name, ship.portOfCall, voyageDate, isArrival);
        case 'type6V3SbkP2':
          return crewListForm07PdfFileName(ship.name, ship.portOfCall, voyageDate, isArrival);
      }
    })();
    return pdfName.replace(/\.pdf$/i, '.xlsx');
  }

  private type1PdfFileName(base: AppData, listType: CrewListTypeId): string {
    const { ship, crewArr } = base;
    const isArrival = crewArr.isArrival;
    const voyageDate = isArrival ? ship.dateOfArrival : ship.dateOfDeparture;
    const typeToken = pdfFileToken(listType === 'type1SeamansBook' ? 'SeamansBook' : 'Passport');
    const dirToken = isArrival ? 'Arrival' : 'Departure';
    return `Crew_List_${typeToken}_${dirToken}_${pdfFileToken(ship.name)}_${pdfFileToken(ship.portOfCall)}_${pdfFileDate(voyageDate)}.pdf`;
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
      dgUnReference: this.storage.dgUnReference(),
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
