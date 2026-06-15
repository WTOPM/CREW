const SUB_RISK_EMPTY = new Set(['', '-', '--', '—', '–']);

/** Strip UNIFEEDER template slash placeholders; keep up to three subsidiary class values. */
export function normalizeUnifeederSubRisk(raw: string): string {
  const value = raw.trim();
  if (!value) return '';

  const parts = value
    .split('/')
    .map((part) => part.trim())
    .filter((part) => !SUB_RISK_EMPTY.has(part));

  return parts.join('/');
}
