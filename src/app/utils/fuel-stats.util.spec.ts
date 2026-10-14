import { describe, expect, it } from 'vitest';
import type { FuelDisplayEvent } from '../models/fuel.models';
import {
  buildFuelStatsSummary,
  describeFuelStatsScope,
  fuelStatsEventsOnDate,
  fuelStatsFilterView,
  sliceFuelStatsByEventBounds,
  sortFuelStatsDayRows,
  sortFuelStatsEvents,
  sortFuelStatsKindRows,
} from './fuel-stats.util';

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
    density: null,
    meMt: null,
    aeMt: null,
    boilerMt: null,
    dmaDensity: null,
    robRmdMt: null,
    robB100Mt: null,
    bunkerRmdBioMt: null,
    bunkerDmaMt: null,
    robDmaMt: null,
    meRobTank: null,
    aeRobTank: null,
    boilerRobTank: null,
    bunkerRobTank: null,
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
    cengSourceRow: 0,
    writeStatus: 'synced',
    voyageChainId: null,
    voyageChainIndex: null,
    voyageChainPredict: false,
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
        bunkerRmdBioMt: 50,
        bunkerDmaMt: 5,
        bunkerRobTank: 'b100',
      }),
    ]);
    expect(summary.rowCount).toBe(2);
    expect(summary.sourceEventCount).toBe(3);
    expect(summary.hours).toBe(24);
    expect(summary.totalMt).toBe(21);
    expect(summary.meMt).toBe(17);
    expect(summary.calendarDays).toBe(2);
    expect(summary.rateMtPerDay).toBe(21);
    expect(summary.rateMtPerCalendarDay).toBe(10.5);
    expect(summary.bunkerCount).toBe(1);
    expect(summary.bunkerTotalMt).toBe(55);
    expect(summary.bunkers).toHaveLength(1);
    expect(summary.bunkers[0]!.bunkerRobTank).toBe('b100');
    expect(summary.byKind).toHaveLength(2);
    expect(summary.byDay).toHaveLength(2);
  });

  it('tracks ROB endpoints and delta', () => {
    const summary = buildFuelStatsSummary([
      row({
        id: '1',
        date: '2026-01-01',
        kind: 'noon',
        robRmdMt: 100,
        robB100Mt: 20,
        robDmaMt: 40,
      }),
      row({
        id: '2',
        date: '2026-01-03',
        kind: 'noon',
        robRmdMt: 90,
        robB100Mt: 18,
        robDmaMt: 42,
      }),
    ]);
    expect(summary.calendarDays).toBe(3);
    expect(summary.firstRob).toEqual({ robRmdMt: 100, robB100Mt: 20, robDmaMt: 40 });
    expect(summary.lastRob).toEqual({ robRmdMt: 90, robB100Mt: 18, robDmaMt: 42 });
    expect(summary.robDelta).toEqual({ robRmdMt: -10, robB100Mt: -2, robDmaMt: 2 });
  });

  it('sorts kind / day / event rows', () => {
    const kinds = sortFuelStatsKindRows(
      [
        {
          kind: 'noon',
          label: 'Noon',
          count: 2,
          hours: 24,
          totalMt: 20,
          meMt: 16,
          aeMt: 4,
          boilerMt: null,
          sharePct: 50,
        },
        {
          kind: 'arrival',
          label: 'Arrival',
          count: 1,
          hours: 6,
          totalMt: 5,
          meMt: 4,
          aeMt: 1,
          boilerMt: null,
          sharePct: 12.5,
        },
      ],
      'label',
      true,
    );
    expect(kinds.map((k) => k.label)).toEqual(['Arrival', 'Noon']);

    const days = sortFuelStatsDayRows(
      [
        { date: '2026-01-02', count: 1, hours: 12, totalMt: 10, meMt: 8, aeMt: 2, boilerMt: null },
        { date: '2026-01-01', count: 2, hours: 24, totalMt: 20, meMt: 16, aeMt: 4, boilerMt: null },
      ],
      'totalMt',
      false,
    );
    expect(days[0]!.date).toBe('2026-01-01');

    const events = sortFuelStatsEvents(
      [
        row({ id: 'b', date: '2026-01-01', time: '18:00', kind: 'noon', totalMt: 5 }),
        row({ id: 'a', date: '2026-01-01', time: '06:00', kind: 'noon', totalMt: 12 }),
      ],
      'totalMt',
      false,
    );
    expect(events[0]!.id).toBe('a');
  });

  it('describes the active filter scope', () => {
    const withDates = describeFuelStatsScope(
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
    expect(withDates).toContain('2026-01-01 → 2026-01-31');
    expect(withDates).toContain('2 event types');
    expect(withDates).toContain('Full date range');
    expect(withDates).not.toContain('Last 20');

    const noDates = describeFuelStatsScope(
      {
        visibleKinds: ['arrival', 'departure'],
        newestFirst: true,
        dateFrom: '',
        dateTo: '',
        search: '',
        limitCount: 20,
      },
      2,
      12,
    );
    expect(noDates).toContain('All dates');
    expect(noDates).toContain('Last 20');
  });

  it('ignores Last N for stats when a date bound is set', () => {
    const base = {
      visibleKinds: ['arrival' as const],
      newestFirst: true,
      dateFrom: '',
      dateTo: '',
      search: '',
      limitCount: 20,
    };
    expect(fuelStatsFilterView(base).limitCount).toBe(20);
    expect(fuelStatsFilterView({ ...base, dateFrom: '2026-01-01' }).limitCount).toBe(0);
    expect(fuelStatsFilterView({ ...base, dateTo: '2026-01-31' }).limitCount).toBe(0);
  });

  it('slices stats between start/end events on the period dates', () => {
    const sample = [
      row({ id: 'a', date: '2026-01-01', time: '08:00', kind: 'arrival', totalMt: 1 }),
      row({ id: 'b', date: '2026-01-01', time: '18:00', kind: 'departure', totalMt: 2 }),
      row({ id: 'c', date: '2026-01-02', time: '12:00', kind: 'noon', totalMt: 3 }),
      row({ id: 'd', date: '2026-01-03', time: '06:00', kind: 'arrival', totalMt: 4 }),
      row({ id: 'e', date: '2026-01-03', time: '20:00', kind: 'departure', totalMt: 5 }),
    ];
    expect(fuelStatsEventsOnDate(sample, '2026-01-01').map((r) => r.id)).toEqual(['a', 'b']);
    expect(fuelStatsEventsOnDate(sample, '2026-01-03').map((r) => r.id)).toEqual(['d', 'e']);
    const sliced = sliceFuelStatsByEventBounds(sample, 'b', 'd');
    expect(sliced.map((r) => r.id)).toEqual(['b', 'c', 'd']);
    expect(buildFuelStatsSummary(sliced).totalMt).toBe(9);
  });
});
