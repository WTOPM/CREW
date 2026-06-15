export interface IsoContainerTypeEntry {
  code: string;
  /** Physical size shown first in the hover tooltip (e.g. 40′ High Cube). */
  sizeLabel?: string;
  /** Explanation shown under the size line in the tooltip. */
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

/** Shorthand codes used in UNIFEEDER / carrier manifests (not full ISO 6346). */
const MANIFEST_CONTAINER_TYPES: readonly IsoContainerTypeEntry[] = [
  {
    code: '45GP',
    sizeLabel: '40′ High Cube (9′6″)',
    summary:
      'General-purpose dry container — manifest shorthand for a 40-foot high-cube GP box with extra internal height.',
    description: '40-foot high-cube general-purpose dry container (manifest code 45GP)',
  },
  {
    code: '42GP',
    sizeLabel: '40′ standard height',
    summary:
      'General-purpose dry container — standard 40-foot GP box (8′6″ external height).',
    description: '40-foot general-purpose dry container (manifest code 42GP)',
  },
  {
    code: '22GP',
    sizeLabel: '20′ standard height',
    summary:
      'General-purpose dry container — standard 20-foot GP box for general cargo.',
    description: '20-foot general-purpose dry container (manifest code 22GP)',
  },
  {
    code: 'L5GP',
    sizeLabel: '45′ High Cube (9′6″)',
    summary:
      'General-purpose dry container — 45-foot high-cube GP box (ISO length code L5, common in UNIFEEDER manifests).',
    description: '45-foot high-cube general-purpose dry container (manifest code L5GP)',
  },
  {
    code: 'L2GP',
    sizeLabel: '45′ standard height',
    summary:
      'General-purpose dry container — 45-foot GP box (ISO length code L2).',
    description: '45-foot general-purpose dry container (manifest code L2GP)',
  },
  {
    code: '45RF',
    sizeLabel: '40′ High Cube (9′6″)',
    summary: 'Refrigerated container — 40-foot high-cube reefer unit (manifest shorthand).',
    description: '40-foot high-cube refrigerated container (manifest code 45RF)',
  },
  {
    code: '22RF',
    sizeLabel: '20′ standard height',
    summary: 'Refrigerated container — 20-foot reefer unit (manifest shorthand).',
    description: '20-foot refrigerated container (manifest code 22RF)',
  },
];

const ISO_CONTAINER_TYPE_BY_CODE = new Map(
  ISO_CONTAINER_TYPES.map((entry) => [entry.code, entry] as const),
);

const MANIFEST_CONTAINER_TYPE_BY_CODE = new Map(
  MANIFEST_CONTAINER_TYPES.map((entry) => [entry.code, entry] as const),
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
  G: 'general-purpose dry container',
  R: 'refrigerated container (reefer)',
  U: 'open-top container',
  P: 'platform / flat-rack container',
  T: 'ISO tank container',
  V: 'ventilated container',
  B: 'bulk container',
};

const ISO_CATEGORY_DETAIL: Record<string, string> = {
  GP: 'general-purpose dry container (GP)',
  RF: 'refrigerated container (RF / reefer)',
  OT: 'open-top container',
  FR: 'flat-rack container',
  TK: 'tank container',
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
  const entry =
    ISO_CONTAINER_TYPE_BY_CODE.get(code) ??
    MANIFEST_CONTAINER_TYPE_BY_CODE.get(code) ??
    guessIsoContainerType(code);
  return entry ? withTooltipSizeLabel(entry) : null;
}

export function containerTypeSizeLabel(entry: IsoContainerTypeEntry): string {
  return entry.sizeLabel?.trim() || guessSizeLabel(entry.code) || entry.code;
}

function withTooltipSizeLabel(entry: IsoContainerTypeEntry): IsoContainerTypeEntry {
  const sizeLabel = containerTypeSizeLabel(entry);
  if (entry.sizeLabel === sizeLabel) return entry;
  return { ...entry, sizeLabel };
}

function guessSizeLabel(code: string): string {
  const lengthKey = code.slice(0, 2);
  const size = ISO_LENGTH[lengthKey];
  if (!size) return '';
  return formatSizeLabel(size);
}

function formatSizeLabel(size: string): string {
  if (size.includes('HC')) {
    const base = size.replace(/\s*HC/, '');
    return `${base} High Cube (9′6″)`;
  }
  return `${size} standard height`;
}

function guessIsoContainerType(code: string): IsoContainerTypeEntry | null {
  if (!/^(?:[0-9]{2}[A-Z0-9]{2,3}|[A-Z][0-9][A-Z]{2,3})$/.test(code)) return null;

  const lengthKey = code.slice(0, 2);
  const size = ISO_LENGTH[lengthKey];
  if (!size) return null;

  const suffix = code.slice(2);
  const categoryDetail = ISO_CATEGORY_DETAIL[suffix];
  const categoryKey = code.charAt(2);
  const category = categoryDetail ?? ISO_CATEGORY[categoryKey];
  if (!category) return null;

  const sizeLabel = formatSizeLabel(size);
  const summary = `${category}. Type code ${code} — decoded from ISO 6346 length/category letters.`;

  return {
    code,
    sizeLabel,
    summary,
    description: `${sizeLabel} — ${summary}`,
  };
}
