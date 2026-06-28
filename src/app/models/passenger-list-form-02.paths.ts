/** Form 02 - PAX P ID E — static HTML editor (`public/forms/passenger-list-form-02/`). */
export const PASSENGER_LIST_FORM_02_MAX_ROWS = 23;

export const PASSENGER_LIST_FORM_02_BASE_PATH = '/forms/passenger-list-form-02/';

/** Query param on return URL after Save/Cancel in the HTML editor. */
export const PASSENGER_LIST_FORM_02_FEEDBACK_PARAM = 'paxForm02Feedback';

export type PassengerListForm02Feedback = 'saved' | 'cancelled';

export interface PassengerListForm02UrlParams {
  mode?: 'arrival' | 'departure';
  /** Encoded return URL (e.g. `/?paxSettings=1`). */
  return?: string;
  pdfExport?: '1';
  /** JSON snapshot for headless PDF capture. */
  data?: string;
}

export function passengerListForm02EditorUrl(
  params: PassengerListForm02UrlParams = {},
): string {
  const q = new URLSearchParams();
  if (params.mode) q.set('mode', params.mode);
  if (params.return) q.set('return', params.return);
  if (params.pdfExport) q.set('pdfExport', params.pdfExport);
  if (params.data) q.set('data', params.data);
  const qs = q.toString();
  return qs ? `${PASSENGER_LIST_FORM_02_BASE_PATH}?${qs}` : PASSENGER_LIST_FORM_02_BASE_PATH;
}
