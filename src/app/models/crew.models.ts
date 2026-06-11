import { parseValidityRange } from '../utils/date.util';
import { PassengerMember, PaxArrFormSettings } from './passenger.models';
import type { DocumentOverlayPrefs, ShipAssetsMeta } from './document-overlay.models';
import { createDefaultDocumentOverlayPrefs, createEmptyShipAssetsMeta } from './document-overlay.models';
import type { CrewEffectFormSettings } from './crew-effect.models';
import { createDefaultCrewEffectForm } from './crew-effect.models';
import type { NilListFormSettings } from './nil-list.models';
import { createDefaultNilListForm } from './nil-list.models';
import type { ShipMoneyFormSettings } from './ship-money.models';
import { createDefaultShipMoneyForm } from './ship-money.models';
import type { CashAdvanceFormSettings } from './cash-advance.models';
import { createDefaultCashAdvanceForm } from './cash-advance.models';
import type { CrewMoneyListFormSettings } from './crew-money-list.models';
import { createDefaultCrewMoneyListForm } from './crew-money-list.models';
import type { NarcoticListFormSettings } from './narcotic-list.models';
import { createDefaultNarcoticListForm } from './narcotic-list.models';
import type { ShipStoresFormSettings } from './ship-stores.models';
import { createDefaultShipStoresForm } from './ship-stores.models';

export type {
  DocumentOverlayPrefs,
  DocumentOverlayId,
  CrewListDocumentPrefs,
  CrewListTypeId,
  DocumentStampOptions,
  ShipAssetsMeta,
  ShipAssetKind,
} from './document-overlay.models';
export {
  createDefaultCrewListPrefs,
  createDefaultDocumentOverlayPrefs,
  CREW_LIST_TYPE_LABELS,
  CREW_LIST_TYPE_IDS,
  normalizeCrewListType,
  createEmptyShipAssetsMeta,
  DOCUMENT_OVERLAY_LABELS,
} from './document-overlay.models';

export interface Port {
  name: string;
  code: string;
  /** Country name for Port of Call form (e.g. ITALY). */
  country?: string;
}

export const DEFAULT_RANKS = [
  'Master',
  'Ch.Off',
  '2nd Off',
  'Ch.Eng',
  '2nd Eng',
  'A/B',
  'O/S',
  'Wiper',
  'Cook',
  'Dcad',
];

export const DEFAULT_NATIONALITIES = [
  'Cyprus',
  'Ukraine',
  'Philippines',
  'Russia',
  'Georgia',
  'India',
  'Romania',
  'Bulgaria',
  'Poland',
  'Turkey',
];

export interface ShipInfo {
  name: string;
  callSign: string;
  nationality: string;
  homeport: string;
  imoNo: string;
  type: string;
  charterer: string;
  voyageNumber: string;
  sanitationCertificateNo: string;
  sanitationCertificateIssuedAt: string;
  sanitationCertificateIssueDate: string;
  waterTestPort: string;
  waterTestDate: string;
  grossTonnage: string;
  netTonnage: string;
  dateOfArrival: string;
  dateOfDeparture: string;
  portOfCall: string;
  lastPortOfCall: string;
  nextPortOfCall: string;
  /** Ship Security Officer — if empty, resolved from crew (SSO rank, else Ch.Off). */
  shipSecurityOfficer: string;
  /** International Ship Security Certificate — issue date (ISO). */
  isscIssueDate: string;
  /** ISSC expiry date (ISO). */
  isscExpiryDate: string;
  /** ISSC issued by (Recognized Security Organization), e.g. BV. */
  isscIssuedByRso: string;
  /** Present ship MARSEC level (1–3); PDF shows digit after “1 (one)”. */
  presentMarsecLevel: string;
}

/** Select / date fields — show Saved on change; text fields use debounced save on main forms. */
export const SHIP_FIELDS_SAVED_ON_CHANGE: readonly (keyof ShipInfo)[] = [
  'nationality',
  'homeport',
  'lastPortOfCall',
  'portOfCall',
  'nextPortOfCall',
  'dateOfArrival',
  'dateOfDeparture',
  'sanitationCertificateIssuedAt',
  'sanitationCertificateIssueDate',
  'waterTestPort',
  'waterTestDate',
  'isscIssueDate',
  'isscExpiryDate',
] as const;

