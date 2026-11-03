/** Unifeeder A&D (Arrival & Departure) report — in-memory draft + Excel cell map. */

export type AdYn = 'Yes' | 'No';

export type AdActionKind =
  | 'river_in'
  | 'river_out'
  | 'harbour_in'
  | 'harbour_out'
  | 'anchorage_to'
  | 'anchorage_from'
  | 'tug_mooring'
  | 'tug_unmooring';

export type AdActionTone = 'in' | 'out';

export interface AdActionDef {
  kind: AdActionKind;
  group: string;
  direction: string;
  tone: AdActionTone;
  /** Pilot-style (on/off times) vs tug (qty + start/end). */
  shape: 'pilot' | 'tug';
}

/** Catalog of Excel action kinds (column A/B). Direction comes from drop zone, not palette. */
export const AD_ACTION_DEFS: readonly AdActionDef[] = [
  { kind: 'river_in', group: 'River/sea pilot', direction: 'IN', tone: 'in', shape: 'pilot' },
  { kind: 'river_out', group: 'River/sea pilot', direction: 'OUT', tone: 'out', shape: 'pilot' },
  { kind: 'harbour_in', group: 'Harbour pilot', direction: 'IN', tone: 'in', shape: 'pilot' },
  { kind: 'harbour_out', group: 'Harbour pilot', direction: 'OUT', tone: 'out', shape: 'pilot' },
  {
    kind: 'anchorage_to',
    group: 'Pilot — anchorage',
    direction: 'TO',
    tone: 'in',
    shape: 'pilot',
  },
  {
    kind: 'anchorage_from',
    group: 'Pilot — anchorage',
    direction: 'FROM',
    tone: 'out',
    shape: 'pilot',
  },
  { kind: 'tug_mooring', group: 'Tug assistance', direction: 'MOORING', tone: 'in', shape: 'tug' },
  {
    kind: 'tug_unmooring',
    group: 'Tug assistance',
    direction: 'UN-MOORING',
    tone: 'out',
    shape: 'tug',
  },
] as const;

/** Palette chips — 4 groups; IN/OUT decided by arrival (top) / departure (bottom) drop zone. */
export type AdPaletteGroupId = 'river' | 'harbour' | 'anchorage' | 'tug';

export interface AdPaletteGroup {
  id: AdPaletteGroupId;
  label: string;
  shape: 'pilot' | 'tug';
  inKind: AdActionKind;
  outKind: AdActionKind;
}

export const AD_PALETTE_GROUPS: readonly AdPaletteGroup[] = [
  {
    id: 'river',
    label: 'River',
    shape: 'pilot',
    inKind: 'river_in',
    outKind: 'river_out',
  },
  {
    id: 'harbour',
    label: 'Harbour',
    shape: 'pilot',
    inKind: 'harbour_in',
    outKind: 'harbour_out',
  },
  {
    id: 'anchorage',
    label: 'Anchorage',
    shape: 'pilot',
    inKind: 'anchorage_to',
    outKind: 'anchorage_from',
  },
  {
    id: 'tug',
    label: 'Tug',
    shape: 'tug',
    inKind: 'tug_mooring',
    outKind: 'tug_unmooring',
  },
] as const;

export function adPaletteGroup(id: AdPaletteGroupId): AdPaletteGroup {
  const hit = AD_PALETTE_GROUPS.find((g) => g.id === id);
  if (!hit) throw new Error(`Unknown A&D palette group: ${id}`);
  return hit;
}

export function adPaletteGroupOfKind(kind: AdActionKind): AdPaletteGroup {
  const hit = AD_PALETTE_GROUPS.find((g) => g.inKind === kind || g.outKind === kind);
  if (!hit) throw new Error(`No palette group for: ${kind}`);
  return hit;
}

export function adKindForDrop(groupId: AdPaletteGroupId, tone: AdActionTone): AdActionKind {
  const g = adPaletteGroup(groupId);
  return tone === 'in' ? g.inKind : g.outKind;
}

