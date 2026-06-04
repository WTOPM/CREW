export const CREW_EFFECT_MAX_ROWS = 13;

export const CREW_EFFECT_NIL_LABEL = 'NIL';

export interface CrewEffectFormSettings {
  /** Column Others (e.g. - P. E. -). */
  others: string;
  /** Print NIL in Cigarettes for every crew row. */
  nilCigarettes: boolean;
  /** Print NIL in Spirits (Ltr) for every crew row. */
  nilSpirits: boolean;
  /** Print NIL in Wines (Ltr) for every crew row. */
  nilWines: boolean;
}

export function createDefaultCrewEffectForm(): CrewEffectFormSettings {
  return {
    others: '- P. E. -',
    nilCigarettes: false,
    nilSpirits: false,
    nilWines: false,
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
    nilCigarettes: Boolean(raw?.nilCigarettes),
    nilSpirits: Boolean(raw?.nilSpirits),
    nilWines: Boolean(raw?.nilWines),
  };
}
