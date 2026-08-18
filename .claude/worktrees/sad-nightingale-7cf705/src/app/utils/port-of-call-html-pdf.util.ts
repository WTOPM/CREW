import {
  AppData,
  CrewMember,
  chunkPortCallHistoryForPdf,
  selectPortCallHistoryForPdf,
} from '../models/crew.models';
import {
  PORT_OF_CALL_FORM_01_ROWS_PER_PAGE,
  PORT_OF_CALL_HTML_MAX_ROWS_PER_PAGE,
} from '../models/port-of-call-form-01.paths';

export type PortOfCallHtmlOverlayKey = 'portOfCall' | 'portsOfCall';

export interface PortOfCallHtmlPdfSnapshot {
  ship: AppData['ship'];
  ports: { name: string; country: string; code: string }[];
  pages: ReturnType<typeof chunkPortCallHistoryForPdf>;
  rowsPerPage: number;
  documentOverlay: AppData['documentOverlay'];
  withOverlay: boolean;
  crew?: Pick<CrewMember, 'rank' | 'familyName' | 'givenNames'>[];
}

export function resolvePortOfCallRowsPerPage(
  data: AppData,
  overlayKey: PortOfCallHtmlOverlayKey,
): number {
  const raw = data.documentOverlay?.[overlayKey]?.rowsPerPage;
  const n =
    typeof raw === 'number' && Number.isFinite(raw)
      ? raw
      : PORT_OF_CALL_FORM_01_ROWS_PER_PAGE;
  return Math.min(PORT_OF_CALL_HTML_MAX_ROWS_PER_PAGE, Math.max(1, Math.round(n)));
}

export function buildPortOfCallHtmlPdfSnapshot(
  data: AppData,
  withOverlay: boolean,
  overlayKey: PortOfCallHtmlOverlayKey = 'portOfCall',
): PortOfCallHtmlPdfSnapshot {
  const rowsPerPage = resolvePortOfCallRowsPerPage(data, overlayKey);
  const selected = selectPortCallHistoryForPdf(data.portCallHistory, data.portOfCall.pdfRowCount);
  const pages = chunkPortCallHistoryForPdf(selected, rowsPerPage);

  return {
    ship: data.ship,
    ports: data.ports.map((p) => ({
      name: p.name,
      country: p.country ?? '',
      code: p.code,
    })),
    pages,
    rowsPerPage,
    documentOverlay: data.documentOverlay,
    withOverlay,
    crew: data.crew.map((c) => ({
      rank: c.rank,
      familyName: c.familyName,
      givenNames: c.givenNames,
    })),
  };
}
