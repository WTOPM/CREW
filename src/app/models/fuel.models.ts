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

/** Common Excel event labels for the add-row picker. */
export const FUEL_RAW_EVENT_OPTIONS: string[] = [
  'BOSP',
  'EOSP',
  'SBE',
  'FEW',
  'FWE',
  'Noon',
  'Port Report',
  'Canal In',
  'Canal Out',
  'Anchor',
  'Bunker',
  'Off hire',
  'SBE/Shifting',
  'FEW/Shifting',
  'FWE/Shifting',
  'Noon/SBE/Shifting',
  'Noon / EOSP',
];

export type FuelColumnId =
  | 'date'
  | 'time'
  | 'place'
  | 'kind'
  | 'rawEvent'
  | 'hrs'
  | 'fmMeAe'
  | 'totalM3'
  | 'totalMt'
  | 'meMt'
  | 'aeMt'
  | 'robRmd'
  | 'robB100'
  | 'bunkerRmdBio'
  | 'bunkerDma'
  | 'robDma'
  | 'dmaConsMt'
  | 'dmaConsM3'
  | 'boilerFm'
  | 'meCounterRh'
  | 'meShapoliRev'
  | 'meShapoliKwh'
  | 'meHours'
  | 'meRpm'
  | 'meKw'
  | 'ae1CounterRh'
  | 'ae1KwAvg'
  | 'ae1Hours'
  | 'ae1Kw'
  | 'ae2CounterRh'
  | 'ae2KwAvg'
  | 'ae2Hours'
  | 'ae2Kw'
  | 'ae3CounterRh'
  | 'ae3KwAvg'
  | 'ae3Hours'
  | 'ae3Kw'
  | 'boilerCounterRh'
  | 'boilerHours'
  | 'boilerFmCeng'
  | 'boilerConsM3'
  | 'boilerConsMt';

export type FuelColumnValueType = 'text' | 'date' | 'time' | 'hours' | 'num' | 'kw' | 'kind';

export interface FuelColumnDef {
  id: FuelColumnId;
  label: string;
  tip: string;
  type: FuelColumnValueType;
  /** CSS modifier class suffix (me / ae / boiler…). */
  tone?: 'me' | 'ae' | 'ae1' | 'ae2' | 'ae3' | 'boiler';
  /** Field on FuelLogEvent (kind column is special). */
  field?: keyof FuelLogEvent;
  numeric?: boolean;
}

/**
 * Full Fuel Log column set (MASTER A–R + CENG machinery).
 * MASTER S1–AC4 summary block and other sheets are intentionally omitted.
 */
