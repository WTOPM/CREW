import { describe, expect, it } from 'vitest';
import type { FuelDisplayEvent } from '../models/fuel.models';
import { buildFuelStatsSummary, describeFuelStatsScope } from './fuel-stats.util';

function row(
  partial: Partial<FuelDisplayEvent> & Pick<FuelDisplayEvent, 'id' | 'date' | 'kind'>,
): FuelDisplayEvent {
  return {
    place: '',
    rawEvent: '',
    time: '12:00',
    timeUsedHours: null,
    fmMeAe: null,
    totalM3: null,
    totalMt: null,
    meMt: null,
    aeMt: null,
    boilerMt: null,
    robRmdMt: null,
    robB100Mt: null,
    bunkerRmdBioMt: null,
    bunkerDmaMt: null,
    robDmaMt: null,
    meRobTank: null,
    aeRobTank: null,
    boilerRobTank: null,
    dmaConsM3: null,
    boilerFm: null,
    meCounterRh: null,
    meShapoliRev: null,
    meShapoliKwh: null,
    meHours: null,
    meRpm: null,
    meKw: null,
    ae1CounterRh: null,
    ae1KwAvg: null,
    ae1Hours: null,
    ae1Kw: null,
    ae2CounterRh: null,
    ae2KwAvg: null,
    ae2Hours: null,
    ae2Kw: null,
    ae3CounterRh: null,
    ae3KwAvg: null,
    ae3Hours: null,
    ae3Kw: null,
    boilerCounterRh: null,
    boilerHours: null,
    boilerFmCeng: null,
    boilerConsM3: null,
    boilerConsMt: null,
    sourceRow: 1,
    rolledFromCount: 1,
    ...partial,
  };
}

describe('fuel-stats.util', () => {
  it('sums consumption and hours across filtered rows', () => {
    const summary = buildFuelStatsSummary([
      row({
        id: '1',
        date: '2026-01-01',
        kind: 'start_sea',
        timeUsedHours: 12,
        totalMt: 10,
        meMt: 8,
        aeMt: 2,
        rolledFromCount: 2,
      }),
      row({
        id: '2',
        date: '2026-01-02',
        kind: 'noon',
        timeUsedHours: 12,
        totalMt: 11,
        meMt: 9,
        aeMt: 2,
      }),
    ]);
    expect(summary.rowCount).toBe(2);
    expect(summary.sourceEventCount).toBe(3);
    expect(summary.hours).toBe(24);
    expect(summary.totalMt).toBe(21);
    expect(summary.meMt).toBe(17);
    expect(summary.rateMtPerDay).toBe(21);
    expect(summary.byKind).toHaveLength(2);
  });

  it('describes the active filter scope', () => {
    const text = describeFuelStatsScope(
      {
        visibleKinds: ['arrival', 'departure'],
        newestFirst: true,
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
        search: '',
        limitCount: 20,
      },
      2,
      12,
    );
    expect(text).toContain('2026-01-01 → 2026-01-31');
    expect(text).toContain('2 event types');
    expect(text).toContain('Last 20');
  });
});
