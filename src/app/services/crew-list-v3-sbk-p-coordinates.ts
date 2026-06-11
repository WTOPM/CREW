/** Crew List v3 SBK/P — pdf-lib placements (origin bottom-left, pt). */

export const CREW_LIST_V3_SBK_P_TEMPLATE_URL = '/crew-list-v3-sbk-p-empty.pdf';

/** Bump when public/crew-list-v3-sbk-p-empty.pdf changes. */
export const CREW_LIST_V3_SBK_P_TEMPLATE_VERSION = 4;

/**
 * Landscape A4 — media box 595×842 pt with /Rotate 90 (visual 842×595).
 * Coordinates from coordinate picker → pdf-lib drawText space.
 */
export const CREW_LIST_V3_SBK_P_PAGE = { w: 595.22, h: 842 } as const;

export const CREW_LIST_V3_SBK_P_FONT = 8;
export const CREW_LIST_V3_SBK_P_LINE_HEIGHT = CREW_LIST_V3_SBK_P_FONT * 1.05;
export const CREW_LIST_V3_SBK_P_PORTS_FROM_TO_GAP = '       ';

/** Max text along column for nationality (y 253 → DOB 301). */
export const CREW_LIST_V3_SBK_P_NATIONALITY_FIELD_MAX_PT = 46;
export const CREW_LIST_V3_SBK_P_NATIONALITY_MAX_LINES = 2;
/** Second line offset — perpendicular to rotate-90 text (column width ~19 pt). */
export const CREW_LIST_V3_SBK_P_WRAP_LINE_STEP = CREW_LIST_V3_SBK_P_LINE_HEIGHT;
export const CREW_LIST_V3_SBK_P_NATIONALITY_LINE_STEP = CREW_LIST_V3_SBK_P_WRAP_LINE_STEP;
export const CREW_LIST_V3_SBK_P_WRAP_MAX_LINES = 2;

const CREW_LIST_V3_SBK_P_FIELD_GAP_MARGIN = 3;

/** Max text extent along a crew column (~19 pt spacing − margin). */
export const CREW_LIST_V3_SBK_P_COL_TEXT_MAX_PT = 17;

/** Max extent along column for date + place of birth (y 301 → sbook 444). */
export const CREW_LIST_V3_SBK_P_BIRTH_FIELD_MAX_PT = 138;

export const CREW_LIST_V3_SBK_P_BIRTH_PLACE_GAP = '  ';

/** Page /Rotate 90 — all drawText uses this rotation (same as Alger crew list). */
export const CREW_LIST_V3_SBK_P_TEXT_ROTATION = 90;

export interface CrewListV3SbkPTextPlacement {
  x: number;
  y: number;
  fontSize?: number;
  maxWidth?: number;
}

/** Header — user-measured on 123.pdf (landscape). */
export const CREW_LIST_V3_SBK_P_HEADER = {
  charterer: { x: 94, y: 83 },
  shipName: { x: 122, y: 111 },
  shipNationality: { x: 147, y: 111 },
  portOfCall: { x: 123, y: 258 },
  arrivalMark: { x: 93.4, y: 253 },
  departureMark: { x: 93.4, y: 346.4 },
  portsFromTo: { x: 146, y: 256, maxWidth: 320 },
  voyageDate: { x: 123, y: 388 },
  imoNo: { x: 123, y: 527 },
  callSign: { x: 123, y: 640 },
  voyageNumber: { x: 119, y: 733 },
} satisfies Record<string, CrewListV3SbkPTextPlacement>;

/** Footer — field 12 (date + master signature). */
export const CREW_LIST_V3_SBK_P_FOOTER = {
  signatureDate: { x: 466, y: 162 },
  masterName: { x: 466, y: 610 },
} satisfies Record<string, CrewListV3SbkPTextPlacement>;