export const FUEL_COLUMNS: FuelColumnDef[] = [
  { id: 'date', label: 'Date', tip: 'Event date from the fuel log (local ship date).', type: 'date', field: 'date' },
  { id: 'time', label: 'Time', tip: 'Event time from the fuel log (HH:mm).', type: 'time', field: 'time' },
  { id: 'place', label: 'Place', tip: 'Port name or Sea for the event.', type: 'text', field: 'place' },
  {
    id: 'kind',
    label: 'Kind',
    tip: 'Normalized type used for filters (Arrival, Departure, Shifting, …).',
    type: 'kind',
    field: 'kind',
  },
  {
    id: 'rawEvent',
    label: 'Excel event',
    tip: 'Original Excel label (BOSP, FEW, SBE/Shifting, …).',
    type: 'text',
    field: 'rawEvent',
  },
  {
    id: 'hrs',
    label: 'Hrs',
    tip: 'Hours since the previous visible event. Hidden events in between are summed in.',
    type: 'hours',
    field: 'timeUsedHours',
    numeric: true,
  },
  {
    id: 'fmMeAe',
    label: 'ME/AE FM',
    tip: 'Main/aux fuel flowmeter counter (MASTER col F).',
    type: 'num',
    field: 'fmMeAe',
    numeric: true,
  },
  {
    id: 'totalM3',
    label: 'Total m³',
    tip: 'Total ME+AE consumption volume (m³).',
    type: 'num',
    field: 'totalM3',
    numeric: true,
  },
  {
    id: 'totalMt',
    label: 'Total t',
    tip: 'Total fuel consumption for the period (mt).',
    type: 'num',
    field: 'totalMt',
    numeric: true,
  },
  {
    id: 'meMt',
    label: 'ME t',
    tip: 'Main engine fuel consumed in this period (mt).',
    type: 'num',
    field: 'meMt',
    tone: 'me',
    numeric: true,
  },
  {
    id: 'aeMt',
    label: 'AE t',
    tip: 'Auxiliary engines fuel consumed in this period (mt).',
    type: 'num',
    field: 'aeMt',
    tone: 'ae',
    numeric: true,
  },
  {
    id: 'robRmd',
    label: 'ROB RMD',
    tip: 'ROB of ULSFO / RMD at this event (mt).',
    type: 'num',
    field: 'robRmdMt',
    numeric: true,
  },
  {
    id: 'robB100',
    label: 'ROB B100',
    tip: 'ROB of biofuel blend (B100) at this event (mt).',
    type: 'num',
    field: 'robB100Mt',
    numeric: true,
  },
  {
    id: 'bunkerRmdBio',
    label: 'Bunker RMD/BIO',
    tip: 'Bunker received RMD/BIO this event (mt).',
    type: 'num',
    field: 'bunkerRmdBioMt',
    numeric: true,
  },
  {
    id: 'bunkerDma',
    label: 'Bunker DMA',
    tip: 'Bunker received DMA this event (mt).',
    type: 'num',
    field: 'bunkerDmaMt',
    numeric: true,
  },
  {
    id: 'robDma',
    label: 'ROB DMA',
    tip: 'ROB of DMA / MGO at this event (mt).',
    type: 'num',
    field: 'robDmaMt',
    numeric: true,
  },
  {
    id: 'dmaConsMt',
    label: 'DMA / Boiler t',
    tip: 'DMA total consumption (mt) — used as boiler-side fuel in MASTER.',
    type: 'num',
    field: 'boilerMt',
    tone: 'boiler',
    numeric: true,
  },
  {
    id: 'dmaConsM3',
    label: 'DMA m³',
    tip: 'DMA total consumption volume (m³).',
    type: 'num',
    field: 'dmaConsM3',
    tone: 'boiler',
    numeric: true,
  },
  {
    id: 'boilerFm',
    label: 'Boiler FM',
    tip: 'Boiler flowmeter counter (MASTER col R).',
    type: 'num',
    field: 'boilerFm',
    tone: 'boiler',
    numeric: true,
  },
  {
    id: 'meCounterRh',
    label: 'ME counter',
    tip: 'Main engine running-hours counter (CENG).',
    type: 'num',
    field: 'meCounterRh',
    tone: 'me',
    numeric: true,
  },
  {
    id: 'meShapoliRev',
    label: 'SHAPOLI rev',
    tip: 'SHAPOLI revolution counter (CENG).',
    type: 'num',
    field: 'meShapoliRev',
    tone: 'me',
    numeric: true,
  },
  {
    id: 'meShapoliKwh',
    label: 'SHAPOLI kWh',
    tip: 'SHAPOLI energy counter (CENG).',
    type: 'kw',
    field: 'meShapoliKwh',
    tone: 'me',
    numeric: true,
  },
  {
    id: 'meHours',
    label: 'ME hrs',
    tip: 'Main engine running hours (CENG).',
    type: 'hours',
    field: 'meHours',
    tone: 'me',
    numeric: true,
  },
  {
    id: 'meRpm',
    label: 'ME RPM',
    tip: 'Main engine average RPM (CENG).',
    type: 'num',
    field: 'meRpm',
    tone: 'me',
    numeric: true,
  },
  {
    id: 'meKw',
    label: 'ME kW',
    tip: 'Main engine / shaft power in kW (CENG).',
    type: 'kw',
    field: 'meKw',
    tone: 'me',
    numeric: true,
  },
  {
    id: 'ae1CounterRh',
    label: 'AE1 counter',
    tip: 'Aux engine 1 running-hours counter.',
    type: 'num',
    field: 'ae1CounterRh',
    tone: 'ae1',
    numeric: true,
  },
  {
    id: 'ae1KwAvg',
    label: 'AE1 kW avg',
    tip: 'Aux engine 1 average kW (CENG).',
    type: 'kw',
    field: 'ae1KwAvg',
    tone: 'ae1',
    numeric: true,
  },
  {
    id: 'ae1Hours',
    label: 'AE1 hrs',
    tip: 'Aux engine 1 running hours.',
    type: 'hours',
    field: 'ae1Hours',
    tone: 'ae1',
    numeric: true,
  },
  {
    id: 'ae1Kw',
    label: 'AE1 kWh',
    tip: 'Aux engine 1 total energy for the event (kWh).',
    type: 'kw',
    field: 'ae1Kw',
    tone: 'ae1',
    numeric: true,
  },
  {
    id: 'ae2CounterRh',
    label: 'AE2 counter',
    tip: 'Aux engine 2 running-hours counter.',
    type: 'num',
    field: 'ae2CounterRh',
    tone: 'ae2',
    numeric: true,
  },
  {
    id: 'ae2KwAvg',
    label: 'AE2 kW avg',
    tip: 'Aux engine 2 average kW (CENG).',
    type: 'kw',
    field: 'ae2KwAvg',
    tone: 'ae2',
    numeric: true,
  },
  {
    id: 'ae2Hours',
    label: 'AE2 hrs',
    tip: 'Aux engine 2 running hours.',
    type: 'hours',
    field: 'ae2Hours',
    tone: 'ae2',
    numeric: true,
  },
  {
    id: 'ae2Kw',
    label: 'AE2 kWh',
    tip: 'Aux engine 2 total energy for the event (kWh).',
    type: 'kw',
    field: 'ae2Kw',
    tone: 'ae2',
    numeric: true,
  },
  {
    id: 'ae3CounterRh',
    label: 'AE3 counter',
    tip: 'Aux engine 3 running-hours counter.',
    type: 'num',
    field: 'ae3CounterRh',
    tone: 'ae3',
    numeric: true,
  },
  {
    id: 'ae3KwAvg',
    label: 'AE3 kW avg',
    tip: 'Aux engine 3 average kW (CENG).',
    type: 'kw',
    field: 'ae3KwAvg',
    tone: 'ae3',
    numeric: true,
  },
  {
    id: 'ae3Hours',
    label: 'AE3 hrs',
    tip: 'Aux engine 3 running hours.',
    type: 'hours',
    field: 'ae3Hours',
    tone: 'ae3',
    numeric: true,
  },
  {
    id: 'ae3Kw',
    label: 'AE3 kWh',
    tip: 'Aux engine 3 total energy for the event (kWh).',
    type: 'kw',
    field: 'ae3Kw',
    tone: 'ae3',
    numeric: true,
  },
  {
    id: 'boilerCounterRh',
    label: 'Boiler counter',
    tip: 'Boiler running-hours counter (CENG).',
    type: 'num',
    field: 'boilerCounterRh',
    tone: 'boiler',
    numeric: true,
  },
  {
    id: 'boilerHours',
    label: 'Boiler hrs',
    tip: 'Boiler running hours (CENG).',
    type: 'hours',
    field: 'boilerHours',
    tone: 'boiler',
    numeric: true,
  },
  {
    id: 'boilerFmCeng',
    label: 'Boiler FM (CENG)',
    tip: 'Boiler flowmeter from CENG sheet.',
    type: 'num',
    field: 'boilerFmCeng',
    tone: 'boiler',
    numeric: true,
  },
  {
    id: 'boilerConsM3',
    label: 'Boiler m³',
    tip: 'Boiler consumption volume (CENG).',
    type: 'num',
    field: 'boilerConsM3',
    tone: 'boiler',
    numeric: true,
  },
  {
    id: 'boilerConsMt',
    label: 'Boiler cons t',
    tip: 'Boiler consumption mass (CENG).',
    type: 'num',
    field: 'boilerConsMt',
    tone: 'boiler',
    numeric: true,
  },
];

