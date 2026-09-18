/** Fuel log (FO-VPC / SHAPOLI Excel) — events for VPS report prep. */

/** Canonical kinds used for viewing / VPS mapping. */
export type FuelEventKind =
  | 'arrival'
  | 'departure'
  | 'start_sea'
  | 'end_sea'
  | 'shifting'
  | 'noon'
  | 'port_report'
  | 'canal'
  | 'anchor'
  | 'bunker'
  | 'offhire'
  | 'other';

/** Default view: VPS passage events only (no shifting / noon). */
export const FUEL_DEFAULT_VISIBLE_KINDS: FuelEventKind[] = [
  'arrival',
  'departure',
  'start_sea',
  'end_sea',
];

export const FUEL_EVENT_KIND_LABELS: Record<FuelEventKind, string> = {
  arrival: 'Arrival',
  departure: 'Departure',
  start_sea: 'Start sea passage',
  end_sea: 'End of passage',
  shifting: 'Shifting',
  noon: 'Noon',
  port_report: 'Port report',
  canal: 'Canal',
  anchor: 'Anchor',
  bunker: 'Bunker',
  offhire: 'Off-hire',
  other: 'Other',
};

/** Column header titles (hover tips). */
export const FUEL_COLUMN_TIPS = {
  date: 'Event date from the fuel log (local ship date).',
  time: 'Event time from the fuel log (HH:mm).',
  place: 'Port name or Sea for the event.',
  kind: 'Normalized type used for filters (Arrival, Departure, Shifting, …).',
  rawEvent: 'Original Excel label (BOSP, FEW, SBE/Shifting, …).',
  hrs: 'Hours since the previous visible event. Hidden events in between are summed in.',
  meMt: 'Main engine fuel consumed in this period (mt) — Excel Fuel Log MASTER, 1 decimal.',
  aeMt: 'Auxiliary engines fuel consumed in this period (mt).',
  boilerMt: 'Boiler fuel consumed in this period (mt).',
  totalMt: 'Total fuel consumption for the period (mt).',
  robB100: 'ROB of biofuel blend (B100) at this event (mt).',
  robDma: 'ROB of DMA / MGO at this event (mt).',
  meHours: 'Main engine running hours (CENG / VPC Drivers).',
  meRpm: 'Main engine average RPM (CENG / VPC Drivers).',
  meKw: 'Main engine / shaft power in kW (CENG / VPC Drivers).',
  ae1Hours: 'Aux engine 1 running hours.',
  ae1Kw: 'Aux engine 1 total energy for the event (kWh) — not average kW/h.',
  ae2Hours: 'Aux engine 2 running hours.',
  ae2Kw: 'Aux engine 2 total energy for the event (kWh) — not average kW/h.',
  ae3Hours: 'Aux engine 3 running hours.',
  ae3Kw: 'Aux engine 3 total energy for the event (kWh) — not average kW/h.',
  boilerHours: 'Boiler running hours.',
} as const;

/** One row from Fuel Log MASTER (optionally enriched from CENG). */
export interface FuelLogEvent {
  id: string;
  /** Port name or "Sea". */
  place: string;
  /** Raw Excel event text (BOSP / EOSP / SBE / …). */
  rawEvent: string;
  kind: FuelEventKind;
  /** ISO date yyyy-MM-dd. */
  date: string;
  /** HH:mm local. */
  time: string;
  /** Hours since previous event. */
  timeUsedHours: number | null;
  /** ULSFO / bio total consumption mt. */
  totalMt: number | null;
  meMt: number | null;
  aeMt: number | null;
  /** DMA / boiler-side consumption mt when present. */
  boilerMt: number | null;
  robRmdMt: number | null;
  robB100Mt: number | null;
  robDmaMt: number | null;
  /** Optional machinery (from CENG when matched). */
  meHours: number | null;
  meRpm: number | null;
  meKw: number | null;
  ae1Hours: number | null;
  ae1Kw: number | null;
  ae2Hours: number | null;
  ae2Kw: number | null;
  ae3Hours: number | null;
  ae3Kw: number | null;
  boilerHours: number | null;
  sourceRow: number;
}

