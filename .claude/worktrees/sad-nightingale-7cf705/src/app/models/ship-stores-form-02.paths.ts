/** Form 02 - Ship Stores Long — HTML editor (`public/forms/ship-stores-form-02/`). */
export const SHIP_STORES_FORM_02_BASE_PATH = '/forms/ship-stores-form-02/';

export const SHIP_STORES_FORM_02_FEEDBACK_PARAM = 'ssForm02Feedback';

export type ShipStoresForm02Feedback = 'saved' | 'cancelled';

export interface ShipStoresForm02UrlParams {
  return?: string;
  pdfExport?: '1';
  data?: string;
}

export function shipStoresForm02EditorUrl(params: ShipStoresForm02UrlParams = {}): string {
  const q = new URLSearchParams();
  if (params.return) q.set('return', params.return);
  if (params.pdfExport) q.set('pdfExport', params.pdfExport);
  if (params.data) q.set('data', params.data);
  const qs = q.toString();
  return qs ? `${SHIP_STORES_FORM_02_BASE_PATH}?${qs}` : SHIP_STORES_FORM_02_BASE_PATH;
}
