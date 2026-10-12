import type { EtaPlan } from '../models/eta.models';
import {
  classifyFuelEvent,
  createEmptyFuelLogEvent,
  findLatestFuelEvent,
  formatFuelHoursHm,
  type FuelEventKind,
  type FuelLogEvent,
} from '../models/fuel.models';
import { calculateEta, wallClockToUtcMs } from './eta-calculator.util';

export interface EtaFuelVoyagePoint {
  utcMs: number;
  place: string;
  rawEvent: string;
}

export interface EtaFuelVoyageBuildResult {
  points: EtaFuelVoyagePoint[];
  warnings: string[];
}

/** Existing Fuel Edit row shown as context above the proposed voyage. */
export interface EtaFuelVoyagePreviousRef {
  date: string;
  time: string;
  place: string;
  rawEvent: string;
  kind: FuelEventKind;
}

/** Editable preview row before committing ETA → Fuel Edit. */
export interface EtaFuelVoyagePreviewRow {
  key: string;
  date: string;
  time: string;
  place: string;
  rawEvent: string;
  kind: FuelEventKind;
  /** User can strike out — excluded rows are not added. */
  included: boolean;
  /** Chronologically before the previous Fuel Edit event (when included). */
  beforePrevious: boolean;
  /** Hours from previous context / previous included row (negative = before). */
  gapFromPrevHours: number | null;
  gapLabel: string;
}

export interface EtaFuelVoyagePreview {
  routeLabel: string;
  shipUtcOffsetHours: number;
  previousEvent: EtaFuelVoyagePreviousRef | null;
  rows: EtaFuelVoyagePreviewRow[];
  warnings: string[];
  hasTimeConflict: boolean;
}

/** Fuel log place for sea-passage / noon rows (not ETA waypoint labels). */
export const FUEL_VOYAGE_SEA_PLACE = 'Sea';

/**
 * Map ETA Fuel label → Fuel Place.
 * BOSP / EOSP / Noon → "Sea"; Arrival / Departure / Shifting → port name.
 * Do not reuse ETA waypoint labels (Pilot drop, …) as Fuel places.
 */
export function fuelPlaceForEtaEvent(rawEvent: string, portName: string): string {
  const kind = classifyFuelEvent(rawEvent);
  if (kind === 'start_sea' || kind === 'end_sea' || kind === 'noon') {
    return FUEL_VOYAGE_SEA_PLACE;
  }
  if (kind === 'arrival' || kind === 'departure' || kind === 'shifting') {
    return portName.trim();
  }
  return portName.trim() || FUEL_VOYAGE_SEA_PLACE;
}

