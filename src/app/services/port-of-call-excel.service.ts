import { Injectable, inject } from '@angular/core';
import ExcelJS from 'exceljs';
import {
  AppData,
  chunkPortCallHistoryForPdf,
  selectPortCallHistoryForPdf,
} from '../models/crew.models';
import { POC_TEMPLATE_ROW_COUNT } from './port-of-call-coordinates';
import { workbookToBytes } from '../utils/crew-list-excel-layout.util';
import { openExcelBytes } from '../utils/excel-open.util';
import { pdfFileDate, pdfFileToken, portOfCallPdfFileName } from '../utils/pdf-filename.util';
import {
  POC_EXCEL_SHEET,
  buildPocFormLayout,
  configurePocPrint,
  fillPocDataRows,
  fillPocHeaderValues,
} from '../utils/port-of-call-excel-layout.util';
import { buildPortOfCallSecurityWorkbook } from '../utils/port-of-call-security-excel-layout.util';
import { PortSettingsDocId } from '../models/crew.models';
import { POC_TEMPLATE_ROWS_PER_PAGE } from './port-of-call-template-coordinates';
import { StorageService } from './storage.service';

@Injectable({ providedIn: 'root' })
export class PortOfCallExcelService {
  private readonly storage = inject(StorageService);

  async openForDoc(doc: PortSettingsDocId): Promise<boolean> {
    const base = this.appData();
    const bytes =
      doc === 'portsOfCall' ? await this.buildSecurity(base) : await this.build(base);
    const voyageDate = base.ship.dateOfArrival || base.ship.dateOfDeparture;
    const fileName =
      doc === 'portsOfCall'
        ? `Port_of_Call_Security_${pdfFileToken(base.ship.name)}_${pdfFileDate(voyageDate)}.xlsx`
        : portOfCallPdfFileName(base.ship.name, voyageDate).replace(/\.pdf$/i, '.xlsx');
    return openExcelBytes(fileName, bytes);
  }

  async open(): Promise<boolean> {
    return this.openForDoc('portOfCall');
  }

  private async build(data: AppData): Promise<Uint8Array> {
    const selected = selectPortCallHistoryForPdf(data.portCallHistory, data.portOfCall.pdfRowCount);
    const pages = chunkPortCallHistoryForPdf(selected, POC_TEMPLATE_ROW_COUNT);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'CREW Documents';

    pages.forEach((pageRows, pageIndex) => {
      const sheetName =
        pageIndex === 0 ? POC_EXCEL_SHEET : `${POC_EXCEL_SHEET} (${pageIndex + 1})`;
      const ws = wb.addWorksheet(sheetName, {
        pageSetup: { paperSize: 9, orientation: 'portrait' },
      });

      const layout = buildPocFormLayout(ws);
      fillPocHeaderValues(ws, data.ship);
      fillPocDataRows(ws, pageRows, pageIndex * POC_TEMPLATE_ROW_COUNT, layout.dataStart);
      configurePocPrint(ws, layout.signatureRow);
    });

    if (pages.length === 0) {
      const ws = wb.addWorksheet(POC_EXCEL_SHEET, {
        pageSetup: { paperSize: 9, orientation: 'portrait' },
      });
      const layout = buildPocFormLayout(ws);
      fillPocHeaderValues(ws, data.ship);
      configurePocPrint(ws, layout.signatureRow);
    }

    return workbookToBytes(wb);
  }

  private async buildSecurity(data: AppData): Promise<Uint8Array> {
    const selected = selectPortCallHistoryForPdf(data.portCallHistory, data.portOfCall.pdfRowCount);
    const pages = chunkPortCallHistoryForPdf(selected, POC_TEMPLATE_ROWS_PER_PAGE);
    return buildPortOfCallSecurityWorkbook(data.ship, data.ports, data.crew, pages);
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
      documentOverlay: this.storage.documentOverlay(),
      shipAssets: this.storage.shipAssets(),
      outputSettings: this.storage.outputSettings(),
      printPackages: this.storage.printPackages(),
      customDocuments: this.storage.customDocuments(),
    };
  }
}
