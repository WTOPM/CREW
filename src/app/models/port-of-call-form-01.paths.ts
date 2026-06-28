/** Form 01 - Port of Call — static HTML PDF renderer (`public/forms/port-of-call-form-01/`). */
export const PORT_OF_CALL_FORM_01_ROWS_PER_PAGE = 11;

export const PORT_OF_CALL_FORM_01_BASE_PATH = '/forms/port-of-call-form-01/';

export interface PortOfCallForm01UrlParams {
  pdfExport?: '1';
  data?: string;
}

export function portOfCallForm01EditorUrl(params: PortOfCallForm01UrlParams = {}): string {
  const q = new URLSearchParams();
  if (params.pdfExport) q.set('pdfExport', params.pdfExport);
  if (params.data) q.set('data', params.data);
  const qs = q.toString();
  return qs ? `${PORT_OF_CALL_FORM_01_BASE_PATH}?${qs}` : PORT_OF_CALL_FORM_01_BASE_PATH;
}
