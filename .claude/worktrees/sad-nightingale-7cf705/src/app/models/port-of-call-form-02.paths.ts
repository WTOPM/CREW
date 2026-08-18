/** Form 02 - PORTS OF CALL (Security) — HTML editor (`public/forms/port-of-call-form-02/`). */
export const PORT_OF_CALL_FORM_02_ROWS_PER_PAGE = 11;

export const PORT_OF_CALL_FORM_02_BASE_PATH = '/forms/port-of-call-form-02/';

export const PORT_OF_CALL_FORM_02_FEEDBACK_PARAM = 'pocForm02Feedback';

export type PortOfCallForm02Feedback = 'saved' | 'cancelled';

export interface PortOfCallForm02UrlParams {
  return?: string;
  pdfExport?: '1';
  data?: string;
}

export function portOfCallForm02EditorUrl(params: PortOfCallForm02UrlParams = {}): string {
  const q = new URLSearchParams();
  if (params.return) q.set('return', params.return);
  if (params.pdfExport) q.set('pdfExport', params.pdfExport);
  if (params.data) q.set('data', params.data);
  const qs = q.toString();
  return qs ? `${PORT_OF_CALL_FORM_02_BASE_PATH}?${qs}` : PORT_OF_CALL_FORM_02_BASE_PATH;
}
