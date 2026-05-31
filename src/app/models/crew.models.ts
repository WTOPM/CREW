export interface Port {
  name: string;
  code: string;
}

export const DEFAULT_PORTS: Port[] = [
  { name: 'Napoli', code: 'ITNAP' },
  { name: 'Marseille', code: 'FRMRS' },
  { name: 'Alger', code: 'DZALG' },
  { name: 'La Spezia', code: 'ITSPE' },
  { name: 'Limassol', code: 'CYLMS' },
  { name: 'Genoa', code: 'ITGOA' },
  { name: 'Salerno', code: 'ITSAL' },
  { name: 'Le Havre', code: 'FRLEH' },
  { name: 'Bejaia', code: 'DZBJA' },
  { name: 'Antwerp', code: 'BEANR' },
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
  passportValidity: string;
  sbookValidity: string;
  cyprusSeamansBook: string;
  cyprusValidity: string;
  visa: string;
  visaValidity: string;
  joiningDate: string;
  /** Port name (code resolved from ports directory). */
  joiningPort: string;
  archived: boolean;
}

export interface CrewArrFormSettings {
  isArrival: boolean;
  pageNo: number;
  /** Field 6 — type of identity document (Passport, Seaman's Book, …). */
  identityDocumentType: string;
}

export interface AppData {
  ship: ShipInfo;
  crew: CrewMember[];
  crewArr: CrewArrFormSettings;
  ports: Port[];
  ranks: string[];
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
    passportValidity: '',
    sbookValidity: '',
    cyprusSeamansBook: '',
    cyprusValidity: '',
    visa: '',
    visaValidity: '',
    joiningDate: '',
    joiningPort: '',
    archived: false,
  };
}

export function createDefaultCrewArrSettings(): CrewArrFormSettings {
  return {
    isArrival: true,
    pageNo: 1,
    identityDocumentType: 'Passport',
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
      map.set(key, { name: resolved.name, code: resolved.code || prev?.code || '' });
    } else if (ref.name) {
      const key = ref.name.toLowerCase();
      const prev = map.get(key);
      map.set(key, { name: ref.name, code: ref.code || prev?.code || '' });
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

export function migrateCrewMember(raw: Partial<CrewMember> & { familyNameGivenNames?: string }): CrewMember {
  const base = { ...createEmptyCrewMember(), ...raw };
  if (!base.familyName && !base.givenNames && raw.familyNameGivenNames) {
    const parsed = parseCrewName(raw.familyNameGivenNames);
    base.familyName = parsed.familyName;
    base.givenNames = parsed.givenNames;
  }
  return base;
}

export function mergeUniqueList(existing: string[], ...items: (string | undefined)[]): string[] {
  const set = new Set(existing.filter(Boolean));
  for (const item of items) {
    const v = item?.trim();
    if (v) set.add(v);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}
