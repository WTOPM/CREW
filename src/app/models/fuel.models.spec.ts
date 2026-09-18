import { describe, expect, it } from 'vitest';
import {
  classifyFuelEvent,
  filterFuelEvents,
  createDefaultFuelViewPrefs,
  type FuelLogEvent,
} from '../models/fuel.models';

function ev(partial: Partial<FuelLogEvent> & Pick<FuelLogEvent, 'id' | 'kind' | 'date' | 'time'>): FuelLogEvent {
  return {
    place: 'Sea',
    rawEvent: partial.kind,
    timeUsedHours: null,
    totalMt: null,
    meMt: null,
    aeMt: null,
    boilerMt: null,
    robRmdMt: null,
    robB100Mt: null,
    robDmaMt: null,
    meHours: null,
    meRpm: null,
    meKw: null,
    ae1Hours: null,
    ae1Kw: null,
    ae2Hours: null,
    ae2Kw: null,
    ae3Hours: null,
    ae3Kw: null,
    boilerHours: null,
    sourceRow: Number(partial.id) || 0,
    ...partial,
  };
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
      timeUsedHours: 8,
      meMt: 0.4,
      aeMt: 0.2,
      totalMt: 0.6,
    }),
  ];

  it('sums hours and fuel into next visible when Noon is hidden', () => {
    const view = {
      ...createDefaultFuelViewPrefs(),
      visibleKinds: ['arrival' as const, 'departure' as const],
      newestFirst: false,
      limitCount: 0,
    };
    const rows = filterFuelEvents(sample, view);
    expect(rows.map((e) => e.id)).toEqual(['1', '3']);
    expect(rows[0].timeUsedHours).toBe(2);
    expect(rows[0].rolledFromCount).toBe(1);
    expect(rows[1].timeUsedHours).toBe(20);
    expect(rows[1].meMt).toBe(1.4);
    expect(rows[1].aeMt).toBe(0.7);
    expect(rows[1].totalMt).toBe(2.1);
    expect(rows[1].rolledFromCount).toBe(2);
  });

  it('sums kW and takes max RPM when rolling up hidden events', () => {
    const withPower: FuelLogEvent[] = [
      ev({
        id: '1',
        kind: 'arrival',
        date: '2026-09-01',
        time: '06:00',
        meRpm: 40,
        meKw: 1000,
        ae1Kw: 200,
      }),
      ev({
        id: '2',
        kind: 'noon',
        date: '2026-09-01',
        time: '12:00',
        meRpm: 72.5,
        meKw: 4500,
        ae1Kw: 350,
      }),
      ev({
        id: '3',
        kind: 'departure',
        date: '2026-09-01',
        time: '18:00',
        meRpm: 55,
        meKw: 2200,
        ae1Kw: 180,
      }),
    ];
    const view = {
      ...createDefaultFuelViewPrefs(),
      visibleKinds: ['arrival' as const, 'departure' as const],
      newestFirst: false,
      limitCount: 0,
    };
    const rows = filterFuelEvents(withPower, view);
    expect(rows[1].meKw).toBe(6700);
    expect(rows[1].ae1Kw).toBe(530);
    expect(rows[1].meRpm).toBe(72.5);
    expect(rows[1].rolledFromCount).toBe(2);
  });

  it('limits to last N matches', () => {
    const view = {
      ...createDefaultFuelViewPrefs(),
      visibleKinds: ['arrival' as const, 'noon' as const, 'departure' as const],
      newestFirst: true,
      limitCount: 2,
    };
    const rows = filterFuelEvents(sample, view);
    expect(rows).toHaveLength(2);
    expect(rows.map((e) => e.id)).toEqual(['3', '2']);
  });
});