export function shipFieldPersistNotify(field: keyof ShipInfo): 'saved' | 'debounced' {
  return (SHIP_FIELDS_SAVED_ON_CHANGE as readonly string[]).includes(field) ? 'saved' : 'debounced';
}

export type PersonGender = 'MALE' | 'FEMALE';

export function normalizePersonGender(value: unknown): PersonGender | '' {
  const v = String(value ?? '').trim().toUpperCase();
  if (v === 'MALE' || v === 'FEMALE') return v;
  return '';
}

/** Scanned PDF attachments (stored locally; see CrewDocumentService). */
export type CrewDocumentType = 'passport' | 'seamansBook' | 'cyprusPassport';

export const CREW_DOCUMENT_TYPES: readonly {
  id: CrewDocumentType;
  label: string;
  short: string;
}[] = [
  { id: 'passport', label: 'Passport scan', short: 'P' },
  { id: 'seamansBook', label: "Seaman's book scan", short: 'S' },
  { id: 'cyprusPassport', label: 'Cyprus book scan', short: 'CY' },
] as const;

export type CrewDocumentFlags = Partial<Record<CrewDocumentType, boolean>>;

export interface CrewMember {
  id: string;
  familyName: string;
  givenNames: string;
  rank: string;
  gender: PersonGender | '';
  nationality: string;
  dateOfBirth: string;
  placeOfBirth: string;
  passport: string;
  passportPlaceOfIssue: string;
  seamansBook: string;
  seamansBookPlaceOfIssue: string;
  passportIssueDate: string;
  passportExpiryDate: string;
  sbookIssueDate: string;
  sbookExpiryDate: string;
  cyprusSeamansBook: string;
  cyprusIssueDate: string;
  cyprusExpiryDate: string;
  visa: string;
  visaIssueDate: string;
  visaExpiryDate: string;
  joiningDate: string;
  /** Port name (code resolved from ports directory). */
  joiningPort: string;
  /** Vaccine medical product name. */
  vaccineMedicalProduct: string;
  /** Date of vaccination (ISO date). */
  dateOfVaccination: string;
  archived: boolean;
  /** Shown on CREW LIST ARRIVAL tab and Arrival PDF. */
  onArrivalList: boolean;
  /** Shown on CREW LIST DEPARTURE tab and Departure PDF. */
  onDepartureList: boolean;
  /** Removed from departure list (departure-side archive); may still be active on arrival. */
  archivedFromDeparture: boolean;
  /** Which PDF scans exist on disk (experimental). */
  documents?: CrewDocumentFlags;
}

export type CrewListKind = 'arrival' | 'departure';

/** Active crew in Home table order (drag-and-drop order in `crew` array). */
export function filterActiveCrewList(
  crew: readonly CrewMember[],
  list: CrewListKind,
): CrewMember[] {
  return crew.filter((m) =>
    !m.archived && (list === 'arrival' ? m.onArrivalList : m.onDepartureList),
  );
}

/** True when the same active members appear on arrival and departure (linked lists). */
export function areCrewListsInSync(crew: readonly CrewMember[]): boolean {
  const arrival = new Set(
    crew.filter((m) => !m.archived && m.onArrivalList).map((m) => m.id),
  );
  const departure = new Set(
    crew.filter((m) => !m.archived && m.onDepartureList).map((m) => m.id),
  );
  if (arrival.size !== departure.size) return false;
  for (const id of arrival) {
    if (!departure.has(id)) return false;
  }
  return true;
}

/** Count active members present on only one list (lists diverged). */
export function crewListDiffCounts(crew: readonly CrewMember[]): {
  arrivalOnly: number;
  departureOnly: number;
} {
  let arrivalOnly = 0;
  let departureOnly = 0;
  for (const m of crew) {
    if (m.archived) continue;
    if (m.onArrivalList && !m.onDepartureList) arrivalOnly++;
    else if (m.onDepartureList && !m.onArrivalList) departureOnly++;
  }
  return { arrivalOnly, departureOnly };
}

