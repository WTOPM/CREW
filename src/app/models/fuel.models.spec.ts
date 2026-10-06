import { describe, expect, it } from 'vitest';
import {
  applyFuelEventAutoCalcs,
  applyFuelConsumptionSideEffects,
  classifyFuelEvent,
  createEmptyFuelLogEvent,
  discoverFuelRobTanks,
  filterFuelEvents,
  formatFuelHoursHm,
  createDefaultFuelViewPrefs,
  inferDefaultRobTanks,
  projectFuelRobAfterConsumption,
  recomputeFuelTotalM3FromFm,
  dateTimeFromFuelHrsEdit,
  shiftFuelDateTime,
  type FuelLogEvent,
} from '../models/fuel.models';

function ev(partial: Partial<FuelLogEvent> & Pick<FuelLogEvent, 'id' | 'kind' | 'date' | 'time'>): FuelLogEvent {
  return createEmptyFuelLogEvent(partial);
}

describe('classifyFuelEvent', () => {
  it('maps VPS-relevant excel labels', () => {
    expect(classifyFuelEvent('BOSP')).toBe('start_sea');
    expect(classifyFuelEvent('EOSP')).toBe('end_sea');
    expect(classifyFuelEvent('Noon / EOSP')).toBe('end_sea');
    expect(classifyFuelEvent('SBE')).toBe('departure');
    expect(classifyFuelEvent('FEW')).toBe('arrival');
    expect(classifyFuelEvent('FWE')).toBe('arrival');
    expect(classifyFuelEvent('Noon')).toBe('noon');
    expect(classifyFuelEvent('Port Report')).toBe('port_report');
    expect(classifyFuelEvent('Canal In')).toBe('canal');
    expect(classifyFuelEvent('FEW/Shifting')).toBe('shifting');
    expect(classifyFuelEvent('SBE/Shifting')).toBe('shifting');
    expect(classifyFuelEvent('Noon/SBE/Shifting')).toBe('shifting');
  });
});

describe('formatFuelHoursHm', () => {
  it('converts decimal hours to H:MM', () => {
    expect(formatFuelHoursHm(1.1)).toBe('1:06');
    expect(formatFuelHoursHm(0.5)).toBe('0:30');
    expect(formatFuelHoursHm(24)).toBe('24:00');
    expect(formatFuelHoursHm(null)).toBe('—');
  });
});

describe('discoverFuelRobTanks / inferDefaultRobTanks', () => {
  it('discovers tanks that appear in the log', () => {
    expect(discoverFuelRobTanks([])).toEqual(['rmd', 'b100', 'dma']);
    expect(
      discoverFuelRobTanks([
        ev({ id: '1', kind: 'noon', date: '2026-01-01', time: '12:00', robB100Mt: 10, robDmaMt: 5 }),
      ]),
    ).toEqual(['b100', 'dma']);
  });

  it('infers B100 when previous burned B100 vs beforePrevious', () => {
    const before = ev({
      id: '0',
      kind: 'noon',
      date: '2026-10-05',
      time: '12:00',
      robRmdMt: 0,
      robB100Mt: 343,
      robDmaMt: 68.5,
    });
    const prev = ev({
      id: '1',
      kind: 'noon',
      date: '2026-10-06',
      time: '12:00',
      meMt: 0.5,
      aeMt: 0.5,
      boilerMt: 0.1,
      robRmdMt: 0,
      robB100Mt: 342.1,
      robDmaMt: 68.4,
    });
    expect(inferDefaultRobTanks(prev, before)).toEqual({ me: 'b100', ae: 'b100', boiler: 'dma' });
  });

  it('falls back to stocked B100 when no beforePrevious', () => {
    const prev = ev({
      id: '1',
      kind: 'noon',
      date: '2026-10-06',
      time: '12:00',
      robRmdMt: 0,
      robB100Mt: 342.1,
      robDmaMt: 68.4,
    });
    expect(inferDefaultRobTanks(prev, null)).toEqual({ me: 'b100', ae: 'b100', boiler: 'dma' });
  });
});

describe('dateTimeFromFuelHrsEdit', () => {
  it('anchors clock to previous + new hrs (±0.1 h = 6 min)', () => {
    const prev = { date: '2026-10-06', time: '05:24' };
    expect(dateTimeFromFuelHrsEdit({ date: '2026-10-06', time: '12:00', timeUsedHours: 6.6 }, 6.7, prev)).toEqual({
      date: '2026-10-06',
      time: '12:06',
    });
    expect(dateTimeFromFuelHrsEdit({ date: '2026-10-06', time: '12:00', timeUsedHours: 6.6 }, 6.5, prev)).toEqual({
      date: '2026-10-06',
      time: '11:54',
    });
  });

  it('falls back to delta from old hrs when no previous', () => {
    expect(
      dateTimeFromFuelHrsEdit({ date: '2026-10-06', time: '12:00', timeUsedHours: 6.6 }, 6.7, null),
    ).toEqual({ date: '2026-10-06', time: '12:06' });
  });
});

