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

/** Active passenger ids in display order. */
export function activePassengerListIds(
  passengers: readonly PassengerMember[],
  list: PaxListKind,
  orderOverride?: readonly string[] | null,
): string[] {
  const activeIds = passengers
    .filter((m) => !m.archived && (list === 'arrival' ? m.onArrivalList : m.onDepartureList))
    .map((m) => m.id);
  if (!orderOverride?.length) return activeIds;
  const activeSet = new Set(activeIds);
  const ordered: string[] = [];
  for (const id of orderOverride) {
    if (activeSet.has(id)) {
      ordered.push(id);
      activeSet.delete(id);
    }
  }
  for (const id of activeIds) {
    if (activeSet.has(id)) ordered.push(id);
  }
  return ordered;
}

/** Active passengers in Home table order. */
export function filterActivePassengerList(
  passengers: readonly PassengerMember[],
  list: PaxListKind,
  orderOverride?: readonly string[] | null,
): PassengerMember[] {
  const byId = new Map(passengers.map((m) => [m.id, m]));
  return activePassengerListIds(passengers, list, orderOverride)
    .map((id) => byId.get(id))
    .filter((m): m is PassengerMember => m != null);
}

export function filterActivePassengerListFromData(
  data: {
    passengers: PassengerMember[];
    passengerArrivalOrder?: string[];
    passengerDepartureOrder?: string[];
  },
  list: PaxListKind,
): PassengerMember[] {
  return filterActivePassengerList(
    data.passengers,
    list,
    list === 'arrival' ? data.passengerArrivalOrder : data.passengerDepartureOrder,
  );
}

/** True when the same active passengers appear on arrival and departure in the same order. */
export function arePassengerListsInSync(
  passengers: readonly PassengerMember[],
  arrivalOrder?: readonly string[] | null,
  departureOrder?: readonly string[] | null,
): boolean {
  const arrivalIds = activePassengerListIds(passengers, 'arrival', arrivalOrder);
  const departureIds = activePassengerListIds(passengers, 'departure', departureOrder);
  if (arrivalIds.length !== departureIds.length) return false;
  for (let i = 0; i < arrivalIds.length; i++) {
    if (arrivalIds[i] !== departureIds[i]) return false;
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

export interface PassengerVoyageStay {
  id: string;
  embarkationDate: string;
  embarkationPort: string;
  disembarkationDate: string;
  disembarkationPort: string;
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
  /**
   * Embarkation / disembarkation visits (can repeat if the passenger returns later).
   * Each row: emb. date + port, disemb. port + date.
   */
  voyageStays: PassengerVoyageStay[];
  /** Scanned passport PDF flag (file stored via CrewDocumentService by member id). */
  documents?: PassengerDocumentFlags;
  archived: boolean;
  onArrivalList: boolean;
  onDepartureList: boolean;
  /** Removed from departure list (departure-side archive); may still be active on arrival. */
  archivedFromDeparture: boolean;
}

/** Passenger scans — passport only (no seaman's / Cyprus books). */
export type PassengerDocumentFlags = { passport?: boolean };

export function hasPassengerPassportScan(
  member: Pick<PassengerMember, 'documents'>,
): boolean {
  return !!member.documents?.passport;
}

export function normalizePassengerDocuments(member: PassengerMember): PassengerMember {
  const raw = member.documents ?? {};
  return {
    ...member,
    documents: {
      passport: !!raw.passport,
    },
  };
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

export function createEmptyPassengerVoyageStay(
  partial: Partial<PassengerVoyageStay> = {},
): PassengerVoyageStay {
  return {
    id: partial.id?.trim() || crypto.randomUUID(),
    embarkationDate: (partial.embarkationDate ?? '').trim(),
    embarkationPort: (partial.embarkationPort ?? '').trim(),
    disembarkationDate: (partial.disembarkationDate ?? '').trim(),
    disembarkationPort: (partial.disembarkationPort ?? '').trim(),
  };
}

export function normalizePassengerVoyageStays(
  raw: unknown,
  legacy?: { embarkationDate?: string; embarkationPort?: string },
): PassengerVoyageStay[] {
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((row) => createEmptyPassengerVoyageStay(row as Partial<PassengerVoyageStay>));
  }
  const embDate = (legacy?.embarkationDate ?? '').trim();
  const embPort = (legacy?.embarkationPort ?? '').trim();
  if (embDate || embPort) {
    return [createEmptyPassengerVoyageStay({ embarkationDate: embDate, embarkationPort: embPort })];
  }
  return [];
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
    voyageStays: [],
    documents: {},
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
    embarkationDate,
    embarkationPort,
    familyNameGivenNames,
    passportValidity,
    voyageStays: rawStays,
    ...rest
  } = raw;
  const base = migratePassengerListFlags({ ...createEmptyPassenger(), ...rest });
  base.voyageStays = normalizePassengerVoyageStays(rawStays, { embarkationDate, embarkationPort });
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
  return normalizePassengerDocuments(base);
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
