import {
  AppData,
  CrewMember,
  filterActiveCrewListFromData,
  formatCrewListName,
  formatPortCallPortName,
} from '../models/crew.models';
import { NilListPhrase, normalizeNilListForm } from '../models/nil-list.models';
import { formatDisplayDate } from './date.util';

export interface NilListHtmlForm {
  vessel: string;
  portOfRegistry: string;
  port: string;
  date: string;
  masterName: string;
  phrases: NilListPhrase[];
}

export interface NilListHtmlPdfSnapshot {
  overlayKey: 'nilList';
  form: NilListHtmlForm;
  documentOverlay: AppData['documentOverlay'];
  withOverlay: boolean;
}

function findMaster(crew: CrewMember[]): CrewMember | undefined {
  const exact = crew.find((m) => m.rank.trim().toLowerCase() === 'master');
  if (exact) return exact;
  return crew.find((m) => m.rank.trim().toLowerCase().includes('master'));
}

export function buildNilListHtmlPdfSnapshot(
  data: AppData,
  withOverlay: boolean,
): NilListHtmlPdfSnapshot {
  const { ship } = data;
  const form = normalizeNilListForm(data.nilListForm);
  const crewArrival = filterActiveCrewListFromData(data, 'arrival');
  const master = findMaster(crewArrival);

  return {
    overlayKey: 'nilList',
    form: {
      vessel: ship.name.trim(),
      portOfRegistry: formatPortCallPortName(ship.homeport),
      port: formatPortCallPortName(ship.portOfCall),
      date: formatDisplayDate(ship.dateOfArrival),
      masterName: master ? formatCrewListName(master) : '',
      phrases: form.phrases,
    },
    documentOverlay: data.documentOverlay,
    withOverlay,
  };
}
