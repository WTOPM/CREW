import { describe, expect, it } from 'vitest';
import {
  displayContainerSize,
  normalizeManifestSizeCode,
  resolveContainerColumnValue,
  resolveContainerSizeValue,
  splitContainerSizeLabel,
  suggestIsoContainerTypes,
  SUGGESTABLE_CONTAINER_TYPES,
} from './iso-container-type.util';

const P = '\u2032'; // ′

describe('suggestIsoContainerTypes', () => {
  it('shows 40′ family when typing 4', () => {
    const sizes = suggestIsoContainerTypes('4').map((e) => e.sizeLabel);
    expect(sizes.length).toBeGreaterThan(3);
    expect(sizes.every((s) => s.startsWith(`40${P}`) || s.startsWith(`45${P}`))).toBe(
      true,
    );
    expect(sizes).toContain(`40${P}HC`);
    expect(sizes).toContain(`40${P}DC`);
    expect(sizes).not.toContain(`20${P}DC`);
  });

  it('shows 20′ family when typing 2', () => {
    const sizes = suggestIsoContainerTypes('2').map((e) => e.sizeLabel);
    expect(sizes).toContain(`20${P}DC`);
    expect(sizes).toContain(`20${P}HC`);
    expect(sizes).toContain(`20${P}HCPW`);
    expect(sizes.every((s) => s.startsWith(`20${P}`))).toBe(true);
  });

  it('matches size labels and codes', () => {
    const bySize = suggestIsoContainerTypes('40 HC').map((e) => e.sizeLabel);
    expect(bySize).toContain(`40${P}HC`);

    const byCode = suggestIsoContainerTypes('45GP').map((e) => e.sizeLabel);
    expect(byCode[0]).toBe(`40${P}HC`);
  });

  it('returns empty for blank query', () => {
    expect(suggestIsoContainerTypes('')).toEqual([]);
    expect(suggestIsoContainerTypes('   ')).toEqual([]);
  });

  it('lists unique compact sizes including PW / PF', () => {
    const sizes = SUGGESTABLE_CONTAINER_TYPES.map((e) => e.sizeLabel);
    expect(sizes).toContain(`20${P}DC`);
    expect(sizes).toContain(`20${P}HCPW`);
    expect(sizes).toContain(`40${P}HCPW`);
    expect(sizes).toContain(`45${P}HCPW`);
    expect(sizes).toContain(`40${P}PF`);
    expect(sizes).toContain(`40${P}PFHC`);
    expect(sizes).toContain(`40${P}RFHC`);
    expect(new Set(sizes).size).toBe(sizes.length);
  });
});

describe('displayContainerSize / resolveContainerColumnValue', () => {
  it('maps codes to compact size labels with ′', () => {
    expect(displayContainerSize('45GP')).toBe(`40${P}HC`);
    expect(displayContainerSize('22GP')).toBe(`20${P}DC`);
    expect(displayContainerSize('46GP')).toBe(`40${P}HCPW`);
    expect(displayContainerSize('42FR')).toBe(`40${P}PF`);
    expect(displayContainerSize('45RF')).toBe(`40${P}RFHC`);
    expect(displayContainerSize('22TN')).toBe(`20${P}TN`);
    expect(displayContainerSize('22K2')).toBe(`20${P}TN`);
  });

  it('fixes Unifeeder PDF OCR size tokens (EM/DM → 22)', () => {
    expect(normalizeManifestSizeCode('EMKD')).toBe('22K2');
    expect(normalizeManifestSizeCode('DMKD')).toBe('22K2');
    expect(normalizeManifestSizeCode('EMT6')).toBe('22T6');
    expect(displayContainerSize(normalizeManifestSizeCode('EMKD'))).toBe(`20${P}TN`);
  });

  it('keeps size labels and normalizes ASCII apostrophes / spaces', () => {
    expect(resolveContainerSizeValue("40' HC")).toBe(`40${P}HC`);
    expect(resolveContainerSizeValue(`40${P}HC`)).toBe(`40${P}HC`);
    expect(resolveContainerSizeValue('45GP')).toBe(`40${P}HC`);
    expect(resolveContainerSizeValue(`40${P} RF HC`)).toBe(`40${P}RFHC`);
  });

  it('resolves type mode to codes that fit the column', () => {
    expect(resolveContainerColumnValue('45RF', 'type')).toBe('45RF');
    expect(resolveContainerColumnValue(`40${P}RFHC`, 'type')).toBe('45RF');
    expect(resolveContainerColumnValue('45RF', 'size')).toBe(`40${P}RFHC`);
  });

  it('splits length prefix for colored display', () => {
    expect(splitContainerSizeLabel(`40${P}RFHC`)).toEqual({
      prefix: `40${P}`,
      rest: 'RFHC',
      family: '40',
    });
    expect(splitContainerSizeLabel(`20${P}DC`).family).toBe('20');
    expect(splitContainerSizeLabel(`45${P}HCPW`).family).toBe('45');
  });
});
