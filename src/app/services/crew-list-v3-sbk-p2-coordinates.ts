/** Crew List v3 SBK/P 2 — pdf-lib placements (origin bottom-left, pt). */

export const CREW_LIST_V3_SBK_P2_TEMPLATE_URL = '/crew-list-v3-sbk-p2-empty.pdf';

/** Bump when public/crew-list-v3-sbk-p2-empty.pdf changes. */
export const CREW_LIST_V3_SBK_P2_TEMPLATE_VERSION = 1;

/**
 * Landscape A4 — media box 595×842 pt with /Rotate 90 (visual 842×595).
 * Coordinates from coordinate picker → pdf-lib drawText space.
 */
export const CREW_LIST_V3_SBK_P2_PAGE = { w: 595.22, h: 842 } as const;

export const CREW_LIST_V3_SBK_P2_FONT = 8;
export const CREW_LIST_V3_SBK_P2_LINE_HEIGHT = CREW_LIST_V3_SBK_P2_FONT * 1.05;
export const CREW_LIST_V3_SBK_P2_PORTS_FROM_TO_GAP = '       ';

const CREW_LIST_V3_SBK_P2_FIELD_GAP_MARGIN = 3;

/** Max text along column for nationality (y 253 → DOB 301). */
export const CREW_LIST_V3_SBK_P2_NATIONALITY_FIELD_MAX_PT = 46;
export const CREW_LIST_V3_SBK_P2_NATIONALITY_MAX_LINES = 2;
/** Second line offset — perpendicular to rotate-90 text (column width ~19 pt). */
export const CREW_LIST_V3_SBK_P2_WRAP_LINE_STEP = CREW_LIST_V3_SBK_P2_LINE_HEIGHT;
export const CREW_LIST_V3_SBK_P2_NATIONALITY_LINE_STEP = CREW_LIST_V3_SBK_P2_WRAP_LINE_STEP;
export const CREW_LIST_V3_SBK_P2_WRAP_MAX_LINES = 2;

/** Max text extent along a crew column (~19 pt spacing − margin). */
export const CREW_LIST_V3_SBK_P2_COL_TEXT_MAX_PT = 17;

/** Max extent along column for date + place of birth (y 301 → sbook 444). */
export const CREW_LIST_V3_SBK_P2_BIRTH_FIELD_MAX_PT = 138;

export const CREW_LIST_V3_SBK_P2_BIRTH_PLACE_GAP = '  ';

/** Page /Rotate 90 — all drawText uses this rotation (same as Alger crew list). */
export const CREW_LIST_V3_SBK_P2_TEXT_ROTATION = 90;

export interface CrewListV3SbkP2TextPlacement {
  x: number;
  y: number;
  fontSize?: number;
  maxWidth?: number;
}

/** Header — user-measured on 123.pdf (landscape). */
export const CREW_LIST_V3_SBK_P2_HEADER = {
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
} satisfies Record<string, CrewListV3SbkP2TextPlacement>;

/** Footer — field 12 (date + master signature). */
export const CREW_LIST_V3_SBK_P2_FOOTER = {
  signatureDate: { x: 466, y: 162 },
  masterName: { x: 466, y: 610 },
} satisfies Record<string, CrewListV3SbkP2TextPlacement>;

/** Row No. — one (x, y) per slot (14 columns; X −1 pt from measured). */
export const CREW_LIST_V3_SBK_P2_ROW_NO = [
  { x: 170, y: 57 },
  { x: 188, y: 57 },
  { x: 207, y: 57 },
  { x: 227, y: 57 },
  { x: 246, y: 57 },
  { x: 265, y: 57 },
  { x: 285, y: 57 },
  { x: 303, y: 57 },
  { x: 323, y: 57 },
  { x: 341, y: 57 },
  { x: 361, y: 57 },
  { x: 380, y: 57 },
  { x: 399, y: 57 },
  { x: 419, y: 57 },
] as const;

export const CREW_LIST_V3_SBK_P2_MAX_ROWS = CREW_LIST_V3_SBK_P2_ROW_NO.length;

/** Body fields — constant Y per row; column X from {@link crewListV3SbkP2ColX}. */
export const CREW_LIST_V3_SBK_P2_COL_Y = {
  name: 70,
  rank: 197,
  nationality: 253,
  dateOfBirth: 301,
  sbookNo: 444,
  sbookPlaceOfIssue: 500,
  sbookExpiry: 560,
  passport: 611,
  passportPlaceOfIssue: 662,
  passportExpiry: 732,
} as const;

export type CrewListV3SbkP2ColField = keyof typeof CREW_LIST_V3_SBK_P2_COL_Y;

/** Body field order along each crew column (top → bottom). */
export const CREW_LIST_V3_SBK_P2_COL_FIELDS: readonly CrewListV3SbkP2ColField[] = [
  'name',
  'rank',
  'nationality',
  'dateOfBirth',
  'sbookNo',
  'sbookPlaceOfIssue',
  'sbookExpiry',
  'passport',
  'passportPlaceOfIssue',
  'passportExpiry',
];

/** Max text extent along the column for any body cell (next field Y − current Y). */
export function crewListV3SbkP2FieldMaxPt(field: CrewListV3SbkP2ColField): number {
  const idx = CREW_LIST_V3_SBK_P2_COL_FIELDS.indexOf(field);
  const y0 = CREW_LIST_V3_SBK_P2_COL_Y[field];
  if (idx >= 0 && idx < CREW_LIST_V3_SBK_P2_COL_FIELDS.length - 1) {
    const y1 = CREW_LIST_V3_SBK_P2_COL_Y[CREW_LIST_V3_SBK_P2_COL_FIELDS[idx + 1]];
    return y1 - y0 - CREW_LIST_V3_SBK_P2_FIELD_GAP_MARGIN;
  }
  return CREW_LIST_V3_SBK_P2_PAGE.h - y0 - CREW_LIST_V3_SBK_P2_FIELD_GAP_MARGIN - 12;
}

export function crewListV3SbkP2ColX(colIndex: number): number {
  return crewListV3SbkP2RowNoPlacement(colIndex).x;
}

export function crewListV3SbkP2RowNoPlacement(rowIndex: number): { x: number; y: number } {
  if (rowIndex < CREW_LIST_V3_SBK_P2_ROW_NO.length) {
    return CREW_LIST_V3_SBK_P2_ROW_NO[rowIndex];
  }
  const last = CREW_LIST_V3_SBK_P2_ROW_NO[CREW_LIST_V3_SBK_P2_ROW_NO.length - 1];
  const step = CREW_LIST_V3_SBK_P2_ROW_NO[1].x - CREW_LIST_V3_SBK_P2_ROW_NO[0].x;
  return { x: last.x + step * (rowIndex - CREW_LIST_V3_SBK_P2_ROW_NO.length + 1), y: last.y };
}
