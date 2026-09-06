import type { ShipInfo } from '../models/crew.models';

export type VoyageDateMode = 'arrival' | 'departure';

type ShipVoyageDates = Pick<ShipInfo, 'dateOfArrival' | 'dateOfDeparture'>;

/** ISO date for the chosen voyage side — never falls back to the other side. */
export function voyageDateForMode(
  ship: ShipVoyageDates | null | undefined,
  mode: VoyageDateMode,
): string {
  if (!ship) return '';
  const raw = mode === 'arrival' ? ship.dateOfArrival : ship.dateOfDeparture;
  return String(raw ?? '').trim();
}

/** Arrival / departure docs: pick by flag; empty if that side has no date. */
export function voyageDateByArrivalFlag(
  ship: ShipVoyageDates | null | undefined,
  isArrival: boolean,
): string {
  return voyageDateForMode(ship, isArrival ? 'arrival' : 'departure');
}

/**
 * Arrival-oriented documents (Port of Call, MDH, NIL, vaccine, money lists, …).
 * Use arrival only — do not silently substitute departure.
 */
export function arrivalVoyageDate(ship: ShipVoyageDates | null | undefined): string {
  return voyageDateForMode(ship, 'arrival');
}