describe('recomputeFuelTotalM3FromFm', () => {
  it('matches Excel G = Fₙ − Fₙ₋₁', () => {
    expect(recomputeFuelTotalM3FromFm(802.3, 799.5)).toBe(2.8);
    expect(recomputeFuelTotalM3FromFm(799.5, 799.5)).toBe(0);
    expect(recomputeFuelTotalM3FromFm(100, null)).toBeNull();
    expect(recomputeFuelTotalM3FromFm(null, 100)).toBeNull();
    expect(recomputeFuelTotalM3FromFm(90, 100)).toBeNull(); // negative delta rejected
  });
});

describe('applyFuelEventAutoCalcs', () => {
  it('fills elapsed hours and total from ME+AE', () => {
    const prev = ev({
      id: '1',
      kind: 'departure',
      rawEvent: 'SBE',
      date: '2026-09-01',
      time: '06:00',
    });
    const draft = ev({
      id: '2',
      kind: 'noon',
      rawEvent: 'Noon',
      date: '2026-09-01',
      time: '12:00',
      meMt: 1.2,
      aeMt: 0.3,
    });
    const next = applyFuelEventAutoCalcs(draft, prev);
    expect(next.timeUsedHours).toBe(6);
    expect(next.totalMt).toBe(1.5);
    expect(next.kind).toBe('noon');
  });

  it('fills Total m³ from FM delta (Excel Fₙ−Fₙ₋₁)', () => {
    const prev = ev({
      id: '1',
      kind: 'start_sea',
      rawEvent: 'BOSP',
      date: '2026-09-01',
      time: '08:00',
      fmMeAe: 799.5,
    });
    const draft = ev({
      id: '2',
      kind: 'end_sea',
      rawEvent: 'EOSP',
      date: '2026-09-01',
      time: '11:24',
      fmMeAe: 802.3,
    });
    const next = applyFuelEventAutoCalcs(draft, prev);
    expect(next.totalM3).toBe(2.8);
  });

  it('projects ROB RMD/DMA from previous minus period consumption', () => {
    const prev = ev({
      id: '1',
      kind: 'noon',
      rawEvent: 'Noon',
      date: '2026-09-01',
      time: '12:00',
      robRmdMt: 100.5,
      robDmaMt: 20.0,
    });
    const draft = ev({
      id: '2',
      kind: 'noon',
      rawEvent: 'Noon',
      date: '2026-09-02',
      time: '12:00',
      meMt: 1.2,
      aeMt: 0.3,
      boilerMt: 0.4,
      meRobTank: 'rmd',
      aeRobTank: 'rmd',
      boilerRobTank: 'dma',
    });
    const next = applyFuelEventAutoCalcs(draft, prev);
    expect(next.robRmdMt).toBe(99.0);
    expect(next.robDmaMt).toBe(19.6);
    expect(next.timeUsedHours).toBe(24);
  });

  it('burns ME+AE from B100 when RMD stock is empty (bio ops)', () => {
    const prev = ev({
      id: '1',
      kind: 'noon',
      rawEvent: 'Noon',
      date: '2026-10-06',
      time: '12:00',
      robRmdMt: 0,
      robB100Mt: 342.1,
      robDmaMt: 68.4,
    });
    const draft = ev({
      id: '2',
      kind: 'noon',
      rawEvent: 'Noon',
      date: '2026-10-06',
      time: '18:00',
      meMt: 0.5,
      aeMt: 0.5,
      boilerMt: 0.4,
    });
    const next = applyFuelEventAutoCalcs(draft, prev);
    expect(next.meRobTank).toBe('b100');
    expect(next.aeRobTank).toBe('b100');
    expect(next.boilerRobTank).toBe('dma');
    expect(next.robRmdMt).toBe(0);
    expect(next.robB100Mt).toBe(341.1);
    expect(next.robDmaMt).toBe(68.0);
  });

  it('never goes negative when previous ROB is 0', () => {
    const prev = ev({
      id: '1',
      kind: 'noon',
      date: '2026-10-06',
      time: '12:00',
      robRmdMt: 0,
      robB100Mt: 10,
      robDmaMt: 5,
    });
    const draft = ev({
      id: '2',
      kind: 'noon',
      date: '2026-10-06',
      time: '18:00',
      meMt: 1,
      aeMt: 0,
      boilerMt: 0,
      meRobTank: 'rmd',
      aeRobTank: 'b100',
      boilerRobTank: 'dma',
    });
    const next = applyFuelEventAutoCalcs(draft, prev);
    expect(next.robRmdMt).toBe(0);
    expect(next.robB100Mt).toBe(10);
  });

  it('supports split ME→B100 and AE→RMD debit', () => {
    const prev = ev({
      id: '1',
      kind: 'noon',
      date: '2026-09-01',
      time: '12:00',
      robRmdMt: 50,
      robB100Mt: 100,
      robDmaMt: 20,
    });
    const projected = projectFuelRobAfterConsumption(
      prev,
      { me: 'b100', ae: 'rmd', boiler: 'dma' },
      { meMt: 1.5, aeMt: 0.5, boilerMt: 0.2 },
    );
    expect(projected.robB100Mt).toBe(98.5);
    expect(projected.robRmdMt).toBe(49.5);
    expect(projected.robDmaMt).toBe(19.8);
  });
});