export interface AdPilotAction {
  kind: Extract<
    AdActionKind,
    | 'river_in'
    | 'river_out'
    | 'harbour_in'
    | 'harbour_out'
    | 'anchorage_to'
    | 'anchorage_from'
  >;
  /** Local `YYYY-MM-DDTHH:mm` for datetime-local inputs. */
  onboarding: string;
  disembarkment: string;
  /** Excel PEC (Y/N) — river/harbour only; ignored for anchorage. */
  pec: AdYn;
  /** Waiting time (mins). */
  waitMins: string;
  /** Tour in vain (Y/N). */
  vain: AdYn;
}

export interface AdTugAction {
  kind: 'tug_mooring' | 'tug_unmooring';
  quantity: number;
  start: string;
  end: string;
  reason: string;
  waitMins: string;
  vain: AdYn;
}

export type AdAction = AdPilotAction | AdTugAction;

export interface AdTerminalRemarks {
  shoreGangway: AdYn;
  shoreGangwayShift: AdYn;
  hatchCoverQty: string;
  draftArrival: string;
  draftDeparture: string;
  /** Signed boatmen waiting time (mins) — Excel row 60. */
  boatmenWaitMins: string;
  miscRemarks: string;
}

export interface AdTerminal {
  id: string;
  /** Terminal code as in Excel row 6, e.g. EGB. */
  code: string;
  layBy: boolean;
  actions: AdAction[];
  remarks: AdTerminalRemarks;
}

export interface AdReportDraft {
  vessel: string;
  master: string;
  portCallId: string;
  portCode: string;
  terminals: AdTerminal[];
}

/** Excel rows for pilot blocks (1-based). Anchorage has no PEC row. */
export const AD_PILOT_EXCEL_ROWS: Record<
  AdPilotAction['kind'],
  { used: number; pec: number | null; on: number; off: number; wait: number; vain: number }
> = {
  river_in: { used: 10, pec: 11, on: 12, off: 13, wait: 14, vain: 15 },
  river_out: { used: 16, pec: 17, on: 18, off: 19, wait: 20, vain: 21 },
  harbour_in: { used: 22, pec: 23, on: 24, off: 25, wait: 26, vain: 27 },
  harbour_out: { used: 28, pec: 29, on: 30, off: 31, wait: 32, vain: 33 },
  anchorage_to: { used: 34, pec: null, on: 35, off: 36, wait: 37, vain: 38 },
  anchorage_from: { used: 39, pec: null, on: 40, off: 41, wait: 42, vain: 43 },
};

export const AD_TUG_EXCEL_ROWS: Record<
  AdTugAction['kind'],
  { qty: number; start: number; end: number; reason: number; wait: number; vain: number }
> = {
  tug_mooring: { qty: 46, start: 47, end: 48, reason: 49, wait: 50, vain: 51 },
  tug_unmooring: { qty: 52, start: 53, end: 54, reason: 55, wait: 56, vain: 57 },
};

/** First terminal column in the template (D = 4). */
export const AD_FIRST_TERMINAL_COL = 4;
export const AD_MAX_TERMINALS = 12;

export function adActionDef(kind: AdActionKind): AdActionDef {
  const hit = AD_ACTION_DEFS.find((d) => d.kind === kind);
  if (!hit) throw new Error(`Unknown A&D action: ${kind}`);
  return hit;
}

/** Per-palette defaults applied when a new block is dropped (settings strip). */
export interface AdPilotBlockDefaults {
  pec: AdYn;
  waitMins: string;
  vain: AdYn;
}

export interface AdTugBlockDefaults {
  quantity: number;
  reason: string;
  waitMins: string;
  vain: AdYn;
}

/** Defaults for newly added terminals (Terminal card settings strip). */
export interface AdTerminalBlockDefaults {
  shoreGangway: AdYn;
  shoreGangwayShift: AdYn;
  hatchCoverQty: string;
  draftArrival: string;
  draftDeparture: string;
  boatmenWaitMins: string;
  miscRemarks: string;
}

