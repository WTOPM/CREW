import { describe, expect, it } from 'vitest';
import {
  isUnifeederPackagingOrTechNote,
  pickBestGoodsDescription,
  preferManifestGoodsDescription,
} from './dg-goods-description.util';

describe('dg-goods-description', () => {
  it('detects packaging / technical-name notes', () => {
    expect(isUnifeederPackagingOrTechNote('max 1 ltr')).toBe(true);
    expect(isUnifeederPackagingOrTechNote('0.5 kg')).toBe(true);
    expect(isUnifeederPackagingOrTechNote('AEROSOLS')).toBe(false);
    expect(isUnifeederPackagingOrTechNote('VEHICLE, FLAMMABLE LIQUID POWERED')).toBe(false);
  });

  it('prefers leftmost proper name over longer technical note', () => {
    expect(
      pickBestGoodsDescription([
        { str: 'AEROSOLS', x: 164 },
        { str: 'max 1 ltr', x: 172 },
      ]),
    ).toBe('AEROSOLS');
  });

  it('falls back to DG Reference when PDF kept a packaging note', () => {
    expect(preferManifestGoodsDescription('max 1 ltr', 'AEROSOLS, asphyxiant')).toBe(
      'AEROSOLS, asphyxiant',
    );
    expect(
      preferManifestGoodsDescription('VEHICLE, FLAMMABLE LIQUID POWERED', 'VEHICLE, ...'),
    ).toBe('VEHICLE, FLAMMABLE LIQUID POWERED');
  });
});
