/** Crew List v2 — pdf-lib placements (origin bottom-left, pt). */

export const CREW_LIST_V2_TEMPLATE_URL = '/crew-list-v2-empty.pdf';

/** Bump when public/crew-list-v2-empty.pdf changes. */
export const CREW_LIST_V2_TEMPLATE_VERSION = 2;

/** Portrait A4 (pt) — matches Crew List v2 — empty.pdf. */
export const CREW_LIST_V2_PAGE = { w: 595.22, h: 842 } as const;

export const CREW_LIST_V2_FONT_HEADER = 9;
/** Field 5 — may shrink further to fit maxWidth. */
export const CREW_LIST_V2_FONT_PORTS_FROM_TO = 7;
/** Gap between «arrived from» and «destination» (7 spaces). */
export const CREW_LIST_V2_PORTS_FROM_TO_GAP = '       ';
export const CREW_LIST_V2_FONT_ROW = 8;
export const CREW_LIST_V2_ROW_LINE_HEIGHT = CREW_LIST_V2_FONT_ROW * 1.05;

export interface CrewListV2TextPlacement {
  x: number;
  y: number;
  fontSize?: number;
  maxWidth?: number;
}

/** Header fields (user-measured on template). */
export const CREW_LIST_V2_HEADER = {
  shipName: { x: 83, y: 736, fontSize: CREW_LIST_V2_FONT_HEADER },
  shipNationality: { x: 83, y: 704, fontSize: CREW_LIST_V2_FONT_HEADER },
  arrivalMark: { x: 201, y: 756, fontSize: CREW_LIST_V2_FONT_HEADER },
  departureMark: { x: 318, y: 756, fontSize: CREW_LIST_V2_FONT_HEADER },
  portOfCall: { x: 210, y: 735, fontSize: CREW_LIST_V2_FONT_HEADER },
  voyageDate: { x: 360, y: 735, fontSize: CREW_LIST_V2_FONT_HEADER },
  pageNo: { x: 548, y: 755, fontSize: CREW_LIST_V2_FONT_HEADER },
  portsFromTo: {
    x: 210,
    y: 702,
    fontSize: CREW_LIST_V2_FONT_PORTS_FROM_TO,
    maxWidth: 320,
  },
} satisfies Record<string, CrewListV2TextPlacement>;

/** Field 13 — date & master signature line (every page). */
export const CREW_LIST_V2_FOOTER = {
  signatureDate: { x: 79, y: 314, fontSize: CREW_LIST_V2_FONT_HEADER },
  masterName: { x: 432, y: 314, fontSize: CREW_LIST_V2_FONT_HEADER, maxWidth: 155 },
} satisfies Record<string, CrewListV2TextPlacement>;

/** Column 7 — row No. */
export const CREW_LIST_V2_ROW_NO_X = 36;

/** pdf-lib drawText baseline Y per row (0-based; row 1 = index 0) — user-measured. */
export const CREW_LIST_V2_ROW_Y = [
  660,
  638,
  616,
  594,
  572,
  550,
  527,
  506,
  484, // 1–9
  462,
  440,
  418,
  396,
  374,
  352, // 10–15
] as const;

/** Fallback step for rows beyond CREW_LIST_V2_ROW_Y (≈22 pt). */
export const CREW_LIST_V2_ROW_STEP = 22;

export interface CrewListV2RowCol {
  x: number;
  maxWidth: number;
  maxLines: number;
  /** false = always draw full value (dates, passport no.) — no «…» truncation. */
  truncate?: boolean;
  /** Horizontal alignment inside the cell (uses drawRight as inner right edge). */
  align?: 'left' | 'center' | 'right';
  /** Inner right edge of the cell (pt). */
  drawRight?: number;
}

const CREW_LIST_V2_COL_GAP = 3;

/** Template vertical line between Place of issue and GENDER (pdf-lib x). */
const CREW_LIST_V2_PLACE_CELL_RIGHT = 521;
const CREW_LIST_V2_GENDER_CELL_LEFT = 529;
const CREW_LIST_V2_GENDER_CELL_RIGHT = 565;

/**
 * Column right edges (template grid).
 */
const CREW_LIST_V2_COL_RIGHT = {
  name: 152,
  rank: 200,
  nationality: 250,
  dateOfBirth: 317,
  placeOfBirth: 393,
  passportNo: 443,
  passportExpiry: 481,
  passportPlaceOfIssue: CREW_LIST_V2_PLACE_CELL_RIGHT,
  gender: CREW_LIST_V2_GENDER_CELL_RIGHT,
} as const;

/** Table body columns — maxWidth = gap to next column; all wrap up to 2 lines. */
export const CREW_LIST_V2_ROW_COLS = {
  name: {
    x: 54,
    maxWidth: CREW_LIST_V2_COL_RIGHT.name - 54 - CREW_LIST_V2_COL_GAP,
    maxLines: 2,
    truncate: false,
  },
  rank: {
    x: 152,
    maxWidth: CREW_LIST_V2_COL_RIGHT.rank - 152 - CREW_LIST_V2_COL_GAP,
    maxLines: 2,
    truncate: false,
  },
  nationality: {
    x: 200,
    maxWidth: CREW_LIST_V2_COL_RIGHT.nationality - 200 - CREW_LIST_V2_COL_GAP,
    maxLines: 2,
    truncate: false,
  },
  dateOfBirth: {
    x: 249,
    maxWidth: CREW_LIST_V2_COL_RIGHT.dateOfBirth - 249 - CREW_LIST_V2_COL_GAP,
    maxLines: 2,
    truncate: false,
  },
  placeOfBirth: {
    x: 317,
    maxWidth: CREW_LIST_V2_COL_RIGHT.placeOfBirth - 317 - CREW_LIST_V2_COL_GAP,
    maxLines: 2,
    truncate: false,
  },
  passportNo: {
    x: 393,
    maxWidth: CREW_LIST_V2_COL_RIGHT.passportNo - 393 - CREW_LIST_V2_COL_GAP,
    maxLines: 2,
    truncate: false,
  },
  passportExpiry: {
    x: 439,
    maxWidth: CREW_LIST_V2_COL_RIGHT.passportExpiry - 439 - CREW_LIST_V2_COL_GAP,
    maxLines: 2,
    truncate: false,
  },
  passportPlaceOfIssue: {
    x: 480,
    maxWidth: CREW_LIST_V2_PLACE_CELL_RIGHT - 480,
    maxLines: 2,
    truncate: false,
  },
  gender: {
    x: CREW_LIST_V2_GENDER_CELL_LEFT,
    maxWidth: CREW_LIST_V2_GENDER_CELL_RIGHT - CREW_LIST_V2_GENDER_CELL_LEFT,
    maxLines: 1,
    truncate: false,
  },
} satisfies Record<string, CrewListV2RowCol>;

export const CREW_LIST_V2_MAX_ROWS = 15;

export function crewListV2RowY(rowIndex: number): number {
  if (rowIndex < CREW_LIST_V2_ROW_Y.length) {
    return CREW_LIST_V2_ROW_Y[rowIndex];
  }
  const last = CREW_LIST_V2_ROW_Y[CREW_LIST_V2_ROW_Y.length - 1];
  return last - CREW_LIST_V2_ROW_STEP * (rowIndex - CREW_LIST_V2_ROW_Y.length + 1);
}