/** Summary shown before departure → arrival list sync. */
export interface DepartureToArrivalSyncPreview {
  onDeparture: number;
  /** On arrival but not departure — will be moved to archive. */
  arrivalOnlyToArchive: number;
  /** Departure-archive entries merged into arrival archive. */
  departureArchiveMerged: number;
}

/** Summary for FROM ARRIVAL → departure sync. */
export interface ArrivalToDepartureSyncPreview {
  onArrival: number;
  /** Active on departure only — will be moved to archive. */
  departureOnlyToArchive: number;
  /** Extra departure-archive entries merged into arrival archive. */
  departureArchiveMerged: number;
}

/** Field 6 label and row values for crew-list PDF (passport vs seaman's book). */
export const CREW_IDENTITY_PASSPORT = 'Passport';
export const CREW_IDENTITY_SEAMANS_BOOK = "Seaman's Book";

export interface CrewArrFormSettings {
  isArrival: boolean;
  pageNo: number;
  /** Field 6 — type of identity document (Passport, Seaman's Book, …). */
  identityDocumentType: string;
}

/** MARSEC / SEC. LVL. per port call (1–3). */
export type PortSecLvl = '1' | '2' | '3';

export const PORT_SEC_LVL_OPTIONS: readonly PortSecLvl[] = ['1', '2', '3'];

export function normalizePortSecLvl(raw: unknown): PortSecLvl {
  const s = String(raw ?? '1').trim();
  if (s === '2' || s === '3') return s;
  return '1';
}

export interface PortCallHistoryEntry {
  id: string;
  portName: string;
  country: string;
  arrivalDate: string;
  arrivalTime: string;
  departureDate: string;
  departureTime: string;
  /** Per-port security level for Security / SSO-0108 PDFs. */
  secLvl: PortSecLvl;
}

/** Which port document Port Settings is editing. */
export type PortSettingsDocId = 'portOfCall' | 'portsOfCall' | 'sso0108';

export const PORT_SETTINGS_DOC_IDS: readonly PortSettingsDocId[] = [
  'portOfCall',
  'portsOfCall',
  'sso0108',
];

/** Base name without order prefix. */
export const PORT_SETTINGS_DOC_NAMES: Record<PortSettingsDocId, string> = {
  portOfCall: 'Port of Call',
  portsOfCall: 'Port of Call - Security',
  sso0108: 'Port of Call - SSO-0108',
};

export function portSettingsDocOrderNo(id: PortSettingsDocId): string {
  const index = PORT_SETTINGS_DOC_IDS.indexOf(id);
  return String(index + 1).padStart(2, '0');
}

/** Full label with order prefix (e.g. «01 - Port of Call»). */
export const PORT_SETTINGS_DOC_LABELS: Record<PortSettingsDocId, string> = Object.fromEntries(
  PORT_SETTINGS_DOC_IDS.map((id) => [
    id,
    `${portSettingsDocOrderNo(id)} - ${PORT_SETTINGS_DOC_NAMES[id]}`,
  ]),
) as Record<PortSettingsDocId, string>;

export function normalizePortSettingsDocId(raw: unknown): PortSettingsDocId {
  if (raw === 'portsOfCall' || raw === 'sso0108') return raw;
  return 'portOfCall';
}

export interface PortOfCallSettings {
  /** How many latest port calls to print in the PDF (pages of 11 rows each). */
  pdfRowCount: number;
}

