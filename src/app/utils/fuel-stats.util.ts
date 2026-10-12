import {
  FUEL_EVENT_KIND_LABELS,
  type FuelDisplayEvent,
  type FuelEventKind,
  type FuelViewPrefs,
} from '../models/fuel.models';

export type FuelStatsRob = {
  robRmdMt: number | null;
  robB100Mt: number | null;
  robDmaMt: number | null;
};

export type FuelStatsKindRow = {
  kind: FuelEventKind;
  label: string;
  count: number;
  hours: number | null;
  totalMt: number | null;
  meMt: number | null;
  aeMt: number | null;
  boilerMt: number | null;
  sharePct: number | null;
};

export type FuelStatsDayRow = {
  date: string;
  count: number;
  hours: number | null;
  totalMt: number | null;
  meMt: number | null;
  aeMt: number | null;
  boilerMt: number | null;
};

/** Rows that received bunker (RMD/BIO and/or DMA) in the period. */
export type FuelStatsBunkerRow = {
  id: string;
  date: string;
  time: string;
  place: string;
  rawEvent: string;
  kind: FuelEventKind;
  bunkerRmdBioMt: number | null;
  bunkerDmaMt: number | null;
  bunkerTotalMt: number | null;
  /** Target tank for RMD/BIO when known (DMA always → DMA). */
  bunkerRobTank: 'rmd' | 'b100' | null;
};

export type FuelStatsSummary = {
  rowCount: number;
  sourceEventCount: number;
  firstDate: string;
  firstTime: string;
  lastDate: string;
  lastTime: string;
  /** Calendar span from first→last date (inclusive), not sum of Hrs. */
  calendarDays: number | null;
  hours: number | null;
  meHours: number | null;
  aeHours: number | null;
  boilerHours: number | null;
  totalM3: number | null;
  totalMt: number | null;
  meMt: number | null;
  aeMt: number | null;
  boilerMt: number | null;
  meSharePct: number | null;
  aeSharePct: number | null;
  boilerSharePct: number | null;
  bunkerRmdBioMt: number | null;
  bunkerDmaMt: number | null;
  /** Sum of RMD/BIO + DMA bunker received. */
  bunkerTotalMt: number | null;
  /** How many matching rows have bunker received. */
  bunkerCount: number;
  bunkers: FuelStatsBunkerRow[];
  rateMtPerDay: number | null;
  rateMtPerHour: number | null;
  rateMtPerCalendarDay: number | null;
  byKind: FuelStatsKindRow[];
  byDay: FuelStatsDayRow[];
  firstRob: FuelStatsRob | null;
  lastRob: FuelStatsRob | null;
  /** last − first (negative = consumed / drawn down). */
  robDelta: FuelStatsRob | null;
};

export type FuelStatsKindSortKey =
  | 'label'
  | 'count'
  | 'hours'
  | 'totalMt'
  | 'meMt'
  | 'aeMt'
  | 'boilerMt'
  | 'sharePct';

export type FuelStatsDaySortKey =
  | 'date'
  | 'count'
  | 'hours'
  | 'totalMt'
  | 'meMt'
  | 'aeMt'
  | 'boilerMt';

export type FuelStatsEventSortKey =
  | 'date'
  | 'time'
  | 'place'
  | 'rawEvent'
  | 'kind'
  | 'hours'
  | 'totalMt'
  | 'meMt'
  | 'aeMt'
  | 'boilerMt';

export type FuelStatsBunkerSortKey =
  | 'date'
  | 'time'
  | 'place'
  | 'rawEvent'
  | 'bunkerRmdBioMt'
  | 'bunkerDmaMt'
  | 'bunkerTotalMt'
  | 'bunkerRobTank';

function sumNullable(vals: Array<number | null | undefined>): number | null {
  let sum = 0;
  let any = false;
  for (const v of vals) {
    if (v == null || !Number.isFinite(v)) continue;
    sum += v;
    any = true;
  }
  return any ? Math.round(sum * 10) / 10 : null;
}

