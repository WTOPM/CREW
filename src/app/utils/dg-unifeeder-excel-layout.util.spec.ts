import { describe, expect, it } from 'vitest';
import type { Port } from '../models/crew.models';
import { createDgUnifeederRow } from '../models/dg-unifeeder.models';
import { unifeederExportPolPodLabel } from './dg-unifeeder-excel-layout.util';

describe('unifeederExportPolPodLabel', () => {
  const ports: Port[] = [
    {
      name: 'HAMBURG',
      code: 'DEHAM',
      terminals: [{ abbrev: 'EGH', name: 'Eurogate Terminal Hamburg' }],
    },
  ];

  it('exports port UN/LOCODE when By terminals is off', () => {
    const row = createDgUnifeederRow({
      loadPort: 'HAMBURG',
      loadTerminal: 'EGH',
      dischargePort: 'HAMBURG',
      dischargeTerminal: 'EGH',
    });
    expect(unifeederExportPolPodLabel(row, 'load', ports, false)).toBe('DEHAM');
    expect(unifeederExportPolPodLabel(row, 'discharge', ports, false)).toBe('DEHAM');
  });

  it('exports terminal abbrev when By terminals is on', () => {
    const row = createDgUnifeederRow({
      loadPort: 'HAMBURG',
      loadTerminal: 'EGH',
      dischargePort: 'HAMBURG',
      dischargeTerminal: '',
    });
    expect(unifeederExportPolPodLabel(row, 'load', ports, true)).toBe('EGH');
    expect(unifeederExportPolPodLabel(row, 'discharge', ports, true)).toBe('');
  });
});
