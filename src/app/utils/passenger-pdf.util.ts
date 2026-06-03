import { CrewMember, createEmptyCrewMember } from '../models/crew.models';
import { PASSENGER_RANK, PassengerMember } from '../models/passenger.models';

/** Map passenger to crew-list row shape for the shared IMO FAL Form 5 PDF. */
export function passengersToCrewRows(passengers: PassengerMember[]): CrewMember[] {
  return passengers.map((p) => ({
    ...createEmptyCrewMember(),
    id: p.id,
    familyName: p.familyName,
    givenNames: p.givenNames,
    rank: PASSENGER_RANK,
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
