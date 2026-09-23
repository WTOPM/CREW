/** Departure Cargo Report (DEP REP.xlsx) — path + TOTAL CARGO + densities. */

export interface DepRepDensityEntry {
  /** UN/LOCODE, e.g. LVRIX. */
  port: string;
  /** Water density as entered, e.g. "1.025" or "1,025". */
  density: string;
}

export interface DepRepLibrarySettings {
  /** Absolute path to DEP REP.xlsx (Electron). */
  sourcePath: string;
  sourceFileName: string;
  /** TOTAL CARGO in tonnes — entered manually per departure. */
  totalCargo: string;
  lastWrittenSheet: string;
  lastWrittenAt: string;
  /** App-managed PORT → density list (editable; used when POL matches). */
  densities: DepRepDensityEntry[];
}

export function createDefaultDepRepLibrary(): DepRepLibrarySettings {
  return {
    sourcePath: '',
    sourceFileName: '',
    totalCargo: '',
    lastWrittenSheet: '',
    lastWrittenAt: '',
    densities: [],
  };
}

export function normalizeDepRepDensityEntry(
  raw: Partial<DepRepDensityEntry> | undefined | null,
): DepRepDensityEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const port = String(raw.port ?? '')
    .trim()
    .toUpperCase();
  const density = String(raw.density ?? '')
    .trim()
    .replace(',', '.');
  if (!port) return null;
  return { port, density };
}

export function normalizeDepRepDensities(
  raw: readonly Partial<DepRepDensityEntry>[] | undefined | null,
): DepRepDensityEntry[] {
  if (!Array.isArray(raw)) return [];
  const map = new Map<string, DepRepDensityEntry>();
  for (const item of raw) {
    const entry = normalizeDepRepDensityEntry(item);
    if (!entry) continue;
    map.set(entry.port, entry);
  }
  return [...map.values()].sort((a, b) => a.port.localeCompare(b.port));
}

export function normalizeDepRepLibrary(
  raw: Partial<DepRepLibrarySettings> | undefined | null,
): DepRepLibrarySettings {
  const d = createDefaultDepRepLibrary();
  if (!raw || typeof raw !== 'object') return d;
  return {
    sourcePath: String(raw.sourcePath ?? d.sourcePath).trim(),
    sourceFileName: String(raw.sourceFileName ?? d.sourceFileName).trim(),
    totalCargo: String(raw.totalCargo ?? d.totalCargo).trim(),
    lastWrittenSheet: String(raw.lastWrittenSheet ?? d.lastWrittenSheet).trim(),
    lastWrittenAt: String(raw.lastWrittenAt ?? d.lastWrittenAt).trim(),
    densities: normalizeDepRepDensities(raw.densities ?? d.densities),
  };
}

/** Lookup density string for a POL code from the app list. */
export function lookupDepRepLibraryDensity(
  densities: readonly DepRepDensityEntry[],
  polCode: string,
): string {
  const key = polCode.trim().toUpperCase();
  if (!key) return '';
  return densities.find((d) => d.port === key)?.density ?? '';
}

/** Sheet tab name: voyage + POL code, e.g. "138 LVRIX". */
export function depRepSheetName(voyage: string, polCode: string): string {
  const voy = voyage.trim();
  const pol = polCode.trim().toUpperCase();
  if (!voy && !pol) return '';
  if (!voy) return pol;
  if (!pol) return voy;
  return `${voy} ${pol}`;
}

/** Mid draft = (fore + aft) / 2. Keeps hundredths when needed (e.g. 9.3/9.4 → 9.35). */
export function depRepMidDraftMetres(draftFore: string, draftAft: string): string {
  const fore = parseDepRepDraftMetres(draftFore);
  const aft = parseDepRepDraftMetres(draftAft);
  if (fore == null && aft == null) return '';
  if (fore == null) return formatDepRepMidDraft(aft!);
  if (aft == null) return formatDepRepMidDraft(fore);
  return formatDepRepMidDraft((fore + aft) / 2);
}

function parseDepRepDraftMetres(raw: string): number | null {
  const s = String(raw ?? '').trim().replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function formatDepRepMidDraft(metres: number): string {
  const hundredths = Math.round(metres * 100) / 100;
  // Clean tenths stay as one decimal (9.30 → 9.3); halves keep two (9.35).
  if (Math.abs(hundredths * 10 - Math.round(hundredths * 10)) < 1e-9) {
    return (Math.round(hundredths * 10) / 10).toFixed(1);
  }
  return hundredths.toFixed(2);
}
