import { describe, expect, it } from 'vitest';
import { createEmptyFuelLogEvent } from '../models/fuel.models';
import {
  applyVoyageChainTimeShift,
  clearVoyageChainOnEvent,
  foRateMtPerHourForVoyageSegment,
  predictFuelVoyageEventFromPrevious,
  stampVoyageChain,
} from './fuel-voyage-chain.util';

describe('foRateMtPerHourForVoyageSegment', () => {
  it('uses canal/slow band for departure→arrival without sea kinds', () => {
    const rate = foRateMtPerHourForVoyageSegment(
      createEmptyFuelLogEvent({
        place: 'Singapore',
        rawEvent: 'Departure',
        kind: 'departure',
      }),
      createEmptyFuelLogEvent({
        place: 'Singapore',
        rawEvent: 'Arrival Pilot Station',
        kind: 'arrival',
      }),
    );
    expect(rate).toBe(0.3);
  });

  it('uses sea band for Sea place / BOSP', () => {
    const rate = foRateMtPerHourForVoyageSegment(
      createEmptyFuelLogEvent({
        place: 'Sea',
        rawEvent: 'BOSP',
        kind: 'start_sea',
      }),
      createEmptyFuelLogEvent({
        place: 'Sea',
        rawEvent: 'NOON',
        kind: 'noon',
      }),
    );
    expect(rate).toBe(1.2);
  });
});

describe('predictFuelVoyageEventFromPrevious', () => {
  it('fills totalMt / Hrs from elapsed hours × rate', () => {
    const prev = createEmptyFuelLogEvent({
      id: 'a',
      date: '2026-04-01',
      time: '12:00',
      place: 'Sea',
      rawEvent: 'BOSP',
      kind: 'start_sea',
      fmMeAe: 1000,
      density: 0.98,
      meRobTank: 'rmd',
      aeRobTank: 'rmd',
      boilerRobTank: 'dma',
    });
    const draft = createEmptyFuelLogEvent({
      id: 'b',
      date: '2026-04-01',
      time: '14:00',
      place: 'Sea',
      rawEvent: 'NOON',
      kind: 'noon',
    });
    const next = predictFuelVoyageEventFromPrevious(draft, prev, 0.98);
    expect(next.timeUsedHours).toBe(2);
    expect(next.totalMt).toBe(2.4); // 2h × 1.2
    expect(next.meMt).toBeCloseTo(1.6, 5);
    expect(next.aeMt).toBeCloseTo(0.8, 5);
    expect(next.density).toBe(0.98);
  });
});

describe('stampVoyageChain + applyVoyageChainTimeShift', () => {
  it('shifts later linked events by the same clock delta', () => {
    const a = createEmptyFuelLogEvent({
      id: 'dep',
      date: '2026-04-01',
      time: '12:06',
      place: 'Singapore',
      rawEvent: 'Departure',
      kind: 'departure',
    });
    const b = createEmptyFuelLogEvent({
      id: 'bosp',
      date: '2026-04-01',
      time: '13:00',
      place: 'Sea',
      rawEvent: 'BOSP',
      kind: 'start_sea',
    });
    const stamped = stampVoyageChain([a, b], 'chain-1', false);
    expect(stamped[0]!.voyageChainId).toBe('chain-1');
    expect(stamped[0]!.voyageChainIndex).toBe(0);
    expect(stamped[1]!.voyageChainIndex).toBe(1);

    const edited = stamped.map((e) =>
      e.id === 'dep' ? createEmptyFuelLogEvent({ ...e, time: '12:12' }) : e,
    );
    const next = applyVoyageChainTimeShift(edited, 'dep', '2026-04-01', '12:06', 0.98);
    const bosp = next.find((e) => e.id === 'bosp')!;
    expect(bosp.time).toBe('13:06');
    expect(bosp.voyageChainId).toBe('chain-1');
  });

  it('clearVoyageChainOnEvent drops link fields only', () => {
    const e = createEmptyFuelLogEvent({
      id: 'x',
      voyageChainId: 'c',
      voyageChainIndex: 2,
      voyageChainPredict: true,
      rawEvent: 'NOON',
    });
    const cleared = clearVoyageChainOnEvent(e);
    expect(cleared.voyageChainId).toBeNull();
    expect(cleared.voyageChainIndex).toBeNull();
    expect(cleared.voyageChainPredict).toBe(false);
    expect(cleared.rawEvent).toBe('NOON');
  });
});