function pctOf(part: number | null, whole: number | null): number | null {
  if (part == null || whole == null || !(whole > 0)) return null;
  return Math.round((part / whole) * 1000) / 10;
}

function eventStamp(e: Pick<FuelDisplayEvent, 'date' | 'time'>): string {
  return `${e.date}T${e.time || '00:00'}`;
}

/** Chronological order (oldest first) for period bounds / slicing. */
export function sortFuelStatsChrono(rows: readonly FuelDisplayEvent[]): FuelDisplayEvent[] {
  return [...rows].sort((a, b) => {
    const c = eventStamp(a).localeCompare(eventStamp(b));
    if (c) return c;
    return String(a.id).localeCompare(String(b.id));
  });
}

/**
 * Keep rows from `startId` through `endId` (inclusive) in chrono order.
 * Missing ids fall back to first / last row.
 */
export function sliceFuelStatsByEventBounds(
  rows: readonly FuelDisplayEvent[],
  startId: string | null | undefined,
  endId: string | null | undefined,
): FuelDisplayEvent[] {
  if (!rows.length) return [];
  const chrono = sortFuelStatsChrono(rows);
  let i0 = startId ? chrono.findIndex((e) => e.id === startId) : 0;
  let i1 = endId ? chrono.findIndex((e) => e.id === endId) : chrono.length - 1;
  if (i0 < 0) i0 = 0;
  if (i1 < 0) i1 = chrono.length - 1;
  if (i0 > i1) {
    const t = i0;
    i0 = i1;
    i1 = t;
  }
  return chrono.slice(i0, i1 + 1);
}

/** Events on a calendar date (ship LT `date` field), oldest first. */
export function fuelStatsEventsOnDate(
  rows: readonly FuelDisplayEvent[],
  dateIso: string,
): FuelDisplayEvent[] {
  if (!dateIso) return [];
  return sortFuelStatsChrono(rows).filter((e) => e.date === dateIso);
}

function robOf(e: FuelDisplayEvent): FuelStatsRob {
  return {
    robRmdMt: e.robRmdMt,
    robB100Mt: e.robB100Mt,
    robDmaMt: e.robDmaMt,
  };
}

function robDelta(first: FuelStatsRob, last: FuelStatsRob): FuelStatsRob {
  const d = (a: number | null, b: number | null): number | null => {
    if (a == null || b == null) return null;
    return Math.round((b - a) * 10) / 10;
  };
  return {
    robRmdMt: d(first.robRmdMt, last.robRmdMt),
    robB100Mt: d(first.robB100Mt, last.robB100Mt),
    robDmaMt: d(first.robDmaMt, last.robDmaMt),
  };
}

