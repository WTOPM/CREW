import type { DgCargoLine } from '../models/dg-manifest.models';
import type { DgUnifeederRow } from '../models/dg-unifeeder.models';
import { applyMfagSchedulesToUnifeederRow } from './dg-mfag-schedule.util';
import {
  isClass2DivisionMisfiledAsSubRisk,
  normalizeUnifeederSubRisk,
} from './dg-unifeeder-sub-risk.util';
import {
  lookupUnNumberReference,
  matchUnNumberReference,
  normalizeUnNumber,
  type UnNumberLookupHints,
} from './dg-un-number.util';

function refField(value: string | undefined): string {
  const v = String(value ?? '').trim();
  return v && v !== '-' ? v : '';
}

export function unNumberHasDigits(raw: string | undefined | null): boolean {
  return /\d/.test(String(raw ?? ''));
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

/** DP WORLD row fields from the matching IMDG list variant (PG + description). */
export function unifeederAutofillFromUnNumber(
  raw: string,
  hints: UnNumberLookupHints = {},
): UnifeederAutofillPatch | null {
  if (!unNumberHasDigits(raw)) return null;

  const match = matchUnNumberReference(raw, hints);
  if (!match) return null;
  const entry = match.row;

  const patch: UnifeederAutofillPatch = {
    unNo: normalizeUnNumber(raw),
  };
  const dgClass = refField(entry.dgClass);
  const goodsDescription = refField(entry.description);
  const packingGroup = refField(entry.packingGroup);
  const subRiskRaw = normalizeUnifeederSubRisk(refField(entry.subRisk));
  // Class 2: reference stores the division (2.1/2.2/2.3) under subRisk while
  // dgClass is only "2". Manifest Class already has 2.1/2.2 — do not copy
  // that division into the Sub Risk column.
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

/** Autofill using the manifesto row's own PG / description as variant hints. */
export function unifeederAutofillFromManifestRow(
  row: Pick<DgUnifeederRow, 'unNo' | 'packingGroup' | 'goodsDescription' | 'dgClass'>,
): UnifeederAutofillPatch | null {
  return unifeederAutofillFromUnNumber(row.unNo, hintsFromPartial(row));
}
