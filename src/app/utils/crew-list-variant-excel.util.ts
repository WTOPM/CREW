import ExcelJS from 'exceljs';
import { AppData, CrewMember, formatPortCallPortName, portCode } from '../models/crew.models';
import { CREW_LIST_TYPE_LABELS } from '../models/document-overlay.models';
import { formatBirthDate, formatDisplayDate } from './date.util';
import { workbookToBytes } from './crew-list-excel-layout.util';
import { CREW_LIST_FORM_04_MAX_ROWS } from '../models/crew-list-form-04.paths';
import { CREW_LIST_FORM_05_MAX_ROWS } from '../models/crew-list-form-05.paths';
import { CREW_LIST_V3_SBK_P_MAX_ROWS } from '../services/crew-list-v3-sbk-p-coordinates';
import {
  CrewListFormColumn,
  buildLandscapeCrewListForm,
  buildPortraitCrewListForm,
  chunkCrewPages,
  configureCrewListFormPrint,
  drawCrewListFormNil,
  fillCrewListFormFooter,
  fillCrewListFormRows,
  fillLandscapeCrewListHeader,
  fillPortraitCrewListHeader,
  findMasterName,
  formatBirthAndPlace,
  formatCrewListV2Name,
  formatGender,
  formatPlaceOfIssue,
} from './crew-list-form-excel.util';

type VariantListType = 'type3V2' | 'type4V3Sbk' | 'type5V3SbkP' | 'type6V3SbkP2';

interface CrewListExcelVariantConfig {
  listType: VariantListType;
  orientation: 'portrait' | 'landscape';
  maxRows: number;
  charterer: boolean;
  columns: CrewListFormColumn[];
}

const CREW_LIST_EXCEL_VARIANTS: Record<VariantListType, CrewListExcelVariantConfig> = {
  type3V2: {
    listType: 'type3V2',
    orientation: 'portrait',
    maxRows: CREW_LIST_FORM_04_MAX_ROWS,
    charterer: false,
    columns: [
      { header: 'No.', width: 4.5, align: 'center', value: (_m, _d, n) => n },
      {
        header: 'Family name and given names',
        width: 24,
        value: (m) => formatCrewListV2Name(m),
      },
      { header: 'Rank', width: 10, value: (m) => m.rank },
      { header: 'Nationality', width: 10, value: (m) => m.nationality },
      { header: 'Date of birth', width: 9, value: (m) => formatBirthDate(m.dateOfBirth) },
      { header: 'Place of birth', width: 14, value: (m) => m.placeOfBirth },
      { header: 'Passport No.', width: 11, value: (m) => m.passport },
      {
        header: 'Passport expiry',
        width: 10,
        value: (m) => formatDisplayDate(m.passportExpiryDate),
      },
      {
        header: 'Place of issue',
        width: 11,
        value: (m) => formatPlaceOfIssue(m.passportPlaceOfIssue),
      },
      { header: 'Gender', width: 6, align: 'center', value: (m) => formatGender(m.gender) },
    ],
  },
  type4V3Sbk: {
    listType: 'type4V3Sbk',
    orientation: 'portrait',
    maxRows: CREW_LIST_FORM_05_MAX_ROWS,
    charterer: true,
    columns: [
      { header: 'No.', width: 5, align: 'center', value: (_m, _d, n) => n },
      {
        header: 'Family name and given names',
        width: 26,
        value: (m) => formatCrewListV2Name(m),
      },
      { header: 'Rank', width: 11, value: (m) => m.rank },
      { header: 'Nationality', width: 12, value: (m) => m.nationality },
      { header: 'Date of birth', width: 10, value: (m) => formatBirthDate(m.dateOfBirth) },
      { header: 'Place of birth', width: 18, value: (m) => m.placeOfBirth },
      { header: "Seaman's book No.", width: 13, value: (m) => m.seamansBook },
      {
        header: "Seaman's book expiry",
        width: 13,
        value: (m) => formatDisplayDate(m.sbookExpiryDate),
      },
    ],
  },
  type5V3SbkP: {
    listType: 'type5V3SbkP',
    orientation: 'landscape',
    maxRows: CREW_LIST_V3_SBK_P_MAX_ROWS,
    charterer: true,
    columns: [
      { header: 'No.', width: 4.5, align: 'center', value: (_m, _d, n) => n },
      {
        header: 'Family name and given names',
        width: 20,
        value: (m) => formatCrewListV2Name(m),
      },
      { header: 'Rank', width: 9, value: (m) => m.rank },
      { header: 'Nationality', width: 10, value: (m) => m.nationality },
      { header: 'Date and place of birth', width: 18, value: (m) => formatBirthAndPlace(m) },
      { header: "Seaman's book No.", width: 10, value: (m) => m.seamansBook },
      {
        header: 'S.book place of issue',
        width: 12,
        value: (m) => formatPlaceOfIssue(m.seamansBookPlaceOfIssue),
      },
      { header: 'S.book expiry', width: 10, value: (m) => formatDisplayDate(m.sbookExpiryDate) },
      { header: 'Passport No.', width: 10, value: (m) => m.passport },
      {
        header: 'Joining port',
        width: 12,
        value: (m, d) =>
          formatPortCallPortName(m.joiningPort).toUpperCase() || portCode(m.joiningPort, d.ports),
      },
      { header: 'Joining date', width: 10, value: (m) => formatDisplayDate(m.joiningDate) },
    ],
  },
  type6V3SbkP2: {
    listType: 'type6V3SbkP2',
    orientation: 'landscape',
    maxRows: CREW_LIST_V3_SBK_P_MAX_ROWS,
    charterer: true,
    columns: [
      { header: 'No.', width: 4.5, align: 'center', value: (_m, _d, n) => n },
      {
        header: 'Family name and given names',
        width: 18,
        value: (m) => formatCrewListV2Name(m),
      },
      { header: 'Rank', width: 8, value: (m) => m.rank },
      { header: 'Nationality', width: 9, value: (m) => m.nationality },
      { header: 'Date and place of birth', width: 16, value: (m) => formatBirthAndPlace(m) },
      { header: "Seaman's book No.", width: 9, value: (m) => m.seamansBook },
      {
        header: 'S.book place of issue',
        width: 11,
        value: (m) => formatPlaceOfIssue(m.seamansBookPlaceOfIssue),
      },
      { header: 'S.book expiry', width: 9, value: (m) => formatDisplayDate(m.sbookExpiryDate) },
      { header: 'Passport No.', width: 9, value: (m) => m.passport },
      {
        header: 'Passport place of issue',
        width: 11,
        value: (m) => formatPlaceOfIssue(m.passportPlaceOfIssue),
      },
      {
        header: 'Passport expiry',
        width: 9,
        value: (m) => formatDisplayDate(m.passportExpiryDate),
      },
    ],
  },
};

