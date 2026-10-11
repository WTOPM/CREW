import type { DgCargoLine } from '../models/dg-manifest.models';
import type { DgUnifeederRow } from '../models/dg-unifeeder.models';
import { applyMfagSchedulesToUnifeederRow } from './dg-mfag-schedule.util';
import {
  isClass2DivisionMisfiledAsSubRisk,
  normalizeUnifeederSubRisk,
} from './dg-unifeeder-sub-risk.util';
import {
  listUnNumberReferenceVariants,
  lookupUnNumberReference,
  matchUnNumberReference,
  normalizeUnNumber,
  type UnNumberLookupHints,
  type UnNumberReferenceRow,
} from './dg-un-number.util';
import {
  listUnNumberVariantPackingGroups,
  normalizeUnDescriptionKey,
  sameUnPackingGroup,
  scoreUnDescriptionMatch,
} from './dg-un-reference-variant.util';

function refField(value: string | undefined): string {
  const v = String(value ?? '').trim();
  return v && v !== '-' ? v : '';
}

export function unNumberHasDigits(raw: string | undefined | null): boolean {
  return /\d/.test(String(raw ?? ''));
}

/** Marker joining rival proper shipping names when PG matches but PSN does not. */
export const UNIFEEDER_DESCRIPTION_FORK_SEP = '  ·or·  ';

export function isUnifeederDescriptionFork(raw: string | undefined | null): boolean {
  return String(raw ?? '').includes('·or·');
}

function hintsFromPartial(partial: {
  packingGroup?: string;
  goodsDescription?: string;
  properShippingName?: string;
  dgClass?: string;
}): UnNumberLookupHints {
  return {
    packingGroup: partial.packingGroup,
    description: partial.goodsDescription ?? partial.properShippingName,
    dgClass: partial.dgClass,
  };
}

