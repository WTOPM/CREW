/** Digit positions in the fixed "HH:MM" mask (colon at index 2). */
export const TIME_MASK_DIGIT_POS = [0, 1, 3, 4] as const;

export function digitAtOrAfterTime(p: number): number {
  for (const e of TIME_MASK_DIGIT_POS) if (e >= p) return e;
  return 4;
}

export function nextTimeDigitPos(p: number): number {
  for (const e of TIME_MASK_DIGIT_POS) if (e > p) return e;
  return 0;
}

export function prevTimeDigitPos(p: number): number {
  let r = 0;
  for (const e of TIME_MASK_DIGIT_POS) {
    if (e < p) r = e;
    else break;
  }
  return r;
}

export function timeSegmentBounds(pos: number): { start: number; end: number } {
  if (pos <= 2) return { start: 0, end: 2 };
  return { start: 3, end: 5 };
}

export function clampHoursSegment(s: string): string {
  const hh = Math.min(23, Math.max(0, parseInt(s.slice(0, 2), 10) || 0));
  return String(hh).padStart(2, '0') + s.slice(2);
}

export function clampMinutesSegment(s: string): string {
  const mm = Math.min(59, Math.max(0, parseInt(s.slice(3, 5), 10) || 0));
  return s.slice(0, 3) + String(mm).padStart(2, '0');
}

/** Validate "HH:MM" mask and return normalized value, or null. */
export function timeFromMask(text: string): string | null {
  const m = text.match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  const clamped = clampMinutesSegment(clampHoursSegment(text));
  return clamped;
}

export type TimeMaskSegment = 'hours' | 'minutes';

/** Adjust hours or minutes in an HH:MM mask by ±1 (wraps at range ends). */
export function adjustTimeMaskSegment(
  mask: string,
  segment: TimeMaskSegment,
  delta: number,
): string | null {
  const normalized = timeFromMask(mask);
  if (!normalized) return null;
  const [hhStr, mmStr] = normalized.split(':');
  let hh = parseInt(hhStr, 10);
  let mm = parseInt(mmStr, 10);

  if (segment === 'hours') {
    hh = (hh + delta + 24) % 24;
  } else {
    mm = (mm + delta + 60) % 60;
  }

  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function defaultTimeMask(): string {
  return '00:00';
}

export function ensureTimeMaskText(raw: string, fallback = ''): string {
  if (/^\d{2}:\d{2}$/.test(raw)) return raw;
  if (/^\d{2}:\d{2}$/.test(fallback)) return fallback;
  return defaultTimeMask();
}

export function prepareTimeOnFocus(value: string): { text: string; value: string } {
  if (value && /^\d{2}:\d{2}$/.test(value)) {
    return { text: value, value };
  }
  const text = defaultTimeMask();
  return { text, value: text };
}
