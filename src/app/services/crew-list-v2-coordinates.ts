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
  662, 640, 618, 596, 574, 552, 529, 508, 486, // 1–9
  464, 442, 420, 398, 376, 354, // 10–15
] as const;

/** Fallback step for rows beyond CREW_LIST_V2_ROW_Y (≈22 pt). */
export const CREW_LIST_V2_ROW_STEP = 22;

export interface CrewListV2RowCol {
  x: number;
  maxWidth: number;
  maxLines: number;
  /** false = always draw full value (dates, passport no.) — no «…» truncation. */
  truncate?: boolean;
}

/** Table body columns (8+) — maxWidth = gap to next column; maxLines 2 where long text wraps. */
export const CREW_LIST_V2_ROW_COLS = {
  name: { x: 54, maxWidth: 94, maxLines: 2 },
  rank: { x: 152, maxWidth: 44, maxLines: 2 },
  nationality: { x: 200, maxWidth: 46, maxLines: 2 },
  dateOfBirth: { x: 250, maxWidth: 64, maxLines: 1, truncate: false },
  placeOfBirth: { x: 317, maxWidth: 73, maxLines: 2 },
  passportNo: { x: 393, maxWidth: 42, maxLines: 1, truncate: false },
  passportExpiry: { x: 438, maxWidth: 44, maxLines: 1, truncate: false },
  passportPlaceOfIssue: { x: 482, maxWidth: 39, maxLines: 2 },
  gender: { x: 523, maxWidth: 48, maxLines: 1, truncate: false },
} satisfies Record<string, CrewListV2RowCol>;

export const CREW_LIST_V2_MAX_ROWS = 15;

export function crewListV2RowY(rowIndex: number): number {
  if (rowIndex < CREW_LIST_V2_ROW_Y.length) {
    return CREW_LIST_V2_ROW_Y[rowIndex];
  }
  const last = CREW_LIST_V2_ROW_Y[CREW_LIST_V2_ROW_Y.length - 1];
  return last - CREW_LIST_V2_ROW_STEP * (rowIndex - CREW_LIST_V2_ROW_Y.length + 1);
}