export interface AdBlockDefaults {
  river: AdPilotBlockDefaults;
  harbour: AdPilotBlockDefaults;
  anchorage: AdPilotBlockDefaults;
  tug: AdTugBlockDefaults;
  terminal: AdTerminalBlockDefaults;
}

export const DEFAULT_AD_PILOT_BLOCK_DEFAULTS: AdPilotBlockDefaults = {
  pec: 'No',
  waitMins: '0',
  vain: 'No',
};

export const DEFAULT_AD_TUG_BLOCK_DEFAULTS: AdTugBlockDefaults = {
  quantity: 1,
  reason: 'Safety',
  waitMins: '0',
  vain: 'No',
};

export const DEFAULT_AD_TERMINAL_BLOCK_DEFAULTS: AdTerminalBlockDefaults = {
  shoreGangway: 'No',
  shoreGangwayShift: 'No',
  hatchCoverQty: '',
  draftArrival: '',
  draftDeparture: '',
  boatmenWaitMins: '0',
  miscRemarks: '',
};

export const DEFAULT_AD_BLOCK_DEFAULTS: AdBlockDefaults = {
  river: { ...DEFAULT_AD_PILOT_BLOCK_DEFAULTS },
  harbour: { ...DEFAULT_AD_PILOT_BLOCK_DEFAULTS },
  anchorage: { ...DEFAULT_AD_PILOT_BLOCK_DEFAULTS, pec: 'No' },
  tug: { ...DEFAULT_AD_TUG_BLOCK_DEFAULTS },
  terminal: { ...DEFAULT_AD_TERMINAL_BLOCK_DEFAULTS },
};

export function createEmptyAdRemarks(
  defaults: Partial<AdTerminalBlockDefaults> = {},
): AdTerminalRemarks {
  const d = { ...DEFAULT_AD_TERMINAL_BLOCK_DEFAULTS, ...defaults };
  return {
    shoreGangway: d.shoreGangway === 'Yes' ? 'Yes' : 'No',
    shoreGangwayShift: d.shoreGangwayShift === 'Yes' ? 'Yes' : 'No',
    hatchCoverQty: String(d.hatchCoverQty ?? ''),
    draftArrival: String(d.draftArrival ?? ''),
    draftDeparture: String(d.draftDeparture ?? ''),
    boatmenWaitMins: String(d.boatmenWaitMins ?? '0').trim() || '0',
    miscRemarks: String(d.miscRemarks ?? ''),
  };
}

export function createAdTerminal(
  code = '',
  defaults: Partial<AdBlockDefaults> | Partial<AdTerminalBlockDefaults> = {},
): AdTerminal {
  const termDefaults =
    'terminal' in defaults && defaults.terminal
      ? defaults.terminal
      : (defaults as Partial<AdTerminalBlockDefaults>);
  return {
    id: crypto.randomUUID(),
    code: code.trim().toUpperCase(),
    layBy: false,
    actions: [],
    remarks: createEmptyAdRemarks(termDefaults),
  };
}

export function createEmptyAdDraft(partial?: Partial<AdReportDraft>): AdReportDraft {
  return {
    vessel: partial?.vessel ?? '',
    master: partial?.master ?? '',
    portCallId: partial?.portCallId ?? '',
    portCode: partial?.portCode ?? '',
    // Explicit `terminals: []` must stay empty (Excel parse fills then); only omit → one blank.
    terminals: Array.isArray(partial?.terminals) ? partial.terminals : [createAdTerminal()],
  };
}

