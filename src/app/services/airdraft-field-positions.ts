/**
 * Airdraft (Erklärung / Declaration) — pdf-lib placements (origin bottom-left, pt).
 * Template: public/airdraft-empty.pdf (landscape).
 */

export const AIRDRAFT_TEMPLATE_VERSION = 1;

export const AIRDRAFT_FONT_SIZE = 11;

export interface AirdraftTextPlacement {
  x: number;
  y: number;
  fontSize?: number;
  maxWidth?: number;
}

/** User-measured on filled original. */
export const AIRDRAFT_FIELDS = {
  shipName: { x: 277, y: 245, fontSize: 14, maxWidth: 220 },
  /** Height above water = keel–mast − present draft. */
  heightAboveWater: { x: 263, y: 173, fontSize: AIRDRAFT_FONT_SIZE, maxWidth: 48 },
  /** Maximum present draft (m). */
  presentDraft: { x: 484, y: 173, fontSize: AIRDRAFT_FONT_SIZE, maxWidth: 48 },
  date: { x: 157, y: 64, fontSize: AIRDRAFT_FONT_SIZE, maxWidth: 90 },
  masterName: { x: 355, y: 64, fontSize: AIRDRAFT_FONT_SIZE, maxWidth: 160 },
} as const satisfies Record<string, AirdraftTextPlacement>;

/** Parse metres from ship field (comma or dot). */
export function parseAirdraftMetres(raw: string | undefined | null): number | null {
  const v = String(raw ?? '')
    .trim()
    .replace(/\s/g, '')
    .replace(',', '.');
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Display metres with one decimal and a dot (e.g. 1.1, 46.7). */
export function formatAirdraftMetres(value: number): string {
  return (Math.round(value * 10) / 10).toFixed(1);
}

/**
 * Normalize user input for ship metres fields: `1,1` → `1.1`, empty stays empty.
 * Invalid non-empty input returns null (caller keeps editing / rejects).
 */
export function normalizeShipMetresInput(raw: string | undefined | null): string | null {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return '';
  const n = parseAirdraftMetres(trimmed);
  if (n == null) return null;
  return formatAirdraftMetres(n);
}

/** Height above water level = keel–mast top − present draft. */
export function airdraftHeightAboveWaterMetres(
  heightKeelToMastTop: string | undefined | null,
  maximumPresentDraft: string | undefined | null,
): number | null {
  const height = parseAirdraftMetres(heightKeelToMastTop);
  const draft = parseAirdraftMetres(maximumPresentDraft);
  if (height == null || draft == null) return null;
  return height - draft;
}