export const FUEL_COLUMN_BY_ID: Record<FuelColumnId, FuelColumnDef> = Object.fromEntries(
  FUEL_COLUMNS.map((c) => [c.id, c]),
) as Record<FuelColumnId, FuelColumnDef>;

/** Columns shown by default (matches the previous compact table). */
export const FUEL_DEFAULT_VISIBLE_COLUMNS: FuelColumnId[] = [
  'date',
  'time',
  'place',
  'kind',
  'rawEvent',
  'hrs',
  'meMt',
  'aeMt',
  'dmaConsMt',
  'totalMt',
  'robB100',
  'robDma',
  'meHours',
  'meRpm',
  'meKw',
  'ae1Hours',
  'ae1Kw',
  'ae2Hours',
  'ae2Kw',
  'ae3Hours',
  'ae3Kw',
  'boilerHours',
];

/** @deprecated Use FUEL_COLUMNS tips — kept for older call sites. */
export const FUEL_COLUMN_TIPS = Object.fromEntries(
  FUEL_COLUMNS.map((c) => [c.id, c.tip]),
) as Record<FuelColumnId, string>;

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
  /** ME/AE flowmeter counter. */
  fmMeAe: number | null;
  /** Total ME+AE consumption m³. */
  totalM3: number | null;
  /** ULSFO / bio total consumption mt. */
  totalMt: number | null;
  meMt: number | null;
  aeMt: number | null;
  /** DMA / boiler-side consumption mt (MASTER col P). */
  boilerMt: number | null;
  robRmdMt: number | null;
  robB100Mt: number | null;
  bunkerRmdBioMt: number | null;
  bunkerDmaMt: number | null;
  robDmaMt: number | null;
  dmaConsM3: number | null;
  boilerFm: number | null;
  /** Optional machinery (from CENG when matched). */
  meCounterRh: number | null;
  meShapoliRev: number | null;
  meShapoliKwh: number | null;
  meHours: number | null;
  meRpm: number | null;
  meKw: number | null;
  ae1CounterRh: number | null;
  ae1KwAvg: number | null;
  ae1Hours: number | null;
  ae1Kw: number | null;
  ae2CounterRh: number | null;
  ae2KwAvg: number | null;
  ae2Hours: number | null;
  ae2Kw: number | null;
  ae3CounterRh: number | null;
  ae3KwAvg: number | null;
  ae3Hours: number | null;
  ae3Kw: number | null;
  boilerCounterRh: number | null;
  boilerHours: number | null;
  boilerFmCeng: number | null;
  boilerConsM3: number | null;
  boilerConsMt: number | null;
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

