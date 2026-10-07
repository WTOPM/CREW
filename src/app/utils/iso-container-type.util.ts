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
    summary: 'General-purpose dry container — standard 40-foot GP box (8′6″ external height).',
    description: '40-foot general-purpose dry container (manifest code 42GP)',
  },
  {
    code: '22GP',
    sizeLabel: '20′ standard height',
    summary: 'General-purpose dry container — standard 20-foot GP box for general cargo.',
    description: '20-foot general-purpose dry container (manifest code 22GP)',
  },
  {
    code: '25GP',
    sizeLabel: '20′ High Cube (9′6″)',
    summary: 'General-purpose dry container — 20-foot high-cube GP box.',
    description: '20-foot high-cube general-purpose dry container (manifest code 25GP)',
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
    summary: 'General-purpose dry container — 45-foot GP box (ISO length code L2).',
    description: '45-foot general-purpose dry container (manifest code L2GP)',
  },
  {
    code: '45RF',
    sizeLabel: '40′ High Cube (9′6″)',
    summary: 'Refrigerated container — 40-foot high-cube reefer unit (manifest shorthand).',
    description: '40-foot high-cube refrigerated container (manifest code 45RF)',
  },
  {
    code: '42RF',
    sizeLabel: '40′ standard height',
    summary: 'Refrigerated container — 40-foot reefer unit (manifest shorthand).',
    description: '40-foot refrigerated container (manifest code 42RF)',
  },
  {
    code: '22RF',
    sizeLabel: '20′ standard height',
    summary: 'Refrigerated container — 20-foot reefer unit (manifest shorthand).',
    description: '20-foot refrigerated container (manifest code 22RF)',
  },
  {
    code: '22TN',
    sizeLabel: '20′ standard height',
    summary: 'Tank container — 20-foot ISO tank (manifest shorthand).',
    description: '20-foot tank container (manifest code 22TN)',
  },
  {
    code: '42TN',
    sizeLabel: '40′ standard height',
    summary: 'Tank container — 40-foot ISO tank (manifest shorthand).',
    description: '40-foot tank container (manifest code 42TN)',
  },
  {
    code: '22OT',
    sizeLabel: '20′ standard height',
    summary: 'Open-top container — 20-foot (manifest shorthand).',
    description: '20-foot open-top container (manifest code 22OT)',
  },
  {
    code: '42OT',
    sizeLabel: '40′ standard height',
    summary: 'Open-top container — 40-foot (manifest shorthand).',
    description: '40-foot open-top container (manifest code 42OT)',
  },
  {
    code: '45OT',
    sizeLabel: '40′ High Cube (9′6″)',
    summary: 'Open-top container — 40-foot high-cube (manifest shorthand).',
    description: '40-foot high-cube open-top container (manifest code 45OT)',
  },
  {
    code: '22FR',
    sizeLabel: '20′ standard height',
    summary: 'Flat-rack container — 20-foot (manifest shorthand).',
    description: '20-foot flat-rack container (manifest code 22FR)',
  },
  {
    code: '42FR',
    sizeLabel: '40′ standard height',
    summary: 'Flat-rack container — 40-foot (manifest shorthand).',
    description: '40-foot flat-rack container (manifest code 42FR)',
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
  L2: '45′',
  L5: '45′ HC',
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

/** Catalog used for Size/Type typing suggestions (ISO + manifest, unique by code). */
export const SUGGESTABLE_CONTAINER_TYPES: readonly IsoContainerTypeEntry[] = (() => {
  const map = new Map<string, IsoContainerTypeEntry>();
  for (const entry of [...MANIFEST_CONTAINER_TYPES, ...ISO_CONTAINER_TYPES]) {
    const code = normalizeIsoContainerTypeCode(entry.code);
    if (!code || map.has(code)) continue;
    map.set(code, withTooltipSizeLabel({ ...entry, code }));
  }
  return [...map.values()].sort((a, b) => a.code.localeCompare(b.code));
})();

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

/** Shorthand length digit(s): `4`/`40` → all 40′ codes (42*, 45*); `2`/`20` → 20′. */
function lengthFamilyForQuery(q: string): '20' | '40' | null {
  if (q === '2' || q === '20') return '20';
  if (q === '4' || q === '40') return '40';
  return null;
}

function entryLengthFamily(code: string): '20' | '40' | '45' | null {
  const key = code.slice(0, 2);
  const size = ISO_LENGTH[key] ?? '';
  if (size.startsWith('20')) return '20';
  if (size.startsWith('40')) return '40';
  if (size.startsWith('45')) return '45';
  return null;
}

function scoreContainerTypeSuggestion(entry: IsoContainerTypeEntry, q: string): number {
  const code = entry.code;
  if (code === q) return 1000;

  const family = lengthFamilyForQuery(q);
  if (family) {
    // Digit length queries (`4`, `40`, `2`) rank the whole family — not only code prefix.
    if (entryLengthFamily(code) !== family) return 0;
    let score = 600;
    if (code.endsWith('GP') || code.endsWith('G1') || code.endsWith('G0')) score += 80;
    else if (code.endsWith('RF') || code.endsWith('R1')) score += 60;
    else if (code.endsWith('TN') || code.endsWith('T1')) score += 50;
    else if (code.endsWith('OT') || code.endsWith('U1')) score += 40;
    else if (code.endsWith('FR') || code.endsWith('P1')) score += 40;
    // Prefer HC variants within the family (25*, 45*).
    if (code.startsWith('25') || code.startsWith('45')) score += 15;
    return score;
  }

  if (code.startsWith(q)) return 800 + Math.min(q.length, 8) * 10;

  const sizeLabel = containerTypeSizeLabel(entry).toUpperCase().replace(/[′'″"\s]/g, '');
  const qCompact = q.replace(/[′'″"\s]/g, '');
  if (qCompact && sizeLabel.includes(qCompact)) return 500;
  if (entry.summary.toUpperCase().includes(q)) return 300;
  return 0;
}

/**
 * Size/Type suggestions while typing in DG inventory.
 * Typing `4` → 40′ family (42GP, 45GP, 42G1, …); `2` → 20′; code prefix also matches.
 */
export function suggestIsoContainerTypes(
  rawQuery: string | undefined | null,
  limit = 12,
): IsoContainerTypeEntry[] {
  const q = normalizeIsoContainerTypeCode(rawQuery);
  if (!q) return [];
  const scored = SUGGESTABLE_CONTAINER_TYPES.map((entry) => ({
    entry,
    score: scoreContainerTypeSuggestion(entry, q),
  })).filter((row) => row.score > 0);
  scored.sort(
    (a, b) => b.score - a.score || a.entry.code.localeCompare(b.entry.code),
  );
  return scored.slice(0, Math.max(1, limit)).map((row) => row.entry);
}
