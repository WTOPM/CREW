import { normalizePersonGender, PersonGender } from './crew.models';
import { parseValidityRange } from '../utils/date.util';

/** Rank on IMO passenger list (field 9). */
export const PASSENGER_RANK = 'Passenger';

/** Field 6 — nature of identity document on IMO passenger list. */
export const PASSENGER_IDENTITY_DOCUMENT = 'Passport / ID CARD';

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

/** True when the same active passengers appear on arrival and departure (linked lists). */
export function arePassengerListsInSync(passengers: readonly PassengerMember[]): boolean {
  const arrival = new Set(
    passengers.filter((m) => !m.archived && m.onArrivalList).map((m) => m.id),
  );
  const departure = new Set(
    passengers.filter((m) => !m.archived && m.onDepartureList).map((m) => m.id),
  );
  if (arrival.size !== departure.size) return false;
  for (const id of arrival) {
    if (!departure.has(id)) return false;
  }
  return true;
}

/** Count active passengers present on only one list (lists diverged). */
export function passengerListDiffCounts(passengers: readonly PassengerMember[]): {
  arrivalOnly: number;
  departureOnly: number;
} {
  let arrivalOnly = 0;
  let departureOnly = 0;
  for (const m of passengers) {
    if (m.archived) continue;
    if (m.onArrivalList && !m.onDepartureList) arrivalOnly++;
    else if (m.onDepartureList && !m.onArrivalList) departureOnly++;
  }
  return { arrivalOnly, departureOnly };
}

/** Active passengers in Home table order. */
export function filterActivePassengerList(
  passengers: readonly PassengerMember[],
  list: PaxListKind,
): PassengerMember[] {
  return passengers.filter((m) =>
    !m.archived && (list === 'arrival' ? m.onArrivalList : m.onDepartureList),
  );
}

export interface PassengerMember {
  id: string;
  familyName: string;
  givenNames: string;
  gender: PersonGender | '';
  nationality: string;
  dateOfBirth: string;
  placeOfBirth: string;
  passport: string;
  passportIssueDate: string;
  passportExpiryDate: string;
  archived: boolean;
  onArrivalList: boolean;
  onDepartureList: boolean;
  /** Removed from departure list (departure-side archive); may still be active on arrival. */
  archivedFromDeparture: boolean;
}

export type PaxListTypeId = 'pax' | 'paxV2';

export interface PaxListTypeOptionLabel {
  prefix: string;
  abbrs: readonly string[];
}

export const PAX_LIST_TYPE_IDS: readonly PaxListTypeId[] = ['pax', 'paxV2'];

/** Base name without order prefix. */
export const PAX_LIST_TYPE_NAMES: Record<PaxListTypeId, string> = {
  pax: 'PAX - P ID',
  paxV2: 'PAX P ID E',
};

export function paxListTypeOrderNo(id: PaxListTypeId): string {
  const index = PAX_LIST_TYPE_IDS.indexOf(id);
  return String(index + 1).padStart(2, '0');
}

/** Full label with order prefix (e.g. «01 - PAX - P ID»). */
export const PAX_LIST_TYPE_LABELS: Record<PaxListTypeId, string> = Object.fromEntries(
  PAX_LIST_TYPE_IDS.map((id) => [id, `${paxListTypeOrderNo(id)} - ${PAX_LIST_TYPE_NAMES[id]}`]),
) as Record<PaxListTypeId, string>;

/** Settings UI: text prefix + colored abbreviation chips. */
export const PAX_LIST_TYPE_OPTION_LABELS: Record<PaxListTypeId, PaxListTypeOptionLabel> = {
  pax: { prefix: 'PAX - ', abbrs: ['P', 'ID'] },
  paxV2: { prefix: 'PAX ', abbrs: ['P', 'ID', 'E'] },
};

/** PAX-only field shorthand (P and E reuse crew list colors via shared chip lookup). */
export interface PaxFieldAbbreviation {
  abbr: string;
  label: string;
  top: string;
  bottom: string;
  edge: string;
}

export const PAX_LIST_FIELD_ABBREVIATIONS: readonly PaxFieldAbbreviation[] = [
  { abbr: 'ID', top: '#fbbf24', bottom: '#d97706', edge: '#b45309', label: 'ID CARD' },
];

export const PAX_LIST_FIELD_ABBREVIATIONS_BY_ABBR: Readonly<Record<string, PaxFieldAbbreviation>> =
  Object.fromEntries(PAX_LIST_FIELD_ABBREVIATIONS.map((item) => [item.abbr, item]));

export function normalizePaxListType(raw: unknown): PaxListTypeId {
  return raw === 'paxV2' ? 'paxV2' : 'pax';
}

export interface PaxArrFormSettings {
  isArrival: boolean;
  listType: PaxListTypeId;
}

export function createDefaultPaxArrSettings(): PaxArrFormSettings {
  return { isArrival: true, listType: 'pax' };
}

export function createEmptyPassenger(): PassengerMember {
  return {
    id: crypto.randomUUID(),
    familyName: '',
    givenNames: '',
    gender: '',
    nationality: '',
    dateOfBirth: '',
    placeOfBirth: '',
    passport: '',
    passportIssueDate: '',
    passportExpiryDate: '',
    archived: false,
    onArrivalList: false,
    onDepartureList: false,
    archivedFromDeparture: false,
  };
}

export function migratePassengerListFlags(member: PassengerMember): PassengerMember {
  const raw = member as PassengerMember & {
    onArrivalList?: boolean;
    onDepartureList?: boolean;
    archivedFromDeparture?: boolean;
  };
  const archivedFromDeparture = !!raw.archivedFromDeparture;
  if (raw.onArrivalList !== undefined && raw.onDepartureList !== undefined) {
    return {
      ...member,
      onArrivalList: !!raw.onArrivalList,
      onDepartureList: !!raw.onDepartureList,
      archivedFromDeparture,
    };
  }
  const onArrival = !member.archived;
  return {
    ...member,
    onArrivalList: onArrival,
    onDepartureList: onArrival,
    archivedFromDeparture,
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
  base.gender = normalizePersonGender(base.gender);
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
