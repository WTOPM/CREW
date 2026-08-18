/** Form 07 - CREW LIST [SBK][PI][E][P][PI][E] — static HTML editor (`public/forms/crew-list-form-07/`). */
export const CREW_LIST_FORM_07_MAX_ROWS = 18;

export const CREW_LIST_FORM_07_BASE_PATH = '/forms/crew-list-form-07/';

/** Query param on return URL after Save/Cancel in the HTML editor. */
export const CREW_LIST_FORM_07_FEEDBACK_PARAM = 'form07Feedback';

export type CrewListForm07Feedback = 'saved' | 'cancelled';

export interface CrewListForm07UrlParams {
  mode?: 'arrival' | 'departure';
  /** Encoded return URL (e.g. `/?crewListSettings=1`). */
  return?: string;
  pdfExport?: '1';
  /** JSON snapshot for headless PDF capture. */
  data?: string;
}

export function crewListForm07EditorUrl(params: CrewListForm07UrlParams = {}): string {
  const q = new URLSearchParams();
  if (params.mode) q.set('mode', params.mode);
  if (params.return) q.set('return', params.return);
  if (params.pdfExport) q.set('pdfExport', params.pdfExport);
  if (params.data) q.set('data', params.data);
  const qs = q.toString();
  return qs ? `${CREW_LIST_FORM_07_BASE_PATH}?${qs}` : CREW_LIST_FORM_07_BASE_PATH;
}
