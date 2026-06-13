export interface IsoContainerTypeEntry {
  code: string;
  /** Short line for hover tooltip. */
  summary: string;
  /** Full description (catalog / future UI). */
  description: string;
}

/** Common ISO 6346 type codes — extend as needed. */
export const ISO_CONTAINER_TYPES: readonly IsoContainerTypeEntry[] = [
  {
    code: '22G1',
    summary: '20′ GP dry van — opening at one or both ends',
    description:
      'General purpose container, closed, with full or partial opening on one or both ends (20-foot dry van)',
  },
  {
    code: '22G0',
    summary: '20′ GP dry — closed, standard',
    description: 'General purpose container, closed (20-foot dry container, standard variant)',
  },
  {
    code: '42G1',
    summary: '40′ GP dry van — opening at one or both ends',
    description:
      'General purpose container, closed, with full or partial opening on one or both ends (40-foot dry van)',
  },
  {
    code: '42G0',
    summary: '40′ GP dry — closed, standard',
    description: 'General purpose container, closed (40-foot dry container, standard variant)',
  },
  {
    code: '45G1',
    summary: '40′ GP High Cube — closed, 9′6″',
    description: 'General purpose container, closed, High Cube (40-foot, 9\'6" height)',
  },
  {
    code: '22R1',
    summary: '20′ refrigerated (reefer)',
    description: 'Insulated container, mechanically refrigerated (20-foot reefer)',
  },
  {
    code: '42R1',
    summary: '40′ refrigerated (reefer)',
    description: 'Insulated container, mechanically refrigerated (40-foot reefer)',
  },
  {
    code: '25R1',
    summary: '20′ reefer High Cube',
    description: 'Insulated container, mechanically refrigerated, High Cube (20-foot)',
  },
  {
    code: '45R1',
    summary: '40′ reefer High Cube',
    description: 'Insulated container, mechanically refrigerated, High Cube (40-foot)',
  },
  {
    code: '22U1',
    summary: '20′ open top — removable roof',
    description: 'Open top container, with removable convertible top (20-foot)',
  },
  {
    code: '42U1',
    summary: '40′ open top — removable roof',
    description: 'Open top container, with removable convertible top (40-foot)',
  },
  {
    code: '22P1',
    summary: '20′ flat rack — fixed posts',
    description:
      'Platform container with fixed posts, complete superstructure with permanent ends (20-foot flat rack)',
  },
  {
    code: '42P1',
    summary: '40′ flat rack — fixed posts',
    description:
      'Platform container with fixed posts, complete superstructure with permanent ends (40-foot flat rack)',
  },
  {
    code: '22T1',
    summary: '20′ ISO tank — non-DG liquids',
    description:
      'Tank container for non-dangerous liquids (20-foot, ISO tank, minimum pressure 0.45 bar)',
  },
  {
    code: '22V1',
    summary: '20′ ventilated — closed with vents',
    description: 'Closed ventilated container, with ventilation openings (20-foot)',
  },
  {
    code: '22B1',
    summary: '20′ bulk — closed, dry bulk',
    description: 'Bulk container, closed (20-foot, for dry bulk cargo)',
  },
];

const ISO_CONTAINER_TYPE_BY_CODE = new Map(
  ISO_CONTAINER_TYPES.map((entry) => [entry.code, entry] as const),
);

const ISO_LENGTH: Record<string, string> = {
  '20': '20′',
  '22': '20′',
  '25': '20′ HC',
  '40': '40′',
  '42': '40′',
  '45': '40′ HC',
  'L2': '45′',
  'L5': '45′ HC',
};

const ISO_CATEGORY: Record<string, string> = {
  G: 'general purpose',
  R: 'refrigerated',
  U: 'open top',
  P: 'platform / flat rack',
  T: 'tank',
  V: 'ventilated',
  B: 'bulk',
};

export function normalizeIsoContainerTypeCode(raw: string | undefined | null): string {
  return String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s/g, '');
}

export function lookupIsoContainerType(
  raw: string | undefined | null,
): IsoContainerTypeEntry | null {
  const code = normalizeIsoContainerTypeCode(raw);
  if (!code) return null;
  return ISO_CONTAINER_TYPE_BY_CODE.get(code) ?? guessIsoContainerType(code);
}

function guessIsoContainerType(code: string): IsoContainerTypeEntry | null {
  if (!/^[0-9]{2}[A-Z0-9]{2}$/.test(code)) return null;

  const lengthKey = code.slice(0, 2);
  const categoryKey = code.charAt(2);
  const size = ISO_LENGTH[lengthKey];
  const category = ISO_CATEGORY[categoryKey];
  if (!size || !category) return null;

  const summary = `${size}, ${category} (ISO ${code})`;
  return { code, summary, description: summary };
}
