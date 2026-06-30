/** Form 01 - Crew Effect — HTML editor (`public/forms/crew-effect-form-01/`). */
export const CREW_EFFECT_FORM_01_BASE_PATH = '/forms/crew-effect-form-01/';

export const CREW_EFFECT_FORM_01_ROW_COUNT = 24;

/** Crew/passenger rows filled from app data (legacy PDF had 13). */
export const CREW_EFFECT_FORM_01_DATA_ROWS = 13;

export const CREW_EFFECT_FORM_01_FEEDBACK_PARAM = 'ceForm01Feedback';

export const CREW_EFFECT_SETTINGS_PARAM = 'crewEffectSettings';

export type CrewEffectForm01Feedback = 'saved' | 'cancelled';

export interface CrewEffectForm01UrlParams {
  return?: string;
  pdfExport?: '1';
  data?: string;
}

export function crewEffectForm01EditorUrl(params: CrewEffectForm01UrlParams = {}): string {
  const q = new URLSearchParams();
  if (params.return) q.set('return', params.return);
  if (params.pdfExport) q.set('pdfExport', params.pdfExport);
  if (params.data) q.set('data', params.data);
  const qs = q.toString();
  return qs ? `${CREW_EFFECT_FORM_01_BASE_PATH}?${qs}` : CREW_EFFECT_FORM_01_BASE_PATH;
}
