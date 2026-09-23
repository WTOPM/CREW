import { describe, expect, it } from 'vitest';
import { capitalizeSentence, detectTextCase, nextTextCase } from './text-case.util';

describe('text-case.util', () => {
  it('capitalizes first letter only', () => {
    expect(capitalizeSentence('HELSINKI')).toBe('Helsinki');
    expect(capitalizeSentence('helsinki')).toBe('Helsinki');
    expect(capitalizeSentence('  port')).toBe('  Port');
    expect(capitalizeSentence('москва')).toBe('Москва');
  });

  it('detects case modes', () => {
    expect(detectTextCase('ABC')).toBe('upper');
    expect(detectTextCase('abc')).toBe('lower');
    expect(detectTextCase('Abc')).toBe('capitalize');
    expect(detectTextCase('AbC')).toBe('mixed');
  });

  it('cycles UPPER → Capitalize → lower', () => {
    expect(nextTextCase('helsinki')).toBe('HELSINKI');
    expect(nextTextCase('HELSINKI')).toBe('Helsinki');
    expect(nextTextCase('Helsinki')).toBe('helsinki');
    expect(nextTextCase('Port Said')).toBe('PORT SAID');
  });
});
