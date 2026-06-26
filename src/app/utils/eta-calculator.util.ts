import type { EtaLeg, EtaPlan, EtaScenario } from '../models/eta.models';

export interface EtaLegResult {
  legIndex: number;
  fromLabel: string;
  toLabel: string;
  distanceNm: number;
  speedKnots: number;
  effectiveSpeedKnots: number | null;
  durationHours: number;
  durationLabel: string;
  arrivalAtLegEndUtcMs: number | null;
  arrivalAtLegEndLabel: string;
  arrivalAtLegEndShortLabel: string;
  cumulativeHours: number;
}

export interface EtaCalculation {
  scenario: EtaScenario;
  routePoints: string[];
  legs: EtaLegResult[];
  totalDistanceNm: number;
  totalHours: number;
  totalDurationLabel: string;
  requiredSpeedKnots: number | null;
  departureUtcMs: number | null;
  arrivalUtcMs: number | null;
  departureLabel: string;
  arrivalLabel: string;
  valid: boolean;
  warnings: string[];
}

export function formatDurationHours(hours: number): string {
  const parts = durationPartsFromHours(hours);
  if (parts.empty) return '—';
  const chunks: string[] = [];
  if (parts.hours != null) chunks.push(`${parts.hours}h`);
  if (parts.minutes != null) chunks.push(`${parts.minutes}m`);
  return chunks.join(' ');
}

export interface DurationParts {
  hours: number | null;
  minutes: number | null;
  empty: boolean;
}

export function durationPartsFromHours(hours: number): DurationParts {
  if (!isFinite(hours) || hours <= 0) return { hours: null, minutes: null, empty: true };
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return {
    hours: h > 0 ? h : null,
    minutes: m > 0 ? m : null,
    empty: false,
  };
}

export interface EtaLegEndParts {
  dateTime: string;
  tz: string;
  empty: boolean;
}

export function etaLegEndParts(utcMs: number | null, utcOffsetHours: number): EtaLegEndParts {
  if (utcMs == null) return { dateTime: '—', tz: '', empty: true };
  const shifted = utcMs + utcOffsetHours * 3_600_000;
  const d = new Date(shifted);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yy = String(d.getUTCFullYear()).slice(-2);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  const tz =
    !utcOffsetHours || utcOffsetHours === 0
      ? 'UTC'
      : utcOffsetHours > 0
        ? `+${utcOffsetHours}`
        : String(utcOffsetHours);
  return { dateTime: `${dd}.${mm}.${yy} ${hh}:${min}`, tz, empty: false };
}

export function formatUtcOffsetLabel(hours: number): string {
  if (!isFinite(hours) || hours === 0) return 'UTC';
  const sign = hours > 0 ? '+' : '−';
  const abs = Math.abs(hours);
  const value = Number.isInteger(abs) ? String(abs) : abs.toFixed(1);
  return `UTC${sign}${value}`;
}

export interface EtaWallClockParts {
  date: string;
  time: string;
  tz: string;
  empty: boolean;
}

export function etaWallClockParts(utcMs: number | null, utcOffsetHours: number): EtaWallClockParts {
  if (utcMs == null) return { date: '—', time: '', tz: '', empty: true };
  const shifted = utcMs + utcOffsetHours * 3_600_000;
  const d = new Date(shifted);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  return {
    date: `${dd}.${mm}.${yyyy}`,
    time: `${hh}:${min}`,
    tz: formatUtcOffsetLabel(utcOffsetHours),
    empty: false,
  };
}

export function formatEtaWallClock(utcMs: number | null, utcOffsetHours: number): string {
  const parts = etaWallClockParts(utcMs, utcOffsetHours);
  if (parts.empty) return '—';
  return `${parts.date} ${parts.time} LT (${parts.tz})`;
}

/** Compact ETA for table cells (dd.mm.yy hh:mm +offset). */
export function formatEtaLegEnd(utcMs: number | null, utcOffsetHours: number): string {
  const parts = etaLegEndParts(utcMs, utcOffsetHours);
  if (parts.empty) return '—';
  return `${parts.dateTime} ${parts.tz}`;
}

