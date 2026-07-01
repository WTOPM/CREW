import {
  AppData,
  CrewMember,
  filterActiveCrewListFromData,
  formatCrewListName,
  formatPortCallPortName,
} from '../models/crew.models';
import {
  CREW_EFFECT_FORM_01_DATA_ROWS,
  CREW_EFFECT_FORM_01_ROW_COUNT,
} from '../models/crew-effect-form-01.paths';
import { CREW_EFFECT_NIL_LABEL, normalizeCrewEffectForm } from '../models/crew-effect.models';
import { crewEffectListRows } from './passenger-pdf.util';

export interface CrewEffectForm01CrewRow {
  no: string;
  familyGivenNames: string;
  rankOrRating: string;
  cigarettes: string;
  spirits: string;
  wines: string;
  others: string;
  signature: string;
}

export interface CrewEffectForm01HtmlForm {
  pageNo: string;
  nameOfShip: string;
  nationalityOfShip: string;
  crew: CrewEffectForm01CrewRow[];
  footerMaster: string;
}

export interface CrewEffectHtmlPdfSnapshot {
  overlayKey: 'crewEffect';
  form01: CrewEffectForm01HtmlForm;
  documentOverlay: AppData['documentOverlay'];
  withOverlay: boolean;
}

function overlayCellValues(data: AppData): Record<string, string> | undefined {
  const overlay = data.documentOverlay?.crewEffect as { cellValues?: Record<string, string> } | undefined;
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

function crewRowHasContent(row: CrewEffectForm01CrewRow): boolean {
  return !!(
    row.familyGivenNames?.trim() ||
    row.rankOrRating?.trim() ||
    row.cigarettes?.trim() ||
    row.spirits?.trim() ||
    row.wines?.trim() ||
    row.others?.trim() ||
    row.signature?.trim()
  );
}

function resolveRowNo(row: CrewEffectForm01CrewRow, index: number): string {
  if (!crewRowHasContent(row)) return '';
  const no = row.no?.trim();
  return no || String(index + 1);
}

function emptyRow(): CrewEffectForm01CrewRow {
  return {
    no: '',
    familyGivenNames: '',
    rankOrRating: '',
    cigarettes: '',
    spirits: '',
    wines: '',
    others: '',
    signature: '',
  };
}

function baseRowFromMember(
  member: CrewMember,
  index: number,
  form: ReturnType<typeof normalizeCrewEffectForm>,
): CrewEffectForm01CrewRow {
  const others = form.others.trim();
  return {
    no: String(index + 1),
    familyGivenNames: formatCrewListName(member).toUpperCase(),
    rankOrRating: member.rank.trim(),
    cigarettes: form.nilCigarettes ? CREW_EFFECT_NIL_LABEL : '',
    spirits: form.nilSpirits ? CREW_EFFECT_NIL_LABEL : '',
    wines: form.nilWines ? CREW_EFFECT_NIL_LABEL : '',
    others,
    signature: '',
  };
}

function buildForm01Data(data: AppData): CrewEffectForm01HtmlForm {
  const form = normalizeCrewEffectForm(data.crewEffectForm);
  const { ship } = data;
  const cv = overlayCellValues(data) ?? {};
  const members = crewEffectListRows(data, form.appendPassengers, CREW_EFFECT_FORM_01_DATA_ROWS);
  const crewList = filterActiveCrewListFromData(data, 'arrival');
  const master = findMaster(crewList);

  const defaultCrew: CrewEffectForm01CrewRow[] = [];
  for (let i = 0; i < CREW_EFFECT_FORM_01_ROW_COUNT; i++) {
    if (i < CREW_EFFECT_FORM_01_DATA_ROWS && members[i]) {
      defaultCrew.push(baseRowFromMember(members[i], i, form));
    } else {
      defaultCrew.push(emptyRow());
    }
  }

  // Crew grid is always live from the crew/passenger list — cell overlays never
  // pin these rows, so the document can't freeze and no Reset is ever needed.
  const crew: CrewEffectForm01CrewRow[] = [];
  for (let i = 0; i < CREW_EFFECT_FORM_01_ROW_COUNT; i++) {
    const row = defaultCrew[i] ?? emptyRow();
    row.no = resolveRowNo(row, i);
    crew.push(row);
  }

  const footerMaster = cv['footer-master'] ?? (master ? formatCaptainName(master) : '');

  return {
    pageNo: cv['h-pageNo'] ?? '1',
    nameOfShip: cv['h-nameOfShip'] ?? formatPortCallPortName(ship.name),
    nationalityOfShip: cv['h-nationality'] ?? formatPortCallPortName(ship.nationality),
    crew,
    footerMaster,
  };
}

export function buildCrewEffectHtmlPdfSnapshot(
  data: AppData,
  withOverlay: boolean,
): CrewEffectHtmlPdfSnapshot {
  return {
    overlayKey: 'crewEffect',
    form01: buildForm01Data(data),
    documentOverlay: data.documentOverlay,
    withOverlay,
  };
}