export interface FuelViewPrefs {
  /** Kinds shown in the table (empty = show none). */
  visibleKinds: FuelEventKind[];
  newestFirst: boolean;
  /** Optional ISO date filters (inclusive). Empty = no bound. */
  dateFrom: string;
  dateTo: string;
  /** Free-text filter on place / raw event. */
  search: string;
  /**
   * Max rows to show after filters (0 = all).
   * Applied as “latest N” in time, then sorted per newestFirst.
   */
  limitCount: number;
}

/** Row shown in the FUEL table (may roll up hidden intermediates). */
export interface FuelDisplayEvent extends FuelLogEvent {
  /** Source events summed into this row (1 = unchanged). */
  rolledFromCount: number;
}

export const FUEL_LIMIT_OPTIONS: { value: number; label: string }[] = [
  { value: 10, label: 'Last 10' },
  { value: 20, label: 'Last 20' },
  { value: 50, label: 'Last 50' },
  { value: 100, label: 'Last 100' },
  { value: 0, label: 'All' },
];

export interface FuelLibrarySettings {
  /** Absolute path (Electron) or display label of last import. */
  sourcePath: string;
  sourceFileName: string;
  importedAt: string;
  sheetName: string;
  events: FuelLogEvent[];
  view: FuelViewPrefs;
}

export function createDefaultFuelViewPrefs(): FuelViewPrefs {
  return {
    visibleKinds: [...FUEL_DEFAULT_VISIBLE_KINDS],
    newestFirst: true,
    dateFrom: '',
    dateTo: '',
    search: '',
    limitCount: 20,
  };
}

export function createDefaultFuelLibrary(): FuelLibrarySettings {
  return {
    sourcePath: '',
    sourceFileName: '',
    importedAt: '',
    sheetName: '',
    events: [],
    view: createDefaultFuelViewPrefs(),
  };
}

export function normalizeFuelLibrary(
  raw: Partial<FuelLibrarySettings> | undefined,
): FuelLibrarySettings {
  const defaults = createDefaultFuelLibrary();
  const viewRaw = raw?.view;
  const kindsRaw = Array.isArray(viewRaw?.visibleKinds) ? viewRaw!.visibleKinds : null;
  const visibleKinds = kindsRaw
    ? kindsRaw.filter((k): k is FuelEventKind => k in FUEL_EVENT_KIND_LABELS)
    : [...FUEL_DEFAULT_VISIBLE_KINDS];

  return {
    sourcePath: String(raw?.sourcePath ?? defaults.sourcePath).trim(),
    sourceFileName: String(raw?.sourceFileName ?? defaults.sourceFileName).trim(),
    importedAt: String(raw?.importedAt ?? defaults.importedAt).trim(),
    sheetName: String(raw?.sheetName ?? defaults.sheetName).trim(),
    events: Array.isArray(raw?.events)
      ? raw!.events.map((e, i) => normalizeFuelLogEvent(e, i)).filter((e): e is FuelLogEvent => !!e)
      : [],
    view: {
      visibleKinds,
      newestFirst: viewRaw?.newestFirst !== false,
      dateFrom: String(viewRaw?.dateFrom ?? '').trim(),
      dateTo: String(viewRaw?.dateTo ?? '').trim(),
      search: String(viewRaw?.search ?? '').trim(),
      limitCount: normalizeLimitCount(viewRaw?.limitCount),
    },
  };
}

function normalizeLimitCount(raw: unknown): number {
  if (raw == null || raw === '') return 20;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0) return 20;
  return Math.floor(n);
}