export function wallClockToUtcMs(dateIso: string, timeHm: string, utcOffsetHours: number): number | null {
  if (!dateIso || !/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return null;
  const [y, mo, d] = dateIso.split('-').map((v) => parseInt(v, 10));
  const [hh = 0, mm = 0] = (timeHm || '00:00').split(':').map((v) => parseInt(v, 10));
  if ([y, mo, d, hh, mm].some((n) => !isFinite(n))) return null;
  const ms = Date.UTC(y, mo - 1, d, hh, mm, 0, 0) - utcOffsetHours * 3_600_000;
  return isFinite(ms) ? ms : null;
}

export function routePointsFromPlan(plan: Pick<EtaPlan, 'fromPort' | 'toPort' | 'legs'>): string[] {
  const points: string[] = [];
  const from = plan.fromPort.trim();
  const to = plan.toPort.trim();
  const legs = plan.legs ?? [];
  if (from) points.push(from);
  for (let i = 0; i < legs.length - 1; i++) {
    const label = (legs[i]?.toLabel ?? '').trim();
    if (label) points.push(label);
  }
  if (to && to !== points[points.length - 1]) points.push(to);
  return points;
}

function legLabels(
  legIndex: number,
  legCount: number,
  fromPort: string,
  toPort: string,
  legs: EtaLeg[],
): { from: string; to: string } {
  const from =
    legIndex === 0
      ? fromPort.trim() || '—'
      : (legs[legIndex - 1]?.toLabel ?? '').trim() || '—';
  const to =
    legIndex === legCount - 1
      ? toPort.trim() || '—'
      : (legs[legIndex]?.toLabel ?? '').trim() || '—';
  return { from, to };
}

/** Distance (NM) = speed (kn) × time (h). */
export function distanceNmFromSpeed(speedKnots: number, hours: number): number | null {
  if (!isFinite(speedKnots) || speedKnots <= 0 || !isFinite(hours) || hours < 0) return null;
  return speedKnots * hours;
}

/** Voyage time (h) = distance (NM) / speed (kn). */
export function voyageHours(distanceNm: number, speedKnots: number): number | null {
  if (!isFinite(distanceNm) || distanceNm <= 0 || !isFinite(speedKnots) || speedKnots <= 0) return null;
  return distanceNm / speedKnots;
}

/** Required speed (kn) = distance (NM) / available time (h). */
export function computeRequiredSpeedKnots(distanceNm: number, hours: number): number | null {
  if (!isFinite(distanceNm) || distanceNm <= 0 || !isFinite(hours) || hours <= 0) return null;
  return distanceNm / hours;
}

function legDurationFromInputs(leg: EtaLeg): number | null {
  return voyageHours(leg.distanceNm, leg.speedKnots);
}

export function calculateEta(plan: EtaPlan): EtaCalculation {
  const warnings: string[] = [];
  const routePoints = routePointsFromPlan(plan);
  const legs = plan.legs ?? [];
  const depOffset = plan.departureUtcOffsetHours ?? 0;
  const arrOffset = plan.arrivalUtcOffsetHours ?? 0;
  const scenario = plan.scenario ?? 'planEta';
  const totalDistanceNm = legs.reduce((sum, leg) => sum + (leg.distanceNm > 0 ? leg.distanceNm : 0), 0);

  if (routePoints.length >= 2 && legs.length > 0 && routePoints.length !== legs.length + 1) {
    warnings.push(
      `Route has ${routePoints.length} points but ${legs.length} leg(s) — name each intermediate leg or check ports.`,
    );
  }

  const missingIntermediate = legs.slice(0, -1).some((leg) => !(leg.toLabel ?? '').trim());
  if (legs.length > 1 && missingIntermediate) {
    warnings.push('Enter a name for each intermediate leg end point.');
  }

  if (totalDistanceNm <= 0 && legs.length > 0) {
    warnings.push('Enter distance (NM) for each leg.');
  }

  let departureUtcMs = wallClockToUtcMs(plan.departureDate, plan.departureTime, depOffset);
  let arrivalUtcMs = wallClockToUtcMs(plan.arrivalDate, plan.arrivalTime, arrOffset);
  let totalHours = 0;
  let requiredSpeedKnots: number | null = null;
  let legDurations: (number | null)[] = [];
  let legSpeeds: (number | null)[] = [];

  if (scenario === 'planEta') {
    if (!departureUtcMs) {
      warnings.push('Enter departure date and time.');
    }
    legDurations = legs.map(legDurationFromInputs);
    if (legDurations.some((h) => h == null) && legs.length > 0) {
      warnings.push('Enter speed (kn) for each leg.');
    }
    totalHours = legDurations.reduce<number>((sum, h) => sum + (h ?? 0), 0);
    legSpeeds = legs.map((leg) => (leg.speedKnots > 0 ? leg.speedKnots : null));
    if (departureUtcMs != null && legDurations.every((h) => h != null)) {
      arrivalUtcMs = departureUtcMs + totalHours * 3_600_000;
    }
  } else if (scenario === 'meetEtaBySpeed') {
    if (!arrivalUtcMs) {
      warnings.push('Enter target arrival date and time.');
    }
    legDurations = legs.map(legDurationFromInputs);
    if (legDurations.some((h) => h == null) && legs.length > 0) {
      warnings.push('Enter speed (kn) for each leg.');
    }
    totalHours = legDurations.reduce<number>((sum, h) => sum + (h ?? 0), 0);
    legSpeeds = legs.map((leg) => (leg.speedKnots > 0 ? leg.speedKnots : null));
    if (arrivalUtcMs != null && legDurations.every((h) => h != null)) {
      departureUtcMs = arrivalUtcMs - totalHours * 3_600_000;
    }
  } else {
    if (!arrivalUtcMs) {
      warnings.push('Enter target arrival date and time.');
    }
    if (!departureUtcMs) {
      warnings.push('Enter departure date and time.');
    }
    if (departureUtcMs != null && arrivalUtcMs != null) {
      totalHours = (arrivalUtcMs - departureUtcMs) / 3_600_000;
      if (totalHours <= 0) {
        warnings.push('Arrival must be after departure.');
        totalHours = 0;
      } else if (totalDistanceNm > 0) {
        requiredSpeedKnots = computeRequiredSpeedKnots(totalDistanceNm, totalHours);
        legDurations = legs.map((leg) =>
          leg.distanceNm > 0 && requiredSpeedKnots != null
            ? voyageHours(leg.distanceNm, requiredSpeedKnots)
            : null,
        );
        legSpeeds = legs.map((leg) => (leg.distanceNm > 0 ? requiredSpeedKnots : null));
      }
    }
  }

  let cursorUtcMs: number | null = departureUtcMs;
  const legResults: EtaLegResult[] = legs.map((leg, index) => {
    const hours = legDurations[index] ?? 0;
    const labels = legLabels(index, legs.length, plan.fromPort, plan.toPort, legs);
    let arrivalAtLegEndUtcMs: number | null = null;
    if (cursorUtcMs != null && hours > 0) {
      arrivalAtLegEndUtcMs = cursorUtcMs + hours * 3_600_000;
      cursorUtcMs = arrivalAtLegEndUtcMs;
    }
    const cumulativeHours = legDurations
      .slice(0, index + 1)
      .reduce<number>((sum, h) => sum + (h ?? 0), 0);
    const legEndOffset = index === legs.length - 1 ? arrOffset : depOffset;
    const effectiveSpeed = legSpeeds[index] ?? null;

    return {
      legIndex: index,
      fromLabel: labels.from,
      toLabel: labels.to,
      distanceNm: leg.distanceNm,
      speedKnots: leg.speedKnots,
      effectiveSpeedKnots: effectiveSpeed,
      durationHours: hours,
      durationLabel: hours > 0 ? formatDurationHours(hours) : '—',
      arrivalAtLegEndUtcMs,
      arrivalAtLegEndLabel: formatEtaWallClock(arrivalAtLegEndUtcMs, legEndOffset),
      arrivalAtLegEndShortLabel: formatEtaLegEnd(arrivalAtLegEndUtcMs, legEndOffset),
      cumulativeHours,
    };
  });

  const allLegsValid =
    legs.length > 0 &&
    legDurations.length === legs.length &&
    legDurations.every((h) => h != null && h > 0);

  const valid =
    allLegsValid &&
    departureUtcMs != null &&
    arrivalUtcMs != null &&
    (scenario !== 'meetEtaByDeparture' || requiredSpeedKnots != null);

  return {
    scenario,
    routePoints,
    legs: legResults,
    totalDistanceNm,
    totalHours,
    totalDurationLabel: totalHours > 0 ? formatDurationHours(totalHours) : '—',
    requiredSpeedKnots,
    departureUtcMs,
    arrivalUtcMs,
    departureLabel: formatEtaWallClock(departureUtcMs, depOffset),
    arrivalLabel: formatEtaWallClock(arrivalUtcMs, arrOffset),
    valid,
    warnings,
  };
}

export function scenarioLabel(scenario: EtaScenario): string {
  switch (scenario) {
    case 'planEta':
      return 'Plan ETA from departure';
    case 'meetEtaByDeparture':
      return 'Required speed for target arrival';
    case 'meetEtaBySpeed':
      return 'Required departure for target arrival';
  }
}

export function scenarioTooltip(scenario: EtaScenario): string {
  switch (scenario) {
    case 'planEta':
      return 'Departure + NM + kn → arrival';
    case 'meetEtaByDeparture':
      return 'Arrival + departure + NM → kn';
    case 'meetEtaBySpeed':
      return 'Arrival + NM + kn → departure';
  }
}

export function scenarioHint(scenario: EtaScenario): string {
  switch (scenario) {
    case 'planEta':
      return 'Fill departure, distance and speed — arrival is calculated.';
    case 'meetEtaByDeparture':
      return 'Fill target arrival, departure and distance — required speed is calculated.';
    case 'meetEtaBySpeed':
      return 'Fill target arrival, distance and speed — departure is calculated.';
  }
}

/** Short hover tips for ETA page fields (shown via TitleTooltipService). */
export const ETA_FIELD_TOOLTIPS = {
  newPlan: 'Start a new voyage',
  fromPort: 'Departure port',
  toPort: 'Destination port',
  departureUtc: 'UTC offset at departure. ↑↓ ±1 h, Enter to confirm',
  arrivalUtc: 'UTC offset at arrival. ↑↓ ±1 h, Enter to confirm',
  routeDepBlock: 'Departure side: port and local UTC offset',
  routeArrBlock: 'Arrival side: port and local UTC offset',
  departureDate: 'Departure date (local time)',
  departureTime: 'Departure time (local time)',
  arrivalDate: 'Arrival date (local time)',
  arrivalTime: 'Arrival time (local time)',
  utcBadge: 'Offset from UTC for local time',
  legWaypoint: 'Name intermediate point on this leg',
  legDistance: 'Distance in nautical miles (NM)',
  legSpeed: 'Speed in knots (kn)',
  legDuration: 'Leg duration: distance ÷ speed',
  legEta: 'ETA at end of leg (local time)',
  addLeg: 'Add another distance / speed segment',
} as const;
