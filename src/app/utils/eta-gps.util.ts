/** Optional WGS84 position for an ETA route point (stored as decimal degrees). */
export interface EtaGpsCoords {
  /** Latitude degrees, −90…+90. */
  lat: number;
  /** Longitude degrees, −180…+180. */
  lon: number;
}

export type EtaGpsLatHemi = 'N' | 'S';
export type EtaGpsLonHemi = 'E' | 'W';

/**
 * Maritime DDM editor fields (IHO chart style).
 * Example 53°52.70′ N → deg=`53`, min=`52`, sec=`70` (hundredths of a minute, not arc-seconds).
 * Field name `sec` kept for payload compatibility with the Electron float window.
 */
export interface EtaGpsDmsDraft {
  deg: string;
  /** Whole minutes 00…59. */
  min: string;
  /** Hundredths of a minute 00…99 (forms decimal minutes: min.sec). */
  sec: string;
  hemi: EtaGpsLatHemi | EtaGpsLonHemi;
}

/** WGS84 geographic ranges. */
const LAT_MIN = -90;
const LAT_MAX = 90;
const LON_MIN = -180;
const LON_MAX = 180;

export function isValidEtaGpsCoords(coords: EtaGpsCoords | null | undefined): coords is EtaGpsCoords {
  if (!coords) return false;
  return (
    Number.isFinite(coords.lat) &&
    Number.isFinite(coords.lon) &&
    coords.lat >= LAT_MIN &&
    coords.lat <= LAT_MAX &&
    coords.lon >= LON_MIN &&
    coords.lon <= LON_MAX
  );
}

export function normalizeEtaGpsCoords(raw: unknown): EtaGpsCoords | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const lat =
    typeof r['lat'] === 'number'
      ? r['lat']
      : parseFloat(
          String(r['lat'] ?? '')
            .trim()
            .replace(',', '.'),
        );
  const lon =
    typeof r['lon'] === 'number'
      ? r['lon']
      : parseFloat(
          String(r['lon'] ?? '')
            .trim()
            .replace(',', '.'),
        );
  const coords = { lat, lon };
  return isValidEtaGpsCoords(coords) ? coords : null;
}

