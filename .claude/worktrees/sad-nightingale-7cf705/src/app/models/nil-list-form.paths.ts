/** NIL List — HTML form (`public/forms/nil-list-form/`). */
export const NIL_LIST_FORM_BASE_PATH = '/forms/nil-list-form/';

export const NIL_LIST_FORM_FEEDBACK_PARAM = 'nilListFeedback';

export const NIL_LIST_SETTINGS_PARAM = 'nilListSettings';

export type NilListFormFeedback = 'saved' | 'cancelled';

export interface NilListFormUrlParams {
  return?: string;
  pdfExport?: '1';
  data?: string;
}

export function nilListFormEditorUrl(params: NilListFormUrlParams = {}): string {
  const q = new URLSearchParams();
  if (params.return) q.set('return', params.return);
  if (params.pdfExport) q.set('pdfExport', params.pdfExport);
  if (params.data) q.set('data', params.data);
  const qs = q.toString();
  return qs ? `${NIL_LIST_FORM_BASE_PATH}?${qs}` : NIL_LIST_FORM_BASE_PATH;
}

/** @deprecated Use nilListFormEditorUrl */
export const nilListFormUrl = nilListFormEditorUrl;
