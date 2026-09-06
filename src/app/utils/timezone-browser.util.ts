/** World timezone browser + port → IANA helpers for ETA UTC autofill. */

import type { Port } from '../models/crew.models';
import { normalizeUtcOffsetHours } from '../models/eta.models';

export type DstSeason = 'summer' | 'winter' | 'none';

export interface TimezoneRow {
  id: string;
  region: string;
  cityLabel: string;
  /** Example / known ports in this zone (for search + display). */
  portNames: string[];
  portsLabel: string;
  offsetMinutes: number;
  offsetLabel: string;
  dstSeason: DstSeason;
  dstSeasonLabel: string;
  /** Human-readable next clock change, or "—" if none. */
  nextChangeLabel: string;
}

/** Minimal fallback when `Intl.supportedValuesOf('timeZone')` is missing. */
const FALLBACK_TIME_ZONES = [
  'UTC',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Rome',
  'Europe/Madrid',
  'Europe/Athens',
  'Europe/Kyiv',
  'Europe/Moscow',
  'Europe/Istanbul',
  'Asia/Nicosia',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Manila',
  'Asia/Kolkata',
  'Africa/Cairo',
  'Africa/Algiers',
  'Africa/Lagos',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'America/Argentina/Buenos_Aires',
  'Australia/Sydney',
  'Pacific/Auckland',
] as const;

/**
 * Primary IANA zone by country name (upper/normalized keys).
 * Maritime-heavy list; unknown countries fall back to id/country matching.
 */
const COUNTRY_PRIMARY_TIMEZONE: Record<string, string> = {
  CYPRUS: 'Asia/Nicosia',
  ITALY: 'Europe/Rome',
  SPAIN: 'Europe/Madrid',
  FRANCE: 'Europe/Paris',
  GERMANY: 'Europe/Berlin',
  NETHERLANDS: 'Europe/Amsterdam',
  BELGIUM: 'Europe/Brussels',
  'UNITED KINGDOM': 'Europe/London',
  UK: 'Europe/London',
  'GREAT BRITAIN': 'Europe/London',
  GREECE: 'Europe/Athens',
  TURKEY: 'Europe/Istanbul',
  TURKIYE: 'Europe/Istanbul',
  UKRAINE: 'Europe/Kyiv',
  RUSSIA: 'Europe/Moscow',
  'RUSSIAN FEDERATION': 'Europe/Moscow',
  POLAND: 'Europe/Warsaw',
  ROMANIA: 'Europe/Bucharest',
  BULGARIA: 'Europe/Sofia',
  GEORGIA: 'Asia/Tbilisi',
  MALTA: 'Europe/Malta',
  PORTUGAL: 'Europe/Lisbon',
  CROATIA: 'Europe/Zagreb',
  SLOVENIA: 'Europe/Ljubljana',
  MONACO: 'Europe/Monaco',
  ALGERIA: 'Africa/Algiers',
  MOROCCO: 'Africa/Casablanca',
  TUNISIA: 'Africa/Tunis',
  EGYPT: 'Africa/Cairo',
  LIBYA: 'Africa/Tripoli',
  'SOUTH AFRICA': 'Africa/Johannesburg',
  NIGERIA: 'Africa/Lagos',
  'UNITED ARAB EMIRATES': 'Asia/Dubai',
  UAE: 'Asia/Dubai',
  'SAUDI ARABIA': 'Asia/Riyadh',
  OMAN: 'Asia/Muscat',
  QATAR: 'Asia/Qatar',
  BAHRAIN: 'Asia/Bahrain',
  KUWAIT: 'Asia/Kuwait',
  INDIA: 'Asia/Kolkata',
  'SRI LANKA': 'Asia/Colombo',
  SINGAPORE: 'Asia/Singapore',
  MALAYSIA: 'Asia/Kuala_Lumpur',
  INDONESIA: 'Asia/Jakarta',
  PHILIPPINES: 'Asia/Manila',
  CHINA: 'Asia/Shanghai',
  'HONG KONG': 'Asia/Hong_Kong',
  TAIWAN: 'Asia/Taipei',
  JAPAN: 'Asia/Tokyo',
  'SOUTH KOREA': 'Asia/Seoul',
  KOREA: 'Asia/Seoul',
  VIETNAM: 'Asia/Ho_Chi_Minh',
  THAILAND: 'Asia/Bangkok',
  AUSTRALIA: 'Australia/Sydney',
  'NEW ZEALAND': 'Pacific/Auckland',
  USA: 'America/New_York',
  'UNITED STATES': 'America/New_York',
  'UNITED STATES OF AMERICA': 'America/New_York',
  CANADA: 'America/Toronto',
  MEXICO: 'America/Mexico_City',
  BRAZIL: 'America/Sao_Paulo',
  ARGENTINA: 'America/Argentina/Buenos_Aires',
  CHILE: 'America/Santiago',
  PANAMA: 'America/Panama',
  COLOMBIA: 'America/Bogota',
  PERU: 'America/Lima',
  ISRAEL: 'Asia/Jerusalem',
  LEBANON: 'Asia/Beirut',
  SYRIA: 'Asia/Damascus',
  JORDAN: 'Asia/Amman',
  IRAQ: 'Asia/Baghdad',
  IRAN: 'Asia/Tehran',
  PAKISTAN: 'Asia/Karachi',
  BANGLADESH: 'Asia/Dhaka',
  NORWAY: 'Europe/Oslo',
  SWEDEN: 'Europe/Stockholm',
  DENMARK: 'Europe/Copenhagen',
  FINLAND: 'Europe/Helsinki',
  ESTONIA: 'Europe/Tallinn',
  LATVIA: 'Europe/Riga',
  LITHUANIA: 'Europe/Vilnius',
  IRELAND: 'Europe/Dublin',
  ICELAND: 'Atlantic/Reykjavik',
};

