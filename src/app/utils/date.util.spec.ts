import { describe, expect, it } from 'vitest';
import { adjustDisplayDateSegment } from './date.util';

describe('adjustDisplayDateSegment', () => {
  it('adds and subtracts days', () => {
    expect(adjustDisplayDateSegment('31.01.2026', 'day', 1)).toBe('01.02.2026');
    expect(adjustDisplayDateSegment('01.02.2026', 'day', -1)).toBe('31.01.2026');
  });

  it('adds and subtracts months', () => {
    expect(adjustDisplayDateSegment('15.01.2026', 'month', 1)).toBe('15.02.2026');
    expect(adjustDisplayDateSegment('15.02.2026', 'month', -1)).toBe('15.01.2026');
  });

  it('adds and subtracts years', () => {
    expect(adjustDisplayDateSegment('12.06.2024', 'year', 1)).toBe('12.06.2025');
    expect(adjustDisplayDateSegment('12.06.2024', 'year', -1)).toBe('12.06.2023');
  });

  it('returns null for invalid masks', () => {
    expect(adjustDisplayDateSegment('32.13.2026', 'day', 1)).toBeNull();
    expect(adjustDisplayDateSegment('1.2.2026', 'day', 1)).toBeNull();
  });
});
