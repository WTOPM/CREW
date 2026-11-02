/** Digit positions in the fixed "HH:MM" mask (colon at index 2). */
export const TIME_MASK_DIGIT_POS = [0, 1, 3, 4] as const;

/** Empty / cleared time mask shown in the field. */
export const TIME_EMPTY_MASK = '--:--';

const TIME_EDIT_RE = /^[\d-]{2}:[\d-]{2}$/;

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
  const hhPart = s.slice(0, 2);
  if (!/^\d{2}$/.test(hhPart)) return s;
  const hh = Math.min(23, Math.max(0, parseInt(hhPart, 10) || 0));
  return String(hh).padStart(2, '0') + s.slice(2);
}

export function clampMinutesSegment(s: string): string {
  const mmPart = s.slice(3, 5);
  if (!/^\d{2}$/.test(mmPart)) return s;
  const mm = Math.min(59, Math.max(0, parseInt(mmPart, 10) || 0));
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

/**
 * Adjust hours or minutes in an HH:MM mask by ±delta.
 * Clamps at ends (00↔23 hours, 00↔59 minutes) — does not wrap around.
 */
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
    hh = Math.min(23, Math.max(0, hh + delta));
  } else {
    mm = Math.min(59, Math.max(0, mm + delta));
  }

  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function defaultTimeMask(): string {
  return TIME_EMPTY_MASK;
}

export function isTimeMaskEmpty(text: string): boolean {
  const t = String(text ?? '').trim();
  return !t || t === TIME_EMPTY_MASK || /^[-:]{5}$/.test(t);
}

function segmentIsCleared(raw: string): boolean {
  return !raw || /^-+$/.test(raw);
}

export type TimeMaskBackspaceResult = {
  text: string;
  select: 'hours' | 'minutes' | 'empty';
};

/**
 * Backspace clears an HH:MM mask in order: minutes → hours.
 * Cleared segments become `--`; a final Backspace on hours clears the field.
 */
export function clearTimeMaskByBackspace(mask: string): TimeMaskBackspaceResult {
  const trimmed = String(mask ?? '').trim();
  if (!trimmed || isTimeMaskEmpty(trimmed)) {
    return { text: '', select: 'empty' };
  }

  const m = trimmed.match(/^([\d-]{2}):([\d-]{2})$/);
  if (!m) return { text: '', select: 'empty' };

  const hh = m[1]!;
  const mm = m[2]!;

  if (!segmentIsCleared(mm)) {
    return { text: `${hh}:--`, select: 'minutes' };
  }
  if (!segmentIsCleared(hh)) {
    return { text: '', select: 'empty' };
  }
  return { text: '', select: 'empty' };
}

export function ensureTimeMaskText(raw: string, fallback = ''): string {
  const trimmed = String(raw ?? '').trim();
  if (TIME_EDIT_RE.test(trimmed)) return trimmed;
  if (/^\d{2}:\d{2}$/.test(fallback)) return fallback;
  return TIME_EMPTY_MASK;
}

/** Focus an empty time field: show `--:--` without inventing 00:00. */
export function prepareTimeOnFocus(value: string): { text: string; value: string } {
  if (value && /^\d{2}:\d{2}$/.test(value)) {
    return { text: value, value };
  }
  return { text: TIME_EMPTY_MASK, value: '' };
}