export function createAdAction(
  kind: AdActionKind,
  defaults: AdBlockDefaults | AdBlockDefaultsInput = DEFAULT_AD_BLOCK_DEFAULTS,
): AdAction {
  const def = adActionDef(kind);
  const full = normalizeAdBlockDefaults(defaults);
  if (def.shape === 'tug') {
    const td = full.tug;
    const qty = Number(td.quantity);
    return {
      kind: kind as AdTugAction['kind'],
      quantity: Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 1,
      start: '',
      end: '',
      reason: td.reason.trim() || 'Safety',
      waitMins: String(td.waitMins ?? '0').trim() || '0',
      vain: td.vain === 'Yes' ? 'Yes' : 'No',
    };
  }
  const group = adPaletteGroupOfKind(kind).id;
  const pd =
    group === 'harbour' ? full.harbour : group === 'anchorage' ? full.anchorage : full.river;
  return {
    kind: kind as AdPilotAction['kind'],
    onboarding: '',
    disembarkment: '',
    pec: pd.pec === 'Yes' ? 'Yes' : 'No',
    waitMins: String(pd.waitMins ?? '0').trim() || '0',
    vain: pd.vain === 'Yes' ? 'Yes' : 'No',
  };
}

function normalizePilotDefaults(raw?: Partial<AdPilotBlockDefaults> | null): AdPilotBlockDefaults {
  const d = DEFAULT_AD_PILOT_BLOCK_DEFAULTS;
  if (!raw) return { ...d };
  return {
    pec: normalizeAdYn(raw.pec, d.pec),
    waitMins: String(raw.waitMins ?? d.waitMins).trim() || '0',
    vain: normalizeAdYn(raw.vain, d.vain),
  };
}

function normalizeTugDefaults(raw?: Partial<AdTugBlockDefaults> | null): AdTugBlockDefaults {
  const d = DEFAULT_AD_TUG_BLOCK_DEFAULTS;
  if (!raw) return { ...d };
  const qty = Number(raw.quantity);
  return {
    quantity: Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : d.quantity,
    reason: String(raw.reason ?? d.reason).trim() || 'Safety',
    waitMins: String(raw.waitMins ?? d.waitMins).trim() || '0',
    vain: normalizeAdYn(raw.vain, d.vain),
  };
}

function normalizeTerminalDefaults(
  raw?: Partial<AdTerminalBlockDefaults> | null,
): AdTerminalBlockDefaults {
  const d = DEFAULT_AD_TERMINAL_BLOCK_DEFAULTS;
  if (!raw) return { ...d };
  return {
    shoreGangway: normalizeAdYn(raw.shoreGangway, d.shoreGangway),
    shoreGangwayShift: normalizeAdYn(raw.shoreGangwayShift, d.shoreGangwayShift),
    hatchCoverQty: String(raw.hatchCoverQty ?? ''),
    draftArrival: String(raw.draftArrival ?? ''),
    draftDeparture: String(raw.draftDeparture ?? ''),
    boatmenWaitMins: String(raw.boatmenWaitMins ?? d.boatmenWaitMins).trim() || '0',
    miscRemarks: String(raw.miscRemarks ?? ''),
  };
}

type AdBlockDefaultsInput = {
  river?: Partial<AdPilotBlockDefaults> | null;
  harbour?: Partial<AdPilotBlockDefaults> | null;
  anchorage?: Partial<AdPilotBlockDefaults> | null;
  tug?: Partial<AdTugBlockDefaults> | null;
  terminal?: Partial<AdTerminalBlockDefaults> | null;
  /** @deprecated legacy flat shape */
  tugReason?: string;
  gangwayShift?: AdYn;
};