function normalizeFuelLogEvent(raw: unknown, index: number): FuelLogEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Partial<FuelLogEvent>;
  const kind = (e.kind && e.kind in FUEL_EVENT_KIND_LABELS ? e.kind : 'other') as FuelEventKind;
  return {
    id: String(e.id ?? `fuel-${index}`).trim() || `fuel-${index}`,
    place: String(e.place ?? '').trim(),
    rawEvent: String(e.rawEvent ?? '').trim(),
    kind,
    date: String(e.date ?? '').trim(),
    time: String(e.time ?? '').trim(),
    timeUsedHours: numOrNull(e.timeUsedHours),
    totalMt: numOrNull(e.totalMt),
    meMt: numOrNull(e.meMt),
    aeMt: numOrNull(e.aeMt),
    boilerMt: numOrNull(e.boilerMt),
    robRmdMt: numOrNull(e.robRmdMt),
    robB100Mt: numOrNull(e.robB100Mt),
    robDmaMt: numOrNull(e.robDmaMt),
    meHours: numOrNull(e.meHours),
    meRpm: numOrNull(e.meRpm),
    meKw: numOrNull(e.meKw),
    ae1Hours: numOrNull(e.ae1Hours),
    ae1Kw: numOrNull(e.ae1Kw),
    ae2Hours: numOrNull(e.ae2Hours),
    ae2Kw: numOrNull(e.ae2Kw),
    ae3Hours: numOrNull(e.ae3Hours),
    ae3Kw: numOrNull(e.ae3Kw),
    boilerHours: numOrNull(e.boilerHours),
    sourceRow: typeof e.sourceRow === 'number' && Number.isFinite(e.sourceRow) ? e.sourceRow : index,
  };
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Map Excel "BOSP / EOSP etc." text → canonical kind. */
export function classifyFuelEvent(rawEvent: string): FuelEventKind {
  const t = rawEvent.trim().toLowerCase();
  if (!t) return 'other';

  // Berth shifting (FEW/Shifting, SBE/Shifting, …) — before plain arrival/departure
  if (/\bshifting\b/.test(t)) return 'shifting';

  if (/\boff[\s-]?hire\b/.test(t)) return 'offhire';
  if (/\bbunker\b/.test(t)) return 'bunker';
  if (/\banchor\b/.test(t)) return 'anchor';
  if (/\bcanal\b/.test(t)) return 'canal';
  if (/\bport\s*report\b/.test(t)) return 'port_report';

  // End of sea passage (before noon, so "Noon / EOSP" → end_sea)
  if (/\beosp\b/.test(t) || /\bend\s+of\s+sea\s+passage\b/.test(t) || /\bend\s+of\s+passage\b/.test(t)) {
    return 'end_sea';
  }
  // Start sea passage
  if (
    /\bbosp\b/.test(t) ||
    /\bcosp\b/.test(t) ||
    /\bstart\s+sea\s+passage\b/.test(t) ||
    /\bcommence\s+of\s+sea\s+passage\b/.test(t)
  ) {
    return 'start_sea';
  }

  if (/\bnoon\b/.test(t)) return 'noon';

  // Arrival-ish
  if (
    /\bfew\b/.test(t) ||
    /\bfwe\b/.test(t) ||
    /\ball\s+fast\b/.test(t) ||
    /\barrival\b/.test(t)
  ) {
    return 'arrival';
  }
  // Departure-ish
  if (
    /\bsbe\b/.test(t) ||
    /\bdeparture\b/.test(t) ||
    /\bcast\s*off\b/.test(t) ||
    /\ball\s+cast\b/.test(t)
  ) {
    return 'departure';
  }

  return 'other';
}

export function filterFuelEvents(
  events: FuelLogEvent[],
  view: FuelViewPrefs,
): FuelDisplayEvent[] {
  return buildFuelDisplayEvents(events, view);
}

/**
 * Build table rows:
 * 1) Scope by date range (full log inside dates).
 * 2) Pick visible kinds (+ search).
 * 3) For each visible event, sum hours/fuel from the previous visible
 *    through this one — so hiding Noon folds its 12h into Departure.
 * 4) Keep last N (limitCount), then sort for display.
 */