/** Format UTC instant as ship-local ISO date (yyyy-MM-dd) + HH:mm. */
export function utcMsToShipDateTime(
  utcMs: number,
  shipUtcOffsetHours: number,
): { date: string; time: string } {
  const shifted = utcMs + shipUtcOffsetHours * 3_600_000;
  const d = new Date(shifted);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${min}` };
}

/**
 * Build ordered Fuel events from the open ETA draft:
 * departure (SBE…) → each leg TO with a Fuel label → Noon at every 12:00 Ship LT in between.
 */
export function buildEtaFuelVoyagePoints(
  plan: EtaPlan,
  shipUtcOffsetHours: number,
): EtaFuelVoyageBuildResult {
  const calc = calculateEta(plan);
  const warnings = [...calc.warnings];
  const points: EtaFuelVoyagePoint[] = [];

  if (calc.departureUtcMs == null) {
    warnings.push('Set departure date/time on the ETA plan first.');
    return { points, warnings };
  }

  const depEvent = (plan.departureFuelRawEvent ?? '').trim();
  if (depEvent) {
    points.push({
      utcMs: calc.departureUtcMs,
      place: fuelPlaceForEtaEvent(depEvent, plan.fromPort ?? ''),
      rawEvent: depEvent,
    });
  } else {
    warnings.push('Departure Fuel event is empty — skipped.');
  }

  for (let i = 0; i < plan.legs.length; i++) {
    const leg = plan.legs[i]!;
    const raw = (leg.fuelRawEvent ?? '').trim();
    if (!raw) continue;
    const legRes = calc.legs[i];
    const utcMs = legRes?.arrivalAtLegEndUtcMs ?? null;
    if (utcMs == null) {
      warnings.push(`Leg ${i + 1} has no ETA — skipped Fuel event “${raw}”.`);
      continue;
    }
    const portHint =
      i === plan.legs.length - 1
        ? (plan.toPort ?? '').trim() || (legRes?.toLabel ?? '').trim() || (leg.toLabel ?? '').trim()
        : (legRes?.toLabel ?? '').trim() || (leg.toLabel ?? '').trim() || (plan.toPort ?? '').trim();
    points.push({
      utcMs,
      place: fuelPlaceForEtaEvent(raw, portHint),
      rawEvent: raw,
    });
  }

  points.sort((a, b) => a.utcMs - b.utcMs || a.rawEvent.localeCompare(b.rawEvent));

  const withNoon = insertShipNoonPoints(points, shipUtcOffsetHours);
  if (!withNoon.length) {
    warnings.push('No Fuel events to add — set Fuel labels on departure and legs.');
  }
  return { points: withNoon, warnings };
}

/** Insert Noon at 12:00 Ship LT between consecutive waypoint events. */
export function insertShipNoonPoints(
  points: readonly EtaFuelVoyagePoint[],
  shipUtcOffsetHours: number,
): EtaFuelVoyagePoint[] {
  if (points.length < 2) return [...points];
  const out: EtaFuelVoyagePoint[] = [];
  for (let i = 0; i < points.length; i++) {
    const cur = points[i]!;
    if (i > 0) {
      const prev = points[i - 1]!;
      out.push(...shipNoonsBetween(prev.utcMs, cur.utcMs, shipUtcOffsetHours));
    }
    out.push(cur);
  }
  return out;
}

function shipNoonsBetween(
  fromUtcMs: number,
  toUtcMs: number,
  shipUtcOffsetHours: number,
): EtaFuelVoyagePoint[] {
  if (!(toUtcMs > fromUtcMs)) return [];
  const start = utcMsToShipDateTime(fromUtcMs, shipUtcOffsetHours);
  const end = utcMsToShipDateTime(toUtcMs, shipUtcOffsetHours);
  const out: EtaFuelVoyagePoint[] = [];

  let cursor = start.date;
  // Cap walk length (long voyages).
  for (let n = 0; n < 400; n++) {
    const noonUtc = wallClockToUtcMs(cursor, '12:00', shipUtcOffsetHours);
    if (noonUtc != null && noonUtc > fromUtcMs && noonUtc < toUtcMs) {
      out.push({
        utcMs: noonUtc,
        place: FUEL_VOYAGE_SEA_PLACE,
        rawEvent: 'Noon',
      });
    }
    if (cursor >= end.date) break;
    cursor = addIsoDays(cursor, 1);
  }
  return out;
}

function addIsoDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map((v) => parseInt(v, 10));
  const ms = Date.UTC(y!, m! - 1, d! + days);
  const dt = new Date(ms);
  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Turn voyage points into Fuel Edit draft rows (date/time in Ship LT). */
export function etaFuelVoyagePointsToEvents(
  points: readonly EtaFuelVoyagePoint[],
  shipUtcOffsetHours: number,
  preferredDensity: number | null,
): FuelLogEvent[] {
  const out: FuelLogEvent[] = [];
  for (const p of points) {
    const dt = utcMsToShipDateTime(p.utcMs, shipUtcOffsetHours);
    out.push(
      createEmptyFuelLogEvent({
        id: `fuel-eta-${p.utcMs}-${p.rawEvent.replace(/\W+/g, '_').toLowerCase()}`,
        date: dt.date,
        time: dt.time,
        place: p.place,
        rawEvent: p.rawEvent,
        kind: classifyFuelEvent(p.rawEvent),
        density: preferredDensity,
        writeStatus: 'draft',
        sourceRow: 0,
      }),
    );
  }
  return out;
}

function fuelDateTimeMs(date: string, time: string): number | null {
  if (!date) return null;
  const ms = Date.parse(`${date}T${(time || '00:00').padStart(5, '0')}:00`);
  return Number.isFinite(ms) ? ms : null;
}

function signedGapHours(
  fromDate: string,
  fromTime: string,
  toDate: string,
  toTime: string,
): number | null {
  const a = fuelDateTimeMs(fromDate, fromTime);
  const b = fuelDateTimeMs(toDate, toTime);
  if (a == null || b == null) return null;
  return Math.round(((b - a) / 3_600_000) * 10) / 10;
}

function formatSignedGap(hours: number | null): string {
  if (hours == null || !Number.isFinite(hours)) return '—';
  return formatFuelHoursHm(hours);
}

function normalizeRawEventKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Build an interactive preview of ETA → Fuel Edit rows against the current Edit log.
 * All proposed events are included by default (even if the same label already exists).
 * Time-before-previous is flagged.
 */
export function buildEtaFuelVoyagePreview(
  plan: EtaPlan,
  shipUtcOffsetHours: number,
  existingEditEvents: readonly FuelLogEvent[],
): EtaFuelVoyagePreview {
  const { points, warnings } = buildEtaFuelVoyagePoints(plan, shipUtcOffsetHours);
  const routeLabel =
    [plan.fromPort, plan.toPort].filter(Boolean).join(' → ') || plan.name || 'ETA voyage';
  const latest = findLatestFuelEvent(existingEditEvents);
  const previousEvent: EtaFuelVoyagePreviousRef | null = latest
    ? {
        date: latest.date,
        time: latest.time,
        place: latest.place,
        rawEvent: latest.rawEvent,
        kind: latest.kind,
      }
    : null;

  const draftRows: Array<Omit<EtaFuelVoyagePreviewRow, 'beforePrevious' | 'gapFromPrevHours' | 'gapLabel'>> =
    points.map((p, i) => {
      const dt = utcMsToShipDateTime(p.utcMs, shipUtcOffsetHours);
      return {
        key: `eta-${i}-${p.utcMs}-${normalizeRawEventKey(p.rawEvent).replace(/\W+/g, '_')}`,
        date: dt.date,
        time: dt.time,
        place: p.place,
        rawEvent: p.rawEvent,
        kind: classifyFuelEvent(p.rawEvent),
        included: true,
      };
    });

  const rows = annotateEtaFuelVoyagePreviewRows(draftRows, previousEvent);
  return {
    routeLabel,
    shipUtcOffsetHours,
    previousEvent,
    rows,
    warnings,
    hasTimeConflict: rows.some((r) => r.included && r.beforePrevious),
  };
}

/** Recompute gaps / before-previous after the user toggles or edits rows. */
export function annotateEtaFuelVoyagePreviewRows(
  rows: readonly Omit<EtaFuelVoyagePreviewRow, 'beforePrevious' | 'gapFromPrevHours' | 'gapLabel'>[],
  previousEvent: EtaFuelVoyagePreviousRef | null,
): EtaFuelVoyagePreviewRow[] {
  const existingPrevMs =
    previousEvent != null ? fuelDateTimeMs(previousEvent.date, previousEvent.time) : null;

  return rows.map((row, i) => {
    const prevRow = i > 0 ? rows[i - 1]! : null;
    const fromDate = prevRow?.date ?? previousEvent?.date ?? '';
    const fromTime = prevRow?.time ?? previousEvent?.time ?? '';
    const gapFromPrevHours =
      fromDate && row.date ? signedGapHours(fromDate, fromTime, row.date, row.time) : null;
    const rowMs = fuelDateTimeMs(row.date, row.time);
    const beforePrevious =
      row.included && existingPrevMs != null && rowMs != null && rowMs < existingPrevMs;
    return {
      ...row,
      beforePrevious,
      gapFromPrevHours,
      gapLabel: formatSignedGap(gapFromPrevHours),
    };
  });
}

/** Shift all included rows so the first included starts just after the previous Fuel event. */
export function shiftEtaFuelVoyagePreviewAfterPrevious(
  rows: readonly EtaFuelVoyagePreviewRow[],
  previousEvent: EtaFuelVoyagePreviousRef | null,
  minutesAfter = 1,
): EtaFuelVoyagePreviewRow[] {
  if (!previousEvent) return rows.map((r) => ({ ...r }));
  const prevMs = fuelDateTimeMs(previousEvent.date, previousEvent.time);
  if (prevMs == null) return rows.map((r) => ({ ...r }));

  const firstIncluded = rows.find((r) => r.included);
  if (!firstIncluded) return rows.map((r) => ({ ...r }));
  const firstMs = fuelDateTimeMs(firstIncluded.date, firstIncluded.time);
  if (firstMs == null) return rows.map((r) => ({ ...r }));

  const targetFirst = prevMs + minutesAfter * 60_000;
  const delta = targetFirst - firstMs;
  if (delta <= 0) return rows.map((r) => ({ ...r }));

  return rows.map((r) => {
    if (!r.included) return { ...r };
    const ms = fuelDateTimeMs(r.date, r.time);
    if (ms == null) return { ...r };
    const next = new Date(ms + delta);
    const yyyy = next.getFullYear();
    const mm = String(next.getMonth() + 1).padStart(2, '0');
    const dd = String(next.getDate()).padStart(2, '0');
    const hh = String(next.getHours()).padStart(2, '0');
    const min = String(next.getMinutes()).padStart(2, '0');
    return { ...r, date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${min}` };
  });
}

/** Commit only included preview rows as Fuel Edit drafts. */
export function etaFuelVoyagePreviewRowsToEvents(
  rows: readonly EtaFuelVoyagePreviewRow[],
  preferredDensity: number | null,
): FuelLogEvent[] {
  const included = rows.filter((r) => r.included);
  const sorted = [...included].sort((a, b) => {
    const am = fuelDateTimeMs(a.date, a.time) ?? 0;
    const bm = fuelDateTimeMs(b.date, b.time) ?? 0;
    return am - bm || a.rawEvent.localeCompare(b.rawEvent);
  });
  return sorted.map((r, i) =>
    createEmptyFuelLogEvent({
      id: `fuel-eta-${Date.now()}-${i}-${r.rawEvent.replace(/\W+/g, '_').toLowerCase()}`,
      date: r.date,
      time: r.time,
      place: r.place,
      rawEvent: r.rawEvent,
      kind: classifyFuelEvent(r.rawEvent),
      density: preferredDensity,
      writeStatus: 'draft',
      sourceRow: 0,
    }),
  );
}
