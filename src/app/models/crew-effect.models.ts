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

/** Crew Effect 02 — Germany (1234.pdf). */
export interface CrewEffectForm02Settings {
  /** Column Others (e.g. - P. E. -). */
  others: string;
  nilCigarettes: boolean;
  nilCigars: boolean;
  nilSpirits: boolean;
  nilWeapons: boolean;
  nilAmmunition: boolean;
}

export function createDefaultCrewEffectForm02(): CrewEffectForm02Settings {
  return {
    others: '- P. E. -',
    nilCigarettes: false,
    nilCigars: false,
    nilSpirits: false,
    nilWeapons: false,
    nilAmmunition: false,
  };
}

export function normalizeCrewEffectForm02(
  raw: Partial<CrewEffectForm02Settings> & { pageNo?: string; signatureText?: string } | undefined,
): CrewEffectForm02Settings {
  const defaults = createDefaultCrewEffectForm02();
  const legacy = raw as { others?: string; signatureText?: string } | undefined;
  const others = (legacy?.others ?? legacy?.signatureText ?? defaults.others).trim();
  return {
    others: others || defaults.others,
    nilCigarettes: Boolean(raw?.nilCigarettes),
    nilCigars: Boolean(raw?.nilCigars),
    nilSpirits: Boolean(raw?.nilSpirits),
    nilWeapons: Boolean(raw?.nilWeapons),
    nilAmmunition: Boolean(raw?.nilAmmunition),
  };
}
