export interface DgImdgClassEntry {
  code: string;
  summary: string;
  description: string;
}

/** IMDG class / division reference for tooltips. */
export const DG_IMDG_CLASSES: readonly DgImdgClassEntry[] = [
  {
    code: '1',
    summary: 'Explosives',
    description: 'Class 1 — Explosives',
  },
  {
    code: '1.1',
    summary: 'Mass explosion hazard',
    description: 'Substances and articles with a mass explosion hazard',
  },
  {
    code: '1.2',
    summary: 'Projection hazard, not mass explosion',
    description: 'Substances and articles with a projection hazard but not a mass explosion hazard',
  },
  {
    code: '1.3',
    summary: 'Fire hazard; minor blast or projection',
    description:
      'Substances and articles with a fire hazard, minor blast or projection hazard, but not mass explosion',
  },
  {
    code: '1.4',
    summary: 'No significant hazard',
    description: 'Substances and articles with no significant hazard',
  },
  {
    code: '1.5',
    summary: 'Very insensitive — mass explosion hazard',
    description: 'Very insensitive substances with a mass explosion hazard',
  },
  {
    code: '1.6',
    summary: 'Extremely insensitive articles',
    description: 'Extremely insensitive articles with no mass explosion hazard',
  },
  {
    code: '2',
    summary: 'Gases',
    description: 'Class 2 — Gases',
  },
  {
    code: '2.1',
    summary: 'Flammable gases',
    description: 'Flammable gases',
  },
  {
    code: '2.2',
    summary: 'Non-flammable, non-toxic gases',
    description: 'Non-flammable, non-toxic gases',
  },
  {
    code: '2.3',
    summary: 'Toxic gases',
    description: 'Toxic gases',
  },
  {
    code: '3',
    summary: 'Flammable liquids',
    description: 'Class 3 — Flammable liquids',
  },
  {
    code: '4',
    summary: 'Flammable solids; spontaneous combustion; water-reactive',
    description:
      'Class 4 — Flammable solids; substances liable to spontaneous combustion; substances which emit flammable gases on contact with water',
  },
  {
    code: '4.1',
    summary: 'Flammable solids, self-reactive, polymerizing',
    description:
      'Flammable solids, self-reactive substances, polymerizing substances and solid desensitized explosives',
  },
  {
    code: '4.2',
    summary: 'Spontaneous combustion',
    description: 'Substances liable to spontaneous combustion',
  },
  {
    code: '4.3',
    summary: 'Emits flammable gas with water',
    description: 'Substances which, in contact with water, emit flammable gases',
  },
  {
    code: '5',
    summary: 'Oxidizing substances and organic peroxides',
    description: 'Class 5 — Oxidizing substances and organic peroxides',
  },
  {
    code: '5.1',
    summary: 'Oxidizing substances',
    description: 'Oxidizing substances',
  },
  {
    code: '5.2',
    summary: 'Organic peroxides',
    description: 'Organic peroxides',
  },
  {
    code: '6',
    summary: 'Toxic and infectious substances',
    description: 'Class 6 — Toxic and infectious substances',
  },
  {
    code: '6.1',
    summary: 'Toxic substances',
    description: 'Toxic substances',
  },
  {
    code: '6.2',
    summary: 'Infectious substances',
    description: 'Infectious substances',
  },
  {
    code: '7',
    summary: 'Radioactive material',
    description: 'Class 7 — Radioactive material',
  },
  {
    code: '8',
    summary: 'Corrosive substances',
    description: 'Class 8 — Corrosive substances',
  },
  {
    code: '9',
    summary: 'Miscellaneous dangerous goods',
    description: 'Class 9 — Miscellaneous dangerous substances and articles',
  },
];

const DG_IMDG_CLASS_BY_KEY = new Map<string, DgImdgClassEntry>();

for (const entry of DG_IMDG_CLASSES) {
  DG_IMDG_CLASS_BY_KEY.set(entry.code, entry);
}

export function normalizeDgImdgClassKey(raw: string | undefined | null): string {
  return String(raw ?? '')
    .trim()
    .replace(',', '.')
    .replace(/\s+/g, '');
}

/** Display label: prefer comma decimal (6,1) when subdivision present. */
export function formatDgImdgClassLabel(key: string): string {
  if (/^\d+\.\d+$/.test(key)) return key.replace('.', ',');
  return key;
}

export function lookupDgImdgClass(raw: string | undefined | null): DgImdgClassEntry | null {
  const key = normalizeDgImdgClassKey(raw);
  if (!key) return null;

  const exact = DG_IMDG_CLASS_BY_KEY.get(key);
  if (exact) return exact;

  // "6,1" style already normalized; try without trailing zero "3.0" -> "3"
  if (/^\d+\.0+$/.test(key)) {
    const whole = key.replace(/\.0+$/, '');
    return DG_IMDG_CLASS_BY_KEY.get(whole) ?? null;
  }

  return null;
}
