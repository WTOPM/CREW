import { describe, expect, it } from 'vitest';
import {
  formatRemarksFlagsColumn,
  remarksFlagsAlign,
  resolveRemarksParts,
} from './dg-unifeeder-remarks.util';

describe('dg-unifeeder-remarks', () => {
  it('puts LQ at the start and MP at the end when both are set', () => {
    const both = formatRemarksFlagsColumn('LQ', 'MP', 8);
    expect(both.startsWith('LQ')).toBe(true);
    expect(both.endsWith('MP')).toBe(true);
    expect(both.length).toBe(8);
    expect(both.length).toBeLessThanOrEqual(10);
    expect(remarksFlagsAlign('LQ', 'MP')).toBe('left');
  });

  it('keeps single flags simple', () => {
    expect(formatRemarksFlagsColumn('LQ', '')).toBe('LQ');
    expect(formatRemarksFlagsColumn('', 'MP')).toBe('MP');
    expect(remarksFlagsAlign('LQ', '')).toBe('left');
    expect(remarksFlagsAlign('', 'MP')).toBe('right');
  });

  it('resolves parts from a row', () => {
    expect(
      resolveRemarksParts({
        flashPoint: '20.0°C',
        lq: 'YES',
        marinePollutant: 'Y',
      }),
    ).toEqual({ flashPoint: '20.0 C', lq: 'LQ', mp: 'MP' });
  });
});