/**
 * Well-known ports → IANA zone (IANA names cities, not ports — Hamburg ≠ Berlin id).
 * Keys are lowercase for lookup.
 */
const PORT_ALIASES: Record<string, string> = {
  hamburg: 'Europe/Berlin',
  bremerhaven: 'Europe/Berlin',
  bremen: 'Europe/Berlin',
  wilhelmshaven: 'Europe/Berlin',
  kiel: 'Europe/Berlin',
  rostock: 'Europe/Berlin',
  rotterdam: 'Europe/Amsterdam',
  amsterdam: 'Europe/Amsterdam',
  antwerp: 'Europe/Brussels',
  antwerpen: 'Europe/Brussels',
  zeebrugge: 'Europe/Brussels',
  lehavre: 'Europe/Paris',
  'le havre': 'Europe/Paris',
  marseille: 'Europe/Paris',
  dunkirk: 'Europe/Paris',
  dunkerque: 'Europe/Paris',
  genoa: 'Europe/Rome',
  genova: 'Europe/Rome',
  livorno: 'Europe/Rome',
  laSpezia: 'Europe/Rome',
  'la spezia': 'Europe/Rome',
  gioiaTauro: 'Europe/Rome',
  'gioia tauro': 'Europe/Rome',
  trieste: 'Europe/Rome',
  venice: 'Europe/Rome',
  napoli: 'Europe/Rome',
  naples: 'Europe/Rome',
  barcelona: 'Europe/Madrid',
  valencia: 'Europe/Madrid',
  algeciras: 'Europe/Madrid',
  bilbao: 'Europe/Madrid',
  lisbon: 'Europe/Lisbon',
  sines: 'Europe/Lisbon',
  piraeus: 'Europe/Athens',
  thessaloniki: 'Europe/Athens',
  istanbul: 'Europe/Istanbul',
  izmir: 'Europe/Istanbul',
  mersin: 'Europe/Istanbul',
  limassol: 'Asia/Nicosia',
  larnaca: 'Asia/Nicosia',
  odessa: 'Europe/Kyiv',
  odesa: 'Europe/Kyiv',
  chornomorsk: 'Europe/Kyiv',
  constanta: 'Europe/Bucharest',
  varna: 'Europe/Sofia',
  burgas: 'Europe/Sofia',
  gdansk: 'Europe/Warsaw',
  gdynia: 'Europe/Warsaw',
  szczecin: 'Europe/Warsaw',
  klaipeda: 'Europe/Vilnius',
  riga: 'Europe/Riga',
  tallinn: 'Europe/Tallinn',
  helsinki: 'Europe/Helsinki',
  gothenburg: 'Europe/Stockholm',
  goteborg: 'Europe/Stockholm',
  oslo: 'Europe/Oslo',
  aarhus: 'Europe/Copenhagen',
  copenhagen: 'Europe/Copenhagen',
  southampton: 'Europe/London',
  felixstowe: 'Europe/London',
  london: 'Europe/London',
  liverpool: 'Europe/London',
  alger: 'Africa/Algiers',
  algiers: 'Africa/Algiers',
  oran: 'Africa/Algiers',
  tangier: 'Africa/Casablanca',
  tangiers: 'Africa/Casablanca',
  casablanca: 'Africa/Casablanca',
  tunis: 'Africa/Tunis',
  alexandria: 'Africa/Cairo',
  portSaid: 'Africa/Cairo',
  'port said': 'Africa/Cairo',
  suez: 'Africa/Cairo',
  dubai: 'Asia/Dubai',
  'jebel ali': 'Asia/Dubai',
  jebelali: 'Asia/Dubai',
  sharjah: 'Asia/Dubai',
  abuDhabi: 'Asia/Dubai',
  'abu dhabi': 'Asia/Dubai',
  jeddah: 'Asia/Riyadh',
  dammam: 'Asia/Riyadh',
  singapore: 'Asia/Singapore',
  'port kelang': 'Asia/Kuala_Lumpur',
  portkelang: 'Asia/Kuala_Lumpur',
  'tanjung pelepas': 'Asia/Kuala_Lumpur',
  manila: 'Asia/Manila',
  'busan': 'Asia/Seoul',
  shanghai: 'Asia/Shanghai',
  ningbo: 'Asia/Shanghai',
  'hong kong': 'Asia/Hong_Kong',
  hongkong: 'Asia/Hong_Kong',
  tokyo: 'Asia/Tokyo',
  yokohama: 'Asia/Tokyo',
  'los angeles': 'America/Los_Angeles',
  'long beach': 'America/Los_Angeles',
  'new york': 'America/New_York',
  'new jersey': 'America/New_York',
  houston: 'America/Chicago',
  'new orleans': 'America/Chicago',
  miami: 'America/New_York',
  santos: 'America/Sao_Paulo',
  'buenos aires': 'America/Argentina/Buenos_Aires',
  sydney: 'Australia/Sydney',
  melbourne: 'Australia/Sydney',
  auckland: 'Pacific/Auckland',
  'tanger med': 'Africa/Casablanca',
  'tanger-med': 'Africa/Casablanca',
  malaga: 'Europe/Madrid',
  cartagena: 'Europe/Madrid',
  taranto: 'Europe/Rome',
  ravenna: 'Europe/Rome',
  ancona: 'Europe/Rome',
  'st petersburg': 'Europe/Moscow',
  'saint petersburg': 'Europe/Moscow',
  novorossiysk: 'Europe/Moscow',
  murmansk: 'Europe/Moscow',
};

