import type { DgCargoLine } from '../models/dg-manifest.models';
import type { DgUnifeederRow } from '../models/dg-unifeeder.models';
import { applyMfagSchedulesToUnifeederRow } from './dg-mfag-schedule.util';
import { normalizeUnifeederSubRisk } from './dg-unifeeder-sub-risk.util';
import { lookupUnNumberReference, normalizeUnNumber } from './dg-un-number.util';

function refField(value: string | undefined): string {
  const v = String(value ?? '').trim();
  return v && v !== '-' ? v : '';
}

export function unNumberHasDigits(raw: string | undefined | null): boolean {
  return /\d/.test(String(raw ?? ''));
}

/** CMA cargo line fields available from the UN number reference. */
export function cmaCargoAutofillFromUnNumber(
  raw: string,
): Partial<Omit<DgCargoLine, 'id'>> | null {
  if (!unNumberHasDigits(raw)) return null;

  const entry = lookupUnNumberReference(raw);
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

/** DP WORLD row fields available from the UN number reference. */
export function unifeederAutofillFromUnNumber(raw: string): UnifeederAutofillPatch | null {
  if (!unNumberHasDigits(raw)) return null;

  const entry = lookupUnNumberReference(raw);
  if (!entry) return null;

  const patch: UnifeederAutofillPatch = {
    unNo: normalizeUnNumber(raw),
  };
  const dgClass = refField(entry.dgClass);
  const goodsDescription = refField(entry.description);
  const packingGroup = refField(entry.packingGroup);
  const subRisk = normalizeUnifeederSubRisk(refField(entry.subRisk));
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
