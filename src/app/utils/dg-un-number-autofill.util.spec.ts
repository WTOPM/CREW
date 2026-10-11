import { afterEach, describe, expect, it } from 'vitest';
import {
  isUnifeederDescriptionFork,
  resolveUnifeederUnAutofill,
  unifeederNeedsDescriptionChoice,
  unifeederNeedsPackingGroupChoice,
  UNIFEEDER_DESCRIPTION_FORK_SEP,
} from './dg-un-number-autofill.util';
import {
  setUnNumberReferenceOverride,
  type UnNumberReferenceRow,
} from './dg-un-number.util';

function row(
  over: Partial<UnNumberReferenceRow> & Pick<UnNumberReferenceRow, 'unNo' | 'packingGroup'>,
): UnNumberReferenceRow {
  return {
    description: 'SUBSTANCE',
    dgClass: '6.1',
    subRisk: '',
    fire: 'F-A',
    spillage: 'S-A',
    marinePollutant: false,
    ...over,
  };
}

describe('resolveUnifeederUnAutofill', () => {
  afterEach(() => {
    setUnNumberReferenceOverride(null);
  });

  it('waits for packing group when UN has I/II/III variants', () => {
    setUnNumberReferenceOverride([
      row({ unNo: '3288', packingGroup: 'I', description: 'TOXIC SOLID, INORGANIC, N.O.S.' }),
      row({ unNo: '3288', packingGroup: 'II', description: 'TOXIC SOLID, INORGANIC, N.O.S.' }),
      row({ unNo: '3288', packingGroup: 'III', description: 'TOXIC SOLID, INORGANIC, N.O.S.' }),
    ]);

    const result = resolveUnifeederUnAutofill('3288');
    expect(result.kind).toBe('needs-packing-group');
    if (result.kind !== 'needs-packing-group') return;
    expect(result.packingGroups).toEqual(['I', 'II', 'III']);
    expect(result.patch).toEqual({ unNo: '3288' });
    expect(unifeederNeedsPackingGroupChoice({ unNo: '3288', packingGroup: '' })).toBe(true);
  });

  it('fills the matching variant once packing group is chosen', () => {
    setUnNumberReferenceOverride([
      row({ unNo: '3288', packingGroup: 'I', description: 'TOXIC SOLID, INORGANIC, N.O.S.', fire: 'F-A' }),
      row({ unNo: '3288', packingGroup: 'II', description: 'TOXIC SOLID, INORGANIC, N.O.S.', fire: 'F-A' }),
      row({ unNo: '3288', packingGroup: 'III', description: 'TOXIC SOLID, INORGANIC, N.O.S.', fire: 'F-A' }),
    ]);

    const result = resolveUnifeederUnAutofill('3288', { packingGroup: 'II' });
    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') return;
    expect(result.patch.packingGroup).toBe('II');
    expect(result.patch.goodsDescription).toBe('TOXIC SOLID, INORGANIC, N.O.S.');
    expect(result.patch.dgClass).toBe('6.1');
  });

  it('fills PG and forks description when same PG has rival PSNs', () => {
    setUnNumberReferenceOverride([
      row({
        unNo: '1263',
        packingGroup: 'II',
        description: 'PAINT',
        dgClass: '3',
        fire: 'F-E',
        spillage: 'S-E',
      }),
      row({
        unNo: '1263',
        packingGroup: 'II',
        description: 'PAINT RELATED MATERIAL',
        dgClass: '3',
        fire: 'F-E',
        spillage: 'S-E',
      }),
    ]);

    const result = resolveUnifeederUnAutofill('1263', { packingGroup: 'II' });
    expect(result.kind).toBe('needs-description');
    if (result.kind !== 'needs-description') return;
    expect(result.patch.packingGroup).toBe('II');
    expect(result.patch.dgClass).toBe('3');
    expect(result.patch.goodsDescription).toBe(
      `PAINT${UNIFEEDER_DESCRIPTION_FORK_SEP}PAINT RELATED MATERIAL`,
    );
    expect(isUnifeederDescriptionFork(result.patch.goodsDescription)).toBe(true);
    expect(
      unifeederNeedsDescriptionChoice({
        unNo: '1263',
        packingGroup: 'II',
        goodsDescription: result.patch.goodsDescription ?? '',
      }),
    ).toBe(true);
  });

  it('resolves a description choice to a single reference row', () => {
    setUnNumberReferenceOverride([
      row({
        unNo: '1263',
        packingGroup: 'II',
        description: 'PAINT',
        dgClass: '3',
        fire: 'F-E',
        spillage: 'S-E',
      }),
      row({
        unNo: '1263',
        packingGroup: 'II',
        description: 'PAINT RELATED MATERIAL',
        dgClass: '3',
        fire: 'F-E',
        spillage: 'S-E',
      }),
    ]);

    const result = resolveUnifeederUnAutofill('1263', {
      packingGroup: 'II',
      description: 'PAINT RELATED MATERIAL',
    });
    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') return;
    expect(result.patch.goodsDescription).toBe('PAINT RELATED MATERIAL');
  });
});
