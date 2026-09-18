import { describe, expect, it } from 'vitest';
import { createDgUnifeederRow } from '../models/dg-unifeeder.models';
import {
  buildUnifeederContainerDisplayGroups,
  coalesceUnifeederContainerMeta,
  groupUnifeederRawRowsByContainer,
  unifeederContainerKey,
} from './dg-unifeeder-merge.util';

describe('unifeederContainerKey', () => {
  it('groups by container number only (stow must not split)', () => {
    const a = createDgUnifeederRow({
      containerNo: 'CNBU1315876',
      stow: '110182',
      size: '22GP',
    });
    const b = createDgUnifeederRow({
      containerNo: 'CNBU1315876',
      stow: '',
      size: '22GP',
    });
    expect(unifeederContainerKey(a)).toBe(unifeederContainerKey(b));
    expect(unifeederContainerKey(a)).toBe('CNBU1315876');
  });

  it('keeps blank container rows separate', () => {
    const a = createDgUnifeederRow({ containerNo: '' });
    const b = createDgUnifeederRow({ containerNo: '' });
    expect(unifeederContainerKey(a)).not.toBe(unifeederContainerKey(b));
  });
});

describe('groupUnifeederRawRowsByContainer', () => {
  it('merges same container number across page-break stow mismatch', () => {
    const rows = [
      createDgUnifeederRow({
        containerNo: 'CNBU1315876',
        stow: '110182',
        unNo: '1139',
        weightKg: '400',
      }),
      createDgUnifeederRow({
        containerNo: 'CNBU1315876',
        stow: '110182',
        unNo: '1950',
        weightKg: '50',
      }),
      createDgUnifeederRow({
        containerNo: 'CNBU1315876',
        stow: '',
        unNo: '1950',
        weightKg: '121.68',
      }),
    ];
    const groups = groupUnifeederRawRowsByContainer(rows);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.rows).toHaveLength(3);

    const display = buildUnifeederContainerDisplayGroups(rows, {
      mergeLines: false,
      useGrossWeight: true,
      roundWeights: false,
    });
    expect(display).toHaveLength(1);
    expect(display[0]?.stow).toBe('110182');
    expect(display[0]?.lines).toHaveLength(3);
  });
});

describe('coalesceUnifeederContainerMeta', () => {
  it('fills empty stow/size from sibling lines of the same container', () => {
    const rows = coalesceUnifeederContainerMeta([
      {
        containerNo: 'CNBU1315876',
        size: '22GP',
        stow: '110182',
        loadPort: 'DEHAM',
        dischargePort: 'DEBRV',
      },
      {
        containerNo: 'CNBU1315876',
        size: '',
        stow: '',
        loadPort: '',
        dischargePort: '',
      },
    ]);
    expect(rows[1]).toMatchObject({
      size: '22GP',
      stow: '110182',
      loadPort: 'DEHAM',
      dischargePort: 'DEBRV',
    });
  });
});
