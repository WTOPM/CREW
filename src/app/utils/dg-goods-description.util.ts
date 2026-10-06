/**
 * DP WORLD / Unifeeder manifests put Proper ship. name and Technical name on the
 * same Y band a few points apart. Prefer the proper name; ignore packaging notes.
 */

export interface GoodsDescriptionCandidate {
  str: string;
  x: number;
}

/** Technical-name / packaging fragments that are not a proper shipping name. */
export function isUnifeederPackagingOrTechNote(raw: string): boolean {
  const value = String(raw ?? '').trim();
  if (!value) return false;
  if (/^max\s+\d+/i.test(value)) return true;
  if (/^\d+([.,]\d+)?\s*(ltr|l|ml|kg|g|t)\b/i.test(value)) return true;
  if (/^(ltd\.?\s*qty|limited\s*quantity)\b/i.test(value)) return true;
  if (/^n\.?\s*o\.?\s*s\.?$/i.test(value)) return true;
  if (/^(see\s+|as\s+per\b)/i.test(value)) return true;
  return false;
}

/**
 * Pick proper shipping name from same-row candidates.
 * Reject packaging/tech notes; prefer leftmost, then longest.
 */
export function pickBestGoodsDescription(
  candidates: readonly GoodsDescriptionCandidate[],
): string {
  const usable = candidates
    .map((c) => ({ str: String(c.str ?? '').trim(), x: c.x }))
    .filter((c) => c.str.length >= 4)
    .filter((c) => !/^\d{4}$/.test(c.str))
    .filter((c) => !/^(YES|NO|0,0|\/ \/ \/)$/i.test(c.str))
    .filter((c) => !/^Proper ship/i.test(c.str))
    .filter((c) => !isUnifeederPackagingOrTechNote(c.str));

  if (!usable.length) return '';

  usable.sort((a, b) => {
    if (a.x !== b.x) return a.x - b.x;
    return b.str.length - a.str.length;
  });
  return usable[0]!.str;
}

/**
 * Manifest goods description: keep real names; replace packaging notes with
 * DG Reference when available.
 */
export function preferManifestGoodsDescription(
  manifest: string | undefined,
  autofill: string | undefined,
): string {
  const fromPdf = String(manifest ?? '').trim();
  const fromRef = String(autofill ?? '').trim();
  if (fromPdf && !isUnifeederPackagingOrTechNote(fromPdf)) return fromPdf;
  if (fromRef) return fromRef;
  return fromPdf;
}
