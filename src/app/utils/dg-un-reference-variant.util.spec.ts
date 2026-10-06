import { describe, expect, it } from 'vitest';
import {
  pickUnNumberReferenceVariant,
  scoreUnDescriptionMatch,
  unNumberReferenceVariantKey,
} from './dg-un-reference-variant.util';
import type { UnNumberReferenceRow } from './dg-un-number.util';

function row(over: Partial<UnNumberReferenceRow> & Pick<UnNumberReferenceRow, 'unNo'>): UnNumberReferenceRow {
  return {
    description: 'SUBSTANCE',
    dgClass: '3',
    packingGroup: '',
    subRisk: '',
    fire: 'F-E',
    spillage: 'S-D',
    marinePollutant: false,
    ...over,
  };
}

describe('pickUnNumberReferenceVariant', () => {
  const variants = [
    row({ unNo: '3288', packingGroup: 'I', description: 'TOXIC SOLID, INORGANIC, N.O.S.', fire: 'F-A' }),
    row({ unNo: '3288', packingGroup: 'II', description: 'TOXIC SOLID, INORGANIC, N.O.S.', fire: 'F-A' }),
    row({ unNo: '3288', packingGroup: 'III', description: 'TOXIC SOLID, INORGANIC, N.O.S.', fire: 'F-A' }),
  ];

  it('selects the packing-group variant present on the manifesto', () => {
    const match = pickUnNumberReferenceVariant(variants, { packingGroup: 'III' });
    expect(match?.row.packingGroup).toBe('III');
    expect(match?.kind).toBe('pg');
    expect(match?.packingGroupMissing).toBe(false);
  });

  it('flags when manifesto PG is not printed for that UN', () => {
    const match = pickUnNumberReferenceVariant(variants, { packingGroup: 'IV' });
    expect(match?.packingGroupMissing).toBe(true);
    expect(match?.variantCount).toBe(3);
  });

  it('prefers description when several PG rows exist without a PG hint', () => {
    const nitric = [
      row({
        unNo: '2031',
        packingGroup: 'I',
        description: 'NITRIC ACID other than red fuming, with more than 70% nitric acid',
      }),
      row({
        unNo: '2031',
        packingGroup: 'II',
        description: 'NITRIC ACID other than red fuming, with at least 65% but not more than 70%',
      }),
    ];
    const match = pickUnNumberReferenceVariant(nitric, {
      description: 'NITRIC ACID other than red fuming, with more than 70% nitric acid',
    });
    expect(match?.row.packingGroup).toBe('I');
    expect(match?.kind).toBe('description');
  });
});

describe('scoreUnDescriptionMatch', () => {
  it('scores exact and prefix matches highly', () => {
    expect(scoreUnDescriptionMatch('PAINT', 'PAINT')).toBe(100);
    expect(
      scoreUnDescriptionMatch(
        'PAINT (including paint, lacquer, enamel, stain)',
        'PAINT (including paint, lacquer, enamel, stain, shellac',
      ),
    ).toBeGreaterThanOrEqual(90);
  });
});

describe('unNumberReferenceVariantKey', () => {
  it('distinguishes PG variants of the same UN', () => {
    const a = unNumberReferenceVariantKey({
      unNo: '1263',
      packingGroup: 'I',
      description: 'PAINT',
    });
    const b = unNumberReferenceVariantKey({
      unNo: '1263',
      packingGroup: 'II',
      description: 'PAINT',
    });
    expect(a).not.toBe(b);
  });
});