export function buildFuelDisplayEvents(
  events: FuelLogEvent[],
  view: FuelViewPrefs,
): FuelDisplayEvent[] {
  const kinds = new Set(view.visibleKinds);
  const q = view.search.trim().toLowerCase();

  const scoped = [...events]
    .map((e) => ({ ...e, kind: classifyFuelEvent(e.rawEvent) }))
    .filter((e) => {
      if (view.dateFrom && e.date < view.dateFrom) return false;
      if (view.dateTo && e.date > view.dateTo) return false;
      return true;
    })
    .sort((a, b) => eventKey(a).localeCompare(eventKey(b)));

  const visibleIdx: number[] = [];
  for (let i = 0; i < scoped.length; i++) {
    const e = scoped[i];
    if (!kinds.has(e.kind)) continue;
    if (q) {
      const hay = `${e.place} ${e.rawEvent} ${FUEL_EVENT_KIND_LABELS[e.kind]}`.toLowerCase();
      if (!hay.includes(q)) continue;
    }
    visibleIdx.push(i);
  }

  const rolled: FuelDisplayEvent[] = [];
  for (let v = 0; v < visibleIdx.length; v++) {
    const end = visibleIdx[v];
    const start = v === 0 ? end : visibleIdx[v - 1] + 1;
    const slice = scoped.slice(start, end + 1);
    const head = scoped[end];
    rolled.push(rollUpFuelSlice(head, slice));
  }

  const limited =
    view.limitCount > 0 && rolled.length > view.limitCount
      ? rolled.slice(rolled.length - view.limitCount)
      : rolled;

  return [...limited].sort((a, b) => {
    const cmp = eventKey(a).localeCompare(eventKey(b));
    return view.newestFirst ? -cmp : cmp;
  });
}

function eventKey(e: Pick<FuelLogEvent, 'date' | 'time' | 'sourceRow'>): string {
  return `${e.date}T${e.time || '00:00'}#${String(e.sourceRow).padStart(6, '0')}`;
}

function rollUpFuelSlice(head: FuelLogEvent, slice: FuelLogEvent[]): FuelDisplayEvent {
  if (slice.length <= 1) {
    return { ...head, rolledFromCount: 1 };
  }
  return {
    ...head,
    timeUsedHours: sumNullable(slice.map((e) => e.timeUsedHours)),
    totalMt: sumNullable(slice.map((e) => e.totalMt)),
    meMt: sumNullable(slice.map((e) => e.meMt)),
    aeMt: sumNullable(slice.map((e) => e.aeMt)),
    boilerMt: sumNullable(slice.map((e) => e.boilerMt)),
    meHours: sumNullable(slice.map((e) => e.meHours)),
    ae1Hours: sumNullable(slice.map((e) => e.ae1Hours)),
    ae2Hours: sumNullable(slice.map((e) => e.ae2Hours)),
    ae3Hours: sumNullable(slice.map((e) => e.ae3Hours)),
    boilerHours: sumNullable(slice.map((e) => e.boilerHours)),
    meKw: sumNullable(slice.map((e) => e.meKw)),
    ae1Kw: sumNullable(slice.map((e) => e.ae1Kw)),
    ae2Kw: sumNullable(slice.map((e) => e.ae2Kw)),
    ae3Kw: sumNullable(slice.map((e) => e.ae3Kw)),
    meRpm: maxNullable(slice.map((e) => e.meRpm)),
    // ROB stays as at the visible event (end of period)
    rolledFromCount: slice.length,
  };
}

function sumNullable(vals: Array<number | null>): number | null {
  let sum = 0;
  let any = false;
  for (const v of vals) {
    if (v == null) continue;
    sum += v;
    any = true;
  }
  // Match Excel Fuel Log display (numFmt 0.0).
  return any ? Math.round(sum * 10) / 10 : null;
}

function maxNullable(vals: Array<number | null>): number | null {
  let max: number | null = null;
  for (const v of vals) {
    if (v == null) continue;
    max = max == null ? v : Math.max(max, v);
  }
  return max == null ? null : Math.round(max * 10) / 10;
}

/** Sum consumption between two inclusive event timestamps (for VPS period). */
export function sumFuelBetween(
  events: FuelLogEvent[],
  fromIso: string,
  toIso: string,
): { meMt: number; aeMt: number; boilerMt: number; totalMt: number; count: number } {
  let meMt = 0;
  let aeMt = 0;
  let boilerMt = 0;
  let totalMt = 0;
  let count = 0;
  for (const e of events) {
    const key = `${e.date}T${e.time || '00:00'}`;
    if (key < fromIso || key > toIso) continue;
    if (e.meMt != null) meMt += e.meMt;
    if (e.aeMt != null) aeMt += e.aeMt;
    if (e.boilerMt != null) boilerMt += e.boilerMt;
    if (e.totalMt != null) totalMt += e.totalMt;
    count += 1;
  }
  return { meMt, aeMt, boilerMt, totalMt, count };
}
