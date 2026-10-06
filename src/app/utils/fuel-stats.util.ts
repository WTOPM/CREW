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
};

export type FuelStatsSummary = {
  rowCount: number;
  sourceEventCount: number;
  firstDate: string;
  firstTime: string;
  lastDate: string;
  lastTime: string;
  hours: number | null;
  meHours: number | null;
  aeHours: number | null;
  boilerHours: number | null;
  totalMt: number | null;
  meMt: number | null;
  aeMt: number | null;
  boilerMt: number | null;
  bunkerRmdBioMt: number | null;
  bunkerDmaMt: number | null;
  rateMtPerDay: number | null;
  rateMtPerHour: number | null;
  byKind: FuelStatsKindRow[];
  firstRob: FuelStatsRob | null;
  lastRob: FuelStatsRob | null;
};

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

function eventStamp(e: Pick<FuelDisplayEvent, 'date' | 'time'>): string {
  return `${e.date}T${e.time || '00:00'}`;
}

function robOf(e: FuelDisplayEvent): FuelStatsRob {
  return {
    robRmdMt: e.robRmdMt,
    robB100Mt: e.robB100Mt,
    robDmaMt: e.robDmaMt,
  };
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
    hours: null,
    meHours: null,
    aeHours: null,
    boilerHours: null,
    totalMt: null,
    meMt: null,
    aeMt: null,
    boilerMt: null,
    bunkerRmdBioMt: null,
    bunkerDmaMt: null,
    rateMtPerDay: null,
    rateMtPerHour: null,
    byKind: [],
    firstRob: null,
    lastRob: null,
  };
  if (!rows.length) return empty;

  const chrono = [...rows].sort((a, b) => eventStamp(a).localeCompare(eventStamp(b)));
  const first = chrono[0]!;
  const last = chrono[chrono.length - 1]!;

  const hours = sumNullable(rows.map((e) => e.timeUsedHours));
  const meHours = sumNullable(rows.map((e) => e.meHours));
  const aeHours = sumNullable(rows.map((e) => sumNullable([e.ae1Hours, e.ae2Hours, e.ae3Hours])));
  const boilerHours = sumNullable(rows.map((e) => e.boilerHours));
  const totalMt = sumNullable(rows.map((e) => e.totalMt));
  const meMt = sumNullable(rows.map((e) => e.meMt));
  const aeMt = sumNullable(rows.map((e) => e.aeMt));
  const boilerMt = sumNullable(rows.map((e) => e.boilerMt));
  const bunkerRmdBioMt = sumNullable(rows.map((e) => e.bunkerRmdBioMt));
  const bunkerDmaMt = sumNullable(rows.map((e) => e.bunkerDmaMt));

  let rateMtPerHour: number | null = null;
  let rateMtPerDay: number | null = null;
  if (totalMt != null && hours != null && hours > 0) {
    rateMtPerHour = Math.round((totalMt / hours) * 100) / 100;
    rateMtPerDay = Math.round((totalMt / hours) * 24 * 10) / 10;
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
    };
    cur.count += 1;
    cur.hours = sumNullable([cur.hours, e.timeUsedHours]);
    cur.totalMt = sumNullable([cur.totalMt, e.totalMt]);
    cur.meMt = sumNullable([cur.meMt, e.meMt]);
    cur.aeMt = sumNullable([cur.aeMt, e.aeMt]);
    kindMap.set(e.kind, cur);
  }
  const byKind = [...kindMap.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  return {
    rowCount: rows.length,
    sourceEventCount: rows.reduce((n, e) => n + (e.rolledFromCount || 1), 0),
    firstDate: first.date,
    firstTime: first.time || '',
    lastDate: last.date,
    lastTime: last.time || '',
    hours,
    meHours,
    aeHours,
    boilerHours,
    totalMt,
    meMt,
    aeMt,
    boilerMt,
    bunkerRmdBioMt,
    bunkerDmaMt,
    rateMtPerDay,
    rateMtPerHour,
    byKind,
    firstRob: robOf(first),
    lastRob: robOf(last),
  };
}

/** Human-readable filter strip for the stats header. */
export function describeFuelStatsScope(view: FuelViewPrefs, kindCount: number, allKindCount: number): string {
  const parts: string[] = [];
  if (view.dateFrom || view.dateTo) {
    parts.push(`${view.dateFrom || '…'} → ${view.dateTo || '…'}`);
  } else {
    parts.push('All dates');
  }
  if (kindCount <= 0) parts.push('No event types');
  else if (kindCount >= allKindCount) parts.push('All event types');
  else parts.push(`${kindCount} event types`);
  if (view.search.trim()) parts.push(`Search “${view.search.trim()}”`);
  if (view.limitCount > 0) parts.push(`Last ${view.limitCount}`);
  else parts.push('All matching rows');
  return parts.join(' · ');
}
