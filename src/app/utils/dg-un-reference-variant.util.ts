import { normalizeDgPackingGroupKey } from './dg-packing-group.util';
import type { UnNumberReferenceRow } from './dg-un-number.util';

/** Optional manifesto hints used to pick the correct IMDG list variant. */
export interface UnNumberLookupHints {
  packingGroup?: string | null;
  description?: string | null;
  dgClass?: string | null;
}

export type UnNumberVariantMatchKind =
  | 'pg+description'
  | 'pg'
  | 'description'
  | 'class'
  | 'un-only';

export interface UnNumberVariantMatch {
  row: UnNumberReferenceRow;
  kind: UnNumberVariantMatchKind;
  /** 0–100 description similarity (0 when unused). */
  descriptionScore: number;
  /** How many list rows share this UN number. */
  variantCount: number;
  /** True when manifesto PG is set but no list row has that PG. */
  packingGroupMissing: boolean;
}

function normalizeUnNoDigits(raw: string | undefined | null): string {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length >= 4) return digits.slice(0, 4);
  return digits.padStart(4, '0').slice(-4);
}

/** Stable key for one Dangerous Goods List row (UN + PG + PSN). */
export function unNumberReferenceVariantKey(
  row: Pick<UnNumberReferenceRow, 'unNo' | 'packingGroup' | 'description'>,
): string {
  const unNo = normalizeUnNoDigits(row.unNo);
  const pgKey = normalizeDgPackingGroupKey(row.packingGroup ?? '');
  const pgFallback = String(row.packingGroup ?? '')
    .trim()
    .toUpperCase();
  const pg = pgKey || pgFallback || '-';
  return `${unNo}|${pg}|${normalizeUnDescriptionKey(row.description)}`;
}

export function normalizeUnDescriptionKey(raw: string | undefined | null): string {
  return String(raw ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sameUnPackingGroup(a: string | undefined | null, b: string | undefined | null): boolean {
  const ka = normalizeDgPackingGroupKey(String(a ?? ''));
  const kb = normalizeDgPackingGroupKey(String(b ?? ''));
  if (ka && kb) return ka === kb;
  const na = String(a ?? '')
    .trim()
    .toUpperCase()
    .replace(/^PG\s*/i, '');
  const nb = String(b ?? '')
    .trim()
    .toUpperCase()
    .replace(/^PG\s*/i, '');
  if (!na && !nb) return true;
  if (!na || !nb) return false;
  return na === nb;
}

/**
 * Score manifesto proper shipping name vs an IMDG list description.
 * Exact / prefix matches score high; otherwise token Jaccard (significant words).
 */
export function scoreUnDescriptionMatch(
  manifest: string | undefined | null,
  reference: string | undefined | null,
): number {
  const a = normalizeUnDescriptionKey(manifest);
  const b = normalizeUnDescriptionKey(reference);
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (a.startsWith(b) || b.startsWith(a)) return 90;

  const tokensA = new Set(a.split(' ').filter((t) => t.length >= 3));
  const tokensB = new Set(b.split(' ').filter((t) => t.length >= 3));
  if (!tokensA.size || !tokensB.size) return 0;

  let inter = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) inter++;
  }
  const union = tokensA.size + tokensB.size - inter;
  return Math.round((inter / union) * 80);
}

function packingGroupRank(pg: string): number {
  const key = normalizeDgPackingGroupKey(pg);
  if (key === 'I') return 1;
  if (key === 'II') return 2;
  if (key === 'III') return 3;
  return 9;
}

function sameDgClassLoose(a: string | undefined | null, b: string | undefined | null): boolean {
  const na = String(a ?? '')
    .trim()
    .toUpperCase();
  const nb = String(b ?? '')
    .trim()
    .toUpperCase();
  if (!na || !nb) return false;
  if (na === nb) return true;
  // Manifest "2.1" vs reference class "2" / base class comparisons.
  return na.startsWith(nb) || nb.startsWith(na);
}

/**
 * Pick the best IMDG list variant for a manifesto row.
 * Priority: packing group → description → class → first printed variant.
 */
export function pickUnNumberReferenceVariant(
  variants: readonly UnNumberReferenceRow[],
  hints: UnNumberLookupHints = {},
): UnNumberVariantMatch | null {
  if (!variants.length) return null;

  const manifestPg = String(hints.packingGroup ?? '').trim();
  const hasManifestPg = !!manifestPg && manifestPg !== '-' && manifestPg !== '--';

  let pool = [...variants];
  let packingGroupMissing = false;
  let usedPg = false;

  if (hasManifestPg) {
    const pgHits = variants.filter((row) => sameUnPackingGroup(row.packingGroup, manifestPg));
    if (pgHits.length) {
      pool = pgHits;
      usedPg = true;
    } else {
      packingGroupMissing = true;
    }
  }

  const manifestDesc = String(hints.description ?? '').trim();
  const scored = pool.map((row) => ({
    row,
    descriptionScore: manifestDesc ? scoreUnDescriptionMatch(manifestDesc, row.description) : 0,
    classHit: hints.dgClass ? sameDgClassLoose(hints.dgClass, row.dgClass) : false,
  }));

  scored.sort((a, b) => {
    if (b.descriptionScore !== a.descriptionScore) return b.descriptionScore - a.descriptionScore;
    if (Number(b.classHit) !== Number(a.classHit)) return Number(b.classHit) - Number(a.classHit);
    const pg = packingGroupRank(a.row.packingGroup) - packingGroupRank(b.row.packingGroup);
    if (pg) return pg;
    return a.row.description.localeCompare(b.row.description);
  });

  const best = scored[0]!;
  const descHit = best.descriptionScore >= 50;
  let kind: UnNumberVariantMatchKind;
  if (usedPg && descHit) kind = 'pg+description';
  else if (usedPg) kind = 'pg';
  else if (descHit) kind = 'description';
  else if (best.classHit) kind = 'class';
  else kind = 'un-only';

  return {
    row: best.row,
    kind,
    descriptionScore: best.descriptionScore,
    variantCount: variants.length,
    packingGroupMissing,
  };
}

/** Unique packing groups printed for a UN (roman numerals when possible). */
export function listUnNumberVariantPackingGroups(
  variants: readonly UnNumberReferenceRow[],
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const row of variants) {
    const key = normalizeDgPackingGroupKey(row.packingGroup) ?? row.packingGroup.trim().toUpperCase();
    if (!key || key === '-') continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out.sort((a, b) => packingGroupRank(a) - packingGroupRank(b));
}