/** Accepts new shape or legacy `{ tugReason, gangwayShift }`. */
export function normalizeAdBlockDefaults(raw?: AdBlockDefaultsInput | null): AdBlockDefaults {
  const defaults = DEFAULT_AD_BLOCK_DEFAULTS;
  if (!raw) {
    return {
      river: { ...defaults.river },
      harbour: { ...defaults.harbour },
      anchorage: { ...defaults.anchorage },
      tug: { ...defaults.tug },
      terminal: { ...defaults.terminal },
    };
  }
  const hasNew = !!(raw.river || raw.harbour || raw.anchorage || raw.tug || raw.terminal);
  // Legacy flat shape from earlier builds: `{ tugReason, gangwayShift }`.
  if (!hasNew && (raw.tugReason != null || raw.gangwayShift != null)) {
    return {
      river: { ...defaults.river },
      harbour: { ...defaults.harbour },
      anchorage: { ...defaults.anchorage },
      tug: normalizeTugDefaults({
        ...defaults.tug,
        reason: raw.tugReason ?? defaults.tug.reason,
      }),
      terminal: normalizeTerminalDefaults({
        ...defaults.terminal,
        shoreGangwayShift: raw.gangwayShift ?? defaults.terminal.shoreGangwayShift,
      }),
    };
  }
  return {
    river: normalizePilotDefaults(raw.river),
    harbour: normalizePilotDefaults(raw.harbour),
    anchorage: normalizePilotDefaults(raw.anchorage),
    tug: normalizeTugDefaults(raw.tug),
    terminal: normalizeTerminalDefaults(raw.terminal),
  };
}

export function isAdPilotAction(a: AdAction): a is AdPilotAction {
  return adActionDef(a.kind).shape === 'pilot';
}

export function isAdTugAction(a: AdAction): a is AdTugAction {
  return adActionDef(a.kind).shape === 'tug';
}

/** Suggested download name: `A&D DEBRV 15.10.2026 - 701216.xlsx`. */
export function adExportFileName(draft: AdReportDraft, when = new Date()): string {
  const port = (draft.portCode || 'PORT').trim().toUpperCase() || 'PORT';
  const id = (draft.portCallId || 'ID').trim() || 'ID';
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${pad(when.getDate())}.${pad(when.getMonth() + 1)}.${when.getFullYear()}`;
  return `A&D ${port} ${stamp} - ${id}.xlsx`;
}

/** One segment of an auto-generated Excel file name. */
export type AdFileNameBlockType =
  | 'empty'
  | 'sequence'
  | 'custom'
  | 'portCallId'
  | 'portCode'
  | 'portName'
  | 'reportDate';

export interface AdFileNameBlock {
  id: string;
  type: AdFileNameBlockType;
  /** Used when type === 'custom'. */
  text: string;
  /** Separator inserted after this block before the next non-empty block. */
  sepAfter: string;
}

/** User-built Excel name: blocks + per-block separators, then `.xlsx`. */
export interface AdFileNamePattern {
  /**
   * Legacy global delimiter — kept for old saves; migrated into `sepAfter`
   * when a block has no own separator.
   */
  delimiter: string;
  blocks: AdFileNameBlock[];
}

export const AD_FILE_NAME_BLOCK_TYPES: readonly {
  type: AdFileNameBlockType;
  label: string;
}[] = [
  { type: 'empty', label: 'Skip' },
  { type: 'sequence', label: 'Number' },
  { type: 'custom', label: 'Text' },
  { type: 'portCallId', label: 'Port ID' },
  { type: 'portCode', label: 'Code' },
  { type: 'portName', label: 'Port' },
  { type: 'reportDate', label: 'Date' },
];

/** Resolve Settings port name for a draft port code. */
export function resolveAdPortName(
  portCode: string,
  ports: readonly { code?: string; name?: string }[],
): string {
  const code = String(portCode ?? '')
    .trim()
    .toUpperCase();
  if (!code) return '';
  const hit = ports.find((p) => String(p.code ?? '').trim().toUpperCase() === code);
  return String(hit?.name ?? '').trim();
}

/** Format sequence as 01, 02, … 09, 10, … */
export function formatAdFolderSequence(n: number): string {
  const v = Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
  return String(v).padStart(2, '0');
}

/**
 * Latest complete date/time across all actions in the draft → `DD.MM.YYYY`.
 * Empty string when nothing is filled yet.
 */
export function latestAdReportDisplayDate(draft: AdReportDraft): string {
  let bestMs = Number.NEGATIVE_INFINITY;
  let bestIso = '';

  const consider = (raw: string): void => {
    const m = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?/.exec(String(raw ?? '').trim());
    if (!m?.[1]) return;
    const iso = m[1];
    const time = m[2] && /^\d{2}:\d{2}$/.test(m[2]) ? m[2] : '00:00';
    const ms = Date.parse(`${iso}T${time}:00`);
    if (!Number.isFinite(ms)) return;
    if (ms > bestMs) {
      bestMs = ms;
      bestIso = iso;
    }
  };

  for (const term of draft.terminals) {
    for (const action of term.actions) {
      if (isAdPilotAction(action)) {
        consider(action.onboarding);
        consider(action.disembarkment);
      } else if (isAdTugAction(action)) {
        consider(action.start);
        consider(action.end);
      }
    }
  }

  if (!bestIso) return '';
  const [yyyy, mm, dd] = bestIso.split('-');
  if (!yyyy || !mm || !dd) return '';
  return `${dd}.${mm}.${yyyy}`;
}

function newAdFileNameBlockId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `fnb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createAdFileNameBlock(
  type: AdFileNameBlockType = 'custom',
  text = '',
  sepAfter = ' ',
): AdFileNameBlock {
  return { id: newAdFileNameBlockId(), type, text, sepAfter };
}

export function createDefaultAdFileNamePattern(): AdFileNamePattern {
  return {
    delimiter: ' ',
    blocks: [
      createAdFileNameBlock('sequence', '', ' '),
      createAdFileNameBlock('custom', 'A&D', ' '),
      createAdFileNameBlock('portCallId', '', ' '),
    ],
  };
}

export function normalizeAdFileNameBlock(
  raw: unknown,
  fallbackSep = ' ',
): AdFileNameBlock | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<AdFileNameBlock>;
  const type = String(r.type ?? '').trim() as AdFileNameBlockType;
  if (!AD_FILE_NAME_BLOCK_TYPES.some((t) => t.type === type)) return null;
  const sepAfter =
    typeof r.sepAfter === 'string' ? r.sepAfter : fallbackSep;
  return {
    id: String(r.id ?? '').trim() || newAdFileNameBlockId(),
    type,
    text: String(r.text ?? ''),
    sepAfter,
  };
}

