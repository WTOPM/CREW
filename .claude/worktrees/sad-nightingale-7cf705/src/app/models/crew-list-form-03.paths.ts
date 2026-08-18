/** Form 03 - IMO CREW LIST [P][SBK][J][T] — static HTML editor (`public/forms/crew-list-form-03/`). */
export const CREW_LIST_FORM_03_BASE_PATH = '/forms/crew-list-form-03/';

/** Query param on return URL after Save/Cancel in the HTML editor. */
export const CREW_LIST_FORM_03_FEEDBACK_PARAM = 'form03Feedback';

export type CrewListForm03Feedback = 'saved' | 'cancelled';

export interface CrewListForm03UrlParams {
  mode?: 'arrival' | 'departure';
  /** Encoded return URL (e.g. `/?crewListSettings=1`). */
  return?: string;
  pdfExport?: '1';
  /** JSON snapshot for headless PDF capture. */
  data?: string;
}

export function crewListForm03EditorUrl(params: CrewListForm03UrlParams = {}): string {
  const q = new URLSearchParams();
  if (params.mode) q.set('mode', params.mode);
  if (params.return) q.set('return', params.return);
  if (params.pdfExport) q.set('pdfExport', params.pdfExport);
  if (params.data) q.set('data', params.data);
  const qs = q.toString();
  return qs ? `${CREW_LIST_FORM_03_BASE_PATH}?${qs}` : CREW_LIST_FORM_03_BASE_PATH;
}
