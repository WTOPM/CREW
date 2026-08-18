/** Form 05 - CREW LIST [SBK][E] — static HTML editor (`public/forms/crew-list-form-05/`). */
export const CREW_LIST_FORM_05_MAX_ROWS = 18;

export const CREW_LIST_FORM_05_BASE_PATH = '/forms/crew-list-form-05/';

/** Query param on return URL after Save/Cancel in the HTML editor. */
export const CREW_LIST_FORM_05_FEEDBACK_PARAM = 'form05Feedback';

export type CrewListForm05Feedback = 'saved' | 'cancelled';

export interface CrewListForm05UrlParams {
  mode?: 'arrival' | 'departure';
  /** Encoded return URL (e.g. `/?crewListSettings=1`). */
  return?: string;
  pdfExport?: '1';
  /** JSON snapshot for headless PDF capture. */
  data?: string;
}

export function crewListForm05EditorUrl(params: CrewListForm05UrlParams = {}): string {
  const q = new URLSearchParams();
  if (params.mode) q.set('mode', params.mode);
  if (params.return) q.set('return', params.return);
  if (params.pdfExport) q.set('pdfExport', params.pdfExport);
  if (params.data) q.set('data', params.data);
  const qs = q.toString();
  return qs ? `${CREW_LIST_FORM_05_BASE_PATH}?${qs}` : CREW_LIST_FORM_05_BASE_PATH;
}