export interface AppData {
  ship: ShipInfo;
  crew: CrewMember[];
  crewArr: CrewArrFormSettings;
  passengers: PassengerMember[];
  paxArr: PaxArrFormSettings;
  ports: Port[];
  ranks: string[];
  nationalities: string[];
  portCallHistory: PortCallHistoryEntry[];
  portOfCall: PortOfCallSettings;
  /** Ship Stores table (articles, quantities, place of storage). */
  shipStoresForm: ShipStoresFormSettings;
  /** Crew Effect (IMO Crew's Effects Declaration). */
  crewEffectForm: CrewEffectFormSettings;
  /** NIL List — selectable phrases. */
  nilListForm: NilListFormSettings;
  /** Ship Money — amount & currency rows. */
  shipMoneyForm: ShipMoneyFormSettings;
  cashAdvanceForm: CashAdvanceFormSettings;
  crewMoneyListForm: CrewMoneyListFormSettings;
  narcoticListForm: NarcoticListFormSettings;
  documentOverlay: DocumentOverlayPrefs;
  shipAssets: ShipAssetsMeta;
  /** Where generated PDFs are written when "save to folder" is enabled. */
  outputSettings: OutputSettings;
  /** Per-port document packages for batch open/print. */
  printPackages: PortPackage[];
  /** User-uploaded static PDFs (e.g. Ship's Particulars), selectable in packages. */
  customDocuments: CustomDocument[];
  seedVersion?: number;
}

/** A user-uploaded PDF stored inline (base64). Named from its file name. */
export interface CustomDocument {
  id: string;
  name: string;
  dataBase64: string;
}

export function createDefaultCustomDocuments(): CustomDocument[] {
  return [];
}

/** Header "save to folder" preferences for generated PDFs. */
export interface OutputSettings {
  saveToFolder: boolean;
  activePath: string;
  savedPaths: string[];
  /** Selected printer (Electron silent printing); empty = system default. */
  printerName: string;
}

export function createDefaultOutputSettings(): OutputSettings {
  return { saveToFolder: false, activePath: '', savedPaths: [], printerName: '' };
}

/** One document choice within an authority. */
export interface PortPackageItem {
  documentId: string;
  copies: number;
}

/** A receiving authority at a port (e.g. Immigration, Customs) with its documents. */
export interface PortAuthority {
  name: string;
  items: PortPackageItem[];
}

/** All authorities and their documents to open/print for a given port. */
export interface PortPackage {
  port: string;
  authorities: PortAuthority[];
}

export function createDefaultPrintPackages(): PortPackage[] {
  return [];
}

export type { CrewEffectFormSettings } from './crew-effect.models';
export { createDefaultCrewEffectForm } from './crew-effect.models';
export type { NilListFormSettings, NilListPhrase } from './nil-list.models';
export { createDefaultNilListForm } from './nil-list.models';
export type { ShipMoneyFormSettings, ShipMoneyEntry } from './ship-money.models';
export { createDefaultShipMoneyForm } from './ship-money.models';
export type { CashAdvanceFormSettings, CashAdvanceCrewAmounts } from './cash-advance.models';
export {
  createDefaultCashAdvanceForm,
  cashAdvanceAmountsFor,
} from './cash-advance.models';
export type { CrewMoneyListFormSettings, CrewMoneyListCrewAmounts } from './crew-money-list.models';
export {
  createDefaultCrewMoneyListForm,
  crewMoneyListAmountsFor,
} from './crew-money-list.models';
export type { NarcoticListFormSettings, NarcoticMedicineEntry } from './narcotic-list.models';
export {
  createDefaultNarcoticListForm,
  createNarcoticMedicineEntry,
} from './narcotic-list.models';
export type { ShipStoresFormSettings, ShipStoresRow } from './ship-stores.models';
export {
  SHIP_STORES_ROW_COUNT,
  createDefaultShipStoresForm,
  formatShipStoresQuantityText,
  formatShipStoresUnitText,
} from './ship-stores.models';

export function createEmptyShip(): ShipInfo {
  return {
    name: '',
    callSign: '',
    nationality: '',
    homeport: '',
    imoNo: '',
    type: '',
    charterer: '',
    voyageNumber: '',
    sanitationCertificateNo: '',
    sanitationCertificateIssuedAt: '',
    sanitationCertificateIssueDate: '',
    waterTestPort: '',
    waterTestDate: '',
    grossTonnage: '',
    netTonnage: '',
    dateOfArrival: '',
    dateOfDeparture: '',
    portOfCall: '',
    lastPortOfCall: '',
    nextPortOfCall: '',
    shipSecurityOfficer: '',
    isscIssueDate: '',
    isscExpiryDate: '',
    isscIssuedByRso: 'BV',
    presentMarsecLevel: '1',
  };
}

