export const CREW_EFFECT_MAX_ROWS = 13;

export const CREW_EFFECT_NIL_LABEL = 'NIL';

export interface CrewEffectFormSettings {
  /** Column Others (e.g. - P. E. -). */
  others: string;
  nilCigarettes: boolean;
  nilSpirits: boolean;
  nilWines: boolean;
  /** Append arrival passengers after crew rows. */
  appendPassengers: boolean;
}

export function createDefaultCrewEffectForm(): CrewEffectFormSettings {
  return {
    others: '- P. E. -',
    nilCigarettes: false,
    nilSpirits: false,
    nilWines: false,
    appendPassengers: false,
  };
}

export function normalizeCrewEffectForm(
  raw: (Partial<CrewEffectFormSettings> & { pageNo?: string; signatureText?: string }) | undefined,
): CrewEffectFormSettings {
  const defaults = createDefaultCrewEffectForm();
  const legacy = raw as { others?: string; signatureText?: string } | undefined;
  const others = (legacy?.others ?? legacy?.signatureText ?? defaults.others).trim();
  return {
    others: others || defaults.others,
    nilCigarettes: Boolean(raw?.nilCigarettes),
    nilSpirits: Boolean(raw?.nilSpirits),
    nilWines: Boolean(raw?.nilWines),
    appendPassengers: Boolean(raw?.appendPassengers),
  };
}

/** Crew Effect 02 — IMO (123.pdf). */
export interface CrewEffectForm02Settings {
  /** P.E. text for Other column (e.g. - P. E. -). */
  others: string;
  nilCigarettes: boolean;
  /** Tobacco / Cigars — single column. */
  nilTobaccoCigars: boolean;
  nilSpirits: boolean;
  nilBeer: boolean;
  /** Append arrival passengers after crew rows. */
  appendPassengers: boolean;
}

export function createDefaultCrewEffectForm02(): CrewEffectForm02Settings {
  return {
    others: '- P. E. -',
    nilCigarettes: false,
    nilTobaccoCigars: false,
    nilSpirits: false,
    nilBeer: false,
    appendPassengers: false,
  };
}

export function normalizeCrewEffectForm02(
  raw:
    | (Partial<CrewEffectForm02Settings> & { pageNo?: string; signatureText?: string })
    | undefined,
): CrewEffectForm02Settings {
  const defaults = createDefaultCrewEffectForm02();
  const legacy = raw as { others?: string; signatureText?: string } | undefined;
  const others = (legacy?.others ?? legacy?.signatureText ?? defaults.others).trim();
  return {
    others: others || defaults.others,
    nilCigarettes: Boolean(raw?.nilCigarettes),
    nilTobaccoCigars: Boolean(raw?.nilTobaccoCigars),
    nilSpirits: Boolean(raw?.nilSpirits),
    nilBeer: Boolean(raw?.nilBeer),
    appendPassengers: Boolean(raw?.appendPassengers),
  };
}

/** Crew Effect 03 — Germany (1234.pdf). */
export interface CrewEffectForm03Settings {
  others: string;
  nilCigarettes: boolean;
  nilCigars: boolean;
  nilSpirits: boolean;
  nilWeapons: boolean;
  nilAmmunition: boolean;
  /** Append arrival passengers after crew rows. */
  appendPassengers: boolean;
}

export function createDefaultCrewEffectForm03(): CrewEffectForm03Settings {
  return {
    others: '- P. E. -',
    nilCigarettes: false,
    nilCigars: false,
    nilSpirits: false,
    nilWeapons: false,
    nilAmmunition: false,
    appendPassengers: false,
  };
}

export function normalizeCrewEffectForm03(
  raw:
    | (Partial<CrewEffectForm03Settings> & { pageNo?: string; signatureText?: string })
    | undefined,
): CrewEffectForm03Settings {
  const defaults = createDefaultCrewEffectForm03();
  const legacy = raw as { others?: string; signatureText?: string } | undefined;
  const others = (legacy?.others ?? legacy?.signatureText ?? defaults.others).trim();
  return {
    others: others || defaults.others,
    nilCigarettes: Boolean(raw?.nilCigarettes),
    nilCigars: Boolean(raw?.nilCigars),
    nilSpirits: Boolean(raw?.nilSpirits),
    nilWeapons: Boolean(raw?.nilWeapons),
    nilAmmunition: Boolean(raw?.nilAmmunition),
    appendPassengers: Boolean(raw?.appendPassengers),
  };
}
