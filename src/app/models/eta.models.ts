import { normalizeEtaGpsCoords, type EtaGpsCoords } from '../utils/eta-gps.util';

/** planEta: departure + distance + speed → arrival. */
/** meetEtaByDeparture: target arrival + departure + distance → required speed. */
/** meetEtaBySpeed: target arrival + distance + speed → required departure. */
export type EtaScenario = 'planEta' | 'meetEtaByDeparture' | 'meetEtaBySpeed';

export type { EtaGpsCoords };

export interface EtaLeg {
  id: string;
  distanceNm: number;
  speedKnots: number;
  /** Manual name for this leg's end (intermediate). Last leg uses plan.toPort. */
  toLabel: string;
  /**
   * Manual ETA display UTC offset for this leg (hours).
   * null = auto (departure offset for intermediate legs, arrival offset for the last leg).
   */
  etaUtcOffsetHours: number | null;
  /** Optional GPS at this leg's TO (intermediate waypoint). */
  toGps: EtaGpsCoords | null;
}

export interface EtaPlan {
  id: string;
  name: string;
  fromPort: string;
  toPort: string;
  intermediatePorts: string[];
  scenario: EtaScenario;
  /** ISO date yyyy-MM-dd — departure port local date. */
  departureDate: string;
  /** HH:mm — departure port local time. */
  departureTime: string;
  /** ISO date yyyy-MM-dd — arrival port local date. */
  arrivalDate: string;
  /** HH:mm — arrival port local time. */
  arrivalTime: string;
  /** UTC offset in hours at departure port (e.g. 2 for UTC+2). */
  departureUtcOffsetHours: number;
  /** UTC offset in hours at arrival port (e.g. 1 for UTC+1). */
  arrivalUtcOffsetHours: number;
  /** Optional GPS at departure port (FROM of first leg). */
  fromGps: EtaGpsCoords | null;
  /** Optional GPS at arrival port (TO of last leg). */
  toGps: EtaGpsCoords | null;
  legs: EtaLeg[];
  createdAt: string;
  updatedAt: string;
}

export interface EtaWaypointGpsEntry {
  id: string;
  /** Display name (unique case-insensitively). */
  name: string;
  lat: number;
  lon: number;
}

export interface EtaLibrarySettings {
  /** Working copy shown in the editor. */
  draft: EtaPlan;
  /** Saved voyage scenarios. */
  plans: EtaPlan[];
  /** Last loaded saved plan id (informational). */
  activePlanId: string | null;
  /**
   * Ordered shared GPS catalog (unique name + unique coordinates).
   * Display order = array index + 1; drag-reorder reassigns numbers.
   */
  waypoints: EtaWaypointGpsEntry[];
}

import { truncateSpeedKnotsTenths } from '../utils/eta-speed-input.util';

function clampOffsetHours(hours: number): number {
  return Math.max(-12, Math.min(14, Math.round(hours * 2) / 2));
}

export function normalizeUtcOffsetHours(raw: unknown, fallback = 0): number {
  if (typeof raw === 'number' && isFinite(raw)) return clampOffsetHours(raw);
  const s = String(raw ?? '')
    .trim()
    .replace(/^UTC/i, '')
    .replace(',', '.');
  if (!s) return fallback;
  const n = parseFloat(s);
  return isFinite(n) ? clampOffsetHours(n) : fallback;
}

export function normalizeOptionalUtcOffsetHours(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number' && isFinite(raw)) return clampOffsetHours(raw);
  const s = String(raw).trim();
  if (!s) return null;
  return normalizeUtcOffsetHours(s, 0);
}

/** Inclusive offsets between the two ports, e.g. −1…+2 → [-1, 0, 1, 2]. */
export function legEtaUtcOffsetRange(
  departureUtcOffsetHours: number,
  arrivalUtcOffsetHours: number,
): number[] {
  const a = clampOffsetHours(departureUtcOffsetHours);
  const b = clampOffsetHours(arrivalUtcOffsetHours);
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const step = Number.isInteger(a) && Number.isInteger(b) ? 1 : 0.5;
  const out: number[] = [];
  for (let h = lo; h <= hi + 1e-9; h += step) {
    out.push(clampOffsetHours(h));
  }
  return out.length ? out : [a];
}

