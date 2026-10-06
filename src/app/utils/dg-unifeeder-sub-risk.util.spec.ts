import { describe, expect, it } from 'vitest';
import {
  isClass2DivisionMisfiledAsSubRisk,
  normalizeUnifeederSubRisk,
} from './dg-unifeeder-sub-risk.util';

describe('normalizeUnifeederSubRisk', () => {
  it('clears empty slash templates', () => {
    expect(normalizeUnifeederSubRisk('/ / /')).toBe('');
    expect(normalizeUnifeederSubRisk('--')).toBe('');
    expect(normalizeUnifeederSubRisk('0,0')).toBe('');
  });

  it('keeps real subsidiary hazards', () => {
    expect(normalizeUnifeederSubRisk('6.1/8')).toBe('6.1/8');
    expect(normalizeUnifeederSubRisk('8')).toBe('8');
  });

  it('rejects special-provision noise (See SP63 / SP / / /)', () => {
    expect(normalizeUnifeederSubRisk('See SP63')).toBe('');
    expect(normalizeUnifeederSubRisk('SEE SP 63')).toBe('');
    expect(normalizeUnifeederSubRisk('SP / / /')).toBe('');
    expect(normalizeUnifeederSubRisk('SP')).toBe('');
  });
});

describe('isClass2DivisionMisfiledAsSubRisk', () => {
  it('detects gas division stored as sub-risk in DG Reference', () => {
    expect(isClass2DivisionMisfiledAsSubRisk('2', '2.2')).toBe(true);
    expect(isClass2DivisionMisfiledAsSubRisk('2', '2.1')).toBe(true);
    expect(isClass2DivisionMisfiledAsSubRisk('2.1', '2.2')).toBe(true);
    expect(isClass2DivisionMisfiledAsSubRisk('5.1', '6.1/8')).toBe(false);
    expect(isClass2DivisionMisfiledAsSubRisk('8', '6.1')).toBe(false);
  });
});
