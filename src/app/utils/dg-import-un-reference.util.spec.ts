import { describe, expect, it } from 'vitest';
import { applyUnifeederReferenceOrManifest } from './dg-import-un-reference.util';
import type { UnifeederImportRowPartial } from './dg-unifeeder-pdf.util';

function row(partial: Partial<UnifeederImportRowPartial>): UnifeederImportRowPartial {
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

describe('applyUnifeederReferenceOrManifest', () => {
  it('keeps packing group from the manifest when DG Reference has a different PG', () => {
    // Bundled UN 3288 is PG I; Maersk/DP WORLD cargo for this shipment is PG II.
    const { row: next } = applyUnifeederReferenceOrManifest(
      row({
        unNo: '3288',
        packingGroup: 'II',
        dgClass: '6.1',
        goodsDescription: 'TOXIC SOLID, INORGANIC, N.O.S. (Sodium Dichromate Anhydrous)',
        fire: 'F-A',
        spillage: 'S-A',
      }),
    );

    expect(next.packingGroup).toBe('II');
    expect(next.goodsDescription).toContain('Sodium Dichromate');
    expect(next.dgClass).toBe('6.1');
  });

  it('fills packing group from DG Reference when the manifest left it blank', () => {
    const { row: next } = applyUnifeederReferenceOrManifest(
      row({
        unNo: '3288',
        packingGroup: '',
        dgClass: '',
        goodsDescription: '',
      }),
    );

    expect(next.packingGroup).toBe('I');
    expect(next.dgClass).toBe('6.1');
    expect(next.goodsDescription.toUpperCase()).toContain('TOXIC SOLID');
  });
});
