import { AppData, CrewMember, createEmptyCrewMember, filterActiveCrewListFromData } from '../models/crew.models';
import {
  filterActivePassengerListFromData,
  PASSENGER_RANK,
  PassengerMember,
} from '../models/passenger.models';

/** Map passenger to crew-list row shape for the shared IMO FAL Form 5 PDF. */
export function passengersToCrewRows(passengers: PassengerMember[]): CrewMember[] {
  return passengers.map((p) => ({
    ...createEmptyCrewMember(),
    id: p.id,
    familyName: p.familyName,
    givenNames: p.givenNames,
    rank: PASSENGER_RANK,
    gender: p.gender,
    nationality: p.nationality,
    dateOfBirth: p.dateOfBirth,
    placeOfBirth: p.placeOfBirth,
    passport: p.passport,
    passportIssueDate: p.passportIssueDate,
    passportExpiryDate: p.passportExpiryDate,
    archived: p.archived,
    onArrivalList: p.onArrivalList,
    onDepartureList: p.onDepartureList,
  }));
}

/** Crew Effect rows: arrival crew first, then passengers when enabled. */
export function crewEffectListRows(
  data: AppData,
  appendPassengers: boolean,
  maxRows: number,
): CrewMember[] {
  const crew = filterActiveCrewListFromData(data, 'arrival').slice(0, maxRows);
  if (!appendPassengers) return crew;
  const remaining = maxRows - crew.length;
  if (remaining <= 0) return crew;
  const passengers = filterActivePassengerListFromData(data, 'arrival');
  return [...crew, ...passengersToCrewRows(passengers).slice(0, remaining)];
}