export function normalizeAdFileNamePattern(
  raw?: Partial<AdFileNamePattern> | null,
): AdFileNamePattern {
  const defaults = createDefaultAdFileNamePattern();
  if (!raw || typeof raw !== 'object') return defaults;
  const delimiter = typeof raw.delimiter === 'string' ? raw.delimiter : defaults.delimiter;
  const blocksRaw = Array.isArray(raw.blocks) ? raw.blocks : null;
  const blocks = blocksRaw
    ? blocksRaw
        .map((b) => normalizeAdFileNameBlock(b, delimiter))
        .filter((b): b is AdFileNameBlock => !!b)
    : defaults.blocks;
  return {
    delimiter,
    blocks: blocks.length ? blocks : defaults.blocks,
  };
}

/**
 * Next document sequence for the folder: max leading number in existing
 * Excel names + 1, or file count + 1 when none start with digits.
 */
export function nextAdFolderSequence(folderFiles: readonly string[]): number {
  let max = 0;
  let found = false;
  for (const name of folderFiles) {
    const m = /^(\d+)/.exec(String(name ?? '').trim());
    if (!m) continue;
    found = true;
    const n = parseInt(m[1]!, 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  if (found) return max + 1;
  return folderFiles.length + 1;
}

export interface AdFileNameBuildContext {
  portCallId: string;
  folderFiles: readonly string[];
  /** Draft port code (e.g. DEBRV). */
  portCode?: string;
  /** Port display name from Settings. */
  portName?: string;
  /** Latest report date as `DD.MM.YYYY` (from draft events). */
  reportDate?: string;
  /** Override sequence (tests / preview freeze). */
  sequence?: number;
}

export interface AdFileNameFromPatternOptions {
  when?: Date;
  ports?: readonly { code?: string; name?: string }[];
}

/** Resolve one block to its text contribution (may be empty → skipped). */
function resolveAdFileNameBlockPart(
  block: AdFileNameBlock,
  ctx: AdFileNameBuildContext,
  seq: number,
): string {
  switch (block.type) {
    case 'empty':
      return '';
    case 'sequence':
      return formatAdFolderSequence(seq);
    case 'custom':
      return String(block.text ?? '').trim();
    case 'portCallId':
      return String(ctx.portCallId ?? '').trim();
    case 'portCode':
      return String(ctx.portCode ?? '').trim().toUpperCase();
    case 'portName':
      return String(ctx.portName ?? '').trim();
    case 'reportDate':
      return String(ctx.reportDate ?? '').trim();
    default:
      return '';
  }
}

/**
 * Build stem (no extension) from pattern.
 * Empty blocks are skipped; each block’s `sepAfter` joins to the next non-empty part.
 */
export function buildAdFileNameStem(
  pattern: AdFileNamePattern,
  ctx: AdFileNameBuildContext,
): string {
  const seq = ctx.sequence ?? nextAdFolderSequence(ctx.folderFiles);
  let out = '';
  let pendingSep = '';
  const fallbackSep = typeof pattern.delimiter === 'string' ? pattern.delimiter : ' ';
  for (const block of pattern.blocks) {
    const part = resolveAdFileNameBlockPart(block, ctx, seq);
    if (!part) continue;
    out += (out ? pendingSep : '') + part;
    pendingSep = typeof block.sepAfter === 'string' ? block.sepAfter : fallbackSep;
  }
  return out;
}

/** Full suggested `.xlsx` name from pattern (falls back to legacy export name). */
export function buildAdFileNameFromPattern(
  pattern: AdFileNamePattern,
  draft: AdReportDraft,
  folderFiles: readonly string[],
  opts: AdFileNameFromPatternOptions | Date = {},
): string {
  const options: AdFileNameFromPatternOptions =
    opts instanceof Date ? { when: opts } : (opts ?? {});
  const when = options.when ?? new Date();
  const ports = options.ports ?? [];
  const stem = buildAdFileNameStem(pattern, {
    portCallId: draft.portCallId,
    portCode: draft.portCode,
    portName: resolveAdPortName(draft.portCode, ports),
    folderFiles,
    reportDate: latestAdReportDisplayDate(draft),
  }).trim();
  if (!stem) return adExportFileName(draft, when);
  const safe = stem.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/\.+$/g, '');
  return /\.xlsx$/i.test(safe) ? safe : `${safe}.xlsx`;
}

/**
 * UI-only block order inside each terminal.
 * `document` = palette / Excel row order; `timeline` = by event date+time.
 * Never changes Excel write.
 */
export type AdActionDisplaySort = 'document' | 'timeline';

export function normalizeAdActionDisplaySort(raw: unknown): AdActionDisplaySort {
  return raw === 'timeline' ? 'timeline' : 'document';
}

/** Persisted A&D workspace (folder + draft survive app restart). */
export interface AdWorkspace {
  folderPath: string;
  selectedFile: string;
  draft: AdReportDraft;
  blockDefaults: AdBlockDefaults;
  /** Auto Excel name builder (blocks + per-block separators). */
  fileNamePattern: AdFileNamePattern;
  /** Display-only action order inside terminals. */
  actionDisplaySort: AdActionDisplaySort;
}

export function createDefaultAdWorkspace(): AdWorkspace {
  return {
    folderPath: '',
    selectedFile: '',
    draft: createEmptyAdDraft(),
    blockDefaults: normalizeAdBlockDefaults(DEFAULT_AD_BLOCK_DEFAULTS),
    fileNamePattern: createDefaultAdFileNamePattern(),
    actionDisplaySort: 'document',
  };
}

function normalizeAdYn(raw: unknown, fallback: AdYn = 'No'): AdYn {
  return raw === 'Yes' || raw === 'No' ? raw : fallback;
}

function normalizeAdAction(raw: unknown): AdAction | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<AdAction> & { kind?: string };
  const kind = String(r.kind ?? '').trim() as AdActionKind;
  if (!AD_ACTION_DEFS.some((d) => d.kind === kind)) return null;
  const def = adActionDef(kind);
  if (def.shape === 'tug') {
    const qty = Number((r as AdTugAction).quantity);
    return {
      kind: kind as AdTugAction['kind'],
      quantity: Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 1,
      start: String((r as AdTugAction).start ?? ''),
      end: String((r as AdTugAction).end ?? ''),
      reason: String((r as AdTugAction).reason ?? '').trim() || 'Safety',
      waitMins: String((r as AdTugAction).waitMins ?? '0').trim() || '0',
      vain: normalizeAdYn((r as AdTugAction).vain, 'No'),
    };
  }
  return {
    kind: kind as AdPilotAction['kind'],
    onboarding: String((r as AdPilotAction).onboarding ?? ''),
    disembarkment: String((r as AdPilotAction).disembarkment ?? ''),
    pec: normalizeAdYn((r as AdPilotAction).pec, 'No'),
    waitMins: String((r as AdPilotAction).waitMins ?? '0').trim() || '0',
    vain: normalizeAdYn((r as AdPilotAction).vain, 'No'),
  };
}

