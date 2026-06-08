import { Injectable, inject } from '@angular/core';
import ExcelJS from 'exceljs';
import {
  AppData,
  CREW_IDENTITY_PASSPORT,
  CREW_IDENTITY_SEAMANS_BOOK,
  CrewMember,
  formatCrewListName,
  formatPortCallPortName,
  portCode,
} from '../models/crew.models';
import {
  CREW_LIST_TYPE_LABELS,
  CrewListTypeId,
} from '../models/document-overlay.models';
import { formatBirthDate, formatDisplayDate } from '../utils/date.util';
import {
  applyMetaLabel,
  applyMetaValue,
  applyTableBody,
  applyTableHeader,
  applyTitle,
  configurePrint,
  mergeMetaBlock,
  setColumnWidths,
  workbookToBytes,
  writeMetaRow,
} from '../utils/crew-list-excel-layout.util';
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
import { pdfFileDate, pdfFileToken } from '../utils/pdf-filename.util';
import { StorageService } from './storage.service';
import { CREW_LIST_BODY_NIL_LABEL, CREW_LIST_ROW_COUNT } from './crew-list-coordinates';

@Injectable({ providedIn: 'root' })
export class CrewListExcelService {
  private readonly storage = inject(StorageService);

  async openForListType(listType: CrewListTypeId): Promise<boolean> {
    const base = this.appData();
    const bytes =
      listType === 'type2Alger'
        ? await this.buildAlger(base, this.storage.activeCrewArrival())
        : await this.buildType1(base, listType);
    const fileName = this.fileName(base, listType);
    return openExcelBytes(fileName, bytes);
  }

  private async buildType1(base: AppData, listType: CrewListTypeId): Promise<Uint8Array> {
    const isArrival = base.crewArr.isArrival;
    const identity =
      listType === 'type1SeamansBook' ? CREW_IDENTITY_SEAMANS_BOOK : CREW_IDENTITY_PASSPORT;
    const crew = isArrival
      ? this.storage.activeCrewArrival()
      : this.storage.activeCrewDeparture();

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

  private async buildAlger(base: AppData, crew: CrewMember[]): Promise<Uint8Array> {
    const { ship, ports } = base;
    const voyageDate = formatDisplayDate(ship.dateOfArrival);
    const portFromTo = [ship.lastPortOfCall, ship.nextPortOfCall]
      .filter(Boolean)
      .map((p) => formatPortCallPortName(p))
      .join(' / ');

    const columns = [
      'No.',
      'Family name and given names',
      'Rank',
      'Nationality',
      'Date of birth',
      'Place of birth',
      'Passport No.',
      "Seaman's book No.",
      'Joining date',
      'Joining port',
    ];
    const colCount = columns.length;

    const wb = new ExcelJS.Workbook();
    wb.creator = 'CREW Documents';
    const ws = wb.addWorksheet('Crew List Alger', {
      pageSetup: { paperSize: 9, orientation: 'landscape' },
    });

    setColumnWidths(ws, [5, 28, 12, 14, 12, 22, 14, 16, 12, 12]);

    ws.mergeCells(1, 1, 1, colCount);
    const titleCell = ws.getCell(1, 1);
    titleCell.value = CREW_LIST_TYPE_LABELS.type2Alger;
    applyTitle(titleCell);
    ws.getRow(1).height = 28;

    const metaStart = 3;
    writeMetaRow(ws, metaStart, 'Ship name', ship.name);
    writeMetaRow(ws, metaStart + 1, 'Ship nationality', ship.nationality);
    writeMetaRow(ws, metaStart + 2, 'Port of call', ship.portOfCall);
    writeMetaRow(ws, metaStart + 3, 'Date of arrival', voyageDate);
    writeMetaRow(ws, metaStart + 4, 'Last / Next port', portFromTo);
    mergeMetaBlock(ws, metaStart, metaStart + 4, colCount);

    for (let r = metaStart; r <= metaStart + 4; r++) {
      ws.getRow(r).height = 20;
    }

    const headerRow = metaStart + 6;
    columns.forEach((label, i) => {
      const cell = ws.getCell(headerRow, i + 1);
      cell.value = label;
      applyTableHeader(cell);
    });
    ws.getRow(headerRow).height = 36;

    let bodyRow = headerRow + 1;
    if (crew.length === 0) {
      ws.mergeCells(bodyRow, 1, bodyRow, colCount);
      const nilCell = ws.getCell(bodyRow, 1);
      nilCell.value = CREW_LIST_BODY_NIL_LABEL;
      applyTableBody(nilCell, 'center');
      nilCell.font = { name: 'Calibri', size: 24, bold: true, color: { argb: 'FF94A3B8' } };
      ws.getRow(bodyRow).height = 48;
      bodyRow++;
    } else {
      crew.forEach((member, index) => {
        const row = bodyRow + index;
        const values = [
          index + 1,
          formatCrewListName(member),
          member.rank,
          member.nationality,
          formatBirthDate(member.dateOfBirth),
          member.placeOfBirth,
          member.passport,
          member.seamansBook,
          formatDisplayDate(member.joiningDate),
          portCode(member.joiningPort, ports),
        ];
        values.forEach((val, col) => {
          const cell = ws.getCell(row, col + 1);
          cell.value = val;
          applyTableBody(cell, col === 0 ? 'center' : 'left');
        });
        ws.getRow(row).height = 22;
      });
      bodyRow += crew.length;
    }

    const lastRow = bodyRow - 1;
    configurePrint(ws, {
      orientation: 'landscape',
      lastRow,
      lastCol: colCount,
      headerRow,
    });

    return workbookToBytes(wb);
  }

  private fileName(base: AppData, listType: CrewListTypeId): string {
    const { ship, crewArr } = base;
    const isArrival = listType === 'type2Alger' ? true : crewArr.isArrival;
    const voyageDate = isArrival ? ship.dateOfArrival : ship.dateOfDeparture;
    const typeToken = pdfFileToken(
      listType === 'type1Passport'
        ? 'Passport'
        : listType === 'type1SeamansBook'
          ? 'SeamansBook'
          : 'Alger',
    );
    const dirToken = isArrival ? 'Arrival' : 'Departure';
    return `Crew_List_${typeToken}_${dirToken}_${pdfFileToken(ship.name)}_${pdfFileToken(ship.portOfCall)}_${pdfFileDate(voyageDate)}.xlsx`;
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