/** Local-only UI prefs (per machine — not shared via data folder). */
export interface FuelLocalUiPrefs {
  visibleColumns: FuelColumnId[];
  /** Show hour fields as H:MM instead of decimal (1.1 → 1:06). */
  hoursAsHm: boolean;
}

/** One saved column layout (Save / Load display) — shared via data folder. */
export interface FuelDisplayPreset {
  id: string;
  name: string;
  savedAt: string;
  visibleColumns: FuelColumnId[];
  hoursAsHm: boolean;
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
  /** Named column layouts — shared across PCs via the data folder. */
  displayPresets: FuelDisplayPreset[];
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

export function createDefaultFuelLocalUiPrefs(): FuelLocalUiPrefs {
  return {
    visibleColumns: [...FUEL_DEFAULT_VISIBLE_COLUMNS],
    hoursAsHm: false,
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
    displayPresets: [],
  };
}

export function createEmptyFuelLogEvent(partial?: Partial<FuelLogEvent>): FuelLogEvent {
  const rawEvent = String(partial?.rawEvent ?? '').trim();
  return normalizeFuelLogEvent(
    {
      id: partial?.id ?? `fuel-new-${Date.now()}`,
      place: partial?.place ?? '',
      rawEvent,
      kind: partial?.kind ?? classifyFuelEvent(rawEvent),
      date: partial?.date ?? '',
      time: partial?.time ?? '',
      timeUsedHours: partial?.timeUsedHours ?? null,
      fmMeAe: partial?.fmMeAe ?? null,
      totalM3: partial?.totalM3 ?? null,
      totalMt: partial?.totalMt ?? null,
      meMt: partial?.meMt ?? null,
      aeMt: partial?.aeMt ?? null,
      boilerMt: partial?.boilerMt ?? null,
      robRmdMt: partial?.robRmdMt ?? null,
      robB100Mt: partial?.robB100Mt ?? null,
      bunkerRmdBioMt: partial?.bunkerRmdBioMt ?? null,
      bunkerDmaMt: partial?.bunkerDmaMt ?? null,
      robDmaMt: partial?.robDmaMt ?? null,
      dmaConsM3: partial?.dmaConsM3 ?? null,
      boilerFm: partial?.boilerFm ?? null,
      meCounterRh: partial?.meCounterRh ?? null,
      meShapoliRev: partial?.meShapoliRev ?? null,
      meShapoliKwh: partial?.meShapoliKwh ?? null,
      meHours: partial?.meHours ?? null,
      meRpm: partial?.meRpm ?? null,
      meKw: partial?.meKw ?? null,
      ae1CounterRh: partial?.ae1CounterRh ?? null,
      ae1KwAvg: partial?.ae1KwAvg ?? null,
      ae1Hours: partial?.ae1Hours ?? null,
      ae1Kw: partial?.ae1Kw ?? null,
      ae2CounterRh: partial?.ae2CounterRh ?? null,
      ae2KwAvg: partial?.ae2KwAvg ?? null,
      ae2Hours: partial?.ae2Hours ?? null,
      ae2Kw: partial?.ae2Kw ?? null,
      ae3CounterRh: partial?.ae3CounterRh ?? null,
      ae3KwAvg: partial?.ae3KwAvg ?? null,
      ae3Hours: partial?.ae3Hours ?? null,
      ae3Kw: partial?.ae3Kw ?? null,
      boilerCounterRh: partial?.boilerCounterRh ?? null,
      boilerHours: partial?.boilerHours ?? null,
      boilerFmCeng: partial?.boilerFmCeng ?? null,
      boilerConsM3: partial?.boilerConsM3 ?? null,
      boilerConsMt: partial?.boilerConsMt ?? null,
      sourceRow: partial?.sourceRow ?? 0,
    },
    0,
  )!;
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
    displayPresets: normalizeFuelDisplayPresets(raw?.displayPresets),
  };
}

