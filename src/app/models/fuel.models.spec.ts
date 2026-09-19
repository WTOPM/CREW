import { describe, expect, it } from 'vitest';
import {
  applyFuelEventAutoCalcs,
  classifyFuelEvent,
  createEmptyFuelLogEvent,
  filterFuelEvents,
  formatFuelHoursHm,
  createDefaultFuelViewPrefs,
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