function normalizeAdTerminal(raw: unknown): AdTerminal {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<AdTerminal>;
  const remarksRaw = (r.remarks ?? {}) as Partial<AdTerminalRemarks>;
  const actionsRaw = Array.isArray(r.actions) ? r.actions : [];
  const seen = new Set<AdActionKind>();
  const actions: AdAction[] = [];
  for (const row of actionsRaw) {
    const a = normalizeAdAction(row);
    if (!a || seen.has(a.kind)) continue;
    seen.add(a.kind);
    actions.push(a);
  }
  return {
    id: String(r.id ?? '').trim() || crypto.randomUUID(),
    code: String(r.code ?? '').trim().toUpperCase(),
    layBy: !!r.layBy,
    actions,
    remarks: {
      shoreGangway: normalizeAdYn(remarksRaw.shoreGangway, 'No'),
      shoreGangwayShift: normalizeAdYn(remarksRaw.shoreGangwayShift, 'No'),
      hatchCoverQty: String(remarksRaw.hatchCoverQty ?? ''),
      draftArrival: String(remarksRaw.draftArrival ?? ''),
      draftDeparture: String(remarksRaw.draftDeparture ?? ''),
      boatmenWaitMins: String(remarksRaw.boatmenWaitMins ?? '0').trim() || '0',
      miscRemarks: String(remarksRaw.miscRemarks ?? ''),
    },
  };
}