describe('applyFuelConsumptionSideEffects', () => {
  it('rebuilds Total t and ROB from previous when ME/AE/Boiler change', () => {
    const prev = ev({
      id: '1',
      kind: 'noon',
      date: '2026-10-06',
      time: '12:00',
      robRmdMt: 0,
      robB100Mt: 342.1,
      robDmaMt: 68.4,
    });
    const current = ev({
      id: '2',
      kind: 'noon',
      date: '2026-10-06',
      time: '18:00',
      meMt: 0.2,
      aeMt: 0.1,
      boilerMt: 0.1,
      totalMt: 0.3,
      robRmdMt: 999,
      robB100Mt: 999,
      robDmaMt: 999,
      meRobTank: 'b100',
      aeRobTank: 'b100',
      boilerRobTank: 'dma',
    });
    const next = applyFuelConsumptionSideEffects(current, prev, null, {
      meMt: 0.5,
      aeMt: 0.5,
      boilerMt: 0.4,
    });
    expect(next.totalMt).toBe(1.0);
    expect(next.robRmdMt).toBe(0);
    expect(next.robB100Mt).toBe(341.1);
    expect(next.robDmaMt).toBe(68.0);
  });
});

describe('filterFuelEvents roll-up', () => {
  const sample: FuelLogEvent[] = [
    ev({
      id: '1',
      place: 'Hamburg',
      rawEvent: 'FEW',
      kind: 'arrival',
      date: '2026-09-01',
      time: '06:00',
      timeUsedHours: 2,
      meMt: 0.2,
      aeMt: 0.1,
      totalMt: 0.3,
    }),
    ev({
      id: '2',
      place: 'Hamburg',
      rawEvent: 'Noon',
      kind: 'noon',
      date: '2026-09-01',
      time: '12:00',
      timeUsedHours: 12,
      meMt: 1,
      aeMt: 0.5,
      totalMt: 1.5,
    }),
    ev({
      id: '3',
      place: 'Hamburg',
      rawEvent: 'SBE',
      kind: 'departure',
      date: '2026-09-01',
      time: '18:00',
      timeUsedHours: 6,
      meMt: 0.4,
      aeMt: 0.2,
      totalMt: 0.6,
    }),
  ];

  it('rolls hidden noon into next visible departure', () => {
    const view = {
      ...createDefaultFuelViewPrefs(),
      visibleKinds: ['arrival', 'departure'] as const,
      newestFirst: false,
      limitCount: 0,
    };
    const rows = filterFuelEvents(sample, { ...view, visibleKinds: [...view.visibleKinds] });
    expect(rows).toHaveLength(2);
    expect(rows[0].kind).toBe('arrival');
    expect(rows[1].kind).toBe('departure');
    expect(rows[1].timeUsedHours).toBe(18);
    expect(rows[1].totalMt).toBe(2.1);
    expect(rows[1].rolledFromCount).toBe(2);
  });

  it('keeps machinery power when present', () => {
    const withPower: FuelLogEvent[] = [
      ev({
        id: '1',
        kind: 'start_sea',
        rawEvent: 'BOSP',
        date: '2026-09-01',
        time: '08:00',
        meKw: 4000,
      }),
    ];
    const rows = filterFuelEvents(withPower, {
      ...createDefaultFuelViewPrefs(),
      limitCount: 0,
    });
    expect(rows[0].meKw).toBe(4000);
  });
});

describe('shiftFuelDateTime', () => {
  it('subtracts hours for UTC display (local UTC+2 → UTC)', () => {
    expect(shiftFuelDateTime('2026-01-02', '01:30', -2)).toEqual({
      date: '2026-01-01',
      time: '23:30',
    });
    expect(shiftFuelDateTime('2026-01-01', '12:00', -2)).toEqual({
      date: '2026-01-01',
      time: '10:00',
    });
  });
});
