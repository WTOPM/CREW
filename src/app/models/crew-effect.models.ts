export const CREW_EFFECT_MAX_ROWS = 13;

export interface CrewEffectFormSettings {
  /** Column 7 — Others (e.g. - P. E. -). */
  others: string;
}

export function createDefaultCrewEffectForm(): CrewEffectFormSettings {
  return {
    others: '- P. E. -',
  };
}

export function normalizeCrewEffectForm(
  raw: Partial<CrewEffectFormSettings> & { pageNo?: string; signatureText?: string } | undefined,
): CrewEffectFormSettings {
  const defaults = createDefaultCrewEffectForm();
  const legacy = raw as { others?: string; signatureText?: string } | undefined;
  const others = (legacy?.others ?? legacy?.signatureText ?? defaults.others).trim();
  return {
    others: others || defaults.others,
  };
}
