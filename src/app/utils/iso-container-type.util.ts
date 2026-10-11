export interface IsoContainerTypeEntry {
  code: string;
  /** Short display size (e.g. 40′ HC) — primary UI label. */
  sizeLabel: string;
  /** Explanation shown under the size line in the tooltip. */
  summary: string;
  /** Full description (catalog / future UI). */
  description: string;
}

/** Prefer the prime (′) / double-prime (″) glyphs in size text. */
export function prettyContainerSizeText(raw: string | undefined | null): string {
  return String(raw ?? '')
    .replace(/(\d)\s*['’`]/g, '$1′')
    .replace(/(\d)\s*["”]/g, '$1″')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Compact key for matching size labels / loose typing (`40hc`, `40′ HC`, …). */
export function normalizeContainerSizeKey(raw: string | undefined | null): string {
  return prettyContainerSizeText(raw)
    .toUpperCase()
    .replace(/[′'’`″"”]/g, '')
    .replace(/\s+/g, '');
}

function entry(
  code: string,
  sizeLabel: string,
  summary: string,
  description?: string,
): IsoContainerTypeEntry {
  return {
    code,
    sizeLabel,
    summary,
    description: description ?? `${sizeLabel} — ${summary}`,
  };
}

/**
 * Manifest / ops shorthand — primary catalog shown in Size/Type suggestions.
 * Compact size labels (no spaces) so they fit the narrow Unifeeder column: 40′RFHC.
 */
const MANIFEST_CONTAINER_TYPES: readonly IsoContainerTypeEntry[] = [
  // Dry / GP
  entry('22GP', '20′DC', 'General-purpose dry container — standard 20-foot DC.'),
  entry('25GP', '20′HC', 'General-purpose dry container — 20-foot high cube.'),
  entry('26GP', '20′HCPW', 'General-purpose dry — 20-foot high-cube pallet wide.'),
  entry('42GP', '40′DC', 'General-purpose dry container — standard 40-foot DC.'),
  entry('45GP', '40′HC', 'General-purpose dry container — 40-foot high cube.'),
  entry('46GP', '40′HCPW', 'General-purpose dry — 40-foot high-cube pallet wide.'),
  entry('L2GP', '45′', 'General-purpose dry container — 45-foot standard height.'),
  entry('L5GP', '45′HC', 'General-purpose dry container — 45-foot high cube.'),
  entry('L6GP', '45′HCPW', 'General-purpose dry — 45-foot high-cube pallet wide.'),

  // Reefer
  entry('22RF', '20′RF', 'Refrigerated container — 20-foot reefer.'),
  entry('25RF', '20′RFHC', 'Refrigerated container — 20-foot high-cube reefer.'),
  entry('42RF', '40′RF', 'Refrigerated container — 40-foot reefer.'),
  entry('45RF', '40′RFHC', 'Refrigerated container — 40-foot high-cube reefer.'),

  // Tank
  entry('22TN', '20′TN', 'Tank container — 20-foot ISO tank.'),
  entry('42TN', '40′TN', 'Tank container — 40-foot ISO tank.'),

  // Open top
  entry('22OT', '20′OT', 'Open-top container — 20-foot.'),
  entry('42OT', '40′OT', 'Open-top container — 40-foot.'),
  entry('45OT', '40′OTHC', 'Open-top container — 40-foot high cube.'),

  // Platform / flat rack (PF)
  entry('22FR', '20′PF', 'Platform / flat-rack container — 20-foot.'),
  entry('42FR', '40′PF', 'Platform / flat-rack container — 40-foot.'),
  entry('45FR', '40′PFHC', 'Platform / flat-rack container — 40-foot high cube.'),
];

/** Common ISO 6346 type codes — resolve/lookup; sizes alias to the short labels above. */
export const ISO_CONTAINER_TYPES: readonly IsoContainerTypeEntry[] = [
  entry('22G1', '20′DC', '20′ GP dry van — opening at one or both ends'),
  entry('22G0', '20′DC', '20′ GP dry — closed, standard'),
  entry('42G1', '40′DC', '40′ GP dry van — opening at one or both ends'),
  entry('42G0', '40′DC', '40′ GP dry — closed, standard'),
  entry('45G1', '40′HC', '40′ GP High Cube — closed, 9′6″'),
  entry('26G1', '20′HCPW', '20′ GP High Cube pallet wide'),
  entry('46G1', '40′HCPW', '40′ GP High Cube pallet wide'),
  entry('22R1', '20′RF', '20′ refrigerated (reefer)'),
  entry('25R1', '20′RFHC', '20′ reefer High Cube'),
  entry('42R1', '40′RF', '40′ refrigerated (reefer)'),
  entry('45R1', '40′RFHC', '40′ reefer High Cube'),
  entry('22U1', '20′OT', '20′ open top — removable roof'),
  entry('42U1', '40′OT', '40′ open top — removable roof'),
  entry('22P1', '20′PF', '20′ flat rack / platform — fixed posts'),
  entry('42P1', '40′PF', '40′ flat rack / platform — fixed posts'),
  entry('22T1', '20′TN', '20′ ISO tank — non-DG liquids'),
  entry('22V1', '20′VT', '20′ ventilated — closed with vents'),
  entry('22B1', '20′BK', '20′ bulk — closed, dry bulk'),
];

const ISO_CONTAINER_TYPE_BY_CODE = new Map(
  ISO_CONTAINER_TYPES.map((e) => [e.code, e] as const),
);

const MANIFEST_CONTAINER_TYPE_BY_CODE = new Map(
  MANIFEST_CONTAINER_TYPES.map((e) => [e.code, e] as const),
);

const ISO_LENGTH: Record<string, string> = {
  '20': '20′',
  '22': '20′',
  '23': '20′PW',
  '25': '20′HC',
  '26': '20′HCPW',
  '40': '40′',
  '42': '40′',
  '43': '40′PW',
  '45': '40′HC',
  '46': '40′HCPW',
  L2: '45′',
  L5: '45′HC',
  L6: '45′HCPW',
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
  FR: 'flat-rack / platform container (PF)',
  TN: 'tank container',
  TK: 'tank container',
  PW: 'pallet-wide dry container',
};

export function normalizeIsoContainerTypeCode(raw: string | undefined | null): string {
  return String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s/g, '');
}

export function containerTypeSizeLabel(entry: IsoContainerTypeEntry): string {
  return prettyContainerSizeText(entry.sizeLabel) || entry.code;
}

function withTooltipSizeLabel(entry: IsoContainerTypeEntry): IsoContainerTypeEntry {
  const sizeLabel = containerTypeSizeLabel(entry);
  if (entry.sizeLabel === sizeLabel) return entry;
  return { ...entry, sizeLabel };
}

/**
 * Unique sizes for typing suggestions (manifest first, then ISO aliases).
 * One row per size label — UI edits by size, not by ISO code.
 */
export const SUGGESTABLE_CONTAINER_TYPES: readonly IsoContainerTypeEntry[] = (() => {
  const bySize = new Map<string, IsoContainerTypeEntry>();
  for (const raw of [...MANIFEST_CONTAINER_TYPES, ...ISO_CONTAINER_TYPES]) {
    const normalized = withTooltipSizeLabel({
      ...raw,
      code: normalizeIsoContainerTypeCode(raw.code),
    });
    const sizeKey = normalizeContainerSizeKey(normalized.sizeLabel);
    if (!sizeKey || bySize.has(sizeKey)) continue;
    bySize.set(sizeKey, normalized);
  }
  return [...bySize.values()].sort((a, b) => {
    const len = sizeSortKey(a.sizeLabel) - sizeSortKey(b.sizeLabel);
    if (len !== 0) return len;
    return a.sizeLabel.localeCompare(b.sizeLabel, 'en');
  });
})();

const CONTAINER_TYPE_BY_SIZE_KEY = new Map(
  SUGGESTABLE_CONTAINER_TYPES.map((e) => [
    normalizeContainerSizeKey(e.sizeLabel),
    e,
  ] as const),
);

function sizeSortKey(sizeLabel: string): number {
  const m = sizeLabel.match(/^(\d+)/);
  return m ? Number(m[1]) : 999;
}

export function lookupIsoContainerType(
  raw: string | undefined | null,
): IsoContainerTypeEntry | null {
  const text = String(raw ?? '').trim();
  if (!text) return null;

  const sizeHit = CONTAINER_TYPE_BY_SIZE_KEY.get(normalizeContainerSizeKey(text));
  if (sizeHit) return withTooltipSizeLabel(sizeHit);

  const code = normalizeIsoContainerTypeCode(text);
  if (!code) return null;
  const entry =
    MANIFEST_CONTAINER_TYPE_BY_CODE.get(code) ??
    ISO_CONTAINER_TYPE_BY_CODE.get(code) ??
    guessIsoContainerType(code);
  return entry ? withTooltipSizeLabel(entry) : null;
}

/** Value shown in size mode — prefers short size (40′ HC) over code (45GP). */
export function displayContainerSize(raw: string | undefined | null): string {
  const text = String(raw ?? '').trim();
  if (!text) return '';
  const entry = lookupIsoContainerType(text);
  if (entry) return containerTypeSizeLabel(entry);
  return prettyContainerSizeText(text);
}

/** Value shown in type mode — prefers manifest/ISO code (45RF) over size label. */
export function displayContainerTypeCode(raw: string | undefined | null): string {
  const text = String(raw ?? '').trim();
  if (!text) return '';
  const entry = lookupIsoContainerType(text);
  if (entry) return entry.code;
  return normalizeIsoContainerTypeCode(text) || text;
}

/** Canonical size label when the value is a known type/size. */
export function resolveContainerSizeValue(raw: string | undefined | null): string {
  const text = String(raw ?? '').trim();
  if (!text) return '';
  const entry = lookupIsoContainerType(text);
  if (entry) return containerTypeSizeLabel(entry);
  return prettyContainerSizeText(text);
}

/** Canonical type code when the value is a known type/size. */
export function resolveContainerTypeCode(raw: string | undefined | null): string {
  const text = String(raw ?? '').trim();
  if (!text) return '';
  const entry = lookupIsoContainerType(text);
  if (entry) return entry.code;
  return normalizeIsoContainerTypeCode(text) || text;
}

export type ContainerSizeColumnMode = 'type' | 'size';
export type ContainerLengthFamily = '20' | '40' | '45';

/** Display / persist value for the inventory Size|Type column. */
export function resolveContainerColumnValue(
  raw: string | undefined | null,
  mode: ContainerSizeColumnMode,
): string {
  return mode === 'size' ? resolveContainerSizeValue(raw) : resolveContainerTypeCode(raw);
}

/** Split `40′RFHC` → prefix `40′` + rest `RFHC` for colored length display. */
export function splitContainerSizeLabel(raw: string | undefined | null): {
  prefix: string;
  rest: string;
  family: ContainerLengthFamily | null;
} {
  const text = prettyContainerSizeText(raw);
  const m = text.match(/^(20|40|45)([′'’`])?/);
  if (!m) return { prefix: '', rest: text, family: null };
  const family = m[1] as ContainerLengthFamily;
  const prefix = `${m[1]}′`;
  const rest = text.slice(m[0].length);
  return { prefix, rest, family };
}

/** Length family for size labels or type codes (20 / 40 / 45). */
export function containerLengthFamily(
  raw: string | undefined | null,
): ContainerLengthFamily | null {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  const fromLabel = splitContainerSizeLabel(displayContainerSize(text)).family;
  if (fromLabel) return fromLabel;
  const entry = lookupIsoContainerType(text);
  return entry ? entryLengthFamily(entry.sizeLabel) : null;
}

function guessSizeLabel(code: string): string {
  const lengthKey = code.slice(0, 2);
  const size = ISO_LENGTH[lengthKey];
  if (!size) return '';
  return formatGuessedSizeLabel(size, code);
}

function formatGuessedSizeLabel(size: string, code: string): string {
  const suffix = code.slice(2).toUpperCase();
  const kind =
    suffix.startsWith('RF') || suffix.startsWith('R')
      ? 'RF'
      : suffix.startsWith('OT') || suffix.startsWith('U')
        ? 'OT'
        : suffix.startsWith('FR') || suffix.startsWith('P')
          ? 'PF'
          : suffix.startsWith('TN') || suffix.startsWith('T')
            ? 'TN'
            : suffix.startsWith('V')
              ? 'VT'
              : suffix.startsWith('B')
                ? 'BK'
                : 'DC';

  const hc = /HC/.test(size);
  const pw = /PW/.test(size);
  const base = size.replace(/\s*(HC|PW)/g, '').trim(); // e.g. 40′
  if (kind === 'DC') {
    if (hc || pw) return prettyContainerSizeText(`${base}${hc ? 'HC' : ''}${pw ? 'PW' : ''}`);
    return prettyContainerSizeText(`${base}DC`);
  }
  return prettyContainerSizeText(`${base}${kind}${hc ? 'HC' : ''}${pw ? 'PW' : ''}`);
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

  const sizeLabel = guessSizeLabel(code) || formatGuessedSizeLabel(size, code);
  const summary = `${category}. Type code ${code} — decoded from ISO 6346 length/category letters.`;

  return {
    code,
    sizeLabel,
    summary,
    description: `${sizeLabel} — ${summary}`,
  };
}

/** Shorthand length digit(s): `4`/`40` → all 40′ sizes; `2`/`20` → 20′; `45` → 45′. */
function lengthFamilyForQuery(q: string): '20' | '40' | '45' | null {
  if (q === '2' || q === '20') return '20';
  if (q === '4' || q === '40') return '40';
  if (q === '45') return '45';
  return null;
}

function entryLengthFamily(sizeLabel: string): '20' | '40' | '45' | null {
  if (sizeLabel.startsWith('20')) return '20';
  if (sizeLabel.startsWith('40')) return '40';
  if (sizeLabel.startsWith('45')) return '45';
  return null;
}

function scoreContainerTypeSuggestion(entry: IsoContainerTypeEntry, q: string): number {
  const code = entry.code;
  const sizeLabel = containerTypeSizeLabel(entry);
  const sizeKey = normalizeContainerSizeKey(sizeLabel);
  const qSize = normalizeContainerSizeKey(q);
  const qCode = normalizeIsoContainerTypeCode(q);

  if (sizeKey === qSize) return 1100;
  if (code === qCode) return 1000;

  const family = lengthFamilyForQuery(qCode);
  if (family) {
    if (entryLengthFamily(sizeLabel) !== family) return 0;
    let score = 600;
    const key = normalizeContainerSizeKey(sizeLabel);
    if (key.endsWith('DC') || sizeLabel === '45′') score += 80;
    else if (key.includes('HC') && !key.includes('PW') && !key.includes('RF') && !key.includes('OT') && !key.includes('PF'))
      score += 70;
    else if (key.includes('PW')) score += 55;
    else if (key.includes('RF')) score += 50;
    else if (key.includes('TN')) score += 45;
    else if (key.includes('OT')) score += 40;
    else if (key.includes('PF')) score += 40;
    return score;
  }

  if (qSize && sizeKey.startsWith(qSize)) return 850 + Math.min(qSize.length, 10) * 10;
  if (qSize && sizeKey.includes(qSize)) return 700;
  if (qCode && code.startsWith(qCode)) return 650 + Math.min(qCode.length, 8) * 10;
  if (entry.summary.toUpperCase().includes(qCode)) return 300;
  return 0;
}

/**
 * Size/Type suggestions while typing in DG inventory.
 * Primary match is by size (`40`, `HC`, `40′ HC`); ISO codes still match.
 */
export function suggestIsoContainerTypes(
  rawQuery: string | undefined | null,
  limit = 12,
): IsoContainerTypeEntry[] {
  const q = String(rawQuery ?? '').trim();
  if (!q) return [];
  const scored = SUGGESTABLE_CONTAINER_TYPES.map((entry) => ({
    entry,
    score: scoreContainerTypeSuggestion(entry, q),
  })).filter((row) => row.score > 0);
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      a.entry.sizeLabel.localeCompare(b.entry.sizeLabel, 'en') ||
      a.entry.code.localeCompare(b.entry.code),
  );
  return scored.slice(0, Math.max(1, limit)).map((row) => row.entry);
}