function titleCasePort(key: string): string {
  return key
    .split(/[\s-]+/)
    .map((w) => (w.length ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(' ');
}

function buildPortsByZone(
  zones: readonly string[],
  extraPorts: readonly Pick<Port, 'name' | 'country' | 'timeZone'>[],
): Map<string, string[]> {
  const map = new Map<string, Set<string>>();
  const ensure = (zone: string) => {
    let set = map.get(zone);
    if (!set) {
      set = new Set();
      map.set(zone, set);
    }
    return set;
  };

  for (const [port, zone] of Object.entries(PORT_ALIASES)) {
    if (!zones.includes(zone)) continue;
    ensure(zone).add(titleCasePort(port));
  }

  for (const port of extraPorts) {
    const tz = resolveTimezoneForPort(port, zones);
    if (!tz || !port.name?.trim()) continue;
    ensure(tz).add(port.name.trim());
  }

  const out = new Map<string, string[]>();
  for (const [zone, set] of map) {
    out.set(zone, [...set].sort((a, b) => a.localeCompare(b)));
  }
  return out;
}

export function listIanaTimeZones(): string[] {
  try {
    const intl = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] };
    if (typeof intl.supportedValuesOf === 'function') {
      const zones = intl.supportedValuesOf('timeZone');
      if (Array.isArray(zones) && zones.length) return zones.slice();
    }
  } catch {
    /* ignore */
  }
  return [...FALLBACK_TIME_ZONES];
}

export function getSystemTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Offset of `timeZone` relative to UTC at instant `at`, in minutes. */
export function getUtcOffsetMinutes(timeZone: string, at: Date = new Date()): number {
  try {
    const utc = new Date(at.toLocaleString('en-US', { timeZone: 'UTC' }));
    const local = new Date(at.toLocaleString('en-US', { timeZone }));
    return Math.round((local.getTime() - utc.getTime()) / 60_000);
  } catch {
    return 0;
  }
}

