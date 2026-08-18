/** Form 01 - IMO PASSENGER LIST - P ID — static HTML editor (`public/forms/passenger-list-form-01/`). */
export const PASSENGER_LIST_FORM_01_MAX_ROWS = 23;

export const PASSENGER_LIST_FORM_01_BASE_PATH = '/forms/passenger-list-form-01/';

/** Query param on return URL after Save/Cancel in the HTML editor. */
export const PASSENGER_LIST_FORM_01_FEEDBACK_PARAM = 'paxForm01Feedback';

export type PassengerListForm01Feedback = 'saved' | 'cancelled';

export interface PassengerListForm01UrlParams {
  mode?: 'arrival' | 'departure';
  /** Encoded return URL (e.g. `/?paxSettings=1`). */
  return?: string;
  pdfExport?: '1';
  /** JSON snapshot for headless PDF capture. */
  data?: string;
}

export function passengerListForm01EditorUrl(
  params: PassengerListForm01UrlParams = {},
): string {
  const q = new URLSearchParams();
  if (params.mode) q.set('mode', params.mode);
  if (params.return) q.set('return', params.return);
  if (params.pdfExport) q.set('pdfExport', params.pdfExport);
  if (params.data) q.set('data', params.data);
  const qs = q.toString();
  return qs ? `${PASSENGER_LIST_FORM_01_BASE_PATH}?${qs}` : PASSENGER_LIST_FORM_01_BASE_PATH;
}
