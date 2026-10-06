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
import { setUnNumberReferenceOverride, type UnNumberReferenceRow } from './dg-un-number.util';

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

const VARIANT_3288: UnNumberReferenceRow[] = [
  {
    unNo: '3288',
    description: 'TOXIC SOLID, INORGANIC, N.O.S.',
    dgClass: '6.1',
    packingGroup: 'I',
    subRisk: '-',
    fire: 'F-A',
    spillage: 'S-A',
  },
  {
    unNo: '3288',
    description: 'TOXIC SOLID, INORGANIC, N.O.S.',
    dgClass: '6.1',
    packingGroup: 'II',
    subRisk: '-',
    fire: 'F-A',
    spillage: 'S-A',
  },
  {
    unNo: '3288',
    description: 'TOXIC SOLID, INORGANIC, N.O.S.',
    dgClass: '6.1',
    packingGroup: 'III',
    subRisk: '-',
    fire: 'F-A',
    spillage: 'S-A',
  },
];

describe('dg-unifeeder-reference-mismatch', () => {
  it('does not flag packing group when manifesto PG matches a list variant', () => {
    setUnNumberReferenceOverride(VARIANT_3288);
    expect(
      getUnifeederReferenceMismatch(
        row({
          unNo: '3288',
          packingGroup: 'II',
          dgClass: '6.1',
          fire: 'F-A',
          spillage: 'S-A',
          goodsDescription: 'TOXIC SOLID, INORGANIC, N.O.S.',
        }),
        'packingGroup',
      ),
    ).toBeNull();
    setUnNumberReferenceOverride(null);
  });

  it('flags packing group when manifesto PG is not a printed variant', () => {
    setUnNumberReferenceOverride(VARIANT_3288);
    const pg = getUnifeederReferenceMismatch(
      row({ unNo: '3288', packingGroup: 'IV', dgClass: '6.1' }),
      'packingGroup',
    );
    expect(pg?.currentValue).toBe('IV');
    expect(pg?.referenceValue).toContain('allowed:');
    setUnNumberReferenceOverride(null);
  });

  it('flags EmS when it differs from the matched variant', () => {
    setUnNumberReferenceOverride(VARIANT_3288);
    const fire = getUnifeederReferenceMismatch(
      row({
        unNo: '3288',
        packingGroup: 'III',
        dgClass: '6.1',
        fire: 'F-E',
        spillage: 'S-A',
      }),
      'fire',
    );
    expect(fire?.currentValue).toBe('F-E');
    expect(fire?.referenceValue).toBe('F-A');
    setUnNumberReferenceOverride(null);
  });

  it('hides mismatch after Keep manifesto dismisses that reference suggestion', () => {
    setUnNumberReferenceOverride(VARIANT_3288);
    expect(
      getUnifeederReferenceMismatch(
        row({
          unNo: '3288',
          packingGroup: 'III',
          dgClass: '6.1',
          fire: 'F-E',
          referenceKeepManifest: { fire: 'F-A' },
        }),
        'fire',
      ),
    ).toBeNull();
    setUnNumberReferenceOverride(null);
  });

  it('treats PG arabic and roman as equal', () => {
    expect(normalizeUnifeederRefCompareValue('packingGroup', '2')).toBe('II');
    expect(normalizeUnifeederRefCompareValue('packingGroup', 'II')).toBe('II');
  });

  it('finds identical mismatches across rows', () => {
    setUnNumberReferenceOverride(VARIANT_3288);
    const a = row({
      unNo: '3288',
      packingGroup: 'II',
      dgClass: '6.1',
      fire: 'F-E',
      containerNo: 'A',
    });
    const b = row({
      unNo: '3288',
      packingGroup: 'II',
      dgClass: '6.1',
      fire: 'F-E',
      containerNo: 'B',
    });
    const c = row({
      unNo: '3288',
      packingGroup: 'III',
      dgClass: '6.1',
      fire: 'F-A',
      containerNo: 'C',
    });
    const sample = getUnifeederReferenceMismatch(a, 'fire');
    expect(sample).not.toBeNull();
    const identical = findIdenticalUnifeederReferenceMismatches([a, b, c], sample!);
    expect(identical).toHaveLength(2);
    setUnNumberReferenceOverride(null);
  });

  it('counts mismatches and appends import warning', () => {
    setUnNumberReferenceOverride(VARIANT_3288);
    const rows = [
      row({ unNo: '3288', packingGroup: 'II', dgClass: '6.1', fire: 'F-E', spillage: 'S-A' }),
    ];
    expect(countUnifeederReferenceMismatches(rows)).toBeGreaterThan(0);
    const warnings: string[] = [];
    appendUnifeederReferenceMismatchWarning(warnings, 2);
    expect(warnings[0]).toContain('2 values differ from DG Reference');
    setUnNumberReferenceOverride(null);
  });

  it('finalize keeps manifesto PG for the matching variant without PG mismatch', () => {
    setUnNumberReferenceOverride(VARIANT_3288);
    const { rows, warnings } = finalizeUnifeederImportRows(
      [
        row({
          unNo: '3288',
          packingGroup: 'II',
          dgClass: '6.1',
          goodsDescription: 'TOXIC SOLID, INORGANIC, N.O.S.',
          fire: 'F-A',
          spillage: 'S-A',
        }),
      ],
      [],
    );

    expect(rows[0]?.packingGroup).toBe('II');
    expect(getUnifeederReferenceMismatch(rows[0]!, 'packingGroup')).toBeNull();
    // No field differs from the matched PG II variant.
    expect(listUnifeederReferenceMismatches(rows[0]!)).toEqual([]);
    expect(warnings.some((w) => w.includes('DG Reference'))).toBe(false);
    setUnNumberReferenceOverride(null);
  });
});
