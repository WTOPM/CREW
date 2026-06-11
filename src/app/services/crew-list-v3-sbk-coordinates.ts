/** Crew List v3 SBK — pdf-lib placements (origin bottom-left, pt). */

export const CREW_LIST_V3_SBK_TEMPLATE_URL = '/crew-list-v3-sbk-empty.pdf';

/** Bump when public/crew-list-v3-sbk-empty.pdf changes. */
export const CREW_LIST_V3_SBK_TEMPLATE_VERSION = 4;

/** Portrait A4 (pt) — matches Crew List v3 SBK template. */
export const CREW_LIST_V3_SBK_PAGE = { w: 595.22, h: 842 } as const;

/** Single font size for header, rows, and footer (Helvetica regular). */
export const CREW_LIST_V3_SBK_FONT = 8;
export const CREW_LIST_V3_SBK_PORTS_FROM_TO_GAP = '       ';
export const CREW_LIST_V3_SBK_ROW_LINE_HEIGHT = CREW_LIST_V3_SBK_FONT * 1.05;

export interface CrewListV3SbkTextPlacement {
  x: number;
  y: number;
  fontSize?: number;
  maxWidth?: number;
}

/** Header fields — user-measured on 123.pdf. */
export const CREW_LIST_V3_SBK_HEADER = {
  charterer: { x: 87, y: 755 },
  arrivalMark: { x: 217, y: 756 },
  departureMark: { x: 310, y: 756 },
  shipName: { x: 82, y: 730 },
  portOfCall: { x: 220, y: 730, maxWidth: 88 },
  voyageDate: { x: 312, y: 730 },
  shipNationality: { x: 82, y: 708 },
  portsFromTo: { x: 219, y: 708, maxWidth: 320 },
} satisfies Record<string, CrewListV3SbkTextPlacement>;

export const CREW_LIST_V3_SBK_FOOTER = {
  signatureDate: { x: 96, y: 389 },
  masterName: { x: 391, y: 389, maxWidth: 155 },
} satisfies Record<string, CrewListV3SbkTextPlacement>;

/** Row No. column — x fixed, y per row (14 rows per page). */
export const CREW_LIST_V3_SBK_ROW_NO_X = 64;

export const CREW_LIST_V3_SBK_ROW_Y = [
  681, 662, 642, 622, 604, 584, 565, 546, 527, 507, 487, 468, 449, 430,
] as const;

/** Fallback step for rows beyond CREW_LIST_V3_SBK_ROW_Y (≈19 pt). */
export const CREW_LIST_V3_SBK_ROW_STEP = 19;

export interface CrewListV3SbkRowCol {
  x: number;
  maxWidth: number;
  maxLines: number;
  truncate?: boolean;
}

const CREW_LIST_V3_SBK_COL_GAP = 3;

export const CREW_LIST_V3_SBK_ROW_COLS = {
  name: { x: 76, maxWidth: 165 - 76 - CREW_LIST_V3_SBK_COL_GAP, maxLines: 2, truncate: false },
  rank: { x: 167, maxWidth: 214 - 167 - CREW_LIST_V3_SBK_COL_GAP, maxLines: 2, truncate: false },
  nationality: { x: 214, maxWidth: 264 - 214 - CREW_LIST_V3_SBK_COL_GAP, maxLines: 2, truncate: false },
  dateOfBirth: { x: 264, maxWidth: 307 - 264 - CREW_LIST_V3_SBK_COL_GAP, maxLines: 1, truncate: false },
  placeOfBirth: { x: 307, maxWidth: 391 - 307 - CREW_LIST_V3_SBK_COL_GAP, maxLines: 2, truncate: false },
  sbookNo: { x: 393, maxWidth: 443 - 393 - CREW_LIST_V3_SBK_COL_GAP, maxLines: 2, truncate: false },
  sbookExpiry: { x: 446, maxWidth: 543 - 446 - CREW_LIST_V3_SBK_COL_GAP, maxLines: 2, truncate: false },
} satisfies Record<string, CrewListV3SbkRowCol>;

export const CREW_LIST_V3_SBK_MAX_ROWS = 14;

export function crewListV3SbkRowY(rowIndex: number): number {
  if (rowIndex < CREW_LIST_V3_SBK_ROW_Y.length) {
    return CREW_LIST_V3_SBK_ROW_Y[rowIndex];
  }
  const last = CREW_LIST_V3_SBK_ROW_Y[CREW_LIST_V3_SBK_ROW_Y.length - 1];
  return last - CREW_LIST_V3_SBK_ROW_STEP * (rowIndex - CREW_LIST_V3_SBK_ROW_Y.length + 1);
}