export function normalizeFuelLocalUiPrefs(
  raw: Partial<FuelLocalUiPrefs> | null | undefined,
): FuelLocalUiPrefs {
  const defaults = createDefaultFuelLocalUiPrefs();
  const colsRaw = Array.isArray(raw?.visibleColumns) ? raw!.visibleColumns : null;
  const mapped = colsRaw
    ? colsRaw.flatMap((id): FuelColumnId[] => {
        if (id === ('event' as string)) return ['kind', 'rawEvent'];
        return id in FUEL_COLUMN_BY_ID ? [id as FuelColumnId] : [];
      })
    : [...defaults.visibleColumns];
  // Dedupe while keeping order
  const seen = new Set<FuelColumnId>();
  const cols = mapped.filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  return {
    visibleColumns: cols.length ? cols : [...defaults.visibleColumns],
    hoursAsHm: raw?.hoursAsHm === true,
  };
}

export function normalizeFuelDisplayPresets(raw: unknown): FuelDisplayPreset[] {
  if (!Array.isArray(raw)) return [];
  const out: FuelDisplayPreset[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const p = item as Partial<FuelDisplayPreset>;
    const name = String(p.name ?? '').trim();
    if (!name) continue;
    const colsRaw = Array.isArray(p.visibleColumns) ? p.visibleColumns : [];
    const mapped = colsRaw.flatMap((id): FuelColumnId[] => {
      if (id === ('event' as string)) return ['kind', 'rawEvent'];
      return typeof id === 'string' && id in FUEL_COLUMN_BY_ID ? [id as FuelColumnId] : [];
    });
    const seen = new Set<FuelColumnId>();
    const visibleColumns = mapped.filter((id) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    out.push({
      id: String(p.id ?? '').trim() || `fuel-disp-${Date.now()}-${out.length}`,
      name: name.slice(0, 80),
      savedAt: String(p.savedAt ?? '').trim() || new Date().toISOString(),
      visibleColumns: visibleColumns.length ? visibleColumns : [...FUEL_DEFAULT_VISIBLE_COLUMNS],
      hoursAsHm: p.hoursAsHm === true,
    });
  }
  return out.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
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
    fmMeAe: numOrNull(e.fmMeAe),
    totalM3: numOrNull(e.totalM3),
    totalMt: numOrNull(e.totalMt),
    meMt: numOrNull(e.meMt),
    aeMt: numOrNull(e.aeMt),
    boilerMt: numOrNull(e.boilerMt),
    robRmdMt: numOrNull(e.robRmdMt),
    robB100Mt: numOrNull(e.robB100Mt),
    bunkerRmdBioMt: numOrNull(e.bunkerRmdBioMt),
    bunkerDmaMt: numOrNull(e.bunkerDmaMt),
    robDmaMt: numOrNull(e.robDmaMt),
    dmaConsM3: numOrNull(e.dmaConsM3),
    boilerFm: numOrNull(e.boilerFm),
    meCounterRh: numOrNull(e.meCounterRh),
    meShapoliRev: numOrNull(e.meShapoliRev),
    meShapoliKwh: numOrNull(e.meShapoliKwh),
    meHours: numOrNull(e.meHours),
    meRpm: numOrNull(e.meRpm),
    meKw: numOrNull(e.meKw),
    ae1CounterRh: numOrNull(e.ae1CounterRh),
    ae1KwAvg: numOrNull(e.ae1KwAvg),
    ae1Hours: numOrNull(e.ae1Hours),
    ae1Kw: numOrNull(e.ae1Kw),
    ae2CounterRh: numOrNull(e.ae2CounterRh),
    ae2KwAvg: numOrNull(e.ae2KwAvg),
    ae2Hours: numOrNull(e.ae2Hours),
    ae2Kw: numOrNull(e.ae2Kw),
    ae3CounterRh: numOrNull(e.ae3CounterRh),
    ae3KwAvg: numOrNull(e.ae3KwAvg),
    ae3Hours: numOrNull(e.ae3Hours),
    ae3Kw: numOrNull(e.ae3Kw),
    boilerCounterRh: numOrNull(e.boilerCounterRh),
    boilerHours: numOrNull(e.boilerHours),
    boilerFmCeng: numOrNull(e.boilerFmCeng),
    boilerConsM3: numOrNull(e.boilerConsM3),
    boilerConsMt: numOrNull(e.boilerConsMt),
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

/** Decimal hours → H:MM (1.1 → 1:06). */
export function formatFuelHoursHm(hours: number | null | undefined): string {
  if (hours == null || !Number.isFinite(hours)) return '—';
  const sign = hours < 0 ? '-' : '';
  const abs = Math.abs(hours);
  const h = Math.floor(abs);
  let m = Math.round((abs - h) * 60);
  let hh = h;
  if (m === 60) {
    hh += 1;
    m = 0;
  }
  return `${sign}${hh}:${String(m).padStart(2, '0')}`;
}

/** Parse H:MM or decimal into hours. */
export function parseFuelHoursInput(raw: string): number | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const hm = s.match(/^(-)?(\d+):([0-5]?\d)$/);
  if (hm) {
    const sign = hm[1] ? -1 : 1;
    return sign * (Number(hm[2]) + Number(hm[3]) / 60);
  }
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Hours between two date+time pairs (ISO date + HH:mm). */
export function fuelElapsedHours(
  fromDate: string,
  fromTime: string,
  toDate: string,
  toTime: string,
): number | null {
  if (!fromDate || !toDate) return null;
  const a = Date.parse(`${fromDate}T${(fromTime || '00:00').padStart(5, '0')}:00`);
  const b = Date.parse(`${toDate}T${(toTime || '00:00').padStart(5, '0')}:00`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return Math.round(((b - a) / 3600000) * 10) / 10;
}

/** Recompute totalMt from ME + AE when either side is set. */
export function recomputeFuelTotalMt(meMt: number | null, aeMt: number | null): number | null {
  if (meMt == null && aeMt == null) return null;
  return Math.round(((meMt ?? 0) + (aeMt ?? 0)) * 10) / 10;
}

/**
 * Apply auto-calcs when drafting a new/edited event against the chronologically previous row.
 */
export function applyFuelEventAutoCalcs(
  draft: FuelLogEvent,
  previous: FuelLogEvent | null | undefined,
): FuelLogEvent {
  let next = { ...draft, kind: classifyFuelEvent(draft.rawEvent) };
  if (previous?.date && next.date) {
    const hrs = fuelElapsedHours(previous.date, previous.time, next.date, next.time);
    if (hrs != null) next = { ...next, timeUsedHours: hrs };
  }
  const total = recomputeFuelTotalMt(next.meMt, next.aeMt);
  if (total != null) next = { ...next, totalMt: total };
  return next;
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

const SUM_FIELDS: Array<keyof FuelLogEvent> = [
  'timeUsedHours',
  'totalM3',
  'totalMt',
  'meMt',
  'aeMt',
  'boilerMt',
  'bunkerRmdBioMt',
  'bunkerDmaMt',
  'dmaConsM3',
  'meHours',
  'ae1Hours',
  'ae2Hours',
  'ae3Hours',
  'boilerHours',
  'meKw',
  'ae1Kw',
  'ae2Kw',
  'ae3Kw',
  'meShapoliKwh',
  'boilerConsM3',
  'boilerConsMt',
];

function rollUpFuelSlice(head: FuelLogEvent, slice: FuelLogEvent[]): FuelDisplayEvent {
  if (slice.length <= 1) {
    return { ...head, rolledFromCount: 1 };
  }
  const rolled: FuelDisplayEvent = { ...head, rolledFromCount: slice.length };
  for (const field of SUM_FIELDS) {
    (rolled as unknown as Record<string, unknown>)[field] = sumNullable(
      slice.map((e) => e[field] as number | null),
    );
  }
  rolled.meRpm = maxNullable(slice.map((e) => e.meRpm));
  return rolled;
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

/** Previous chronological event before a candidate date/time. */
export function findPreviousFuelEvent(
  events: readonly FuelLogEvent[],
  date: string,
  time: string,
  excludeId?: string,
): FuelLogEvent | null {
  if (!date) return null;
  const key = `${date}T${time || '00:00'}`;
  let best: FuelLogEvent | null = null;
  let bestKey = '';
  for (const e of events) {
    if (excludeId && e.id === excludeId) continue;
    if (!e.date) continue;
    const k = `${e.date}T${e.time || '00:00'}`;
    if (k >= key) continue;
    if (!best || k > bestKey) {
      best = e;
      bestKey = k;
    }
  }
  return best;
}