export function defaultLegEtaUtcOffsetHours(
  legIndex: number,
  legCount: number,
  departureUtcOffsetHours: number,
  arrivalUtcOffsetHours: number,
): number {
  return legIndex === legCount - 1 ? arrivalUtcOffsetHours : departureUtcOffsetHours;
}

export function clampLegEtaUtcOffsetHours(
  hours: number,
  departureUtcOffsetHours: number,
  arrivalUtcOffsetHours: number,
): number {
  const range = legEtaUtcOffsetRange(departureUtcOffsetHours, arrivalUtcOffsetHours);
  if (range.includes(hours)) return hours;
  return range.reduce((best, h) =>
    Math.abs(h - hours) < Math.abs(best - hours) ? h : best,
  );
}

export function resolveLegEtaUtcOffsetHours(
  leg: Pick<EtaLeg, 'etaUtcOffsetHours'>,
  legIndex: number,
  legCount: number,
  departureUtcOffsetHours: number,
  arrivalUtcOffsetHours: number,
): number {
  if (leg.etaUtcOffsetHours != null) {
    return clampLegEtaUtcOffsetHours(
      leg.etaUtcOffsetHours,
      departureUtcOffsetHours,
      arrivalUtcOffsetHours,
    );
  }
  return defaultLegEtaUtcOffsetHours(
    legIndex,
    legCount,
    departureUtcOffsetHours,
    arrivalUtcOffsetHours,
  );
}

/** Step ±1 along the departure↔arrival offset range. */
export function stepLegEtaUtcOffsetHours(
  current: number,
  departureUtcOffsetHours: number,
  arrivalUtcOffsetHours: number,
  delta: number,
): number {
  const range = legEtaUtcOffsetRange(departureUtcOffsetHours, arrivalUtcOffsetHours);
  if (range.length <= 1) return range[0] ?? current;
  let idx = range.indexOf(clampLegEtaUtcOffsetHours(current, departureUtcOffsetHours, arrivalUtcOffsetHours));
  if (idx < 0) idx = 0;
  const next = Math.max(0, Math.min(range.length - 1, idx + (delta < 0 ? -1 : delta > 0 ? 1 : 0)));
  return range[next]!;
}

export function createEtaLeg(partial: Partial<EtaLeg> = {}): EtaLeg {
  return {
    id: partial.id?.trim() || crypto.randomUUID(),
    distanceNm: clampPositive(partial.distanceNm, 0),
    speedKnots: truncateSpeedKnotsTenths(clampPositive(partial.speedKnots, 0)),
    toLabel: (partial.toLabel ?? '').trim(),
    etaUtcOffsetHours: normalizeOptionalUtcOffsetHours(partial.etaUtcOffsetHours),
    toGps: normalizeEtaGpsCoords(partial.toGps),
  };
}

export function createDefaultEtaPlan(name = 'New voyage'): EtaPlan {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name,
    fromPort: '',
    toPort: '',
    intermediatePorts: [],
    scenario: 'planEta',
    departureDate: '',
    departureTime: '12:00',
    arrivalDate: '',
    arrivalTime: '12:00',
    departureUtcOffsetHours: 0,
    arrivalUtcOffsetHours: 0,
    fromGps: null,
    toGps: null,
    legs: [createEtaLeg()],
    createdAt: now,
    updatedAt: now,
  };
}

export function createDefaultEtaLibrary(): EtaLibrarySettings {
  return {
    draft: createDefaultEtaPlan(),
    plans: [],
    activePlanId: null,
    waypoints: [],
  };
}

/** Normalize waypoint / port name for shared GPS lookup. */
export function etaWaypointGpsKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Coordinate fingerprint for uniqueness (≈0.1 m). */
export function etaWaypointGpsCoordKey(coords: EtaGpsCoords): string {
  return `${coords.lat.toFixed(6)},${coords.lon.toFixed(6)}`;
}

function isValidStoredGps(coords: EtaGpsCoords | null | undefined): coords is EtaGpsCoords {
  return !!normalizeEtaGpsCoords(coords);
}

