import { describe, expect, it } from 'vitest';
import {
  appendUnifeederReferenceMismatchWarning,
  countUnifeederReferenceMismatches,
  findIdenticalUnifeederReferenceMismatches,
  getUnifeederReferenceMismatch,
  listUnifeederReferenceMismatches,
  normalizeUnifeederRefCompareValue,
} from './dg-unifeeder-reference-mismatch.util';
import { finalizeUnifeederImportRows } from './dg-import-un-reference.util';
import type { UnifeederImportRowPartial } from './dg-unifeeder-pdf.util';

function row(
  partial: Partial<UnifeederImportRowPartial> & {
    referenceKeepManifest?: Record<string, string>;
  },
): UnifeederImportRowPartial & { referenceKeepManifest?: Record<string, string> } {
  return {
    size: '',
    stow: '',
    containerNo: '',
    loadPort: '',
    dischargePort: '',
    unNo: '',
    packingGroup: '',
    weightKg: '',
    lq: '',
    flashPoint: '',
    marinePollutant: '',
    goodsDescription: '',
    dgClass: '',
    subRisk: '',
    fire: '',
    spillage: '',
    ...partial,
  };
}

describe('dg-unifeeder-reference-mismatch', () => {
  it('flags packing group when manifesto differs from DG Reference', () => {
    const mismatches = listUnifeederReferenceMismatches(
      row({
        unNo: '3288',
        packingGroup: 'II',
        dgClass: '6.1',
        fire: 'F-A',
        spillage: 'S-A',
      }),
    );

    expect(mismatches.some((m) => m.field === 'packingGroup')).toBe(true);
    const pg = getUnifeederReferenceMismatch(
      row({ unNo: '3288', packingGroup: 'II', dgClass: '6.1' }),
      'packingGroup',
    );
    expect(pg?.currentValue).toBe('II');
    expect(pg?.referenceValue).toBe('I');
  });

  it('does not flag when manifesto matches DG Reference', () => {
    expect(
      getUnifeederReferenceMismatch(
        row({ unNo: '3288', packingGroup: 'I', dgClass: '6.1' }),
        'packingGroup',
      ),
    ).toBeNull();
  });

  it('hides mismatch after Keep manifesto dismisses that reference suggestion', () => {
    expect(
      getUnifeederReferenceMismatch(
        row({
          unNo: '3288',
          packingGroup: 'II',
          dgClass: '6.1',
          referenceKeepManifest: { packingGroup: 'I' },
        }),
        'packingGroup',
      ),
    ).toBeNull();
  });

  it('treats PG arabic and roman as equal', () => {
    expect(normalizeUnifeederRefCompareValue('packingGroup', '2')).toBe('II');
    expect(normalizeUnifeederRefCompareValue('packingGroup', 'II')).toBe('II');
  });

  it('finds identical mismatches across rows', () => {
    const a = row({
      unNo: '3288',
      packingGroup: 'II',
      dgClass: '6.1',
      containerNo: 'A',
    });
    const b = row({
      unNo: '3288',
      packingGroup: 'II',
      dgClass: '6.1',
      containerNo: 'B',
    });
    const c = row({
      unNo: '3288',
      packingGroup: 'III',
      dgClass: '6.1',
      containerNo: 'C',
    });
    const sample = getUnifeederReferenceMismatch(a, 'packingGroup');
    expect(sample).not.toBeNull();
    const identical = findIdenticalUnifeederReferenceMismatches([a, b, c], sample!);
    expect(identical).toHaveLength(2);
  });

  it('counts mismatches and appends import warning', () => {
    const rows = [
      row({ unNo: '3288', packingGroup: 'II', dgClass: '6.1', fire: 'F-A', spillage: 'S-A' }),
    ];
    expect(countUnifeederReferenceMismatches(rows)).toBeGreaterThan(0);
    const warnings: string[] = [];
    appendUnifeederReferenceMismatchWarning(warnings, 2);
    expect(warnings[0]).toContain('2 values differ from DG Reference');
  });

  it('finalize keeps manifesto PG and warns about reference differences', () => {
    const { rows, warnings } = finalizeUnifeederImportRows(
      [
        row({
          unNo: '3288',
          packingGroup: 'II',
          dgClass: '6.1',
          goodsDescription: 'TOXIC SOLID (Sodium Dichromate)',
          fire: 'F-A',
          spillage: 'S-A',
        }),
      ],
      [],
    );

    expect(rows[0]?.packingGroup).toBe('II');
    expect(countUnifeederReferenceMismatches(rows)).toBeGreaterThan(0);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain('DG Reference');
  });
});
