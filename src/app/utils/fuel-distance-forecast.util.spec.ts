import { describe, expect, it } from 'vitest';
import { createDefaultEtaPlan, createEtaLeg } from '../models/eta.models';
import {
  buildFuelDistanceLegsFromEtaPlan,
  computeFuelDistanceConsMt,
  computeFuelDistanceHours,
  defaultFoRateMtPerHour,
  foRobMtFromFuelEvent,
  projectFuelDistanceForecast,
} from './fuel-distance-forecast.util';

describe('fuel-distance-forecast.util', () => {
  it('matches Excel: hours = nm/kn, cons = hours × mt/h', () => {
    expect(computeFuelDistanceHours(120, 15)).toBe(8);
    expect(computeFuelDistanceConsMt(8, 1.2)).toBe(9.6);
    expect(computeFuelDistanceHours(52, 5)).toBe(10.4);
    expect(computeFuelDistanceConsMt(10.4, 0.3)).toBe(3.12);
  });

  it('picks canal vs sea rate from speed', () => {
    expect(defaultFoRateMtPerHour(5)).toBe(0.3);
    expect(defaultFoRateMtPerHour(6)).toBe(0.3);
    expect(defaultFoRateMtPerHour(15)).toBe(1.2);
  });

  it('cascades Est ROB like Fuel-Distance Calc.', () => {
    const summary = projectFuelDistanceForecast(
      [
        {
          id: '1',
          fromPort: 'Hamburg',
          toPort: 'Bremerhaven',
          distanceNm: 120,
          speedKnots: 15,
          rateMtPerHour: 1.2,
        },
        {
          id: '2',
          fromPort: 'Bremerhaven',
          toPort: 'Brunsbyttel',
          distanceNm: 83,
          speedKnots: 15,
          rateMtPerHour: 1.2,
        },
      ],
      145,
    );
    expect(summary.legs[0]!.hours).toBe(8);
    expect(summary.legs[0]!.consMt).toBe(9.6);
    expect(summary.legs[0]!.estRobMt).toBe(135.4);
    expect(summary.legs[1]!.consMt).toBe(6.64);
    expect(summary.endRobMt).toBe(128.76);
    expect(summary.totalConsMt).toBe(16.24);
  });

  it('builds legs from ETA plan with rate by speed', () => {
    const plan = createDefaultEtaPlan('Test');
    plan.fromPort = 'Hamburg';
    plan.toPort = 'Riga';
    plan.legs = [
      createEtaLeg({ id: 'a', distanceNm: 52, speedKnots: 5, toLabel: 'Holtenau' }),
      createEtaLeg({ id: 'b', distanceNm: 561, speedKnots: 15, toLabel: '' }),
    ];
    const legs = buildFuelDistanceLegsFromEtaPlan(plan);
    expect(legs).toHaveLength(2);
    expect(legs[0]).toMatchObject({
      fromPort: 'Hamburg',
      toPort: 'Holtenau',
      distanceNm: 52,
      speedKnots: 5,
      rateMtPerHour: 0.3,
    });
    expect(legs[1]).toMatchObject({
      fromPort: 'Holtenau',
      toPort: 'Riga',
      distanceNm: 561,
      speedKnots: 15,
      rateMtPerHour: 1.2,
    });
  });

  it('sums FO ROB from RMD + B100', () => {
    expect(foRobMtFromFuelEvent({ robRmdMt: 10, robB100Mt: 290 })).toBe(300);
    expect(foRobMtFromFuelEvent({ robRmdMt: null, robB100Mt: 291 })).toBe(291);
    expect(foRobMtFromFuelEvent(null)).toBeNull();
  });
});