export function normalizeAdDraft(raw?: Partial<AdReportDraft> | null): AdReportDraft {
  const empty = createEmptyAdDraft();
  if (!raw) return empty;
  const terminals = Array.isArray(raw.terminals)
    ? raw.terminals.map(normalizeAdTerminal).filter(Boolean)
    : [];
  return {
    vessel: String(raw.vessel ?? ''),
    master: String(raw.master ?? ''),
    portCallId: String(raw.portCallId ?? ''),
    portCode: String(raw.portCode ?? '').trim().toUpperCase(),
    terminals: terminals.length ? terminals : empty.terminals,
  };
}

export function normalizeAdWorkspace(raw?: Partial<AdWorkspace> | null): AdWorkspace {
  const defaults = createDefaultAdWorkspace();
  if (!raw) return defaults;
  return {
    folderPath: String(raw.folderPath ?? '').trim(),
    selectedFile: String(raw.selectedFile ?? '').trim(),
    draft: normalizeAdDraft(raw.draft),
    blockDefaults: normalizeAdBlockDefaults(raw.blockDefaults),
    fileNamePattern: normalizeAdFileNamePattern(raw.fileNamePattern),
    actionDisplaySort: normalizeAdActionDisplaySort(raw.actionDisplaySort),
  };
}

/** Numeric Excel cell from wait/qty-like string fields. */
export function adWaitMinsNumber(raw: string | number | null | undefined): number {
  const n = Number(String(raw ?? '').trim().replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
