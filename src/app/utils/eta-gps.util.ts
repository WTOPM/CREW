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
 * Editor field format:
 * - `ddm` — degrees + decimal minutes (53°52.70′ N); `sec` = hundredths of a minute 00–99
 * - `dms` — degrees + minutes + arc-seconds (53°52′42″ N); `sec` = seconds 00–59
 */
export type EtaGpsCoordFormat = 'ddm' | 'dms';

/**
 * Maritime editor fields.
 * Example DDM 53°52.70′ N → deg=`53`, min=`52`, sec=`70`.
 * Example DMS 53°52′42″ N → deg=`53`, min=`52`, sec=`42`.
 * Field name `sec` kept for payload compatibility with the Electron float window.
 */
export interface EtaGpsDmsDraft {
  deg: string;
  /** Whole minutes 00…59. */
  min: string;
  /**
   * DDM: hundredths of a minute 00…99.
   * DMS: arc-seconds 00…59.
   */
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

export function normalizeEtaGpsCoordFormat(raw: unknown): EtaGpsCoordFormat {
  return raw === 'dms' ? 'dms' : 'ddm';
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

function maxSecForFormat(format: EtaGpsCoordFormat): number {
  return format === 'dms' ? 59 : 99;
}

/** Convert stored decimal degrees → editor draft. */
export function decimalToEtaGpsDmsDraft(
  value: number | null | undefined,
  kind: 'lat' | 'lon',
  format: EtaGpsCoordFormat = 'ddm',
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

  if (format === 'dms') {
    let minFloat = (abs - deg) * 60;
    let min = Math.floor(minFloat + 1e-12);
    let sec = Math.round((minFloat - min) * 60 + 1e-9);
    if (sec >= 60) {
      sec = 0;
      min += 1;
    }
    if (min >= 60) {
      min = 0;
      deg += 1;
    }
    return {
      deg: kind === 'lon' ? pad3(deg) : pad2(deg),
      min: pad2(min),
      sec: pad2(sec),
      hemi,
    };
  }

  // DDM: whole minutes + hundredths of a minute.
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

/** Build decimal degrees from editor draft in the given format. */
export function etaGpsDmsDraftToDecimal(
  draft: EtaGpsDmsDraft,
  kind: 'lat' | 'lon',
  format: EtaGpsCoordFormat = 'ddm',
): number | null {
  const degEmpty = !draft.deg.trim();
  const minEmpty = !draft.min.trim();
  const secEmpty = !draft.sec.trim();
  if (degEmpty && minEmpty && secEmpty) return null;

  const deg = parseDmsNumber(draft.deg) ?? 0;
  const min = parseDmsNumber(draft.min) ?? 0;
  const sec = parseDmsNumber(draft.sec) ?? 0;
  if (deg < 0 || min < 0 || sec < 0) return null;
  if (min >= 60 || sec > maxSecForFormat(format)) return null;
  // Reject leftover decimal typing in min/sec (UI is split fields).
  if (String(draft.min).includes('.') || String(draft.sec).includes('.')) return null;

  const maxDeg = kind === 'lat' ? 90 : 180;
  if (deg > maxDeg) return null;
  if (deg === maxDeg && (min > 0 || sec > 0)) return null;

  const abs =
    format === 'dms' ? deg + min / 60 + sec / 3600 : deg + (min + sec / 100) / 60;
  const negative = kind === 'lat' ? draft.hemi === 'S' : draft.hemi === 'W';
  return negative ? -abs : abs;
}

export function tryBuildEtaGpsCoordsFromDms(
  lat: EtaGpsDmsDraft,
  lon: EtaGpsDmsDraft,
  format: EtaGpsCoordFormat = 'ddm',
): EtaGpsCoords | null {
  const latEmpty = !lat.deg.trim() && !lat.min.trim() && !lat.sec.trim();
  const lonEmpty = !lon.deg.trim() && !lon.min.trim() && !lon.sec.trim();
  if (latEmpty && lonEmpty) return null;

  const latDec = etaGpsDmsDraftToDecimal(lat, 'lat', format);
  const lonDec = etaGpsDmsDraftToDecimal(lon, 'lon', format);
  if (latDec == null || lonDec == null) return null;
  const coords = { lat: latDec, lon: lonDec };
  return isValidEtaGpsCoords(coords) ? coords : null;
}

/** Re-encode the same position from one editor format into another. */
export function convertEtaGpsDraftFormat(
  draft: EtaGpsDmsDraft,
  kind: 'lat' | 'lon',
  from: EtaGpsCoordFormat,
  to: EtaGpsCoordFormat,
): EtaGpsDmsDraft {
  if (from === to) return draft;
  const dec = etaGpsDmsDraftToDecimal(draft, kind, from);
  return decimalToEtaGpsDmsDraft(dec, kind, to);
}

/** Human-readable line for one axis. */
export function formatEtaGpsDms(
  value: number,
  kind: 'lat' | 'lon',
  format: EtaGpsCoordFormat = 'ddm',
): string {
  const draft = decimalToEtaGpsDmsDraft(value, kind, format);
  if (format === 'dms') {
    return `${draft.deg}°${draft.min}′${draft.sec}″ ${draft.hemi}`;
  }
  return `${draft.deg}°${draft.min}.${draft.sec}′ ${draft.hemi}`;
}

export function formatEtaGpsShort(
  coords: EtaGpsCoords,
  format: EtaGpsCoordFormat = 'ddm',
): string {
  return `${formatEtaGpsDms(coords.lat, 'lat', format)}, ${formatEtaGpsDms(coords.lon, 'lon', format)}`;
}

export function toggleEtaGpsLatHemi(hemi: EtaGpsLatHemi | EtaGpsLonHemi): EtaGpsLatHemi {
  return hemi === 'S' ? 'N' : 'S';
}

export function toggleEtaGpsLonHemi(hemi: EtaGpsLatHemi | EtaGpsLonHemi): EtaGpsLonHemi {
  return hemi === 'W' ? 'E' : 'W';
}

/**
 * Digits while typing:
 * - deg: integers
 * - min: whole minutes 00–59 (2 digits)
 * - sec: DDM hundredths 00–99 / DMS seconds 00–59 (2 digits)
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

/** Pad typed part (lat deg 00, lon deg 000, min/sec 00). */
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

/** Step a numeric part; wraps within valid ranges for the active format. */
export function stepEtaGpsDmsPart(
  draft: EtaGpsDmsDraft,
  part: 'deg' | 'min' | 'sec',
  axis: 'lat' | 'lon',
  delta: number,
  format: EtaGpsCoordFormat = 'ddm',
): EtaGpsDmsDraft {
  const maxDeg = axis === 'lat' ? 90 : 180;
  const max = part === 'deg' ? maxDeg : part === 'min' ? 59 : maxSecForFormat(format);
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
