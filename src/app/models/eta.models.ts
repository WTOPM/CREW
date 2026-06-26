/** planEta: departure + distance + speed → arrival. */
/** meetEtaByDeparture: target arrival + departure + distance → required speed. */
/** meetEtaBySpeed: target arrival + distance + speed → required departure. */
export type EtaScenario = 'planEta' | 'meetEtaByDeparture' | 'meetEtaBySpeed';

export interface EtaLeg {
  id: string;
  distanceNm: number;
  speedKnots: number;
  /** Manual name for this leg's end (intermediate). Last leg uses plan.toPort. */
  toLabel: string;
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
  legs: EtaLeg[];
  createdAt: string;
  updatedAt: string;
}

export interface EtaLibrarySettings {
  /** Working copy shown in the editor. */
  draft: EtaPlan;
  /** Saved voyage scenarios. */
  plans: EtaPlan[];
  /** Last loaded saved plan id (informational). */
  activePlanId: string | null;
}

export function createEtaLeg(partial: Partial<EtaLeg> = {}): EtaLeg {
  return {
    id: partial.id?.trim() || crypto.randomUUID(),
    distanceNm: clampPositive(partial.distanceNm, 0),
    speedKnots: clampPositive(partial.speedKnots, 0),
    toLabel: (partial.toLabel ?? '').trim(),
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
  };
}

function clampPositive(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
  if (!isFinite(n) || n < 0) return fallback;
  return n;
}

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

export function stepUtcOffsetHours(hours: number, delta: number): number {
  return clampOffsetHours(hours + delta);
}

function normalizeLeg(raw: unknown): EtaLeg {
  const r = raw as Partial<EtaLeg>;
  return createEtaLeg({
    id: r?.id,
    distanceNm: r?.distanceNm,
    speedKnots: r?.speedKnots,
    toLabel: r?.toLabel,
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
  const legsRaw = Array.isArray(r?.legs) && r.legs.length ? r.legs.map(normalizeLeg) : [createEtaLeg()];
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
    departureUtcOffsetHours: normalizeUtcOffsetHours(r?.departureUtcOffsetHours, 0),
    arrivalUtcOffsetHours: normalizeUtcOffsetHours(r?.arrivalUtcOffsetHours, 0),
    legs,
    createdAt: (r?.createdAt ?? '').trim() || now,
    updatedAt: (r?.updatedAt ?? '').trim() || now,
  };
}

export function normalizeEtaLibrary(raw: unknown): EtaLibrarySettings {
  const defaults = createDefaultEtaLibrary();
  if (!raw || typeof raw !== 'object') return defaults;
  const r = raw as Partial<EtaLibrarySettings>;
  const plans = Array.isArray(r.plans)
    ? r.plans.map((p, i) => normalizePlan(p, `Voyage ${i + 1}`))
    : [];
  const draft = r.draft ? normalizePlan(r.draft, defaults.draft.name) : structuredClone(defaults.draft);
  const activePlanId = (r.activePlanId ?? '').trim() || null;
  return {
    draft,
    plans,
    activePlanId: activePlanId && plans.some((p) => p.id === activePlanId) ? activePlanId : null,
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
