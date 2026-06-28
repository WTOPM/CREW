/** Form 02 - Port of Call - Security — static HTML PDF renderer (`public/forms/port-of-call-form-02/`). */
export const PORT_OF_CALL_FORM_02_ROWS_PER_PAGE = 11;

export const PORT_OF_CALL_FORM_02_BASE_PATH = '/forms/port-of-call-form-02/';

export interface PortOfCallForm02UrlParams {
  pdfExport?: '1';
  data?: string;
}

export function portOfCallForm02EditorUrl(params: PortOfCallForm02UrlParams = {}): string {
  const q = new URLSearchParams();
  if (params.pdfExport) q.set('pdfExport', params.pdfExport);
  if (params.data) q.set('data', params.data);
  const qs = q.toString();
  return qs ? `${PORT_OF_CALL_FORM_02_BASE_PATH}?${qs}` : PORT_OF_CALL_FORM_02_BASE_PATH;
}