function addFormSheet(
  wb: ExcelJS.Workbook,
  sheetName: string,
  config: CrewListExcelVariantConfig,
  data: AppData,
  crew: CrewMember[],
  pageIndex: number,
  pageCrew: CrewMember[],
  rowOffset: number,
): void {
  const { ship, crewArr } = data;
  const isArrival = crewArr.isArrival;
  const voyageDate = formatDisplayDate(isArrival ? ship.dateOfArrival : ship.dateOfDeparture);
  const title = CREW_LIST_TYPE_LABELS[config.listType];

  const ws = wb.addWorksheet(sheetName, {
    pageSetup: { paperSize: 9, orientation: config.orientation },
  });

  const layout =
    config.orientation === 'landscape'
      ? buildLandscapeCrewListForm(ws, title, config.columns, { maxRows: config.maxRows })
      : buildPortraitCrewListForm(ws, title, config.columns, {
          charterer: config.charterer,
          maxRows: config.maxRows,
        });

  const headerInput = {
    ship,
    ports: data.ports,
    isArrival,
    voyageDate,
    pageNo: pageIndex + 1,
    charterer: config.charterer ? ship.charterer : undefined,
  };

  if (config.orientation === 'landscape') {
    fillLandscapeCrewListHeader(ws, layout, headerInput);
  } else {
    fillPortraitCrewListHeader(ws, layout, headerInput);
  }

  if (pageCrew.length === 0) {
    drawCrewListFormNil(ws, layout);
  } else {
    fillCrewListFormRows(ws, layout, config.columns, pageCrew, data, rowOffset);
  }

  fillCrewListFormFooter(ws, layout, voyageDate, findMasterName(data, crew));
  configureCrewListFormPrint(ws, layout, config.orientation);
}

export async function buildCrewListVariantExcel(
  listType: VariantListType,
  data: AppData,
  crew: CrewMember[],
): Promise<Uint8Array> {
  const config = CREW_LIST_EXCEL_VARIANTS[listType];
  const pages = chunkCrewPages(crew, config.maxRows);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'CREW Documents';

  pages.forEach((pageCrew, pageIndex) => {
    const sheetName = pageIndex === 0 ? 'Crew List' : `Crew List (${pageIndex + 1})`;
    addFormSheet(
      wb,
      sheetName,
      config,
      data,
      crew,
      pageIndex,
      pageCrew,
      pageIndex * config.maxRows,
    );
  });

  return workbookToBytes(wb);
}

export async function buildAlgerCrewListExcel(
  data: AppData,
  crew: CrewMember[],
): Promise<Uint8Array> {
  const { ship, ports, crewArr } = data;
  const isArrival = crewArr.isArrival;
  const voyageDate = formatDisplayDate(isArrival ? ship.dateOfArrival : ship.dateOfDeparture);
  const title = CREW_LIST_TYPE_LABELS.type2Alger;
  const maxRows = 30;

  const columns: CrewListFormColumn[] = [
    { header: 'No.', width: 5, align: 'center', value: (_m, _d, n) => n },
    {
      header: 'Family name and given names',
      width: 24,
      value: (m) => formatCrewListV2Name(m),
    },
    { header: 'Rank', width: 11, value: (m) => m.rank },
    { header: 'Nationality', width: 12, value: (m) => m.nationality },
    { header: 'Date of birth', width: 10, value: (m) => formatBirthDate(m.dateOfBirth) },
    { header: 'Place of birth', width: 18, value: (m) => m.placeOfBirth },
    { header: 'Passport No.', width: 12, value: (m) => m.passport },
    { header: "Seaman's book No.", width: 13, value: (m) => m.seamansBook },
    { header: 'Joining date', width: 10, value: (m) => formatDisplayDate(m.joiningDate) },
    { header: 'Joining port', width: 11, value: (m, d) => portCode(m.joiningPort, d.ports) },
  ];

  const wb = new ExcelJS.Workbook();
  wb.creator = 'CREW Documents';
  const ws = wb.addWorksheet('Crew List Alger', {
    pageSetup: { paperSize: 9, orientation: 'landscape' },
  });

  const layout = buildPortraitCrewListForm(ws, title, columns, { maxRows });
  fillPortraitCrewListHeader(ws, layout, {
    ship,
    ports,
    isArrival,
    voyageDate,
    pageNo: 1,
  });

  if (crew.length === 0) {
    drawCrewListFormNil(ws, layout);
  } else {
    fillCrewListFormRows(ws, layout, columns, crew, data, 0);
  }

  fillCrewListFormFooter(ws, layout, voyageDate, findMasterName(data, crew));
  configureCrewListFormPrint(ws, layout, 'landscape');

  return workbookToBytes(wb);
}
