/** Form 02 - Crew Effect — HTML editor (`public/forms/crew-effect-form-02/`). */
export const CREW_EFFECT_FORM_02_BASE_PATH = '/forms/crew-effect-form-02/';

export const CREW_EFFECT_FORM_02_ROW_COUNT = 18;

export const CREW_EFFECT_FORM_02_FEEDBACK_PARAM = 'ceForm02Feedback';

export type CrewEffectForm02Feedback = 'saved' | 'cancelled';

export interface CrewEffectForm02UrlParams {
  return?: string;
  pdfExport?: '1';
  data?: string;
}

export function crewEffectForm02EditorUrl(params: CrewEffectForm02UrlParams = {}): string {
  const q = new URLSearchParams();
  if (params.return) q.set('return', params.return);
  if (params.pdfExport) q.set('pdfExport', params.pdfExport);
  if (params.data) q.set('data', params.data);
  const qs = q.toString();
  return qs ? `${CREW_EFFECT_FORM_02_BASE_PATH}?${qs}` : CREW_EFFECT_FORM_02_BASE_PATH;
}
