const SUB_RISK_EMPTY = new Set(['', '-', '--', '—', '–']);

function isEmptySubRiskToken(part: string): boolean {
  const s = part.trim();
  if (!s) return true;
  if (SUB_RISK_EMPTY.has(s)) return true;
  return /^0([.,]0)?$/.test(s);
}

/** Strip UNIFEEDER template slash placeholders; keep up to three subsidiary class values. */
export function normalizeUnifeederSubRisk(raw: string): string {
  const value = raw.trim();
  if (!value || value === '/ / /') return '';
  if (isEmptySubRiskToken(value)) return '';

  const parts = value
    .split('/')
    .map((part) => part.trim())
    .filter((part) => !isEmptySubRiskToken(part));

  return parts.join('/');
}
