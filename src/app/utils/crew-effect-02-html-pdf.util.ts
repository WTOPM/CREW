import {
  AppData,
  CrewMember,
  filterActiveCrewListFromData,
  formatCrewListName,
  formatPortCallPortName,
  portCountry,
} from '../models/crew.models';
import { CREW_EFFECT_FORM_02_ROW_COUNT } from '../models/crew-effect-form-02.paths';
import { CREW_EFFECT_NIL_LABEL, normalizeCrewEffectForm02 } from '../models/crew-effect.models';
import { formatDisplayDate } from './date.util';
import { crewEffectListRows } from './passenger-pdf.util';

export interface CrewEffectForm02CrewRow {
  no: string;
  familyGivenNames: string;
  rankOrRating: string;
  cigarettes: string;
  tobaccoCigares: string;
  spirits: string;
  beer: string;
  other: string;
  signature: string;
}

export interface CrewEffectForm02HtmlForm {
  arrival: boolean;
  departure: boolean;
  pageNo: string;
  nameOfShip: string;
  portOfArrivalDeparture: string;
  dateOfArrivalDeparture: string;
  nationalityOfShip: string;
  crew: CrewEffectForm02CrewRow[];
  footerDate: string;
  footerMaster: string;
}

export interface CrewEffect02HtmlPdfSnapshot {
  overlayKey: 'crewEffect02';
  form02: CrewEffectForm02HtmlForm;
  documentOverlay: AppData['documentOverlay'];
  withOverlay: boolean;
}

function overlayCellValues(data: AppData): Record<string, string> | undefined {
  const overlay = data.documentOverlay?.crewEffect02 as { cellValues?: Record<string, string> } | undefined;
  return overlay?.cellValues;
}

function findMaster(crew: CrewMember[]): CrewMember | undefined {
  const exact = crew.find((m) => m.rank.trim().toLowerCase() === 'master');
  if (exact) return exact;
  return crew.find((m) => m.rank.trim().toLowerCase().includes('master'));
}

function formatCaptainName(member: Pick<CrewMember, 'familyName' | 'givenNames'>): string {
  const parts = [member.familyName?.trim(), member.givenNames?.trim()].filter(Boolean);
  return parts.join(' ').toUpperCase();
}

function formatPortWithCountry(portName: string, ports: AppData['ports']): string {
  const name = formatPortCallPortName(portName);
  if (!name) return '';
  const country = portCountry(portName, ports);
  return country ? `${name}, ${country}` : name;
}

function crewRowHasContent(row: CrewEffectForm02CrewRow): boolean {
  return !!(
    row.familyGivenNames?.trim() ||
    row.rankOrRating?.trim() ||
    row.cigarettes?.trim() ||
    row.tobaccoCigares?.trim() ||
    row.spirits?.trim() ||
    row.beer?.trim() ||
    row.other?.trim() ||
    row.signature?.trim()
  );
}

function resolveRowNo(row: CrewEffectForm02CrewRow, index: number): string {
  if (!crewRowHasContent(row)) return '';
  const no = row.no?.trim();
  return no || String(index + 1);
}

function emptyRow(): CrewEffectForm02CrewRow {
  return {
    no: '',
    familyGivenNames: '',
    rankOrRating: '',
    cigarettes: '',
    tobaccoCigares: '',
    spirits: '',
    beer: '',
    other: '',
    signature: '',
  };
}

function baseRowFromMember(
  member: CrewMember,
  index: number,
  form: ReturnType<typeof normalizeCrewEffectForm02>,
): CrewEffectForm02CrewRow {
  const other = form.others.trim();
  return {
    no: String(index + 1),
    familyGivenNames: formatCrewListName(member).toUpperCase(),
    rankOrRating: member.rank.trim(),
    cigarettes: form.nilCigarettes ? CREW_EFFECT_NIL_LABEL : '',
    tobaccoCigares: form.nilTobaccoCigars ? CREW_EFFECT_NIL_LABEL : '',
    spirits: form.nilSpirits ? CREW_EFFECT_NIL_LABEL : '',
    beer: form.nilBeer ? CREW_EFFECT_NIL_LABEL : '',
    other,
    signature: '',
  };
}

function buildForm02Data(data: AppData): CrewEffectForm02HtmlForm {
  const form = normalizeCrewEffectForm02(data.crewEffectForm02);
  const { ship, crewArr, ports } = data;
  const cv = overlayCellValues(data) ?? {};
  const isArrival =
    cv['_ceMode'] === 'departure' ? false : cv['_ceMode'] === 'arrival' ? true : crewArr.isArrival;
  const list = isArrival ? 'arrival' : 'departure';
  const members = crewEffectListRows(data, form.appendPassengers, CREW_EFFECT_FORM_02_ROW_COUNT);
  const crewList = filterActiveCrewListFromData(data, list);
  const master = findMaster(crewList);
  const voyageIso = isArrival ? ship.dateOfArrival : ship.dateOfDeparture;

  const defaultCrew: CrewEffectForm02CrewRow[] = [];
  for (let i = 0; i < CREW_EFFECT_FORM_02_ROW_COUNT; i++) {
    defaultCrew.push(members[i] ? baseRowFromMember(members[i], i, form) : emptyRow());
  }

  // Crew grid is always live from the crew/passenger list — cell overlays never
  // pin these rows, so the document can't freeze and no Reset is ever needed.
  const crew: CrewEffectForm02CrewRow[] = [];
  for (let i = 0; i < CREW_EFFECT_FORM_02_ROW_COUNT; i++) {
    const row = defaultCrew[i] ?? emptyRow();
    row.no = resolveRowNo(row, i);
    crew.push(row);
  }

  return {
    arrival: isArrival,
    departure: !isArrival,
    pageNo: cv['h-pageNo'] ?? '1',
    nameOfShip: cv['h-nameOfShip'] ?? formatPortCallPortName(ship.name),
    portOfArrivalDeparture:
      cv['h-port'] ?? formatPortWithCountry(ship.portOfCall, ports),
    dateOfArrivalDeparture: cv['h-date'] ?? formatDisplayDate(voyageIso),
    nationalityOfShip: cv['h-nationality'] ?? formatPortCallPortName(ship.nationality),
    crew,
    footerDate: cv['footer-date'] ?? formatDisplayDate(voyageIso),
    footerMaster: cv['footer-master'] ?? (master ? formatCaptainName(master) : ''),
  };
}

export function buildCrewEffect02HtmlPdfSnapshot(
  data: AppData,
  withOverlay: boolean,
): CrewEffect02HtmlPdfSnapshot {
  return {
    overlayKey: 'crewEffect02',
    form02: buildForm02Data(data),
    documentOverlay: data.documentOverlay,
    withOverlay,
  };
}