function uniqueDescriptions(rows: readonly UnNumberReferenceRow[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const text = refField(row.description);
    if (!text) continue;
    const key = normalizeUnDescriptionKey(text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

function sharedRefField(
  rows: readonly UnNumberReferenceRow[],
  pick: (row: UnNumberReferenceRow) => string | undefined,
): string {
  const values = [
    ...new Set(rows.map((row) => refField(pick(row))).filter(Boolean)),
  ];
  return values.length === 1 ? values[0]! : '';
}

function patchFromReferenceRow(
  unNo: string,
  entry: UnNumberReferenceRow,
  overrides: Partial<UnifeederAutofillPatch> = {},
): UnifeederAutofillPatch {
  const patch: UnifeederAutofillPatch = {
    unNo,
    ...overrides,
  };
  const dgClass = refField(entry.dgClass);
  const goodsDescription = refField(overrides.goodsDescription ?? entry.description);
  const packingGroup = refField(overrides.packingGroup ?? entry.packingGroup);
  const subRiskRaw = normalizeUnifeederSubRisk(refField(entry.subRisk));
  const subRisk = isClass2DivisionMisfiledAsSubRisk(dgClass, subRiskRaw) ? '' : subRiskRaw;
  const fire = refField(entry.fire);
  const spillage = refField(entry.spillage);
  if (dgClass) patch.dgClass = dgClass;
  if (goodsDescription) patch.goodsDescription = goodsDescription;
  if (packingGroup) patch.packingGroup = packingGroup;
  if (subRisk) patch.subRisk = subRisk;
  if (fire) patch.fire = fire;
  if (spillage) patch.spillage = spillage;
  return applyMfagSchedulesToUnifeederRow(patch);
}

function patchSharedAcrossVariants(
  unNo: string,
  pool: readonly UnNumberReferenceRow[],
  extras: Partial<UnifeederAutofillPatch>,
): UnifeederAutofillPatch {
  const dgClass = sharedRefField(pool, (r) => r.dgClass);
  const subRiskRaw = normalizeUnifeederSubRisk(sharedRefField(pool, (r) => r.subRisk));
  const subRisk = isClass2DivisionMisfiledAsSubRisk(dgClass, subRiskRaw) ? '' : subRiskRaw;
  const fire = sharedRefField(pool, (r) => r.fire);
  const spillage = sharedRefField(pool, (r) => r.spillage);
  const patch: UnifeederAutofillPatch = { unNo, ...extras };
  if (dgClass) patch.dgClass = dgClass;
  if (subRisk) patch.subRisk = subRisk;
  if (fire) patch.fire = fire;
  if (spillage) patch.spillage = spillage;
  return applyMfagSchedulesToUnifeederRow(patch);
}

/** CMA cargo line fields available from the UN number reference. */
export function cmaCargoAutofillFromUnNumber(
  raw: string,
  hints: UnNumberLookupHints = {},
): Partial<Omit<DgCargoLine, 'id'>> | null {
  if (!unNumberHasDigits(raw)) return null;

  const entry = lookupUnNumberReference(raw, hints);
  if (!entry) return null;

  const patch: Partial<Omit<DgCargoLine, 'id'>> = {
    unNo: normalizeUnNumber(raw),
  };
  const dgClass = refField(entry.dgClass);
  const properShippingName = refField(entry.description);
  if (dgClass) patch.dgClass = dgClass;
  if (properShippingName) patch.properShippingName = properShippingName;
  return patch;
}

export type UnifeederAutofillPatch = Partial<
  Omit<DgUnifeederRow, 'id' | 'status' | 'sourceManifestId'>
>;

export type UnifeederUnAutofillResult =
  | { kind: 'none' }
  | {
      kind: 'needs-packing-group';
      unNo: string;
      packingGroups: string[];
      /** Only normalize UN — leave PG / class / PSN empty until PG is chosen. */
      patch: UnifeederAutofillPatch;
    }
  | {
      kind: 'needs-description';
      unNo: string;
      descriptions: string[];
      patch: UnifeederAutofillPatch;
    }
  | { kind: 'ready'; patch: UnifeederAutofillPatch };

/**
 * Resolve UN autofill without guessing among packing-group variants.
 * Multiple PG → wait for packing group. Same PG, rival PSNs → fill PG + fork text.
 */
export function resolveUnifeederUnAutofill(
  raw: string,
  hints: UnNumberLookupHints = {},
): UnifeederUnAutofillResult {
  if (!unNumberHasDigits(raw)) return { kind: 'none' };

  const unNo = normalizeUnNumber(raw);
  const variants = listUnNumberReferenceVariants(unNo);
  if (!variants.length) return { kind: 'none' };

  const packingGroups = listUnNumberVariantPackingGroups(variants);
  const manifestPg = String(hints.packingGroup ?? '').trim();
  const hasManifestPg = !!manifestPg && manifestPg !== '-' && manifestPg !== '--';

  if (!hasManifestPg && packingGroups.length > 1) {
    return {
      kind: 'needs-packing-group',
      unNo,
      packingGroups,
      patch: { unNo },
    };
  }

  const pool = hasManifestPg
    ? variants.filter((row) => sameUnPackingGroup(row.packingGroup, manifestPg))
    : variants;
  const effectivePool = pool.length ? pool : variants;

  const descriptions = uniqueDescriptions(effectivePool);
  const manifestDesc = String(hints.description ?? '').trim();
  const hasUsefulDesc =
    !!manifestDesc && !isUnifeederDescriptionFork(manifestDesc);

  if (descriptions.length > 1) {
    if (hasUsefulDesc) {
      const scored = descriptions
        .map((d) => ({ d, score: scoreUnDescriptionMatch(manifestDesc, d) }))
        .sort((a, b) => b.score - a.score);
      if (scored[0] && scored[0].score >= 50) {
        const alone =
          scored.length === 1 || scored[0].score > (scored[1]?.score ?? 0);
        if (alone) {
          const match = matchUnNumberReference(unNo, {
            ...hints,
            description: scored[0].d,
          });
          if (match) {
            return {
              kind: 'ready',
              patch: patchFromReferenceRow(unNo, match.row),
            };
          }
        }
      }
    }

    const singlePg =
      listUnNumberVariantPackingGroups(effectivePool).length === 1
        ? listUnNumberVariantPackingGroups(effectivePool)[0]!
        : '';
    const forkText = descriptions.join(UNIFEEDER_DESCRIPTION_FORK_SEP);
    return {
      kind: 'needs-description',
      unNo,
      descriptions,
      patch: patchSharedAcrossVariants(unNo, effectivePool, {
        packingGroup: singlePg || (hasManifestPg ? manifestPg : ''),
        goodsDescription: forkText,
      }),
    };
  }

  const match = matchUnNumberReference(unNo, hints);
  if (!match) return { kind: 'none' };
  return { kind: 'ready', patch: patchFromReferenceRow(unNo, match.row) };
}

/** DP WORLD row fields from the matching IMDG list variant (PG + description). */
export function unifeederAutofillFromUnNumber(
  raw: string,
  hints: UnNumberLookupHints = {},
): UnifeederAutofillPatch | null {
  const result = resolveUnifeederUnAutofill(raw, hints);
  if (result.kind === 'none') return null;
  return result.patch;
}

/** Autofill using the manifesto row's own PG / description as variant hints. */
export function unifeederAutofillFromManifestRow(
  row: Pick<DgUnifeederRow, 'unNo' | 'packingGroup' | 'goodsDescription' | 'dgClass'>,
): UnifeederAutofillPatch | null {
  return unifeederAutofillFromUnNumber(row.unNo, hintsFromPartial(row));
}

/** True when reference has several PG variants and the cell still needs one. */
export function unifeederNeedsPackingGroupChoice(
  row: Pick<DgUnifeederRow, 'unNo' | 'packingGroup'>,
): boolean {
  if (!unNumberHasDigits(row.unNo)) return false;
  if (String(row.packingGroup ?? '').trim()) return false;
  return (
    listUnNumberVariantPackingGroups(listUnNumberReferenceVariants(row.unNo)).length > 1
  );
}

/** Packing groups offered for this UN from DG Reference. */
export function unifeederPackingGroupChoices(unNo: string): string[] {
  return [...listUnNumberVariantPackingGroups(listUnNumberReferenceVariants(unNo))];
}

/** Rival proper shipping names for UN (+ optional PG). */
export function unifeederDescriptionChoices(
  unNo: string,
  packingGroup = '',
): string[] {
  const variants = listUnNumberReferenceVariants(unNo);
  const pg = packingGroup.trim();
  const pool = pg
    ? variants.filter((row) => sameUnPackingGroup(row.packingGroup, pg))
    : variants;
  return uniqueDescriptions(pool.length ? pool : variants);
}

export function unifeederNeedsDescriptionChoice(
  row: Pick<DgUnifeederRow, 'unNo' | 'packingGroup' | 'goodsDescription'>,
): boolean {
  if (!unNumberHasDigits(row.unNo)) return false;
  if (unifeederNeedsPackingGroupChoice(row)) return false;
  const choices = unifeederDescriptionChoices(row.unNo, row.packingGroup);
  if (choices.length <= 1) return false;
  const current = String(row.goodsDescription ?? '').trim();
  if (!current || isUnifeederDescriptionFork(current)) return true;
  const hits = choices.filter((d) => scoreUnDescriptionMatch(current, d) >= 90);
  return hits.length !== 1;
}
