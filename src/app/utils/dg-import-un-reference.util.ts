import type { DgCargoLine } from '../models/dg-manifest.models';
import type { UnifeederImportRowPartial } from './dg-unifeeder-pdf.util';
import { preferManifestGoodsDescription } from './dg-goods-description.util';
import {
  cmaCargoAutofillFromUnNumber,
  unifeederAutofillFromUnNumber,
} from './dg-un-number-autofill.util';
import { lookupUnNumberReference } from './dg-un-number.util';
import { coalesceUnifeederContainerMeta } from './dg-unifeeder-merge.util';
import { normalizeUnifeederSubRisk } from './dg-unifeeder-sub-risk.util';
import {
  appendUnifeederReferenceMismatchWarning,
  countUnifeederReferenceMismatches,
} from './dg-unifeeder-reference-mismatch.util';

/** Reference-backed cargo text fields parsed from a CMA manifest row. */
export interface CmaManifestParsedCargo {
  dgClass: string;
  properShippingName: string;
  mpLq: string;
  flashPoint: string;
}

export function unNoInDgReference(unNo: string): boolean {
  return !!lookupUnNumberReference(unNo);
}

/** Use DG Reference for class when UN is known; proper shipping name always from manifest. */
export function applyCmaCargoReferenceOrManifest(
  unNo: string,
  manifest: CmaManifestParsedCargo,
): { cargo: CmaManifestParsedCargo; filledFromManifest: boolean } {
  const autofill = cmaCargoAutofillFromUnNumber(unNo);
  if (autofill) {
    return {
      cargo: {
        dgClass: autofill.dgClass ?? manifest.dgClass,
        properShippingName: manifest.properShippingName,
        mpLq: manifest.mpLq,
        flashPoint: manifest.flashPoint,
      },
      filledFromManifest: false,
    };
  }
  return { cargo: manifest, filledFromManifest: true };
}

/** Prefer non-empty manifest text; fall back to DG Reference autofill. */
function preferManifest(manifest: string | undefined, autofill: string | undefined): string {
  const fromPdf = String(manifest ?? '').trim();
  if (fromPdf) return fromPdf;
  return String(autofill ?? '').trim();
}

/** Use DG Reference to fill gaps; keep parsed DP WORLD / legacy row fields when present. */
export function applyUnifeederReferenceOrManifest(row: UnifeederImportRowPartial): {
  row: UnifeederImportRowPartial;
  filledFromManifest: boolean;
} {
  const autofill = unifeederAutofillFromUnNumber(row.unNo, {
    packingGroup: row.packingGroup,
    description: row.goodsDescription,
    dgClass: row.dgClass,
  });
  if (!autofill) {
    return { row, filledFromManifest: true };
  }

  // Manifest wins for shipment-specific fields. Autofill uses the matching
  // IMDG variant (same UN + packing group / description) only to fill gaps.
  return {
    row: {
      ...row,
      unNo: autofill.unNo ?? row.unNo,
      dgClass: preferManifest(row.dgClass, autofill.dgClass),
      goodsDescription: preferManifestGoodsDescription(
        row.goodsDescription,
        autofill.goodsDescription,
      ),
      packingGroup: preferManifest(row.packingGroup, autofill.packingGroup),
      subRisk: preferManifest(normalizeUnifeederSubRisk(row.subRisk), autofill.subRisk),
      fire: preferManifest(row.fire, autofill.fire),
      spillage: preferManifest(row.spillage, autofill.spillage),
    },
    filledFromManifest: false,
  };
}

export function appendManifestFilledUnWarning(warnings: string[], count: number): void {
  if (count <= 0) return;
  warnings.push(
    count === 1
      ? '1 cargo row was filled from the manifest (UN not in DG Reference).'
      : `${count} cargo rows were filled from the manifest (UN not in DG Reference).`,
  );
}

export function finalizeUnifeederImportRows(
  rows: UnifeederImportRowPartial[],
  warnings: string[],
): { rows: UnifeederImportRowPartial[]; warnings: string[] } {
  let manifestFilled = 0;
  const merged = rows.map((row) => {
    const { row: next, filledFromManifest } = applyUnifeederReferenceOrManifest(row);
    if (filledFromManifest) manifestFilled++;
    return next;
  });
  appendManifestFilledUnWarning(warnings, manifestFilled);
  const coalesced = coalesceUnifeederContainerMeta(merged);
  appendUnifeederReferenceMismatchWarning(warnings, countUnifeederReferenceMismatches(coalesced));
  return { rows: coalesced, warnings };
}

/** @internal For tests — fields taken from reference on manual UN entry. */
export type CmaReferenceCargoFields = Pick<DgCargoLine, 'dgClass' | 'properShippingName'>;