function parseDmsNumber(raw: string): number | null {
  const s = String(raw ?? '')
    .trim()
    .replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function pad2(n: number): string {
  return String(Math.trunc(Math.abs(n))).padStart(2, '0');
}

function pad3(n: number): string {
  return String(Math.trunc(Math.abs(n))).padStart(3, '0');
}

/** Convert stored decimal degrees → editor draft (deg + whole min + hundredths). */
export function decimalToEtaGpsDmsDraft(
  value: number | null | undefined,
  kind: 'lat' | 'lon',
): EtaGpsDmsDraft {
  const emptyHemi: EtaGpsLatHemi | EtaGpsLonHemi = kind === 'lat' ? 'N' : 'E';
  if (value == null || !Number.isFinite(value)) {
    return {
      deg: kind === 'lon' ? '000' : '00',
      min: '00',
      sec: '00',
      hemi: emptyHemi,
    };
  }

  const hemi: EtaGpsLatHemi | EtaGpsLonHemi =
    kind === 'lat' ? (value >= 0 ? 'N' : 'S') : value >= 0 ? 'E' : 'W';
  const abs = Math.abs(value);
  let deg = Math.floor(abs + 1e-12);
  const minFloat = (abs - deg) * 60;
  let hundredths = Math.round(minFloat * 100 + 1e-9);
  if (hundredths >= 6000) {
    hundredths = 0;
    deg += 1;
  }
  const minWhole = Math.floor(hundredths / 100);
  const minFrac = hundredths % 100;

  return {
    deg: kind === 'lon' ? pad3(deg) : pad2(deg),
    min: pad2(minWhole),
    sec: pad2(minFrac),
    hemi,
  };
}

/** Build decimal degrees from DDM draft: deg + (min + hundredths/100) / 60. */
export function etaGpsDmsDraftToDecimal(
  draft: EtaGpsDmsDraft,
  kind: 'lat' | 'lon',
): number | null {
  const degEmpty = !draft.deg.trim();
  const minEmpty = !draft.min.trim();
  const secEmpty = !draft.sec.trim();
  if (degEmpty && minEmpty && secEmpty) return null;

  const deg = parseDmsNumber(draft.deg) ?? 0;
  const min = parseDmsNumber(draft.min) ?? 0;
  const hundredths = parseDmsNumber(draft.sec) ?? 0;
  if (deg < 0 || min < 0 || hundredths < 0) return null;
  // Whole minutes 0…59; hundredths of a minute 0…99 (→ decimal minutes e.g. 52.70).
  if (min >= 60 || hundredths >= 100) return null;
  // Reject leftover decimal typing in min (UI is split fields).
  if (String(draft.min).includes('.') || String(draft.sec).includes('.')) return null;

  const maxDeg = kind === 'lat' ? 90 : 180;
  if (deg > maxDeg) return null;
  if (deg === maxDeg && (min > 0 || hundredths > 0)) return null;

  const abs = deg + (min + hundredths / 100) / 60;
  const negative = kind === 'lat' ? draft.hemi === 'S' : draft.hemi === 'W';
  return negative ? -abs : abs;
}

export function tryBuildEtaGpsCoordsFromDms(
  lat: EtaGpsDmsDraft,
  lon: EtaGpsDmsDraft,
): EtaGpsCoords | null {
  const latEmpty = !lat.deg.trim() && !lat.min.trim() && !lat.sec.trim();
  const lonEmpty = !lon.deg.trim() && !lon.min.trim() && !lon.sec.trim();
  if (latEmpty && lonEmpty) return null;

  const latDec = etaGpsDmsDraftToDecimal(lat, 'lat');
  const lonDec = etaGpsDmsDraftToDecimal(lon, 'lon');
  if (latDec == null || lonDec == null) return null;
  const coords = { lat: latDec, lon: lonDec };
  return isValidEtaGpsCoords(coords) ? coords : null;
}

/** Human-readable DDM: 53°52.70′ N */
export function formatEtaGpsDms(value: number, kind: 'lat' | 'lon'): string {
  const draft = decimalToEtaGpsDmsDraft(value, kind);
  return `${draft.deg}°${draft.min}.${draft.sec}′ ${draft.hemi}`;
}

export function formatEtaGpsShort(coords: EtaGpsCoords): string {
  return `${formatEtaGpsDms(coords.lat, 'lat')}, ${formatEtaGpsDms(coords.lon, 'lon')}`;
}

export function toggleEtaGpsLatHemi(hemi: EtaGpsLatHemi | EtaGpsLonHemi): EtaGpsLatHemi {
  return hemi === 'S' ? 'N' : 'S';
}

export function toggleEtaGpsLonHemi(hemi: EtaGpsLatHemi | EtaGpsLonHemi): EtaGpsLonHemi {
  return hemi === 'W' ? 'E' : 'W';
}

/**
 * Digits while typing (split DDM):
 * - deg: integers
 * - min: whole minutes 00–59 (2 digits)
 * - sec: hundredths of a minute 00–99 (2 digits)
 */
export function sanitizeEtaGpsDmsPart(
  raw: string,
  kind: 'deg' | 'min' | 'sec',
  axis: 'lat' | 'lon' = 'lat',
): string {
  let s = String(raw ?? '').replace(/[^\d]/g, '');
  if (kind === 'deg') return s.slice(0, axis === 'lon' ? 3 : 2);
  return s.slice(0, 2);
}

/** Pad typed part (lat deg 00, lon deg 000, min/hundredths 00). */
export function padEtaGpsDmsPart(
  raw: string,
  kind: 'deg' | 'min' | 'sec',
  axis: 'lat' | 'lon',
): string {
  const cleaned = sanitizeEtaGpsDmsPart(raw, kind, axis);
  const n = cleaned === '' ? 0 : Number(cleaned);
  if (!Number.isFinite(n)) return axis === 'lon' && kind === 'deg' ? '000' : '00';
  if (kind === 'deg' && axis === 'lon') return pad3(n);
  return pad2(n);
}

export function emptyEtaGpsDmsDraft(kind: 'lat' | 'lon'): EtaGpsDmsDraft {
  return {
    deg: kind === 'lon' ? '000' : '00',
    min: '00',
    sec: '00',
    hemi: kind === 'lat' ? 'N' : 'E',
  };
}

/** Auto-advance after a full fixed-width field. */
export function isEtaGpsDmsPartComplete(
  value: string,
  kind: 'deg' | 'min' | 'sec',
  axis: 'lat' | 'lon',
): boolean {
  if (kind === 'deg') return value.length >= (axis === 'lon' ? 3 : 2);
  return value.length >= 2;
}

/** Step a numeric part; wraps within valid maritime ranges. */
export function stepEtaGpsDmsPart(
  draft: EtaGpsDmsDraft,
  part: 'deg' | 'min' | 'sec',
  axis: 'lat' | 'lon',
  delta: number,
): EtaGpsDmsDraft {
  const maxDeg = axis === 'lat' ? 90 : 180;
  const max = part === 'deg' ? maxDeg : part === 'min' ? 59 : 99;
  const current = parseDmsNumber(draft[part]) ?? 0;
  let next = Math.trunc(current) + delta;
  if (next > max) next = 0;
  if (next < 0) next = max;
  const patched: EtaGpsDmsDraft = {
    ...draft,
    [part]: padEtaGpsDmsPart(String(next), part, axis),
  };
  if (part === 'deg' && next === maxDeg) {
    patched.min = '00';
    patched.sec = '00';
  }
  return patched;
}
