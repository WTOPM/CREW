/** Form 04 - CREW LIST [P][E][PI][G] — static HTML editor (`public/forms/crew-list-form-04/`). */
export const CREW_LIST_FORM_04_MAX_ROWS = 20;

export const CREW_LIST_FORM_04_BASE_PATH = '/forms/crew-list-form-04/';

export const CREW_LIST_FORM_04_FEEDBACK_PARAM = 'form04Feedback';

export type CrewListForm04Feedback = 'saved' | 'cancelled';

export interface CrewListForm04UrlParams {
  mode?: 'arrival' | 'departure';
  return?: string;
  pdfExport?: '1';
  data?: string;
}

export function crewListForm04EditorUrl(params: CrewListForm04UrlParams = {}): string {
  const q = new URLSearchParams();
  if (params.mode) q.set('mode', params.mode);
  if (params.return) q.set('return', params.return);
  if (params.pdfExport) q.set('pdfExport', params.pdfExport);
  if (params.data) q.set('data', params.data);
  const qs = q.toString();
  return qs ? `${CREW_LIST_FORM_04_BASE_PATH}?${qs}` : CREW_LIST_FORM_04_BASE_PATH;
}
