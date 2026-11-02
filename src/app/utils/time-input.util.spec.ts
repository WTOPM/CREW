import { describe, expect, it } from 'vitest';
import {
  adjustTimeMaskSegment,
  clearTimeMaskByBackspace,
  prepareTimeOnFocus,
  TIME_EMPTY_MASK,
} from './time-input.util';

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

describe('clearTimeMaskByBackspace', () => {
  it('clears minutes, then the whole time', () => {
    expect(clearTimeMaskByBackspace('13:48')).toEqual({ text: '13:--', select: 'minutes' });
    expect(clearTimeMaskByBackspace('13:--')).toEqual({ text: '', select: 'empty' });
  });

  it('treats empty / --:-- as a full clear', () => {
    expect(clearTimeMaskByBackspace('')).toEqual({ text: '', select: 'empty' });
    expect(clearTimeMaskByBackspace(TIME_EMPTY_MASK)).toEqual({ text: '', select: 'empty' });
  });
});

describe('prepareTimeOnFocus', () => {
  it('keeps a valid time and does not invent 00:00 for empty', () => {
    expect(prepareTimeOnFocus('09:30')).toEqual({ text: '09:30', value: '09:30' });
    expect(prepareTimeOnFocus('')).toEqual({ text: TIME_EMPTY_MASK, value: '' });
  });
});
