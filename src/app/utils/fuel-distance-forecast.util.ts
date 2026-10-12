import type { EtaPlan } from '../models/eta.models';
import type { FuelLogEvent } from '../models/fuel.models';
import { voyageHours } from './eta-calculator.util';

/**
 * FO-VPC "Fuel-Distance Calc." principle:
 *   ME R/H = Distance nm / Speed kn
 *   Cons. mt/trip = ME R/H × FO Consum. (mt/h)
 *   Est. ROB = previous ROB − Cons
 *
 * Excel sample rates: ~1.2 mt/h at 15 kn (sea), ~0.3 mt/h at 5 kn (canal).
 */

export type FuelDistanceRateBand = {
  /** Inclusive upper speed for this band; use Infinity for the last band. */
  maxSpeedKn: number;
  rateMtPerHour: number;
  label: string;
};

/** Defaults taken from the ship's FO-VPC Fuel-Distance Calc. sheet. */
export const DEFAULT_FUEL_DISTANCE_RATE_BANDS: readonly FuelDistanceRateBand[] = [
  { maxSpeedKn: 6, rateMtPerHour: 0.3, label: 'Canal / slow (≤6 kn)' },
  { maxSpeedKn: Number.POSITIVE_INFINITY, rateMtPerHour: 1.2, label: 'Sea (>6 kn)' },
];

export type FuelDistanceForecastLeg = {
  id: string;
  fromPort: string;
  toPort: string;
  distanceNm: number;
  speedKnots: number;
  /** FO consumption rate mt/h (editable). */
  rateMtPerHour: number;
};

export type FuelDistanceForecastLegResult = FuelDistanceForecastLeg & {
  hours: number | null;
  consMt: number | null;
  estRobMt: number | null;
};

export type FuelDistanceForecastSummary = {
  legs: FuelDistanceForecastLegResult[];
  totalDistanceNm: number;
  totalHours: number | null;
  totalConsMt: number | null;
  startRobMt: number | null;
  endRobMt: number | null;
};

export function roundFuelDistanceMt(n: number): number {
  return Math.round(n * 100) / 100;
}

export function roundFuelDistanceHours(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Pick mt/h from speed using Excel-style bands. */
export function defaultFoRateMtPerHour(
  speedKnots: number,
  bands: readonly FuelDistanceRateBand[] = DEFAULT_FUEL_DISTANCE_RATE_BANDS,
): number {
  if (!Number.isFinite(speedKnots) || speedKnots < 0) {
    return bands[bands.length - 1]?.rateMtPerHour ?? 1.2;
  }
  for (const band of bands) {
    if (speedKnots <= band.maxSpeedKn) return band.rateMtPerHour;
  }
  return bands[bands.length - 1]?.rateMtPerHour ?? 1.2;
}

/** Excel H = E/F. */
export function computeFuelDistanceHours(
  distanceNm: number,
  speedKnots: number,
): number | null {
  const h = voyageHours(distanceNm, speedKnots);
  return h == null ? null : roundFuelDistanceHours(h);
}

/** Excel I = H × G. */
export function computeFuelDistanceConsMt(
  hours: number | null,
  rateMtPerHour: number,
): number | null {
  if (hours == null || !Number.isFinite(hours) || hours < 0) return null;
  if (!Number.isFinite(rateMtPerHour) || rateMtPerHour < 0) return null;
  return roundFuelDistanceMt(hours * rateMtPerHour);
}

/** FO ROB ≈ ROB RMD + ROB B100 (Excel “FO ROB”, DMA tracked separately). */
export function foRobMtFromFuelEvent(
  e: Pick<FuelLogEvent, 'robRmdMt' | 'robB100Mt'> | null | undefined,
): number | null {
  if (!e) return null;
  const parts = [e.robRmdMt, e.robB100Mt].filter(
    (v): v is number => v != null && Number.isFinite(v),
  );
  if (!parts.length) return null;
  return roundFuelDistanceMt(parts.reduce((a, b) => a + b, 0));
}

export function projectFuelDistanceForecast(
  legs: readonly FuelDistanceForecastLeg[],
  startRobMt: number | null,
): FuelDistanceForecastSummary {
  let running = startRobMt != null && Number.isFinite(startRobMt) ? startRobMt : null;
  let totalDistanceNm = 0;
  let totalHours = 0;
  let anyHours = false;
  let totalConsMt = 0;
  let anyCons = false;

  const out: FuelDistanceForecastLegResult[] = legs.map((leg) => {
    const nm = Number.isFinite(leg.distanceNm) && leg.distanceNm > 0 ? leg.distanceNm : 0;
    totalDistanceNm += nm;
    const hours = computeFuelDistanceHours(leg.distanceNm, leg.speedKnots);
    const consMt = computeFuelDistanceConsMt(hours, leg.rateMtPerHour);
    if (hours != null) {
      totalHours += hours;
      anyHours = true;
    }
    if (consMt != null) {
      totalConsMt += consMt;
      anyCons = true;
      if (running != null) running = roundFuelDistanceMt(running - consMt);
    }
    return {
      ...leg,
      hours,
      consMt,
      estRobMt: running,
    };
  });

  return {
    legs: out,
    totalDistanceNm: roundFuelDistanceMt(totalDistanceNm),
    totalHours: anyHours ? roundFuelDistanceHours(totalHours) : null,
    totalConsMt: anyCons ? roundFuelDistanceMt(totalConsMt) : null,
    startRobMt: startRobMt != null && Number.isFinite(startRobMt) ? startRobMt : null,
    endRobMt: running,
  };
}

/** Build forecast legs from the ETA draft/plan (nm + kn → hours; rate from speed band). */
export function buildFuelDistanceLegsFromEtaPlan(
  plan: Pick<EtaPlan, 'fromPort' | 'toPort' | 'legs'>,
  bands: readonly FuelDistanceRateBand[] = DEFAULT_FUEL_DISTANCE_RATE_BANDS,
): FuelDistanceForecastLeg[] {
  const legs = plan.legs ?? [];
  return legs.map((leg, i) => {
    const from =
      i === 0
        ? (plan.fromPort ?? '').trim() || '—'
        : (legs[i - 1]?.toLabel ?? '').trim() || '—';
    const to =
      i === legs.length - 1
        ? (plan.toPort ?? '').trim() || (leg.toLabel ?? '').trim() || '—'
        : (leg.toLabel ?? '').trim() || '—';
    const distanceNm = Number.isFinite(leg.distanceNm) ? Math.max(0, leg.distanceNm) : 0;
    const speedKnots = Number.isFinite(leg.speedKnots) ? Math.max(0, leg.speedKnots) : 0;
    return {
      id: leg.id || `fd-leg-${i}`,
      fromPort: from,
      toPort: to,
      distanceNm,
      speedKnots,
      rateMtPerHour: defaultFoRateMtPerHour(speedKnots, bands),
    };
  });
}

export function createEmptyFuelDistanceLeg(
  partial: Partial<FuelDistanceForecastLeg> = {},
): FuelDistanceForecastLeg {
  const speedKnots = partial.speedKnots ?? 15;
  return {
    id: partial.id ?? `fd-new-${Date.now()}`,
    fromPort: partial.fromPort ?? '',
    toPort: partial.toPort ?? '',
    distanceNm: partial.distanceNm ?? 0,
    speedKnots,
    rateMtPerHour: partial.rateMtPerHour ?? defaultFoRateMtPerHour(speedKnots),
  };
}