function calendarDaysInclusive(fromIso: string, toIso: string): number | null {
  const a = Date.parse(`${fromIso}T00:00:00Z`);
  const b = Date.parse(`${toIso}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return Math.round((b - a) / 86_400_000) + 1;
}

function cmpNullable(
  a: number | null | undefined,
  b: number | null | undefined,
  dir: 1 | -1,
): number {
  const aNull = a == null || !Number.isFinite(a);
  const bNull = b == null || !Number.isFinite(b);
  if (aNull && bNull) return 0;
  if (aNull) return 1;
  if (bNull) return -1;
  return (a! - b!) * dir;
}

/** Aggregate filtered fuel rows (same set as the Fuel log table). */
export function buildFuelStatsSummary(rows: FuelDisplayEvent[]): FuelStatsSummary {
  const empty: FuelStatsSummary = {
    rowCount: 0,
    sourceEventCount: 0,
    firstDate: '',
    firstTime: '',
    lastDate: '',
    lastTime: '',
    calendarDays: null,
    hours: null,
    meHours: null,
    aeHours: null,
    boilerHours: null,
    totalM3: null,
    totalMt: null,
    meMt: null,
    aeMt: null,
    boilerMt: null,
    meSharePct: null,
    aeSharePct: null,
    boilerSharePct: null,
    bunkerRmdBioMt: null,
    bunkerDmaMt: null,
    bunkerTotalMt: null,
    bunkerCount: 0,
    bunkers: [],
    rateMtPerDay: null,
    rateMtPerHour: null,
    rateMtPerCalendarDay: null,
    byKind: [],
    byDay: [],
    firstRob: null,
    lastRob: null,
    robDelta: null,
  };
  if (!rows.length) return empty;

  const chrono = [...rows].sort((a, b) => eventStamp(a).localeCompare(eventStamp(b)));
  const first = chrono[0]!;
  const last = chrono[chrono.length - 1]!;
  const days = calendarDaysInclusive(first.date, last.date);

  const hours = sumNullable(rows.map((e) => e.timeUsedHours));
  const meHours = sumNullable(rows.map((e) => e.meHours));
  const aeHours = sumNullable(rows.map((e) => sumNullable([e.ae1Hours, e.ae2Hours, e.ae3Hours])));
  const boilerHours = sumNullable(rows.map((e) => e.boilerHours));
  const totalM3 = sumNullable(rows.map((e) => e.totalM3));
  const totalMt = sumNullable(rows.map((e) => e.totalMt));
  const meMt = sumNullable(rows.map((e) => e.meMt));
  const aeMt = sumNullable(rows.map((e) => e.aeMt));
  const boilerMt = sumNullable(rows.map((e) => e.boilerMt));
  const bunkerRmdBioMt = sumNullable(rows.map((e) => e.bunkerRmdBioMt));
  const bunkerDmaMt = sumNullable(rows.map((e) => e.bunkerDmaMt));
  const bunkerTotalMt = sumNullable([bunkerRmdBioMt, bunkerDmaMt]);

  const bunkers: FuelStatsBunkerRow[] = chrono
    .filter(
      (e) =>
        (e.bunkerRmdBioMt != null && e.bunkerRmdBioMt > 0) ||
        (e.bunkerDmaMt != null && e.bunkerDmaMt > 0),
    )
    .map((e) => {
      const bio = e.bunkerRmdBioMt != null && e.bunkerRmdBioMt > 0 ? e.bunkerRmdBioMt : null;
      const dma = e.bunkerDmaMt != null && e.bunkerDmaMt > 0 ? e.bunkerDmaMt : null;
      return {
        id: e.id,
        date: e.date,
        time: e.time || '',
        place: e.place || '',
        rawEvent: e.rawEvent || '',
        kind: e.kind,
        bunkerRmdBioMt: bio,
        bunkerDmaMt: dma,
        bunkerTotalMt: sumNullable([bio, dma]),
        bunkerRobTank:
          e.bunkerRobTank === 'rmd' || e.bunkerRobTank === 'b100' ? e.bunkerRobTank : null,
      };
    });

  const burnedParts = sumNullable([meMt, aeMt, boilerMt]);
  const shareBase = burnedParts != null && burnedParts > 0 ? burnedParts : totalMt;

  let rateMtPerHour: number | null = null;
  let rateMtPerDay: number | null = null;
  let rateMtPerCalendarDay: number | null = null;
  if (totalMt != null && hours != null && hours > 0) {
    rateMtPerHour = Math.round((totalMt / hours) * 100) / 100;
    rateMtPerDay = Math.round((totalMt / hours) * 24 * 10) / 10;
  }
  if (totalMt != null && days != null && days > 0) {
    rateMtPerCalendarDay = Math.round((totalMt / days) * 10) / 10;
  }

  const kindMap = new Map<FuelEventKind, FuelStatsKindRow>();
  for (const e of rows) {
    const cur = kindMap.get(e.kind) ?? {
      kind: e.kind,
      label: FUEL_EVENT_KIND_LABELS[e.kind],
      count: 0,
      hours: null,
      totalMt: null,
      meMt: null,
      aeMt: null,
      boilerMt: null,
      sharePct: null,
    };
    cur.count += 1;
    cur.hours = sumNullable([cur.hours, e.timeUsedHours]);
    cur.totalMt = sumNullable([cur.totalMt, e.totalMt]);
    cur.meMt = sumNullable([cur.meMt, e.meMt]);
    cur.aeMt = sumNullable([cur.aeMt, e.aeMt]);
    cur.boilerMt = sumNullable([cur.boilerMt, e.boilerMt]);
    kindMap.set(e.kind, cur);
  }
  const byKind = [...kindMap.values()]
    .map((k) => ({ ...k, sharePct: pctOf(k.totalMt, totalMt) }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const dayMap = new Map<string, FuelStatsDayRow>();
  for (const e of chrono) {
    const cur = dayMap.get(e.date) ?? {
      date: e.date,
      count: 0,
      hours: null,
      totalMt: null,
      meMt: null,
      aeMt: null,
      boilerMt: null,
    };
    cur.count += 1;
    cur.hours = sumNullable([cur.hours, e.timeUsedHours]);
    cur.totalMt = sumNullable([cur.totalMt, e.totalMt]);
    cur.meMt = sumNullable([cur.meMt, e.meMt]);
    cur.aeMt = sumNullable([cur.aeMt, e.aeMt]);
    cur.boilerMt = sumNullable([cur.boilerMt, e.boilerMt]);
    dayMap.set(e.date, cur);
  }
  const byDay = [...dayMap.values()];

  const firstRob = robOf(first);
  const lastRob = robOf(last);

  return {
    rowCount: rows.length,
    sourceEventCount: rows.reduce((n, e) => n + (e.rolledFromCount || 1), 0),
    firstDate: first.date,
    firstTime: first.time || '',
    lastDate: last.date,
    lastTime: last.time || '',
    calendarDays: days,
    hours,
    meHours,
    aeHours,
    boilerHours,
    totalM3,
    totalMt,
    meMt,
    aeMt,
    boilerMt,
    meSharePct: pctOf(meMt, shareBase),
    aeSharePct: pctOf(aeMt, shareBase),
    boilerSharePct: pctOf(boilerMt, shareBase),
    bunkerRmdBioMt,
    bunkerDmaMt,
    bunkerTotalMt,
    bunkerCount: bunkers.length,
    bunkers,
    rateMtPerDay,
    rateMtPerHour,
    rateMtPerCalendarDay,
    byKind,
    byDay,
    firstRob,
    lastRob,
    robDelta: robDelta(firstRob, lastRob),
  };
}

export function sortFuelStatsBunkerRows(
  rows: readonly FuelStatsBunkerRow[],
  key: FuelStatsBunkerSortKey,
  asc: boolean,
): FuelStatsBunkerRow[] {
  const dir: 1 | -1 = asc ? 1 : -1;
  return [...rows].sort((a, b) => {
    let c = 0;
    switch (key) {
      case 'date':
        c = a.date.localeCompare(b.date);
        if (!c) c = (a.time || '').localeCompare(b.time || '');
        break;
      case 'time':
        c = (a.time || '').localeCompare(b.time || '');
        break;
      case 'place':
        c = (a.place || '').localeCompare(b.place || '');
        break;
      case 'rawEvent':
        c = (a.rawEvent || '').localeCompare(b.rawEvent || '');
        break;
      case 'bunkerRobTank':
        c = (a.bunkerRobTank || '').localeCompare(b.bunkerRobTank || '');
        break;
      case 'bunkerRmdBioMt':
      case 'bunkerDmaMt':
      case 'bunkerTotalMt':
        c = cmpNullable(a[key], b[key], 1);
        break;
    }
    c *= dir;
    if (c) return c;
    return eventStamp(a).localeCompare(eventStamp(b));
  });
}

export function sortFuelStatsKindRows(
  rows: readonly FuelStatsKindRow[],
  key: FuelStatsKindSortKey,
  asc: boolean,
): FuelStatsKindRow[] {
  const dir: 1 | -1 = asc ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (key === 'label') return a.label.localeCompare(b.label) * dir;
    return cmpNullable(a[key], b[key], dir) || a.label.localeCompare(b.label);
  });
}

export function sortFuelStatsDayRows(
  rows: readonly FuelStatsDayRow[],
  key: FuelStatsDaySortKey,
  asc: boolean,
): FuelStatsDayRow[] {
  const dir: 1 | -1 = asc ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (key === 'date') return a.date.localeCompare(b.date) * dir;
    return cmpNullable(a[key], b[key], dir) || a.date.localeCompare(b.date);
  });
}

export function sortFuelStatsEvents(
  rows: readonly FuelDisplayEvent[],
  key: FuelStatsEventSortKey,
  asc: boolean,
): FuelDisplayEvent[] {
  const dir: 1 | -1 = asc ? 1 : -1;
  return [...rows].sort((a, b) => {
    let c = 0;
    switch (key) {
      case 'date':
        c = a.date.localeCompare(b.date);
        if (!c) c = (a.time || '').localeCompare(b.time || '');
        break;
      case 'time':
        c = (a.time || '').localeCompare(b.time || '');
        break;
      case 'place':
        c = (a.place || '').localeCompare(b.place || '');
        break;
      case 'rawEvent':
        c = (a.rawEvent || '').localeCompare(b.rawEvent || '');
        break;
      case 'kind':
        c = FUEL_EVENT_KIND_LABELS[a.kind].localeCompare(FUEL_EVENT_KIND_LABELS[b.kind]);
        break;
      case 'hours':
        c = cmpNullable(a.timeUsedHours, b.timeUsedHours, 1);
        break;
      case 'totalMt':
        c = cmpNullable(a.totalMt, b.totalMt, 1);
        break;
      case 'meMt':
        c = cmpNullable(a.meMt, b.meMt, 1);
        break;
      case 'aeMt':
        c = cmpNullable(a.aeMt, b.aeMt, 1);
        break;
      case 'boilerMt':
        c = cmpNullable(a.boilerMt, b.boilerMt, 1);
        break;
    }
    if (key !== 'date' && key !== 'time' && key !== 'place' && key !== 'rawEvent' && key !== 'kind') {
      c *= dir;
    } else {
      c *= dir;
    }
    if (c) return c;
    return eventStamp(a).localeCompare(eventStamp(b));
  });
}

/**
 * Stats row scope from View-tab prefs:
 * - From/To date set → all matching rows in that range (ignore Show / Last N)
 * - no dates → same as the Fuel table (respect Last N)
 */
export function fuelStatsFilterView(view: FuelViewPrefs): FuelViewPrefs {
  const hasDate = !!(view.dateFrom?.trim() || view.dateTo?.trim());
  return {
    ...view,
    limitCount: hasDate ? 0 : view.limitCount,
  };
}

/** Human-readable filter strip for the stats header. */
export function describeFuelStatsScope(
  view: FuelViewPrefs,
  kindCount: number,
  allKindCount: number,
): string {
  const parts: string[] = [];
  const hasDate = !!(view.dateFrom?.trim() || view.dateTo?.trim());
  if (hasDate) {
    parts.push(`${view.dateFrom?.trim() || '…'} → ${view.dateTo?.trim() || '…'}`);
  } else {
    parts.push('All dates');
  }
  if (kindCount <= 0) parts.push('No event types');
  else if (kindCount >= allKindCount) parts.push('All event types');
  else parts.push(`${kindCount} event types`);
  if (view.search.trim()) parts.push(`Search “${view.search.trim()}”`);
  if (hasDate) {
    parts.push('Full date range');
  } else if (view.limitCount > 0) {
    parts.push(`Last ${view.limitCount}`);
  } else {
    parts.push('All matching rows');
  }
  return parts.join(' · ');
}