export function formatOffsetLabel(offsetMinutes: number): string {
  const sign = offsetMinutes < 0 ? '-' : '+';
  const abs = Math.abs(offsetMinutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (m === 0) return `UTC${sign}${h}`;
  return `UTC${sign}${h}:${String(m).padStart(2, '0')}`;
}

/** ETA uses half-hour UTC hour offsets. */
export function offsetMinutesToEtaHours(offsetMinutes: number): number {
  return normalizeUtcOffsetHours(offsetMinutes / 60, 0);
}

export function cityLabelFromZoneId(id: string): string {
  const slash = id.lastIndexOf('/');
  const raw = slash >= 0 ? id.slice(slash + 1) : id;
  return raw.replace(/_/g, ' ');
}

export function regionFromZoneId(id: string): string {
  const slash = id.indexOf('/');
  return slash >= 0 ? id.slice(0, slash) : 'Other';
}

export function dstSeasonLabel(season: DstSeason): string {
  if (season === 'summer') return 'Summer time';
  if (season === 'winter') return 'Winter time';
  return 'No DST';
}

/** Winter / summer / none at instant `at` (Jan vs Jul offset comparison). */
export function getDstSeason(timeZone: string, at: Date): DstSeason {
  const year = at.getUTCFullYear();
  const jan = getUtcOffsetMinutes(timeZone, new Date(Date.UTC(year, 0, 15, 12)));
  const jul = getUtcOffsetMinutes(timeZone, new Date(Date.UTC(year, 6, 15, 12)));
  if (jan === jul) return 'none';
  const now = getUtcOffsetMinutes(timeZone, at);
  const summerOffset = Math.max(jan, jul);
  return now === summerOffset ? 'summer' : 'winter';
}

export interface DstTransition {
  at: Date;
  fromOffsetMinutes: number;
  toOffsetMinutes: number;
  toSeason: DstSeason;
}

/**
 * Next DST / offset change after `from` (scan ~14 months).
 * Coarse weekly steps, then refine — cheap enough for idle batching per zone.
 */
export function findNextDstTransition(
  timeZone: string,
  from: Date = new Date(),
): DstTransition | null {
  const start = from.getTime();
  const end = start + 420 * 24 * 60 * 60 * 1000;
  const coarse = 7 * 24 * 60 * 60 * 1000;
  let prevT = start;
  let prevOff = getUtcOffsetMinutes(timeZone, new Date(prevT));
  for (let t = start + coarse; t <= end; t += coarse) {
    const off = getUtcOffsetMinutes(timeZone, new Date(t));
    if (off === prevOff) {
      prevT = t;
      continue;
    }
    // Refine with 6h then 1min binary search inside the week window
    let lo = prevT;
    let hi = t;
    const midStep = 6 * 60 * 60 * 1000;
    for (let m = lo + midStep; m < hi; m += midStep) {
      if (getUtcOffsetMinutes(timeZone, new Date(m)) !== prevOff) {
        hi = m;
        break;
      }
      lo = m;
    }
    while (hi - lo > 60_000) {
      const mid = Math.floor((lo + hi) / 2);
      if (getUtcOffsetMinutes(timeZone, new Date(mid)) === prevOff) lo = mid;
      else hi = mid;
    }
    const at = new Date(hi);
    const toSeason = getDstSeason(timeZone, new Date(hi + 60_000));
    return {
      at,
      fromOffsetMinutes: prevOff,
      toOffsetMinutes: off,
      toSeason,
    };
  }
  return null;
}

function formatLocalDateTime(timeZone: string, at: Date): string {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(at);
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === type)?.value ?? '';
    return `${get('day')}.${get('month')}.${get('year')} ${get('hour')}:${get('minute')}`;
  } catch {
    return at.toISOString();
  }
}

export function formatNextChangeLabel(timeZone: string, from: Date = new Date()): string {
  const next = findNextDstTransition(timeZone, from);
  if (!next) return '—';
  const when = formatLocalDateTime(timeZone, next.at);
  const toOff = formatOffsetLabel(next.toOffsetMinutes);
  const season =
    next.toSeason === 'summer'
      ? 'summer'
      : next.toSeason === 'winter'
        ? 'winter'
        : 'standard';
  const delta = next.toOffsetMinutes - next.fromOffsetMinutes;
  const move = delta > 0 ? 'forward' : 'back';
  return `${when} local · clocks ${move} → ${toOff} (${season})`;
}

/**
 * Fast row list — no next-clock-change scan (that is O(zones × year) and freezes the UI).
 * Fill `nextChangeLabel` later via {@link formatNextChangeLabel} in idle batches.
 */
