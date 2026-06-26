/** Truncate speed to one decimal place (tenths), not round. */
export function truncateSpeedKnotsTenths(n: number): number {
  if (!isFinite(n)) return 0;
  return Math.trunc(n * 10) / 10;
}

export interface SpeedKnotsInputSanitize {
  /** Sanitized text for the input (comma or dot preserved). */
  text: string;
  /** Parsed speed in knots, or null when empty / incomplete. */
  value: number | null;
}

/**
 * Parse speed input: digits with optional comma or dot decimal separator.
 * Fractional part is limited to one digit (hundredths/thousandths are cut off).
 */
export function sanitizeSpeedKnotsInput(raw: string): SpeedKnotsInputSanitize {
  const trimmed = raw.trim();
  if (!trimmed) return { text: '', value: null };

  let intPart = '';
  let sep: ',' | '.' | null = null;
  let fracPart = '';

  for (const ch of trimmed) {
    if (ch >= '0' && ch <= '9') {
      if (sep === null) {
        intPart += ch;
      } else if (fracPart.length < 1) {
        fracPart += ch;
      }
    } else if ((ch === ',' || ch === '.') && sep === null && intPart.length > 0) {
      sep = ch;
    }
  }

  if (!intPart) return { text: '', value: null };

  let text = intPart;
  if (sep !== null) {
    text = intPart + sep + fracPart;
  }

  let value: number | null;
  if (sep !== null && !fracPart) {
    const whole = parseFloat(intPart);
    value = isFinite(whole) && whole >= 0 ? truncateSpeedKnotsTenths(whole) : null;
  } else {
    const parseStr = sep !== null ? `${intPart}.${fracPart}` : intPart;
    const parsed = parseFloat(parseStr);
    value = isFinite(parsed) && parsed >= 0 ? truncateSpeedKnotsTenths(parsed) : null;
  }

  return { text, value };
}

/** Display stored speed in the input when not actively editing. */
export function formatSpeedKnotsDisplay(n: number): string {
  const t = truncateSpeedKnotsTenths(n);
  if (t <= 0) return '';
  return Number.isInteger(t) ? String(t) : t.toFixed(1);
}
