const SUB_RISK_EMPTY = new Set(['', '-', '--', '—', '–']);

function isEmptySubRiskToken(part: string): boolean {
  const s = part.trim();
  if (!s) return true;
  if (SUB_RISK_EMPTY.has(s)) return true;
  return /^0([.,]0)?$/.test(s);
}

/** IMDG special-provision markers — not subsidiary hazard classes. */
function isSpecialProvisionNoise(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  // "See SP63", "SEE SP 63", "SP63"
  if (/^see\s*sp\s*\d+\b/i.test(v)) return true;
  if (/^sp\s*\d+\b/i.test(v)) return true;
  // Template leftovers: "SP", "SP / / /"
  if (/^sp$/i.test(v)) return true;
  if (/^sp\s*(\/\s*)+$/i.test(v)) return true;
  return false;
}

/**
 * True when DG Reference stores a Class 2 *division* (2.1/2.2/2.3) under subRisk
 * while dgClass is only "2". That value belongs in Class, not Sub Risk.
 */
export function isClass2DivisionMisfiledAsSubRisk(
  dgClass: string | undefined,
  subRisk: string | undefined,
): boolean {
  const cls = String(dgClass ?? '').trim();
  const sub = String(subRisk ?? '').trim();
  if (!/^2\.[123]$/.test(sub)) return false;
  return cls === '2' || cls === sub || /^2\.[123]$/.test(cls);
}

/** Strip UNIFEEDER template slash placeholders; keep up to three subsidiary class values. */
export function normalizeUnifeederSubRisk(raw: string): string {
  const value = raw.trim();
  if (!value || value === '/ / /') return '';
  if (isEmptySubRiskToken(value)) return '';
  if (isSpecialProvisionNoise(value)) return '';

  const parts = value
    .split('/')
    .map((part) => part.trim())
    .filter((part) => !isEmptySubRiskToken(part))
    .filter((part) => !isSpecialProvisionNoise(part));

  // Lone "SP" token from "SP / / /"
  if (parts.length === 1 && /^sp$/i.test(parts[0]!)) return '';

  return parts.join('/');
}
