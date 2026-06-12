import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import {
  AppData,
  CrewMember,
  createDefaultCrewArrSettings,
  createDefaultDocumentOverlayPrefs,
  createDefaultPortOfCallSettings,
  createDefaultCrewEffectForm,
  createDefaultCrewEffectForm02,
  createDefaultCrewEffectForm03,
  createDefaultNilListForm,
  createDefaultShipMoneyForm,
  createDefaultCashAdvanceForm,
  createDefaultCrewMoneyListForm,
  createDefaultNarcoticListForm,
  createDefaultShipStoresForm,
  createDefaultShipStoresForm02,
  createDefaultShipStoresForm03,
  createEmptyShipAssetsMeta,
  createDefaultOutputSettings,
  createDefaultPrintPackages,
  createDefaultCustomDocuments,
  createEmptyCrewMember,
  createEmptyShip,
  mergePorts,
  mergeUniqueList,
  parseCrewName,
} from '../models/crew.models';
import { excelSerialToIso, parseValidityRange } from '../utils/date.util';
import { createDefaultPaxArrSettings } from '../models/passenger.models';
import { APP_DATA_SCHEMA_VERSION } from '../data/empty-app-data';

@Injectable({ providedIn: 'root' })
export class ExcelImportService {
  parseDocument(file: ArrayBuffer): AppData {
    const wb = XLSX.read(file, { type: 'array' });
    const ws = wb.Sheets['Input'];
    if (!ws) throw new Error('Sheet "Input" not found in file');

    const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    const cell = (r: number, c: number) => String(rows[r]?.[c] ?? '').trim();

    const ship = {
      ...createEmptyShip(),
      name: cell(1, 2),
      callSign: cell(1, 6),
      nationality: cell(3, 2),
      homeport: cell(3, 6),
      imoNo: cell(5, 2),
      type: cell(5, 6),
      dateOfArrival: excelSerialToIso(cell(7, 2)),
      dateOfDeparture: excelSerialToIso(cell(9, 2)),
      portOfCall: cell(11, 2),
      lastPortOfCall: cell(13, 2),
      nextPortOfCall: cell(15, 2),
      charterer: cell(17, 2),
    };

    const crew: CrewMember[] = [];
    for (let r = 5; r <= 18; r++) {
      const name = cell(r, 10);
      if (!name) continue;
      crew.push(this.parseMember(rows, r, false));
    }

    for (let r = 22; r < rows.length; r++) {
      const name = cell(r, 10);
      if (!name || name === 'Present Crew Details' || name === 'Previous Crew Details') continue;
      if (crew.some((m) => formatMemberName(m) === name)) continue;
      crew.push(this.parseMember(rows, r, true));
    }

    const ports = mergePorts(
      [],
      ship.portOfCall,
      ship.lastPortOfCall,
      ship.nextPortOfCall,
      ship.homeport,
      ...crew.map((c) => c.joiningPort),
    );
    const ranks = mergeUniqueList([], ...crew.map((c) => c.rank));
    const nationalities = mergeUniqueList(
      [],
      ship.nationality,
      ...crew.map((c) => c.nationality),
    );

    return {
      ship,
      crew,
      crewArr: createDefaultCrewArrSettings(),
      passengers: [],
      paxArr: createDefaultPaxArrSettings(),
      ports,
      ranks,
      nationalities,
      portCallHistory: [],
      portOfCall: createDefaultPortOfCallSettings(),
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
      documentOverlay: createDefaultDocumentOverlayPrefs(),
      shipAssets: createEmptyShipAssetsMeta(),
      outputSettings: createDefaultOutputSettings(),
      printPackages: createDefaultPrintPackages(),
      customDocuments: createDefaultCustomDocuments(),
      seedVersion: APP_DATA_SCHEMA_VERSION,
    };
  }

  private parseMember(rows: unknown[][], r: number, archived: boolean): CrewMember {
    const cell = (row: number, c: number) => String(rows[row]?.[c] ?? '').trim();
    const { familyName, givenNames } = parseCrewName(cell(r, 10));
    const passport = parseValidityRange(cell(r, 19));
    const sbook = parseValidityRange(cell(r, 20));
    const cyprus = parseValidityRange(cell(r, 22));
    const visa = parseValidityRange(cell(r, 24));

    return {
      ...createEmptyCrewMember(),
      id: crypto.randomUUID(),
      familyName,
      givenNames,
      rank: cell(r, 11),
      nationality: cell(r, 12),
      dateOfBirth: excelSerialToIso(cell(r, 14)),
      placeOfBirth: cell(r, 15),
      passport: cell(r, 17),
      seamansBook: cell(r, 18),
      passportIssueDate: passport.issue,
      passportExpiryDate: passport.expiry,
      sbookIssueDate: sbook.issue,
      sbookExpiryDate: sbook.expiry,
      cyprusSeamansBook: cell(r, 21),
      cyprusIssueDate: cyprus.issue,
      cyprusExpiryDate: cyprus.expiry,
      visa: cell(r, 23),
      visaIssueDate: visa.issue,
      visaExpiryDate: visa.expiry,
      joiningDate: excelSerialToIso(cell(r, 25)),
      joiningPort: cell(r, 26),
      archived,
      onArrivalList: !archived,
      onDepartureList: !archived,
    };
  }
}

function formatMemberName(m: CrewMember): string {
  if (m.familyName && m.givenNames) return `${m.familyName}, ${m.givenNames}`;
  return m.familyName || m.givenNames;
}