/** Display name for SSO-0108 (e.g. Laurente Artemio Belza). */
export function formatShipSecurityOfficerName(
  member: Pick<CrewMember, 'familyName' | 'givenNames'>,
): string {
  const family = member.familyName?.trim() ?? '';
  const given = member.givenNames?.trim() ?? '';
  if (!family && !given) return '';
  const title = (s: string) =>
    s
      .toLowerCase()
      .split(/\s+/)
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ''))
      .join(' ');
  if (family && given) return `${title(family)} ${given}`;
  return title(family || given);
}

export function resolveShipSecurityOfficer(ship: ShipInfo, crew: readonly CrewMember[]): string {
  const manual = ship.shipSecurityOfficer?.trim();
  if (manual) return manual;
  const active = crew.filter((m) => !m.archived);
  const byRank = (r: RegExp) => active.find((m) => r.test(m.rank.trim()));
  const sso = byRank(/security/i) ?? byRank(/^sso$/i);
  if (sso) return formatShipSecurityOfficerName(sso);
  const chOff = active.find((m) => m.rank.trim() === 'Ch.Off');
  if (chOff) return formatShipSecurityOfficerName(chOff);
  return '';
}

export function createEmptyCrewMember(): CrewMember {
  return {
    id: crypto.randomUUID(),
    familyName: '',
    givenNames: '',
    rank: '',
    gender: '',
    nationality: '',
    dateOfBirth: '',
    placeOfBirth: '',
    passport: '',
    passportPlaceOfIssue: '',
    seamansBook: '',
    seamansBookPlaceOfIssue: '',
    passportIssueDate: '',
    passportExpiryDate: '',
    sbookIssueDate: '',
    sbookExpiryDate: '',
    cyprusSeamansBook: '',
    cyprusIssueDate: '',
    cyprusExpiryDate: '',
    visa: '',
    visaIssueDate: '',
    visaExpiryDate: '',
    joiningDate: '',
    joiningPort: '',
    vaccineMedicalProduct: '',
    dateOfVaccination: '',
    archived: false,
    onArrivalList: false,
    onDepartureList: false,
    archivedFromDeparture: false,
    documents: {},
  };
}

export function crewMemberLabel(member: Pick<CrewMember, 'familyName' | 'givenNames' | 'rank'>): string {
  const name = [member.familyName, member.givenNames].filter(Boolean).join(' ');
  return member.rank ? `${name} — ${member.rank}` : name || 'Unnamed';
}

export function hasCrewDocument(member: CrewMember, type: CrewDocumentType): boolean {
  return !!member.documents?.[type];
}

/** Migrate legacy crew rows (active = arrival list only). */
export function normalizeCrewDocuments(member: CrewMember): CrewMember {
  const raw = member.documents ?? {};
  return {
    ...member,
    documents: {
      passport: !!raw.passport,
      seamansBook: !!raw.seamansBook,
      cyprusPassport: !!raw.cyprusPassport,
    },
  };
}

