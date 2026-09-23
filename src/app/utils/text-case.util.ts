/** Shift+F3 case cycle: UPPER → Capitalize → lower → … */

export type TextCaseMode = 'upper' | 'capitalize' | 'lower' | 'mixed';

const LETTER_RE = /\p{L}/u;

/** First letter upper, everything else lower (e.g. HELSINKI → Helsinki). */
export function capitalizeSentence(raw: string): string {
  const lower = String(raw ?? '').toLowerCase();
  for (let i = 0; i < lower.length; i++) {
    if (LETTER_RE.test(lower[i]!)) {
      return lower.slice(0, i) + lower[i]!.toUpperCase() + lower.slice(i + 1);
    }
  }
  return lower;
}

export function detectTextCase(raw: string): TextCaseMode {
  const s = String(raw ?? '');
  if (!s || !LETTER_RE.test(s)) return 'mixed';
  const upper = s.toUpperCase();
  const lower = s.toLowerCase();
  if (s === upper && s !== lower) return 'upper';
  if (s === lower && s !== upper) return 'lower';
  if (s === capitalizeSentence(s)) return 'capitalize';
  return 'mixed';
}

/** Next case in the Shift+F3 cycle. */
export function nextTextCase(raw: string): string {
  const s = String(raw ?? '');
  const mode = detectTextCase(s);
  if (mode === 'upper') return capitalizeSentence(s);
  if (mode === 'capitalize') return s.toLowerCase();
  return s.toUpperCase();
}

export const TEXT_CASE_HOTKEY_HINT = 'Shift+F3 — cycle case: ABC → Abc → abc';