/** Row No. — one (x, y) per slot (14 columns). */
export const CREW_LIST_V3_SBK_P_ROW_NO = [
  { x: 172, y: 57 },
  { x: 190, y: 57 },
  { x: 209, y: 57 },
  { x: 229, y: 57 },
  { x: 248, y: 57 },
  { x: 267, y: 57 },
  { x: 287, y: 57 },
  { x: 305, y: 57 },
  { x: 325, y: 57 },
  { x: 343, y: 57 },
  { x: 363, y: 57 },
  { x: 382, y: 57 },
  { x: 401, y: 57 },
  { x: 421, y: 57 },
] as const;

export const CREW_LIST_V3_SBK_P_MAX_ROWS = CREW_LIST_V3_SBK_P_ROW_NO.length;

/** Body fields — constant Y per row; column X from {@link crewListV3SbkPColX}. */
export const CREW_LIST_V3_SBK_P_COL_Y = {
  name: 70,
  rank: 197,
  nationality: 253,
  dateOfBirth: 301,
  sbookNo: 444,
  sbookPlaceOfIssue: 500,
  sbookExpiry: 560,
  passport: 611,
  joiningPort: 662,
  joiningDate: 732,
} as const;

export type CrewListV3SbkPColField = keyof typeof CREW_LIST_V3_SBK_P_COL_Y;

/** Body field order along each crew column (top → bottom). */
export const CREW_LIST_V3_SBK_P_COL_FIELDS: readonly CrewListV3SbkPColField[] = [
  'name',
  'rank',
  'nationality',
  'dateOfBirth',
  'sbookNo',
  'sbookPlaceOfIssue',
  'sbookExpiry',
  'passport',
  'joiningPort',
  'joiningDate',
];

/** Max text extent along the column for any body cell (next field Y − current Y). */
export function crewListV3SbkPFieldMaxPt(field: CrewListV3SbkPColField): number {
  const idx = CREW_LIST_V3_SBK_P_COL_FIELDS.indexOf(field);
  const y0 = CREW_LIST_V3_SBK_P_COL_Y[field];
  if (idx >= 0 && idx < CREW_LIST_V3_SBK_P_COL_FIELDS.length - 1) {
    const y1 = CREW_LIST_V3_SBK_P_COL_Y[CREW_LIST_V3_SBK_P_COL_FIELDS[idx + 1]];
    return y1 - y0 - CREW_LIST_V3_SBK_P_FIELD_GAP_MARGIN;
  }
  return CREW_LIST_V3_SBK_P_PAGE.h - y0 - CREW_LIST_V3_SBK_P_FIELD_GAP_MARGIN - 12;
}

/** Landscape — shift every crew column (all fields + row No.) up 1 pt. */
const CREW_LIST_V3_SBK_P_COL_X_OFFSET = -1;

/** Extra per-column X shift (0-based index). */
const CREW_LIST_V3_SBK_P_ROW_X_EXTRA_OFFSET: Partial<Record<number, number>> = {
  13: -1, // row 14
};

export function crewListV3SbkPColX(colIndex: number): number {
  return crewListV3SbkPRowNoPlacement(colIndex).x;
}

export function crewListV3SbkPRowNoPlacement(rowIndex: number): { x: number; y: number } {
  let x: number;
  let y: number;
  if (rowIndex < CREW_LIST_V3_SBK_P_ROW_NO.length) {
    ({ x, y } = CREW_LIST_V3_SBK_P_ROW_NO[rowIndex]);
  } else {
    const last = CREW_LIST_V3_SBK_P_ROW_NO[CREW_LIST_V3_SBK_P_ROW_NO.length - 1];
    const step = CREW_LIST_V3_SBK_P_ROW_NO[1].x - CREW_LIST_V3_SBK_P_ROW_NO[0].x;
    x = last.x + step * (rowIndex - CREW_LIST_V3_SBK_P_ROW_NO.length + 1);
    y = last.y;
  }
  return {
    x: x + CREW_LIST_V3_SBK_P_COL_X_OFFSET + (CREW_LIST_V3_SBK_P_ROW_X_EXTRA_OFFSET[rowIndex] ?? 0),
    y,
  };
}
