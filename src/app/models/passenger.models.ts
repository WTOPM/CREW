import { parseValidityRange } from '../utils/date.util';

/** Rank on IMO passenger list (field 9). */
export const PASSENGER_RANK = 'Passenger';

function parsePersonName(full: string): { familyName: string; givenNames: string } {
  const trimmed = full.trim();
  if (!trimmed) return { familyName: '', givenNames: '' };
  const comma = trimmed.indexOf(',');
  if (comma >= 0) {
    return {
      familyName: trimmed.slice(0, comma).trim(),
      givenNames: trimmed.slice(comma + 1).trim(),
    };
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { familyName: parts[0], givenNames: '' };
  return { familyName: parts[0], givenNames: parts.slice(1).join(' ') };
}

export type PaxListKind = 'arrival' | 'departure';

export interface PassengerMember {
  id: string;
  familyName: string;
  givenNames: string;
  nationality: string;
  dateOfBirth: string;
  placeOfBirth: string;
  passport: string;
  passportIssueDate: string;
  passportExpiryDate: string;
  archived: boolean;
  onArrivalList: boolean;
  onDepartureList: boolean;
}

export interface PaxArrFormSettings {
  isArrival: boolean;
}

export function createDefaultPaxArrSettings(): PaxArrFormSettings {
  return { isArrival: true };
}

export function createEmptyPassenger(): PassengerMember {
  return {
    id: crypto.randomUUID(),
    familyName: '',
    givenNames: '',
    nationality: '',
    dateOfBirth: '',
    placeOfBirth: '',
    passport: '',
    passportIssueDate: '',
    passportExpiryDate: '',
    archived: false,
    onArrivalList: false,
    onDepartureList: false,
  };
}

export function migratePassengerListFlags(member: PassengerMember): PassengerMember {
  const raw = member as PassengerMember & { onArrivalList?: boolean; onDepartureList?: boolean };
  if (raw.onArrivalList !== undefined && raw.onDepartureList !== undefined) {
    return {
      ...member,
      onArrivalList: !!raw.onArrivalList,
      onDepartureList: !!raw.onDepartureList,
    };
  }
  const onArrival = !member.archived;
  return {
    ...member,
    onArrivalList: onArrival,
    onDepartureList: onArrival,
  };
}

export function migratePassengerMember(
  raw: Partial<PassengerMember> & {
    familyNameGivenNames?: string;
    passportValidity?: string;
    visa?: string;
    visaIssueDate?: string;
    visaExpiryDate?: string;
    visaValidity?: string;
    embarkationDate?: string;
    embarkationPort?: string;
  },
): PassengerMember {
  const {
    visa: _v,
    visaIssueDate: _vi,
    visaExpiryDate: _ve,
    visaValidity: _vv,
    embarkationDate: _ed,
    embarkationPort: _ep,
    familyNameGivenNames,
    passportValidity,
    ...rest
  } = raw;
  const base = migratePassengerListFlags({ ...createEmptyPassenger(), ...rest });
  if (!base.familyName && !base.givenNames && familyNameGivenNames) {
    const parsed = parsePersonName(familyNameGivenNames);
    base.familyName = parsed.familyName;
    base.givenNames = parsed.givenNames;
  }
  if (!base.passportIssueDate && !base.passportExpiryDate && passportValidity?.trim()) {
    const { issue, expiry } = parseValidityRange(passportValidity);
    base.passportIssueDate = issue;
    base.passportExpiryDate = expiry;
  }
  return base;
}

export function sortPassengersByName<T extends Pick<PassengerMember, 'familyName' | 'givenNames'>>(
  members: T[],
): T[] {
  return [...members].sort((a, b) => {
    const nameA = `${a.familyName} ${a.givenNames}`.trim();
    const nameB = `${b.familyName} ${b.givenNames}`.trim();
    return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
  });
}
