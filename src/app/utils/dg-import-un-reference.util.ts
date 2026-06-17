import type { DgCargoLine } from '../models/dg-manifest.models';
import type { UnifeederImportRowPartial } from './dg-unifeeder-pdf.util';
import {
  cmaCargoAutofillFromUnNumber,
  unifeederAutofillFromUnNumber,
} from './dg-un-number-autofill.util';
import { lookupUnNumberReference } from './dg-un-number.util';

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

/** Use DG Reference when UN is known; otherwise keep parsed DP WORLD / legacy row fields. */
export function applyUnifeederReferenceOrManifest(row: UnifeederImportRowPartial): {
  row: UnifeederImportRowPartial;
  filledFromManifest: boolean;
} {
  const autofill = unifeederAutofillFromUnNumber(row.unNo);
  if (!autofill) {
    return { row, filledFromManifest: true };
  }

  return {
    row: {
      ...row,
      unNo: autofill.unNo ?? row.unNo,
      dgClass: autofill.dgClass ?? row.dgClass,
      goodsDescription: autofill.goodsDescription ?? row.goodsDescription,
      packingGroup: autofill.packingGroup ?? row.packingGroup,
      subRisk: autofill.subRisk ?? row.subRisk,
      fire: autofill.fire ?? row.fire,
      spillage: autofill.spillage ?? row.spillage,
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
  return { rows: merged, warnings };
}

/** @internal For tests — fields taken from reference on manual UN entry. */
export type CmaReferenceCargoFields = Pick<DgCargoLine, 'dgClass' | 'properShippingName'>;
