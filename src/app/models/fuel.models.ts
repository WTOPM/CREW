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
 * MASTER S1–AC4 summary is imported separately for a read-only compare modal.
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
    tip: 'ME/AE flowmeter counter — entered from the meter (Excel col F). Total m³ is the delta from the previous FM.',
    type: 'num',
    field: 'fmMeAe',
    numeric: true,
  },
  {
    id: 'totalM3',
    label: 'Total m³',
    tip: 'Period volume = this FM − previous FM (Excel G = Fₙ−Fₙ₋₁). Auto when FM is set.',
    type: 'num',
    field: 'totalM3',
    numeric: true,
  },
  {
    id: 'totalMt',
    label: 'Total t',
    tip: 'Total fuel consumption for the period (mt). Auto: ME + AE when either is edited.',
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
    tip: 'ROB of ULSFO / RMD at this event (mt). Auto: previous ROB − ME/AE assigned to RMD.',
    type: 'num',
    field: 'robRmdMt',
    numeric: true,
  },
  {
    id: 'robB100',
    label: 'ROB B100',
    tip: 'ROB of biofuel blend (B100) at this event (mt). Auto: previous ROB − ME/AE assigned to B100.',
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
    tip: 'ROB of DMA / MGO at this event (mt). Auto: previous ROB − DMA/Boiler consumption.',
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

/** ROB tanks available in Fuel Log MASTER (DMA tip covers MGO). */
export type FuelRobTankId = 'rmd' | 'b100' | 'dma';

export const FUEL_ROB_TANK_IDS: readonly FuelRobTankId[] = ['rmd', 'b100', 'dma'];

export const FUEL_ROB_TANK_LABELS: Record<FuelRobTankId, string> = {
  rmd: 'RMD',
  b100: 'B100',
  dma: 'DMA',
};

export const FUEL_ROB_TANK_TIPS: Record<FuelRobTankId, string> = {
  rmd: 'ULSFO / RMD remaining on board',
  b100: 'Biofuel blend (B100) remaining on board',
  dma: 'DMA / MGO remaining on board',
};

export function isFuelRobTankId(raw: unknown): raw is FuelRobTankId {
  return raw === 'rmd' || raw === 'b100' || raw === 'dma';
}

export function fuelRobField(tank: FuelRobTankId): 'robRmdMt' | 'robB100Mt' | 'robDmaMt' {
  if (tank === 'rmd') return 'robRmdMt';
  if (tank === 'b100') return 'robB100Mt';
  return 'robDmaMt';
}

export function fuelRobValue(e: Pick<FuelLogEvent, 'robRmdMt' | 'robB100Mt' | 'robDmaMt'>, tank: FuelRobTankId): number | null {
  return e[fuelRobField(tank)];
}

/** Tanks that appear in the log (any row with a non-null ROB). Falls back to all three MASTER tanks. */
export function discoverFuelRobTanks(events: readonly FuelLogEvent[]): FuelRobTankId[] {
  const seen = new Set<FuelRobTankId>();
  for (const e of events) {
    if (e.robRmdMt != null) seen.add('rmd');
    if (e.robB100Mt != null) seen.add('b100');
    if (e.robDmaMt != null) seen.add('dma');
  }
  const ordered = FUEL_ROB_TANK_IDS.filter((id) => seen.has(id));
  return ordered.length ? [...ordered] : [...FUEL_ROB_TANK_IDS];
}

export interface FuelRobTankAssignment {
  me: FuelRobTankId;
  ae: FuelRobTankId;
  boiler: FuelRobTankId;
}

function tankDropped(prev: number | null, curr: number | null, minDrop = 0.05): boolean {
  if (prev == null || curr == null) return false;
  return prev - curr > minDrop;
}

/**
 * Infer debit tanks from how ROB changed on `previous` vs `beforePrevious`.
 * Fallback: ME/AE → stocked B100 then RMD; boiler → DMA.
 */
export function inferDefaultRobTanks(
  previous: FuelLogEvent | null | undefined,
  beforePrevious?: FuelLogEvent | null,
): FuelRobTankAssignment {
  let me: FuelRobTankId | null = null;
  let ae: FuelRobTankId | null = null;
  let boiler: FuelRobTankId | null = null;

  if (previous && beforePrevious) {
    const meAmt = previous.meMt ?? 0;
    const aeAmt = previous.aeMt ?? 0;
    const boilerAmt = previous.boilerMt ?? 0;
    const dropRmd = tankDropped(beforePrevious.robRmdMt, previous.robRmdMt);
    const dropB100 = tankDropped(beforePrevious.robB100Mt, previous.robB100Mt);
    const dropDma = tankDropped(beforePrevious.robDmaMt, previous.robDmaMt);

    if (meAmt > 0 || aeAmt > 0) {
      const main: FuelRobTankId | null = dropB100 && !dropRmd ? 'b100' : dropRmd && !dropB100 ? 'rmd' : dropB100 ? 'b100' : dropRmd ? 'rmd' : null;
      if (main) {
        if (meAmt > 0) me = main;
        if (aeAmt > 0) ae = main;
      }
    }
    if (boilerAmt > 0 && dropDma) boiler = 'dma';

    // Prefer tanks already stored on the previous event when present
    if (isFuelRobTankId(previous.meRobTank)) me = previous.meRobTank;
    if (isFuelRobTankId(previous.aeRobTank)) ae = previous.aeRobTank;
    if (isFuelRobTankId(previous.boilerRobTank)) boiler = previous.boilerRobTank;
  }

  const stockedMain = (p: FuelLogEvent | null | undefined): FuelRobTankId => {
    if (p && (p.robB100Mt ?? 0) > 0) return 'b100';
    if (p && (p.robRmdMt ?? 0) > 0) return 'rmd';
    if (p?.robB100Mt != null) return 'b100';
    return 'rmd';
  };

  return {
    me: me ?? stockedMain(previous),
    ae: ae ?? stockedMain(previous),
    boiler: boiler ?? 'dma',
  };
}

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
  /**
   * Which ROB tank ME / AE / boiler consumption debits.
   * Null = infer on next auto-calc from previous row / stock.
   */
  meRobTank: FuelRobTankId | null;
  aeRobTank: FuelRobTankId | null;
  boilerRobTank: FuelRobTankId | null;
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
  /** Show Date/Time columns as UTC (local − utcOffsetHours). */
  showUtc: boolean;
  /**
   * Ship local zone as hours ahead of UTC (e.g. 2 for UTC+2).
   * Displayed UTC = local − this value.
   */
  utcOffsetHours: number;
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
  /** MASTER S1–AC4 snapshot (AUX / tanks) for read-only compare. */
  masterSummary: FuelMasterSummary | null;
}

