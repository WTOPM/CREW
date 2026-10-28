import { describe, expect, it } from 'vitest';
import { createDgUnifeederRow } from '../models/dg-unifeeder.models';
import { findUnifeederDagosNetMismatches } from './dg-unifeeder-dagos-net.util';

describe('findUnifeederDagosNetMismatches', () => {
  it('pairs same UN lines by closest net and reports true diffs only', () => {
    const onboard = [
      createDgUnifeederRow({
        id: 'a',
        containerNo: 'HLBU1607884',
        unNo: '3166',
        netWeightKg: '2010',
        weightKg: '2010',
        status: 'onboard',
      }),
      createDgUnifeederRow({
        id: 'b',
        containerNo: 'HLBU1607884',
        unNo: '3166',
        netWeightKg: '1971',
        weightKg: '1971',
        status: 'onboard',
      }),
      createDgUnifeederRow({
        id: 'c',
        containerNo: 'HLBU1607884',
        unNo: '3166',
        netWeightKg: '1910',
        weightKg: '1910',
        status: 'onboard',
      }),
    ];
    const mismatches = findUnifeederDagosNetMismatches(onboard, [
      { containerNo: 'HLBU1607884', position: '220182', unNo: '3166', netWeightKg: '2010' },
      { containerNo: 'HLBU1607884', position: '220182', unNo: '3166', netWeightKg: '1971' },
      { containerNo: 'HLBU1607884', position: '220182', unNo: '3166', netWeightKg: '1673' },
    ]);
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]?.rowId).toBe('c');
    expect(mismatches[0]?.programNetKg).toBe('1910');
    expect(mismatches[0]?.dagosNetKg).toBe('1673');
  });

  it('ignores discharged rows and empty dagos nets', () => {
    const onboard = [
      createDgUnifeederRow({
        id: 'd',
        containerNo: 'BEAU2367034',
        unNo: '1325',
        netWeightKg: '10500',
        status: 'discharged',
      }),
    ];
    expect(
      findUnifeederDagosNetMismatches(onboard, [
        { containerNo: 'BEAU2367034', position: '150382', unNo: '1325', netWeightKg: '999' },
        { containerNo: 'NYKU9888653', position: '030184', unNo: '3267', netWeightKg: '' },
      ]),
    ).toEqual([]);
  });

  it('does not compare when Dagos Net W. is empty but program has a weight', () => {
    const onboard = [
      createDgUnifeederRow({
        id: 'e',
        containerNo: 'SEKU1159496',
        unNo: '3267',
        netWeightKg: '18000',
        weightKg: '18000',
        status: 'onboard',
      }),
    ];
    expect(
      findUnifeederDagosNetMismatches(onboard, [
        { containerNo: 'SEKU1159496', position: '030286', unNo: '3267', netWeightKg: '' },
        { containerNo: 'SEKU1159496', position: '030286', unNo: '3267', netWeightKg: '—' },
        { containerNo: 'SEKU1159496', position: '030286', unNo: '3267', netWeightKg: '0' },
      ]),
    ).toEqual([]);
  });
});
