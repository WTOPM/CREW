import { CrewMember } from '../models/crew.models';
import { PassengerMember } from '../models/passenger.models';

/** Case-insensitive substring match across concatenated member fields. */
export function matchesArchiveQuery(searchText: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return searchText.toLowerCase().includes(q);
}

export function crewMemberSearchText(m: CrewMember): string {
  const doc = m.documents;
  return [
    m.familyName,
    m.givenNames,
    m.rank,
    m.gender,
    m.nationality,
    m.dateOfBirth,
    m.placeOfBirth,
    m.passport,
    m.passportPlaceOfIssue,
    m.seamansBook,
    m.seamansBookPlaceOfIssue,
    m.passportIssueDate,
    m.passportExpiryDate,
    m.sbookIssueDate,
    m.sbookExpiryDate,
    m.cyprusSeamansBook,
    m.cyprusIssueDate,
    m.cyprusExpiryDate,
    m.visa,
    m.visaIssueDate,
    m.visaExpiryDate,
    m.joiningDate,
    m.joiningPort,
    doc?.passport ? 'passport' : '',
    doc?.seamansBook ? 'seamans' : '',
    doc?.cyprusPassport ? 'cyprus' : '',
  ]
    .filter((v) => v !== undefined && v !== null && String(v).trim() !== '')
    .join(' ');
}

export function passengerMemberSearchText(m: PassengerMember): string {
  return [
    m.familyName,
    m.givenNames,
    m.gender,
    m.nationality,
    m.dateOfBirth,
    m.placeOfBirth,
    m.passport,
    m.passportIssueDate,
    m.passportExpiryDate,
  ]
    .filter((v) => v !== undefined && v !== null && String(v).trim() !== '')
    .join(' ');
}

export function filterCrewArchive(members: CrewMember[], query: string): CrewMember[] {
  if (!query.trim()) return members;
  return members.filter((m) => matchesArchiveQuery(crewMemberSearchText(m), query));
}

export function filterPassengerArchive(
  members: PassengerMember[],
  query: string,
): PassengerMember[] {
  if (!query.trim()) return members;
  return members.filter((m) => matchesArchiveQuery(passengerMemberSearchText(m), query));
}
