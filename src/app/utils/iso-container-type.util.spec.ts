import { describe, expect, it } from 'vitest';
import { suggestIsoContainerTypes } from './iso-container-type.util';

describe('suggestIsoContainerTypes', () => {
  it('shows 40′ family when typing 4', () => {
    const codes = suggestIsoContainerTypes('4').map((e) => e.code);
    expect(codes.length).toBeGreaterThan(3);
    expect(codes.every((c) => c.startsWith('4') || c.startsWith('L'))).toBe(true);
    expect(codes).toContain('45GP');
    expect(codes).toContain('42GP');
    expect(codes).not.toContain('22GP');
  });

  it('shows 20′ family when typing 2', () => {
    const codes = suggestIsoContainerTypes('2').map((e) => e.code);
    expect(codes).toContain('22GP');
    expect(codes).toContain('25GP');
    expect(codes.every((c) => c.startsWith('2'))).toBe(true);
  });

  it('matches code prefixes', () => {
    const codes = suggestIsoContainerTypes('45').map((e) => e.code);
    expect(codes).toContain('45GP');
    expect(codes).toContain('45G1');
    expect(codes).toContain('45RF');
  });

  it('returns empty for blank query', () => {
    expect(suggestIsoContainerTypes('')).toEqual([]);
    expect(suggestIsoContainerTypes('   ')).toEqual([]);
  });
});
