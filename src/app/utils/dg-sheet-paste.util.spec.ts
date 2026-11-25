import { describe, expect, it } from 'vitest';
import { mapPasteTargets, parseClipboardTsv } from './dg-sheet-paste.util';

describe('parseClipboardTsv', () => {
  it('splits Excel column paste into rows', () => {
    expect(parseClipboardTsv('120382\r\n140284\r\n')).toEqual([['120382'], ['140284']]);
  });

  it('splits rectangular TSV', () => {
    expect(parseClipboardTsv('A\tB\nC\tD')).toEqual([
      ['A', 'B'],
      ['C', 'D'],
    ]);
  });
});

describe('mapPasteTargets', () => {
  it('fills down from a single selected cell', () => {
    const targets = mapPasteTargets(
      [['111'], ['222'], ['333']],
      { r0: 2, r1: 2, c0: 5, c1: 5 },
      { maxR: 10, maxC: 8 },
    );
    expect(targets).toEqual([
      { r: 2, c: 5, value: '111' },
      { r: 3, c: 5, value: '222' },
      { r: 4, c: 5, value: '333' },
    ]);
  });

  it('stays inside a multi-cell column selection', () => {
    const targets = mapPasteTargets(
      [['a'], ['b'], ['c'], ['d']],
      { r0: 0, r1: 1, c0: 3, c1: 3 },
      { maxR: 20, maxC: 8 },
    );
    expect(targets).toEqual([
      { r: 0, c: 3, value: 'a' },
      { r: 1, c: 3, value: 'b' },
    ]);
  });
});