export function buildTimezoneRows(
  at: Date = new Date(),
  extraPorts: readonly Pick<Port, 'name' | 'country' | 'timeZone'>[] = [],
): TimezoneRow[] {
  const zones = listIanaTimeZones();
  const portsByZone = buildPortsByZone(zones, extraPorts);
  const rows = zones.map((id) => {
    const offsetMinutes = getUtcOffsetMinutes(id, at);
    const dstSeason = getDstSeason(id, at);
    const portNames = portsByZone.get(id) ?? [];
    return {
      id,
      region: regionFromZoneId(id),
      cityLabel: cityLabelFromZoneId(id),
      portNames,
      portsLabel: portNames.length ? portNames.slice(0, 8).join(', ') : '—',
      offsetMinutes,
      offsetLabel: formatOffsetLabel(offsetMinutes),
      dstSeason,
      dstSeasonLabel: dstSeasonLabel(dstSeason),
      nextChangeLabel: '',
    } satisfies TimezoneRow;
  });
  rows.sort((a, b) => {
    if (a.offsetMinutes !== b.offsetMinutes) return a.offsetMinutes - b.offsetMinutes;
    return a.id.localeCompare(b.id);
  });
  return rows;
}

export function searchTimezoneRows(rows: readonly TimezoneRow[], query: string): TimezoneRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...rows];
  const compact = q.replace(/\s+/g, '');

  // Direct port alias → prefer that zone first in results
  const aliasZone = PORT_ALIASES[q] || PORT_ALIASES[compact];

  const matched = rows.filter((row) => {
    if (aliasZone && row.id === aliasZone) return true;
    const ports = row.portNames.join(' ').toLowerCase();
    const hay = `${row.id} ${row.cityLabel} ${row.region} ${row.offsetLabel} ${ports} ${row.dstSeasonLabel}`.toLowerCase();
    if (hay.includes(q)) return true;
    if (compact.startsWith('utc') || compact.startsWith('+') || compact.startsWith('-')) {
      return row.offsetLabel.toLowerCase().replace(/\s+/g, '').includes(compact);
    }
    return false;
  });

  if (aliasZone) {
    matched.sort((a, b) => {
      if (a.id === aliasZone) return -1;
      if (b.id === aliasZone) return 1;
      return 0;
    });
  }
  return matched;
}

export function uniqueOffsetLabels(rows: readonly TimezoneRow[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const sorted = [...rows].sort((a, b) => a.offsetMinutes - b.offsetMinutes);
  for (const row of sorted) {
    if (seen.has(row.offsetLabel)) continue;
    seen.add(row.offsetLabel);
    out.push(row.offsetLabel);
  }
  return out;
}

export function normalizeCountryKey(country: string | undefined | null): string {
  return String(country ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

function lookupPortAlias(portName: string): string | null {
  const key = portName.trim().toLowerCase();
  if (!key) return null;
  return PORT_ALIASES[key] ?? PORT_ALIASES[key.replace(/\s+/g, '')] ?? null;
}

/** Resolve IANA id for a port (explicit timeZone, else port alias, else country). */
export function resolveTimezoneForPort(
  port: Pick<Port, 'name' | 'country' | 'timeZone'> | null | undefined,
  availableZones: readonly string[] = listIanaTimeZones(),
): string | null {
  if (!port) return null;
  const explicit = String(port.timeZone ?? '').trim();
  if (explicit && availableZones.includes(explicit)) return explicit;

  const alias = lookupPortAlias(port.name ?? '');
  if (alias && availableZones.includes(alias)) return alias;

  const countryKey = normalizeCountryKey(port.country);
  if (countryKey) {
    const primary = COUNTRY_PRIMARY_TIMEZONE[countryKey];
    if (primary && availableZones.includes(primary)) return primary;

    const token = countryKey.toLowerCase().replace(/[^a-z]/g, '');
    if (token.length >= 4) {
      const hit = availableZones.find((z) => z.toLowerCase().includes(token));
      if (hit) return hit;
    }
  }

  const portToken = String(port.name ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, '');
  if (portToken.length >= 4) {
    const hit = availableZones.find((z) => {
      const city = cityLabelFromZoneId(z).toLowerCase().replace(/[^a-z]/g, '');
      return city.includes(portToken) || portToken.includes(city);
    });
    if (hit) return hit;
  }

  return null;
}

/** Instant for offset calc: ISO date yyyy-MM-dd at noon UTC, else now. */
export function instantFromIsoDate(isoDate: string | undefined | null, fallback = new Date()): Date {
  const s = String(isoDate ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T12:00:00Z`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return fallback;
}

export function etaUtcOffsetHoursForPort(
  port: Pick<Port, 'name' | 'country' | 'timeZone'> | null | undefined,
  atIsoDate?: string | null,
): number | null {
  const tz = resolveTimezoneForPort(port);
  if (!tz) return null;
  const at = instantFromIsoDate(atIsoDate);
  return offsetMinutesToEtaHours(getUtcOffsetMinutes(tz, at));
}
