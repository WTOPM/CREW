import { parseValidityRange } from '../utils/date.util';

export interface Port {
  name: string;
  code: string;
  /** Country name for Port of Call form (e.g. ITALY). */
  country?: string;
}

export const DEFAULT_PORTS: Port[] = [
  { name: 'Napoli', code: 'ITNAP', country: 'ITALY' },
  { name: 'Marseille', code: 'FRMRS', country: 'FRANCE' },
  { name: 'Alger', code: 'DZALG', country: 'ALGERIA' },
  { name: 'La Spezia', code: 'ITSPE', country: 'ITALY' },
  { name: 'Limassol', code: 'CYLMS', country: 'CYPRUS' },
  { name: 'Genoa', code: 'ITGOA', country: 'ITALY' },
  { name: 'Salerno', code: 'ITSAL', country: 'ITALY' },
  { name: 'Le Havre', code: 'FRLEH', country: 'FRANCE' },
  { name: 'Bejaia', code: 'DZBJA', country: 'ALGERIA' },
  { name: 'Antwerp', code: 'BEANR', country: 'BELGIUM' },
];

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
  dateOfArrival: string;
  dateOfDeparture: string;
  portOfCall: string;
  lastPortOfCall: string;
  nextPortOfCall: string;
}

export interface CrewMember {
  id: string;
  familyName: string;
  givenNames: string;
  rank: string;
  nationality: string;
  dateOfBirth: string;
  placeOfBirth: string;
  passport: string;
  seamansBook: string;
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
  archived: boolean;
  /** Shown on CREW LIST ARRIVAL tab and Arrival PDF. */
  onArrivalList: boolean;
  /** Shown on CREW LIST DEPARTURE tab and Departure PDF. */
  onDepartureList: boolean;
}

export type CrewListKind = 'arrival' | 'departure';

export interface CrewArrFormSettings {
  isArrival: boolean;
  pageNo: number;
  /** Field 6 — type of identity document (Passport, Seaman's Book, …). */
  identityDocumentType: string;
}

export interface PortCallHistoryEntry {
  id: string;
  portName: string;
  country: string;
  arrivalDate: string;
  arrivalTime: string;
  departureDate: string;
  departureTime: string;
}

export interface PortOfCallSettings {
  /** How many latest port calls to print in the PDF (pages of 11 rows each). */
  pdfRowCount: number;
}

export interface AppData {
  ship: ShipInfo;
  crew: CrewMember[];
  crewArr: CrewArrFormSettings;
  ports: Port[];
  ranks: string[];
  nationalities: string[];
  portCallHistory: PortCallHistoryEntry[];
  portOfCall: PortOfCallSettings;
  seedVersion?: number;
}

export function createEmptyShip(): ShipInfo {
  return {
    name: '',
    callSign: '',
    nationality: '',
    homeport: '',
    imoNo: '',
    type: '',
    charterer: '',
    dateOfArrival: '',
    dateOfDeparture: '',
    portOfCall: '',
    lastPortOfCall: '',
    nextPortOfCall: '',
  };
}

export function createEmptyCrewMember(): CrewMember {
  return {
    id: crypto.randomUUID(),
    familyName: '',
    givenNames: '',
    rank: '',
    nationality: '',
    dateOfBirth: '',
    placeOfBirth: '',
    passport: '',
    seamansBook: '',
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
    archived: false,
    onArrivalList: false,
    onDepartureList: false,
  };
}

/** Migrate legacy crew rows (active = arrival list only). */
export function migrateCrewListFlags(member: CrewMember): CrewMember {
  const raw = member as CrewMember & { onArrivalList?: boolean; onDepartureList?: boolean };
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

export function createDefaultCrewArrSettings(): CrewArrFormSettings {
  return {
    isArrival: true,
    pageNo: 1,
    identityDocumentType: 'Passport',
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

  for (const r of DEFAULT_RANKS) add(r);
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

/** Sort members Master → … like IMO crew list (uses ranks directory order). */
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

export function resolvePortRef(ref: string, ports: Port[] = DEFAULT_PORTS): Port | null {
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

  for (const p of [...DEFAULT_PORTS, ...existing]) {
    if (p.name) map.set(p.name.toLowerCase(), { ...p });
  }

  for (const ref of refs) {
    if (!ref) continue;
    if (typeof ref === 'string') {
      const resolved = resolvePortRef(ref, [...map.values(), ...DEFAULT_PORTS]);
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
  if (!raw || !Array.isArray(raw) || raw.length === 0) return [...DEFAULT_PORTS];
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
  return [...set].sort((a, b) => a.localeCompare(b));
}
