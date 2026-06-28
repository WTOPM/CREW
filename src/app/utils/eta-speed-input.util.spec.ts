import { describe, expect, it } from 'vitest';
import {
  formatSpeedKnotsDisplay,
  sanitizeSpeedKnotsInput,
  stepSpeedKnots,
  truncateSpeedKnotsTenths,
} from './eta-speed-input.util';

describe('eta-speed-input.util', () => {
  it('truncateSpeedKnotsTenths cuts off beyond tenths', () => {
    expect(truncateSpeedKnotsTenths(2.29)).toBe(2.2);
    expect(truncateSpeedKnotsTenths(2.299)).toBe(2.2);
    expect(truncateSpeedKnotsTenths(12.99)).toBe(12.9);
  });

  it('sanitizeSpeedKnotsInput accepts dot and comma decimals', () => {
    expect(sanitizeSpeedKnotsInput('2.2')).toEqual({ text: '2.2', value: 2.2 });
    expect(sanitizeSpeedKnotsInput('2,2')).toEqual({ text: '2,2', value: 2.2 });
  });

  it('sanitizeSpeedKnotsInput truncates hundredths while typing', () => {
    expect(sanitizeSpeedKnotsInput('2.25')).toEqual({ text: '2.2', value: 2.2 });
    expect(sanitizeSpeedKnotsInput('2,256')).toEqual({ text: '2,2', value: 2.2 });
  });

  it('sanitizeSpeedKnotsInput allows partial decimal separator', () => {
    expect(sanitizeSpeedKnotsInput('2,')).toEqual({ text: '2,', value: 2 });
    expect(sanitizeSpeedKnotsInput('2.')).toEqual({ text: '2.', value: 2 });
  });

  it('formatSpeedKnotsDisplay omits trailing .0', () => {
    expect(formatSpeedKnotsDisplay(9)).toBe('9');
    expect(formatSpeedKnotsDisplay(2.2)).toBe('2.2');
  });

  it('stepSpeedKnots adjusts by 0.1 and clamps at zero', () => {
    expect(stepSpeedKnots(2.2, 1)).toEqual({ text: '2.3', value: 2.3 });
    expect(stepSpeedKnots(2.2, -1)).toEqual({ text: '2.1', value: 2.1 });
    expect(stepSpeedKnots(0.1, -1)).toEqual({ text: '', value: 0 });
    expect(stepSpeedKnots(null, 1)).toEqual({ text: '0.1', value: 0.1 });
  });

  it('stepSpeedKnots avoids float drift after repeated +0.1', () => {
    let speed = 5.5;
    for (let i = 0; i < 6; i += 1) {
      const stepped = stepSpeedKnots(speed, 1);
      speed = stepped.value;
    }
    expect(speed).toBe(6.1);
  });
});
