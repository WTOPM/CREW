import { describe, expect, it } from 'vitest';
import {
  createDefaultEtaPlan,
  createEtaLeg,
  legEtaUtcOffsetRange,
  stepLegEtaUtcOffsetHours,
} from '../models/eta.models';
import {
  calculateEta,
  distanceNmFromSpeed,
  formatDurationHours,
  formatEtaWallClock,
  formatUtcOffsetLabel,
  voyageHours,
  wallClockToUtcMs,
} from './eta-calculator.util';

describe('eta-calculator.util', () => {
  it('builds inclusive hour range between port offsets', () => {
    expect(legEtaUtcOffsetRange(-1, 2)).toEqual([-1, 0, 1, 2]);
    expect(legEtaUtcOffsetRange(2, -1)).toEqual([-1, 0, 1, 2]);
    expect(stepLegEtaUtcOffsetHours(-1, -1, 2, 1)).toBe(0);
    expect(stepLegEtaUtcOffsetHours(0, -1, 2, 1)).toBe(1);
    expect(stepLegEtaUtcOffsetHours(2, -1, 2, 1)).toBe(2);
    expect(stepLegEtaUtcOffsetHours(1, -1, 2, -1)).toBe(0);
  });
  it('distance = speed × time (10 kn × 3 h = 30 NM)', () => {
    expect(distanceNmFromSpeed(10, 3)).toBe(30);
  });

  it('time = distance / speed (45 NM / 9 kn = 5 h)', () => {
    expect(voyageHours(45, 9)).toBe(5);
    expect(formatDurationHours(voyageHours(45, 9)!)).toBe('5h');
  });

  it('planEta: 45 NM at 9 kn from 08:00 → arrival 13:00', () => {
    const plan = createDefaultEtaPlan('Example');
    plan.scenario = 'planEta';
    plan.departureDate = '2026-06-01';
    plan.departureTime = '08:00';
    plan.legs = [createEtaLeg({ distanceNm: 45, speedKnots: 9 })];

    const result = calculateEta(plan);
    expect(result.totalHours).toBe(5);
    expect(result.arrivalLabel).toContain('13:00');
    expect(result.arrivalLabel).toContain('01.06.2026');
  });

  it('formatDurationHours formats hours and minutes', () => {
    expect(formatDurationHours(12.5)).toBe('12h 30m');
    expect(formatDurationHours(2)).toBe('2h');
    expect(formatDurationHours(0.5)).toBe('30m');
  });

  it('formatUtcOffsetLabel formats signed offsets', () => {
    expect(formatUtcOffsetLabel(0)).toBe('UTC');
    expect(formatUtcOffsetLabel(2)).toBe('UTC+2');
    expect(formatUtcOffsetLabel(-1)).toBe('UTC−1');
  });

  it('planEta: departure + distance + speed → arrival', () => {
    const plan = createDefaultEtaPlan('Test');
    plan.scenario = 'planEta';
    plan.fromPort = 'A';
    plan.toPort = 'B';
    plan.departureDate = '2026-06-01';
    plan.departureTime = '00:00';
    plan.legs = [
      createEtaLeg({ distanceNm: 150, speedKnots: 12.5, toLabel: 'Waypoint' }),
      createEtaLeg({ distanceNm: 350, speedKnots: 15 }),
    ];

    const result = calculateEta(plan);
    expect(result.totalDistanceNm).toBe(500);
    expect(result.totalHours).toBeCloseTo(150 / 12.5 + 350 / 15, 5);
    expect(result.departureUtcMs).toBe(wallClockToUtcMs('2026-06-01', '00:00', 0));
    expect(result.arrivalUtcMs).toBe(result.departureUtcMs! + result.totalHours * 3_600_000);
    expect(result.legs).toHaveLength(2);
    expect(result.legs[0]?.durationHours).toBeCloseTo(12, 1);
  });

  it('meetEtaBySpeed: arrival + distance + speed → departure', () => {
    const plan = createDefaultEtaPlan('Test');
    plan.scenario = 'meetEtaBySpeed';
    plan.arrivalDate = '2026-06-10';
    plan.arrivalTime = '12:00';
    plan.legs = [createEtaLeg({ distanceNm: 300, speedKnots: 15 })];

    const result = calculateEta(plan);
    expect(result.arrivalUtcMs).toBe(wallClockToUtcMs('2026-06-10', '12:00', 0));
    expect(result.departureUtcMs).toBe(result.arrivalUtcMs! - 20 * 3_600_000);
    expect(result.totalHours).toBe(20);
  });

  it('meetEtaByDeparture: arrival + departure + distance → required speed', () => {
    const plan = createDefaultEtaPlan('Test');
    plan.scenario = 'meetEtaByDeparture';
    plan.departureDate = '2026-06-01';
    plan.departureTime = '00:00';
    plan.arrivalDate = '2026-06-02';
    plan.arrivalTime = '00:00';
    plan.legs = [createEtaLeg({ distanceNm: 240, speedKnots: 0 })];

    const result = calculateEta(plan);
    expect(result.requiredSpeedKnots).toBe(10);
    expect(result.totalHours).toBe(24);
    expect(result.legs[0]?.effectiveSpeedKnots).toBe(10);
  });

  it('applies different departure and arrival UTC offsets', () => {
    const plan = createDefaultEtaPlan('TZ');
    plan.scenario = 'planEta';
    plan.departureDate = '2026-06-01';
    plan.departureTime = '12:00';
    plan.departureUtcOffsetHours = 2;
    plan.arrivalUtcOffsetHours = 1;
    plan.legs = [createEtaLeg({ distanceNm: 300, speedKnots: 15 })];

    const result = calculateEta(plan);
    expect(result.departureUtcMs).toBe(wallClockToUtcMs('2026-06-01', '12:00', 2));
    expect(result.departureLabel).toBe(formatEtaWallClock(result.departureUtcMs, 2));
    expect(result.arrivalLabel).toBe(formatEtaWallClock(result.arrivalUtcMs, 1));
    expect(result.arrivalLabel).toContain('UTC+1');
    expect(result.departureLabel).toContain('UTC+2');
  });

  it('uses per-leg etaUtcOffsetHours for intermediate ETA display', () => {
    const plan = createDefaultEtaPlan('TZ legs');
    plan.scenario = 'planEta';
    plan.departureDate = '2026-06-01';
    plan.departureTime = '12:00';
    plan.departureUtcOffsetHours = -1;
    plan.arrivalUtcOffsetHours = 2;
    plan.legs = [
      createEtaLeg({ distanceNm: 150, speedKnots: 15, toLabel: 'WP', etaUtcOffsetHours: 0 }),
      createEtaLeg({ distanceNm: 150, speedKnots: 15, etaUtcOffsetHours: 1 }),
    ];

    const result = calculateEta(plan);
    expect(result.legs[0]?.arrivalAtLegEndShortLabel).toContain('UTC');
    expect(result.legs[1]?.arrivalAtLegEndShortLabel).toContain('+1');
  });
});
