/** Form 01 - Ship Stores Short — HTML editor (`public/forms/ship-stores-form-01/`). */
export const SHIP_STORES_FORM_01_BASE_PATH = '/forms/ship-stores-form-01/';

export const SHIP_STORES_FORM_01_FEEDBACK_PARAM = 'ssForm01Feedback';

export const SHIP_STORES_SETTINGS_PARAM = 'shipStoresSettings';

export type ShipStoresForm01Feedback = 'saved' | 'cancelled';

export interface ShipStoresForm01UrlParams {
  return?: string;
  pdfExport?: '1';
  data?: string;
}

export function shipStoresForm01EditorUrl(params: ShipStoresForm01UrlParams = {}): string {
  const q = new URLSearchParams();
  if (params.return) q.set('return', params.return);
  if (params.pdfExport) q.set('pdfExport', params.pdfExport);
  if (params.data) q.set('data', params.data);
  const qs = q.toString();
  return qs ? `${SHIP_STORES_FORM_01_BASE_PATH}?${qs}` : SHIP_STORES_FORM_01_BASE_PATH;
}
