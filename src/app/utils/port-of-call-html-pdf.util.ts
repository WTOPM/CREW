import {
  AppData,
  CrewMember,
  chunkPortCallHistoryForPdf,
  selectPortCallHistoryForPdf,
} from '../models/crew.models';
import { PORT_OF_CALL_FORM_01_ROWS_PER_PAGE } from '../models/port-of-call-form-01.paths';

export interface PortOfCallHtmlPdfSnapshot {
  ship: AppData['ship'];
  ports: { name: string; country: string; code: string }[];
  pages: ReturnType<typeof chunkPortCallHistoryForPdf>;
  documentOverlay: AppData['documentOverlay'];
  withOverlay: boolean;
  crew?: Pick<CrewMember, 'rank' | 'familyName' | 'givenNames'>[];
}

export function buildPortOfCallHtmlPdfSnapshot(
  data: AppData,
  withOverlay: boolean,
): PortOfCallHtmlPdfSnapshot {
  const selected = selectPortCallHistoryForPdf(data.portCallHistory, data.portOfCall.pdfRowCount);
  const pages = chunkPortCallHistoryForPdf(selected, PORT_OF_CALL_FORM_01_ROWS_PER_PAGE);

  return {
    ship: data.ship,
    ports: data.ports.map((p) => ({
      name: p.name,
      country: p.country ?? '',
      code: p.code,
    })),
    pages,
    documentOverlay: data.documentOverlay,
    withOverlay,
    crew: data.crew.map((c) => ({
      rank: c.rank,
      familyName: c.familyName,
      givenNames: c.givenNames,
    })),
  };
}
