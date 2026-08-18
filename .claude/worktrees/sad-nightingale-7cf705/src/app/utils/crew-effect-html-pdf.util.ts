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

function emptyRow(index: number): CrewEffectForm01CrewRow {
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

  // Crew grid rows are always live — never pinned by the cell overlay, so the
  // document can never freeze on stale crew/passenger data (see footer/header
  // below for the fields that remain manually overridable).
  const crew: CrewEffectForm01CrewRow[] = [];
  for (let i = 0; i < CREW_EFFECT_FORM_01_ROW_COUNT; i++) {
    crew.push(
      i < CREW_EFFECT_FORM_01_DATA_ROWS && members[i]
        ? baseRowFromMember(members[i], i, form)
        : emptyRow(i),
    );
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