export function migrateCrewListFlags(member: CrewMember): CrewMember {
  const raw = member as CrewMember & {
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

export function createDefaultCrewArrSettings(): CrewArrFormSettings {
  return {
    isArrival: true,
    pageNo: 1,
    identityDocumentType: CREW_IDENTITY_PASSPORT,
  };
}

export function createDefaultPortOfCallSettings(): PortOfCallSettings {
  return { pdfRowCount: 10 };
}

export function createEmptyPortCallEntry(): PortCallHistoryEntry {
  return {
    id: crypto.randomUUID(),
    portName: '',
    country: '',
    arrivalDate: '',
    arrivalTime: '',
    departureDate: '',
    departureTime: '',
    secLvl: '1',
  };
}

export function parseCrewName(full: string): { familyName: string; givenNames: string } {
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

/** IMO crew list format: FAMILY NAME, Given Names */
export function formatCrewListName(
  member: Pick<CrewMember, 'familyName' | 'givenNames'> & { familyNameGivenNames?: string },
): string {
  const family = member.familyName?.trim();
  const given = member.givenNames?.trim();
  if (family && given) return `${family}, ${given}`;
  if (family) return family;
  if (given) return given;
  if (member.familyNameGivenNames) return member.familyNameGivenNames.trim();
  return '';
}

/** IMO crew-list rank order (Master first), then directory extras, then unknown ranks A–Z. */
export function crewRankOrder(
  directoryRanks: readonly string[],
  members: readonly Pick<CrewMember, 'rank'>[],
): string[] {
  const order: string[] = [];
  const seen = new Set<string>();

  const add = (rank: string) => {
    const v = rank.trim();
    if (!v || seen.has(v)) return;
    seen.add(v);
    order.push(v);
  };

  for (const r of directoryRanks) add(r);

  const extra = [...new Set(members.map((m) => m.rank.trim()).filter(Boolean))]
    .filter((r) => !seen.has(r))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  for (const r of extra) add(r);

  return order;
}

/** Index in crew-list rank order; unknown ranks sort last. */
export function rankSortIndex(rank: string, ranks: readonly string[]): number {
  const idx = ranks.indexOf(rank.trim());
  return idx >= 0 ? idx : ranks.length;
}

/** Sort members Master → … for archive view only (not document PDFs). */
export function sortCrewByRank<T extends Pick<CrewMember, 'rank' | 'familyName' | 'givenNames'>>(
  members: T[],
  ranks: readonly string[],
): T[] {
  return [...members].sort((a, b) => {
    const byRank = rankSortIndex(a.rank, ranks) - rankSortIndex(b.rank, ranks);
    if (byRank !== 0) return byRank;
    const nameA = `${a.familyName} ${a.givenNames}`.trim();
    const nameB = `${b.familyName} ${b.givenNames}`.trim();
    return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
  });
}

export function portLabel(port: Port): string {
  return port.code ? `${port.name} (${port.code})` : port.name;
}

export function resolvePortRef(ref: string, ports: Port[] = []): Port | null {
  const v = ref.trim();
  if (!v) return null;
  const lower = v.toLowerCase();
  const byName = ports.find((p) => p.name.toLowerCase() === lower);
  if (byName) return { ...byName };
  const byCode = ports.find((p) => p.code.toLowerCase() === lower);
  if (byCode) return { ...byCode };
  return { name: v, code: '' };
}

export function portCode(name: string, ports: Port[]): string {
  if (!name) return '';
  return ports.find((p) => p.name === name)?.code ?? resolvePortRef(name, ports)?.code ?? '';
}

export function portCountry(name: string, ports: Port[]): string {
  if (!name) return '';
  const resolved = ports.find((p) => p.name === name) ?? resolvePortRef(name, ports);
  return resolved?.country?.trim() ?? '';
}

/** Newest port calls first (row 1 = latest visit). */
export function orderPortCallHistoryForPdf(history: PortCallHistoryEntry[]): PortCallHistoryEntry[] {
  return [...history].sort((a, b) => {
    const aKey = a.arrivalDate || a.departureDate || '';
    const bKey = b.arrivalDate || b.departureDate || '';
    return bKey.localeCompare(aKey);
  });
}

/** Split history into PDF pages (11 rows per page; last page may have empty slots). */
export function chunkPortCallHistoryForPdf(
  history: PortCallHistoryEntry[],
  rowsPerPage: number,
): PortCallHistoryEntry[][] {
  const pageSize = Math.max(1, rowsPerPage);
  const ordered = orderPortCallHistoryForPdf(history);
  if (ordered.length === 0) return [[]];
  const pages: PortCallHistoryEntry[][] = [];
  for (let i = 0; i < ordered.length; i += pageSize) {
    pages.push(ordered.slice(i, i + pageSize));
  }
  return pages;
}

/** N newest port calls for PDF (0 = none). */
export function selectPortCallHistoryForPdf(
  history: PortCallHistoryEntry[],
  portCount: number,
): PortCallHistoryEntry[] {
  const limit = Math.max(0, portCount);
  if (limit === 0) return [];
  return orderPortCallHistoryForPdf(history).slice(0, limit);
}

export function formatPortCallPortName(name: string): string {
  return name.trim().toUpperCase();
}

export function mergePorts(existing: Port[], ...refs: (string | Port | undefined)[]): Port[] {
  const map = new Map<string, Port>();

  for (const p of existing) {
    if (p.name) map.set(p.name.toLowerCase(), { ...p });
  }

  for (const ref of refs) {
    if (!ref) continue;
    if (typeof ref === 'string') {
      const resolved = resolvePortRef(ref, [...map.values()]);
      if (!resolved?.name) continue;
      const key = resolved.name.toLowerCase();
      const prev = map.get(key);
      map.set(key, {
        name: resolved.name,
        code: resolved.code || prev?.code || '',
        country: resolved.country || prev?.country || '',
      });
    } else if (ref.name) {
      const key = ref.name.toLowerCase();
      const prev = map.get(key);
      map.set(key, {
        name: ref.name,
        code: ref.code || prev?.code || '',
        country: ref.country || prev?.country || '',
      });
    }
  }

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function migratePortsRaw(raw: unknown): Port[] {
  if (!raw || !Array.isArray(raw) || raw.length === 0) return [];
  if (typeof raw[0] === 'object' && raw[0] !== null && 'name' in (raw[0] as Port)) {
    return mergePorts([], ...(raw as Port[]));
  }
  return mergePorts([], ...(raw as string[]));
}

export function migrateCrewMember(
  raw: Partial<CrewMember> & {
    familyNameGivenNames?: string;
    passportValidity?: string;
    sbookValidity?: string;
    cyprusValidity?: string;
    visaValidity?: string;
  },
): CrewMember {
  const base = { ...createEmptyCrewMember(), ...raw };
  if (!base.familyName && !base.givenNames && raw.familyNameGivenNames) {
    const parsed = parseCrewName(raw.familyNameGivenNames);
    base.familyName = parsed.familyName;
    base.givenNames = parsed.givenNames;
  }

  migrateLegacyValidity(base, raw.passportValidity, 'passportIssueDate', 'passportExpiryDate');
  migrateLegacyValidity(base, raw.sbookValidity, 'sbookIssueDate', 'sbookExpiryDate');
  migrateLegacyValidity(base, raw.cyprusValidity, 'cyprusIssueDate', 'cyprusExpiryDate');
  migrateLegacyValidity(base, raw.visaValidity, 'visaIssueDate', 'visaExpiryDate');
  base.gender = normalizePersonGender(base.gender);

  return base;
}

function migrateLegacyValidity(
  member: CrewMember,
  legacy: string | undefined,
  issueKey: 'passportIssueDate' | 'sbookIssueDate' | 'cyprusIssueDate' | 'visaIssueDate',
  expiryKey: 'passportExpiryDate' | 'sbookExpiryDate' | 'cyprusExpiryDate' | 'visaExpiryDate',
): void {
  if (!legacy?.trim() || member[issueKey] || member[expiryKey]) return;
  const { issue, expiry } = parseValidityRange(legacy);
  member[issueKey] = issue;
  member[expiryKey] = expiry;
}

export function mergeUniqueList(existing: string[], ...items: (string | undefined)[]): string[] {
  const set = new Set(existing.filter(Boolean));
  for (const item of items) {
    const v = item?.trim();
    if (v) set.add(v);
  }
  // Preserve order: existing items first (in their original order), then new items
  const result: string[] = [];
  for (const item of existing) {
    if (item && set.has(item)) {
      result.push(item);
      set.delete(item);
    }
  }
  // Add remaining new items at the end
  for (const item of set) {
    result.push(item);
  }
  return result;
}