function newWaypointId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `wp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createEtaWaypointGpsEntry(
  partial: Partial<EtaWaypointGpsEntry> & Pick<EtaWaypointGpsEntry, 'name' | 'lat' | 'lon'>,
): EtaWaypointGpsEntry | null {
  const name = partial.name.trim().replace(/\s+/g, ' ');
  const coords = normalizeEtaGpsCoords({ lat: partial.lat, lon: partial.lon });
  if (!name || !coords) return null;
  return {
    id: partial.id?.trim() || newWaypointId(),
    name,
    lat: coords.lat,
    lon: coords.lon,
  };
}

/** Migrate legacy Record + draft/plans GPS into an ordered unique list. */
export function normalizeEtaWaypoints(
  rawList: unknown,
  legacyMap: unknown,
  plans: EtaPlan[],
): EtaWaypointGpsEntry[] {
  const out: EtaWaypointGpsEntry[] = [];
  const byName = new Map<string, number>();
  const byCoord = new Map<string, number>();

  const push = (name: string, gps: EtaGpsCoords | null | undefined, id?: string): void => {
    const entry = createEtaWaypointGpsEntry({
      id,
      name,
      lat: gps?.lat ?? NaN,
      lon: gps?.lon ?? NaN,
    });
    if (!entry) return;
    const nk = etaWaypointGpsKey(entry.name);
    const ck = etaWaypointGpsCoordKey(entry);
    if (byName.has(nk) || byCoord.has(ck)) return;
    byName.set(nk, out.length);
    byCoord.set(ck, out.length);
    out.push(entry);
  };

  if (Array.isArray(rawList)) {
    for (const row of rawList) {
      if (!row || typeof row !== 'object') continue;
      const r = row as Partial<EtaWaypointGpsEntry>;
      push(String(r.name ?? ''), { lat: Number(r.lat), lon: Number(r.lon) }, r.id);
    }
  }

  const legacy = normalizeEtaWaypointGpsMap(legacyMap);
  for (const [key, coords] of Object.entries(legacy)) {
    push(key, coords);
  }

  for (const plan of plans) {
    push(plan.fromPort, plan.fromGps);
    push(plan.toPort, plan.toGps);
    for (let i = 0; i < plan.legs.length - 1; i++) {
      const leg = plan.legs[i]!;
      push(leg.toLabel, leg.toGps);
    }
  }

  return out;
}

/** @deprecated legacy map shape — still read during normalize. */
export function normalizeEtaWaypointGpsMap(raw: unknown): Record<string, EtaGpsCoords> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, EtaGpsCoords> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const k = etaWaypointGpsKey(key);
    const coords = normalizeEtaGpsCoords(value);
    if (k && coords) out[k] = coords;
  }
  return out;
}

export function findEtaWaypointByName(
  waypoints: EtaWaypointGpsEntry[],
  name: string,
): EtaWaypointGpsEntry | null {
  const key = etaWaypointGpsKey(name);
  if (!key) return null;
  return waypoints.find((w) => etaWaypointGpsKey(w.name) === key) ?? null;
}

export function findEtaWaypointByCoords(
  waypoints: EtaWaypointGpsEntry[],
  coords: EtaGpsCoords,
): EtaWaypointGpsEntry | null {
  const key = etaWaypointGpsCoordKey(coords);
  return waypoints.find((w) => etaWaypointGpsCoordKey(w) === key) ?? null;
}

/**
 * Upsert by unique name + unique coordinates.
 * Same name → update coords; same coords under another name → rename that row;
 * conflicts between two rows → keep one merged entry.
 */
export function upsertEtaWaypoint(
  waypoints: EtaWaypointGpsEntry[],
  name: string,
  coords: EtaGpsCoords,
): EtaWaypointGpsEntry[] {
  const entry = createEtaWaypointGpsEntry({ name, lat: coords.lat, lon: coords.lon });
  if (!entry) return waypoints;

  const nameKey = etaWaypointGpsKey(entry.name);
  const coordKey = etaWaypointGpsCoordKey(entry);
  const byNameIdx = waypoints.findIndex((w) => etaWaypointGpsKey(w.name) === nameKey);
  const byCoordIdx = waypoints.findIndex((w) => etaWaypointGpsCoordKey(w) === coordKey);

  if (byNameIdx >= 0 && byCoordIdx >= 0 && byNameIdx !== byCoordIdx) {
    const keepIdx = Math.min(byNameIdx, byCoordIdx);
    const dropIdx = Math.max(byNameIdx, byCoordIdx);
    const next = waypoints.slice();
    next[keepIdx] = { ...entry, id: waypoints[keepIdx]!.id };
    next.splice(dropIdx, 1);
    return next;
  }
  if (byNameIdx >= 0) {
    const next = waypoints.slice();
    next[byNameIdx] = { ...entry, id: waypoints[byNameIdx]!.id };
    return next;
  }
  if (byCoordIdx >= 0) {
    const next = waypoints.slice();
    next[byCoordIdx] = { ...entry, id: waypoints[byCoordIdx]!.id };
    return next;
  }
  return [...waypoints, entry];
}

export function removeEtaWaypoint(
  waypoints: EtaWaypointGpsEntry[],
  id: string,
): { waypoints: EtaWaypointGpsEntry[]; removed: EtaWaypointGpsEntry | null } {
  const idx = waypoints.findIndex((w) => w.id === id);
  if (idx < 0) return { waypoints, removed: null };
  const removed = waypoints[idx]!;
  return { waypoints: waypoints.filter((w) => w.id !== id), removed };
}

export function reorderEtaWaypoints(
  waypoints: EtaWaypointGpsEntry[],
  fromIndex: number,
  toIndex: number,
): EtaWaypointGpsEntry[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= waypoints.length ||
    toIndex >= waypoints.length
  ) {
    return waypoints;
  }
  const next = waypoints.slice();
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item!);
  return next;
}

/** Write/clear GPS on every FROM/TO/waypoint label that matches `name`. */
export function applyEtaGpsByWaypointName(
  plan: EtaPlan,
  name: string,
  coords: EtaGpsCoords | null,
): EtaPlan {
  const key = etaWaypointGpsKey(name);
  if (!key) return plan;

  const fromMatch = etaWaypointGpsKey(plan.fromPort) === key;
  const toMatch = etaWaypointGpsKey(plan.toPort) === key;
  const legs = plan.legs.map((leg, i) => {
    const isLast = i === plan.legs.length - 1;
    if (isLast) return leg;
    if (etaWaypointGpsKey(leg.toLabel) !== key) return leg;
    return { ...leg, toGps: coords };
  });

  if (!fromMatch && !toMatch && legs.every((leg, i) => leg === plan.legs[i])) {
    return plan;
  }

  return {
    ...plan,
    fromGps: fromMatch ? coords : plan.fromGps,
    toGps: toMatch ? coords : plan.toGps,
    legs,
  };
}

/** Find GPS for a name from the catalog, then draft/plans (first hit). */
export function resolveEtaWaypointGps(
  lib: Pick<EtaLibrarySettings, 'draft' | 'plans' | 'waypoints'>,
  name: string,
): EtaGpsCoords | null {
  const hit = findEtaWaypointByName(lib.waypoints ?? [], name);
  if (hit) return { lat: hit.lat, lon: hit.lon };

  const key = etaWaypointGpsKey(name);
  if (!key) return null;

  for (const plan of [lib.draft, ...lib.plans]) {
    if (etaWaypointGpsKey(plan.fromPort) === key && isValidStoredGps(plan.fromGps)) {
      return plan.fromGps;
    }
    if (etaWaypointGpsKey(plan.toPort) === key && isValidStoredGps(plan.toGps)) {
      return plan.toGps;
    }
    for (let i = 0; i < plan.legs.length - 1; i++) {
      const leg = plan.legs[i]!;
      if (etaWaypointGpsKey(leg.toLabel) === key && isValidStoredGps(leg.toGps)) {
        return leg.toGps;
      }
    }
  }
  return null;
}

/**
 * Keep existing GPS on re-emit / same name; apply known shared coords when available;
 * clear only when the label actually changes to an unknown name.
 */
export function pickEtaGpsForRenamedWaypoint(
  previousName: string,
  nextName: string,
  previousGps: EtaGpsCoords | null | undefined,
  knownForNextName: EtaGpsCoords | null,
): EtaGpsCoords | null {
  if (knownForNextName) return knownForNextName;
  const nextKey = etaWaypointGpsKey(nextName);
  if (!nextKey) return null;
  if (etaWaypointGpsKey(previousName) === nextKey) {
    return normalizeEtaGpsCoords(previousGps);
  }
  return null;
}

/**
 * Fill empty GPS slots on a plan from shared names (catalog + other plans).
 * Does not overwrite coords already set on the plan.
 */
export function hydrateEtaPlanWaypointGps(
  plan: EtaPlan,
  lib: Pick<EtaLibrarySettings, 'draft' | 'plans' | 'waypoints'>,
): EtaPlan {
  let next = plan;
  const names = new Set<string>();
  const fromKey = etaWaypointGpsKey(plan.fromPort);
  const toKey = etaWaypointGpsKey(plan.toPort);
  if (fromKey) names.add(plan.fromPort);
  if (toKey) names.add(plan.toPort);
  for (let i = 0; i < plan.legs.length - 1; i++) {
    const label = plan.legs[i]?.toLabel?.trim();
    if (label) names.add(label);
  }

  for (const name of names) {
    const coords = resolveEtaWaypointGps(lib, name);
    if (!coords) continue;
    const key = etaWaypointGpsKey(name);
    const needsFrom = key === fromKey && !isValidStoredGps(next.fromGps);
    const needsTo = key === toKey && !isValidStoredGps(next.toGps);
    const needsLeg = next.legs.some(
      (leg, i) =>
        i < next.legs.length - 1 &&
        etaWaypointGpsKey(leg.toLabel) === key &&
        !isValidStoredGps(leg.toGps),
    );
    if (!needsFrom && !needsTo && !needsLeg) continue;
    next = applyEtaGpsByWaypointName(next, name, coords);
  }
  return next;
}

function clampPositive(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
  if (!isFinite(n) || n < 0) return fallback;
  return n;
}

export function stepUtcOffsetHours(hours: number, delta: number): number {
  return clampOffsetHours(hours + delta);
}

type LegacyEtaLeg = Partial<EtaLeg> & { etaTzSource?: 'departure' | 'arrival' | null };

function normalizeLeg(
  raw: unknown,
  departureUtcOffsetHours: number,
  arrivalUtcOffsetHours: number,
): EtaLeg {
  const r = raw as LegacyEtaLeg;
  let etaUtcOffsetHours = normalizeOptionalUtcOffsetHours(r?.etaUtcOffsetHours);
  if (etaUtcOffsetHours == null) {
    if (r?.etaTzSource === 'arrival') etaUtcOffsetHours = arrivalUtcOffsetHours;
    else if (r?.etaTzSource === 'departure') etaUtcOffsetHours = departureUtcOffsetHours;
  }
  return createEtaLeg({
    id: r?.id,
    distanceNm: r?.distanceNm,
    speedKnots: r?.speedKnots,
    toLabel: r?.toLabel,
    etaUtcOffsetHours,
    toGps: r?.toGps,
  });
}

function applyLegacyIntermediatePorts(legs: EtaLeg[], intermediatePorts: string[]): EtaLeg[] {
  if (!intermediatePorts.length) return legs;
  return legs.map((leg, i) => {
    if (i >= legs.length - 1) return leg;
    const legacy = intermediatePorts[i]?.trim();
    if (!legacy || leg.toLabel.trim()) return leg;
    return { ...leg, toLabel: legacy };
  });
}

type LegacyEtaPlan = Partial<EtaPlan> & {
  calcMode?: 'fromDeparture' | 'fromArrival';
  anchorDate?: string;
  anchorTime?: string;
};

function normalizeScenario(raw: LegacyEtaPlan): EtaScenario {
  if (
    raw.scenario === 'planEta' ||
    raw.scenario === 'meetEtaByDeparture' ||
    raw.scenario === 'meetEtaBySpeed'
  ) {
    return raw.scenario;
  }
  return raw.calcMode === 'fromArrival' ? 'meetEtaBySpeed' : 'planEta';
}

function migrateScheduleFields(raw: LegacyEtaPlan, scenario: EtaScenario): Pick<EtaPlan, 'departureDate' | 'departureTime' | 'arrivalDate' | 'arrivalTime'> {
  let departureDate = (raw.departureDate ?? '').trim();
  let departureTime = (raw.departureTime ?? '').trim() || '12:00';
  let arrivalDate = (raw.arrivalDate ?? '').trim();
  let arrivalTime = (raw.arrivalTime ?? '').trim() || '12:00';

  const anchorDate = (raw.anchorDate ?? '').trim();
  const anchorTime = (raw.anchorTime ?? '').trim() || '12:00';
  if (anchorDate) {
    if (scenario === 'planEta' || scenario === 'meetEtaByDeparture') {
      if (!departureDate) {
        departureDate = anchorDate;
        departureTime = anchorTime;
      }
    } else if (!arrivalDate) {
      arrivalDate = anchorDate;
      arrivalTime = anchorTime;
    }
  }

  return { departureDate, departureTime, arrivalDate, arrivalTime };
}

function normalizePlan(raw: unknown, fallbackName: string): EtaPlan {
  const r = raw as LegacyEtaPlan;
  const now = new Date().toISOString();
  const scenario = normalizeScenario(r);
  const schedule = migrateScheduleFields(r, scenario);
  const departureUtcOffsetHours = normalizeUtcOffsetHours(r?.departureUtcOffsetHours, 0);
  const arrivalUtcOffsetHours = normalizeUtcOffsetHours(r?.arrivalUtcOffsetHours, 0);
  const legsRaw =
    Array.isArray(r?.legs) && r.legs.length
      ? r.legs.map((leg) => normalizeLeg(leg, departureUtcOffsetHours, arrivalUtcOffsetHours))
      : [createEtaLeg()];
  const intermediatePorts = Array.isArray(r?.intermediatePorts)
    ? r.intermediatePorts.map((p) => String(p ?? '').trim())
    : [];
  const legs = applyLegacyIntermediatePorts(legsRaw, intermediatePorts);
  return {
    id: (r?.id ?? '').trim() || crypto.randomUUID(),
    name: (r?.name ?? '').trim() || fallbackName,
    fromPort: (r?.fromPort ?? '').trim(),
    toPort: (r?.toPort ?? '').trim(),
    intermediatePorts,
    scenario,
    ...schedule,
    departureUtcOffsetHours,
    arrivalUtcOffsetHours,
    fromGps: normalizeEtaGpsCoords(r?.fromGps),
    toGps: normalizeEtaGpsCoords(r?.toGps),
    legs,
    createdAt: (r?.createdAt ?? '').trim() || now,
    updatedAt: (r?.updatedAt ?? '').trim() || now,
  };
}

export function normalizeEtaLibrary(raw: unknown): EtaLibrarySettings {
  const defaults = createDefaultEtaLibrary();
  if (!raw || typeof raw !== 'object') return defaults;
  const r = raw as Partial<EtaLibrarySettings> & { waypointGps?: unknown };
  let plans = Array.isArray(r.plans)
    ? r.plans.map((p, i) => normalizePlan(p, `Voyage ${i + 1}`))
    : [];
  let draft = r.draft ? normalizePlan(r.draft, defaults.draft.name) : structuredClone(defaults.draft);
  const activePlanId = (r.activePlanId ?? '').trim() || null;

  const waypoints = normalizeEtaWaypoints(r.waypoints, r.waypointGps, [draft, ...plans]);
  const catalogLib = { draft, plans, waypoints };
  draft = hydrateEtaPlanWaypointGps(draft, catalogLib);
  plans = plans.map((plan) => hydrateEtaPlanWaypointGps(plan, catalogLib));

  return {
    draft,
    plans,
    activePlanId: activePlanId && plans.some((p) => p.id === activePlanId) ? activePlanId : null,
    waypoints,
  };
}

export function cloneEtaPlan(plan: EtaPlan): EtaPlan {
  return structuredClone(plan);
}

/** Suggested name when saving (from → to ports). */
export function defaultEtaSaveName(plan: Pick<EtaPlan, 'fromPort' | 'toPort'>): string {
  const from = plan.fromPort.trim();
  const to = plan.toPort.trim();
  if (from && to) return `${from} — ${to}`;
  return from || to || '';
}

/** Label in the load list: user name + route. */
export function etaPlanDisplayLabel(plan: Pick<EtaPlan, 'name' | 'fromPort' | 'toPort'>): string {
  const name = plan.name.trim();
  const from = plan.fromPort.trim();
  const to = plan.toPort.trim();
  const route = from && to ? `${from} → ${to}` : from || to;
  if (name && route) return `${name} · ${route}`;
  if (name) return name;
  return route || 'Unnamed';
}
