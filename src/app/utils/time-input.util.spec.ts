import { describe, expect, it } from 'vitest';
import { adjustTimeMaskSegment } from './time-input.util';

describe('adjustTimeMaskSegment', () => {
  it('clamps hours at 00 and 23 (no wrap)', () => {
    expect(adjustTimeMaskSegment('23:30', 'hours', 1)).toBe('23:30');
    expect(adjustTimeMaskSegment('00:30', 'hours', -1)).toBe('00:30');
    expect(adjustTimeMaskSegment('08:15', 'hours', 1)).toBe('09:15');
    expect(adjustTimeMaskSegment('08:15', 'hours', -1)).toBe('07:15');
  });

  it('clamps minutes at 00 and 59 (no wrap)', () => {
    expect(adjustTimeMaskSegment('12:59', 'minutes', 1)).toBe('12:59');
    expect(adjustTimeMaskSegment('12:00', 'minutes', -1)).toBe('12:00');
    expect(adjustTimeMaskSegment('12:30', 'minutes', 1)).toBe('12:31');
  });

  it('returns null for invalid masks', () => {
    expect(adjustTimeMaskSegment('12:6', 'minutes', 1)).toBeNull();
    expect(adjustTimeMaskSegment('ab:cd', 'hours', 1)).toBeNull();
  });
});
