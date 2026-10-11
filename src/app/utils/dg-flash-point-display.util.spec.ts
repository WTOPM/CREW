import { describe, expect, it } from 'vitest';
import {
  formatUnifeederFlashPoint,
  suggestUnifeederFlashPointFormat,
} from './dg-flash-point-display.util';

describe('suggestUnifeederFlashPointFormat', () => {
  it('suggests 30,0 C from bare integers and dotted decimals', () => {
    expect(suggestUnifeederFlashPointFormat('30')).toBe('30,0 C');
    expect(suggestUnifeederFlashPointFormat('30.0')).toBe('30,0 C');
    expect(suggestUnifeederFlashPointFormat('-30')).toBe('-30,0 C');
    expect(suggestUnifeederFlashPointFormat('-30.0')).toBe('-30,0 C');
  });

  it('returns null when already in inventory form', () => {
    expect(suggestUnifeederFlashPointFormat('30,0 C')).toBeNull();
    expect(suggestUnifeederFlashPointFormat('-30,0 C')).toBeNull();
    expect(suggestUnifeederFlashPointFormat('')).toBeNull();
    expect(suggestUnifeederFlashPointFormat('abc')).toBeNull();
  });

  it('formats via formatUnifeederFlashPoint', () => {
    expect(formatUnifeederFlashPoint(30)).toBe('30,0 C');
    expect(formatUnifeederFlashPoint(-30.5)).toBe('-30,5 C');
  });
});
