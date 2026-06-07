/**
 * Crew list Type 2 (Alger) — pdf-lib placements (origin bottom-left, pt).
 * Page /Rotate 90: text uses rotate 90° and anchor (transform e, f) from the reference PDF.
 * Crew members are columns (X); body fields are rows (Y) — used when body fill is enabled.
 */

export const CREW_LIST_ALGER_MAX_ROWS = 14;

export const CREW_LIST_ALGER_COL_FIRST_X = 176;
export const CREW_LIST_ALGER_COL_STEP = 22;

/** Max text length along the column (rotated 90° → horizontal extent in pt). */
export const CREW_LIST_ALGER_COL_TEXT_MAX_PT = CREW_LIST_ALGER_COL_STEP - 3;

/** Matches reference PDF text matrix rotation. */
export const CREW_LIST_ALGER_TEXT_ROTATION = 90;

export const CREW_LIST_ALGER_FONT_ROW = 7;
export const CREW_LIST_ALGER_FONT_HEADER = 8;

export const CREW_LIST_ALGER_TEMPS = ['36.5 C', '36.6 C', '36.7 C'] as const;

export interface AlgerTextPlacement {
  x: number;
  y: number;
  fontSize?: number;
  maxWidth?: number;
}

export const CREW_LIST_ALGER_HEADER = {
  pageNo: { x: 98, y: 527, fontSize: 8 },
  /** Arrival checkbox — from coordinate preview. */
  arrivalMark: { x: 97, y: 313, fontSize: 7 },
  shipName: { x: 117, y: 173, fontSize: 8, maxWidth: 120 },
  shipNationality: { x: 142, y: 173, fontSize: 8, maxWidth: 100 },
  portOfCall: { x: 117, y: 339, fontSize: 8, maxWidth: 80 },
  voyageDate: { x: 117, y: 455, fontSize: 8, maxWidth: 70 },
  portsFromTo: { x: 141, y: 394, fontSize: 8, maxWidth: 200 },
  /** Field 6 — left column (Passport). */
  natureOfDocumentPassport: { x: 159, y: 507, fontSize: 7, maxWidth: 80 },
  /** Field 6 — right column (Seaman's book). */
  natureOfDocumentSeamans: { x: 159, y: 577, fontSize: 7, maxWidth: 80 },
} satisfies Record<string, AlgerTextPlacement>;

export interface AlgerRowYPlacement {
  y: number;
  fontSize?: number;
  maxWidth?: number;
}

/** Field row (constant Y); column X varies per crew member. No maxWidth — breaks names when rotated 90°. */
export const CREW_LIST_ALGER_ROW_Y = {
  no: { y: 85, fontSize: CREW_LIST_ALGER_FONT_ROW },
  name: { y: 103, fontSize: CREW_LIST_ALGER_FONT_ROW },
  rank: { y: 268, fontSize: CREW_LIST_ALGER_FONT_ROW },
  nationality: { y: 311, fontSize: CREW_LIST_ALGER_FONT_ROW },
  dateOfBirth: { y: 362, fontSize: CREW_LIST_ALGER_FONT_ROW },
  placeOfBirth: { y: 404, fontSize: CREW_LIST_ALGER_FONT_ROW },
  passport: { y: 507, fontSize: CREW_LIST_ALGER_FONT_ROW },
  seamansBook: { y: 579, fontSize: CREW_LIST_ALGER_FONT_ROW },
  joiningDate: { y: 644, fontSize: CREW_LIST_ALGER_FONT_ROW },
  joiningPort: { y: 706, fontSize: CREW_LIST_ALGER_FONT_ROW },
  temperature: { y: 755, fontSize: CREW_LIST_ALGER_FONT_ROW },
} satisfies Record<string, AlgerRowYPlacement>;

export type AlgerRowField = keyof typeof CREW_LIST_ALGER_ROW_Y;

/** Absolute X for crew columns 6–13 (0-based index 5–12). Others use uniform grid. */
export const CREW_LIST_ALGER_COL_X_ABSOLUTE: Partial<Record<number, number>> = {
  5: 290, // 6
  6: 314, // 7
  7: 335, // 8
  8: 359, // 9
  9: 381, // 10
  10: 403, // 11
  11: 426, // 12
  12: 444, // 13
};

export function crewListAlgerColX(index: number): number {
  const absolute = CREW_LIST_ALGER_COL_X_ABSOLUTE[index];
  if (absolute != null) return absolute;
  return CREW_LIST_ALGER_COL_FIRST_X + index * CREW_LIST_ALGER_COL_STEP;
}

const ALGER_ROW_YS = Object.values(CREW_LIST_ALGER_ROW_Y).map((r) => r.y);

/** Center of crew table body for large NIL when no members. */
export const CREW_LIST_ALGER_BODY_NIL = {
  x:
    CREW_LIST_ALGER_COL_FIRST_X +
    (crewListAlgerColX(Math.max(0, CREW_LIST_ALGER_MAX_ROWS - 1)) - CREW_LIST_ALGER_COL_FIRST_X) / 2,
  y: (Math.min(...ALGER_ROW_YS) + Math.max(...ALGER_ROW_YS)) / 2,
  fontSize: 84,
} as const;

export function randomCrewTemperature(): string {
  const i = Math.floor(Math.random() * CREW_LIST_ALGER_TEMPS.length);
  return CREW_LIST_ALGER_TEMPS[i] ?? '36.6 C';
}

/** Shrink font so rotated text fits one column width (no label rewriting). */
export function crewListAlgerFontSizeToFit(
  textWidthAtSize: (size: number) => number,
  baseSize: number,
  maxExtentPt: number,
  minSize = 5,
): number {
  let size = baseSize;
  while (size > minSize && textWidthAtSize(size) > maxExtentPt) {
    size -= 0.2;
  }
  return size;
}