/** One AE line from MASTER S–V (KW / RH / KG). MT is a shared merged cell. */
export interface FuelMasterSummaryAeRow {
  label: string;
  kw: string;
  rh: string;
  kg: string;
}

/**
 * Read-only MASTER header block S1:AC4 — same layout as Excel:
 * AE rows × KW/RH/KG, merged MT, tank values, merged Updated + note.
 */
export interface FuelMasterSummary {
  heading: string;
  aeMetricHeaders: string[];
  tankHeaders: string[];
  aeRows: FuelMasterSummaryAeRow[];
  /** Merged W2:W4 */
  mt: string;
  /** X2:AC2 per tank */
  tankValues: string[];
  /** Merged X3:AC3 (e.g. Updated) */
  tankStatus: string;
  /** Merged X4:AC4 (e.g. 13.09.2026 - HAMBURG) */
  tankNote: string;
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
    showUtc: false,
    utcOffsetHours: 0,
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
    masterSummary: null,
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
      meRobTank: partial?.meRobTank ?? null,
      aeRobTank: partial?.aeRobTank ?? null,
      boilerRobTank: partial?.boilerRobTank ?? null,
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
    masterSummary: normalizeFuelMasterSummary(raw?.masterSummary),
  };
}

export function normalizeFuelMasterSummary(raw: unknown): FuelMasterSummary | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Partial<FuelMasterSummary> & {
    tanks?: { label?: string; value?: string; status?: string; updatedAt?: string }[];
  };

  // New shape
  const aeRows: FuelMasterSummaryAeRow[] = [];
  const aeRaw = Array.isArray(source.aeRows) ? source.aeRows : [];
  for (const item of aeRaw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Partial<FuelMasterSummaryAeRow> & { mt?: string };
    const label = String(r.label ?? '').trim();
    if (!label) continue;
    aeRows.push({
      label,
      kw: String(r.kw ?? '').trim(),
      rh: String(r.rh ?? '').trim(),
      kg: String(r.kg ?? '').trim(),
    });
  }

  let tankHeaders = Array.isArray(source.tankHeaders)
    ? source.tankHeaders.map((h) => String(h ?? '').trim()).filter(Boolean)
    : [];
  let tankValues = Array.isArray(source.tankValues)
    ? source.tankValues.map((v) => String(v ?? '').trim())
    : [];
  let tankStatus = String(source.tankStatus ?? '').trim();
  let tankNote = String(source.tankNote ?? '').trim();
  let mt = String(source.mt ?? '').trim();

  // Legacy shape (per-tank status/date) → fold into merged fields
  if ((!tankHeaders.length || !tankValues.length) && Array.isArray(source.tanks)) {
    tankHeaders = [];
    tankValues = [];
    for (const t of source.tanks) {
      if (!t || typeof t !== 'object') continue;
      const label = String(t.label ?? '').trim();
      if (!label) continue;
      tankHeaders.push(label);
      tankValues.push(String(t.value ?? '').trim());
      if (!tankStatus) tankStatus = String(t.status ?? '').trim();
      if (!tankNote) tankNote = String(t.updatedAt ?? '').trim();
    }
  }
  if (!mt && aeRaw.length) {
    const first = aeRaw[0] as { mt?: string } | undefined;
    mt = String(first?.mt ?? '').trim();
  }

  const aeMetricHeaders = Array.isArray(source.aeMetricHeaders)
    ? source.aeMetricHeaders.map((h) => String(h ?? '').trim()).filter(Boolean)
    : ['KW', 'RH', 'KG', 'MT'];

  if (!aeRows.length && !tankHeaders.length) return null;
  return {
    heading: String(source.heading ?? '').trim() || 'AUX',
    aeMetricHeaders: aeMetricHeaders.length ? aeMetricHeaders : ['KW', 'RH', 'KG', 'MT'],
    tankHeaders,
    aeRows,
    mt,
    tankValues,
    tankStatus,
    tankNote,
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
    showUtc: raw?.showUtc === true,
    utcOffsetHours: clampFuelUtcOffsetHours(raw?.utcOffsetHours),
  };
}

