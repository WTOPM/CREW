import { describe, expect, it } from 'vitest';
import { createDgCargoLine, dgContainersExportTotalKg, type DgOnboardContainer } from '../models/dg-manifest.models';
import { createDgUnifeederRow } from '../models/dg-unifeeder.models';
import { dgInventoryDisplayTotalKg, mergeDgCargoLines } from './dg-cargo-merge.util';
import { unifeederInventoryDisplayTotalKg } from './dg-unifeeder-weight.util';
import { sumPlannedDgLineWeightsKg } from './dg-weight-view.util';

function cmaContainer(lines: ReturnType<typeof createDgCargoLine>[]): DgOnboardContainer {
  return {
    id: 'c1',
    containerNo: 'TEST123',
    type: '22G1',
    stowage: '010182',
    loadPort: 'DEBRV',
    dischargePort: 'EGDAM',
    status: 'onboard',
    sourceManifestId: '',
    lines,
  };
}

describe('DG weight pipeline (consolidate → round)', () => {
  it('rounds each display line then sums (500.4 × 3 → 1500)', () => {
    const lines = [
      createDgCargoLine({ dgClass: '3', unNo: '1203', weightKg: '500.4' }),
      createDgCargoLine({ dgClass: '3', unNo: '1203', weightKg: '500.4' }),
      createDgCargoLine({ dgClass: '3', unNo: '1203', weightKg: '500.4' }),
    ];
    const containers = [cmaContainer(lines)];

    const total = dgInventoryDisplayTotalKg(containers, {
      manifestMergeLines: false,
      manifestUseGrossWeight: true,
      manifestRoundWeights: true,
    });

    expect(total).toBe(1500);
    expect(sumPlannedDgLineWeightsKg([500.4, 500.4, 500.4], true)).toBe(1500);
  });

  it('consolidates matching lines before round (merge → round)', () => {
    const lines = [
      createDgCargoLine({
        dgClass: '3',
        unNo: '1203',
        properShippingName: 'Gasoline',
        weightKg: '500.4',
      }),
      createDgCargoLine({
        dgClass: '3',
        unNo: '1203',
        properShippingName: 'Gasoline',
        weightKg: '500.4',
      }),
    ];
    const containers = [cmaContainer(lines)];

    const merged = mergeDgCargoLines(lines, true);
    expect(merged).toHaveLength(1);
    expect(merged[0].weightSum).toBeCloseTo(1000.8, 3);

    const totalRounded = dgInventoryDisplayTotalKg(containers, {
      manifestMergeLines: true,
      manifestUseGrossWeight: true,
      manifestRoundWeights: true,
    });
    expect(totalRounded).toBe(1001);
  });

  it('export total matches inventory total for CMA', () => {
    const lines = [
      createDgCargoLine({ dgClass: '3', unNo: '1203', weightKg: '500.4' }),
      createDgCargoLine({ dgClass: '3', unNo: '1204', weightKg: '100.6' }),
    ];
    const containers = [cmaContainer(lines)];

    const viewTotal = dgInventoryDisplayTotalKg(containers, {
      manifestMergeLines: false,
      manifestUseGrossWeight: true,
      manifestRoundWeights: true,
    });
    const exportTotal = dgContainersExportTotalKg(containers, true, true, false);

    expect(exportTotal).toBe(viewTotal);
    expect(exportTotal).toBe(601);
  });

  it('DP WORLD export total matches inventory with merge + round', () => {
    const rows = [
      createDgUnifeederRow({
        containerNo: 'A',
        dgClass: '3',
        unNo: '1203',
        goodsDescription: 'Gasoline',
        weightKg: '500.4',
        grossWeightKg: '500.4',
      }),
      createDgUnifeederRow({
        containerNo: 'A',
        dgClass: '3',
        unNo: '1203',
        goodsDescription: 'Gasoline',
        weightKg: '500.4',
        grossWeightKg: '500.4',
      }),
    ];

    const options = { mergeLines: true, useGrossWeight: true, roundWeights: true };
    expect(unifeederInventoryDisplayTotalKg(rows, options)).toBe(1001);
  });
});
