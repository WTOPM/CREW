/** Form 01 - Port of Call List — HTML editor (`public/forms/port-of-call-form-01/`). */
export const PORT_OF_CALL_FORM_01_ROWS_PER_PAGE = 11;

/** Max data rows that fit on one A4 page in HTML forms 01 & 02. */
export const PORT_OF_CALL_HTML_MAX_ROWS_PER_PAGE = 23;

export const PORT_OF_CALL_FORM_01_BASE_PATH = '/forms/port-of-call-form-01/';

export const PORT_OF_CALL_FORM_01_FEEDBACK_PARAM = 'pocForm01Feedback';

export const PORT_OF_CALL_SETTINGS_PARAM = 'portOfCallSettings';

export type PortOfCallForm01Feedback = 'saved' | 'cancelled';

export interface PortOfCallForm01UrlParams {
  /** Encoded return URL (e.g. `/?portOfCallSettings=1`). */
  return?: string;
  pdfExport?: '1';
  data?: string;
}

export function portOfCallForm01EditorUrl(params: PortOfCallForm01UrlParams = {}): string {
  const q = new URLSearchParams();
  if (params.return) q.set('return', params.return);
  if (params.pdfExport) q.set('pdfExport', params.pdfExport);
  if (params.data) q.set('data', params.data);
  const qs = q.toString();
  return qs ? `${PORT_OF_CALL_FORM_01_BASE_PATH}?${qs}` : PORT_OF_CALL_FORM_01_BASE_PATH;
}