/** Clamp ship UTC offset hours (UTC−12 … UTC+14). */
export function clampFuelUtcOffsetHours(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return 0;
  const rounded = Math.round(n * 2) / 2; // allow half-hours
  return Math.min(14, Math.max(-12, rounded));
}

/** Display ship offset as +2 / −1 / ±0. */
export function formatFuelUtcOffsetLabel(hours: number): string {
  const h = clampFuelUtcOffsetHours(hours);
  if (h === 0) return '±0';
  const sign = h > 0 ? '+' : '−';
  const abs = Math.abs(h);
  const text = Number.isInteger(abs) ? String(abs) : String(abs);
  return `${sign}${text}`;
}

/**
 * Shift a fuel date+time by a signed hour delta (UTC Date math — no browser TZ).
 * Example: local 12:00 with delta −2 → 10:00 (possibly previous day).
 */
export function shiftFuelDateTime(
  date: string,
  time: string,
  deltaHours: number,
): { date: string; time: string } {
  const d = String(date ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !Number.isFinite(deltaHours) || deltaHours === 0) {
    return { date: d, time: String(time ?? '').trim() };
  }
  const t = String(time ?? '').trim();
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  const hh = m ? Number(m[1]) : 0;
  const mm = m ? Number(m[2]) : 0;
  const ms =
    Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)), hh, mm) +
    deltaHours * 3_600_000;
  const out = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${out.getUTCFullYear()}-${pad(out.getUTCMonth() + 1)}-${pad(out.getUTCDate())}`,
    time: `${pad(out.getUTCHours())}:${pad(out.getUTCMinutes())}`,
  };
}

/**
 * When Hrs is edited, move this event's clock so it stays consistent.
 * - Prefer anchoring to the previous event: time = prev + newHrs
 * - Else shift by (newHrs − oldHrs)
 */
export function dateTimeFromFuelHrsEdit(
  current: Pick<FuelLogEvent, 'date' | 'time' | 'timeUsedHours'>,
  newHrs: number | null,
  previous: Pick<FuelLogEvent, 'date' | 'time'> | null | undefined,
): { date: string; time: string } | null {
  if (newHrs == null || !Number.isFinite(newHrs) || newHrs < 0) return null;
  if (previous?.date) {
    return shiftFuelDateTime(previous.date, previous.time || '00:00', newHrs);
  }
  const oldHrs = current.timeUsedHours;
  if (oldHrs == null || !Number.isFinite(oldHrs)) return null;
  const delta = Math.round((newHrs - oldHrs) * 10) / 10;
  if (delta === 0) return null;
  return shiftFuelDateTime(current.date, current.time || '00:00', delta);
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
    meRobTank: isFuelRobTankId(e.meRobTank) ? e.meRobTank : null,
    aeRobTank: isFuelRobTankId(e.aeRobTank) ? e.aeRobTank : null,
    boilerRobTank: isFuelRobTankId(e.boilerRobTank) ? e.boilerRobTank : null,
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
 * Excel MASTER/CENG: Total m³ (G) = Fₙ − Fₙ₋₁.
 * FM is the manual meter reading; m³ is the period delta (never negative).
 */
export function recomputeFuelTotalM3FromFm(
  fmMeAe: number | null,
  previousFm: number | null | undefined,
): number | null {
  if (fmMeAe == null || previousFm == null) return null;
  const delta = Math.round((fmMeAe - previousFm) * 10) / 10;
  return delta < 0 ? null : delta;
}

/** Round fuel mt to 1 decimal (MASTER numFmt 0.0). */
export function roundFuelMt(n: number): number {
  return Math.round(n * 10) / 10;
}

function clampRobDebit(prev: number | null, debit: number): number | null {
  if (prev == null) return null;
  if (prev <= 0) return roundFuelMt(prev); // never go negative from empty / zero tank
  return roundFuelMt(Math.max(0, prev - debit));
}

/**
 * Project ROB after period consumption using per-field tank assignment.
 * Debits are summed per tank; each tank is clamped at 0.
 */
export function projectFuelRobAfterConsumption(
  previous: FuelLogEvent,
  assignment: FuelRobTankAssignment,
  amounts: { meMt: number; aeMt: number; boilerMt: number },
): Pick<FuelLogEvent, 'robRmdMt' | 'robB100Mt' | 'robDmaMt'> {
  const debit: Record<FuelRobTankId, number> = { rmd: 0, b100: 0, dma: 0 };
  debit[assignment.me] += amounts.meMt > 0 ? amounts.meMt : 0;
  debit[assignment.ae] += amounts.aeMt > 0 ? amounts.aeMt : 0;
  debit[assignment.boiler] += amounts.boilerMt > 0 ? amounts.boilerMt : 0;

  return {
    robRmdMt: clampRobDebit(previous.robRmdMt, debit.rmd),
    robB100Mt: clampRobDebit(previous.robB100Mt, debit.b100),
    robDmaMt: clampRobDebit(previous.robDmaMt, debit.dma),
  };
}

/**
 * Resolve tank assignment for a draft: keep explicit picks, fill nulls via inferDefaultRobTanks.
 */
export function resolveFuelRobTankAssignment(
  draft: FuelLogEvent,
  previous: FuelLogEvent | null | undefined,
  beforePrevious?: FuelLogEvent | null,
): FuelRobTankAssignment {
  const inferred = inferDefaultRobTanks(previous, beforePrevious);
  return {
    me: isFuelRobTankId(draft.meRobTank) ? draft.meRobTank : inferred.me,
    ae: isFuelRobTankId(draft.aeRobTank) ? draft.aeRobTank : inferred.ae,
    boiler: isFuelRobTankId(draft.boilerRobTank) ? draft.boilerRobTank : inferred.boiler,
  };
}

/** Fields that trigger Total t + ROB rebuild when edited in the table. */
export const FUEL_CONSUMPTION_EDIT_FIELDS = ['meMt', 'aeMt', 'boilerMt'] as const;
export type FuelConsumptionEditField = (typeof FUEL_CONSUMPTION_EDIT_FIELDS)[number];

export function isFuelConsumptionEditField(field: string): field is FuelConsumptionEditField {
  return (FUEL_CONSUMPTION_EDIT_FIELDS as readonly string[]).includes(field);
}

/**
 * Side effects when ME / AE / DMA consumption is edited in the table:
 * - Total t = ME + AE
 * - ROB tanks = previous ROB − assigned consumption (clamped ≥ 0), always
 *   recomputed from previous even if the user cleared/changed ROB manually.
 */
export function applyFuelConsumptionSideEffects(
  current: FuelLogEvent,
  previous: FuelLogEvent | null | undefined,
  beforePrevious: FuelLogEvent | null | undefined,
  partial: Partial<Pick<FuelLogEvent, FuelConsumptionEditField>>,
): FuelLogEvent {
  let next: FuelLogEvent = { ...current, ...partial };
  if (partial.meMt !== undefined || partial.aeMt !== undefined) {
    next = { ...next, totalMt: recomputeFuelTotalMt(next.meMt, next.aeMt) };
  }
  const assignment = resolveFuelRobTankAssignment(next, previous, beforePrevious);
  next = {
    ...next,
    meRobTank: assignment.me,
    aeRobTank: assignment.ae,
    boilerRobTank: assignment.boiler,
  };
  if (previous) {
    next = {
      ...next,
      ...projectFuelRobAfterConsumption(previous, assignment, {
        meMt: next.meMt ?? 0,
        aeMt: next.aeMt ?? 0,
        boilerMt: next.boilerMt ?? 0,
      }),
    };
  }
  return next;
}

/**
 * Apply auto-calcs when drafting a new/edited event against the chronologically previous row.
 * - Hrs from elapsed time
 * - totalMt = ME + AE (kept for storage; not always shown in UI)
 * - ROB tanks = previous − assigned period consumption (clamped ≥ 0)
 */
export function applyFuelEventAutoCalcs(
  draft: FuelLogEvent,
  previous: FuelLogEvent | null | undefined,
  beforePrevious?: FuelLogEvent | null,
): FuelLogEvent {
  let next = { ...draft, kind: classifyFuelEvent(draft.rawEvent) };
  if (previous?.date && next.date) {
    const hrs = fuelElapsedHours(previous.date, previous.time, next.date, next.time);
    if (hrs != null) next = { ...next, timeUsedHours: hrs };
  }
  const m3 = recomputeFuelTotalM3FromFm(next.fmMeAe, previous?.fmMeAe);
  if (m3 != null) next = { ...next, totalM3: m3 };
  const total = recomputeFuelTotalMt(next.meMt, next.aeMt);
  if (total != null) next = { ...next, totalMt: total };

  const assignment = resolveFuelRobTankAssignment(next, previous, beforePrevious);
  next = {
    ...next,
    meRobTank: assignment.me,
    aeRobTank: assignment.ae,
    boilerRobTank: assignment.boiler,
  };

  if (previous) {
    next = {
      ...next,
      ...projectFuelRobAfterConsumption(previous, assignment, {
        meMt: next.meMt ?? 0,
        aeMt: next.aeMt ?? 0,
        boilerMt: next.boilerMt ?? 0,
      }),
    };
  }
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

/** Event immediately before `previous` (for ROB-tank inference). */
export function findFuelEventBeforePrevious(
  events: readonly FuelLogEvent[],
  previous: FuelLogEvent | null | undefined,
): FuelLogEvent | null {
  if (!previous?.date) return null;
  return findPreviousFuelEvent(events, previous.date, previous.time, previous.id);
}
