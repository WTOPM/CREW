/**
 * Crew Effect 02 — IMO (123.pdf). pdf-lib coords (origin bottom-left, pt).
 */

export const CREW_EFFECT_02_TEMPLATE_VERSION = 2;

export const CREW_EFFECT_02_FONT = 9;

export interface CrewEffect02TextPlacement {
  x: number;
  y: number;
  fontSize?: number;
  maxWidth?: number;
}

/** Header — user-measured on 123.pdf. */
export const CREW_EFFECT_02_FIELDS = {
  shipName: { x: 104, y: 745, fontSize: CREW_EFFECT_02_FONT, maxWidth: 160 },
  nationality: { x: 104, y: 728, fontSize: CREW_EFFECT_02_FONT, maxWidth: 160 },
  arrivalMark: { x: 222, y: 764, fontSize: CREW_EFFECT_02_FONT },
  departureMark: { x: 338, y: 764, fontSize: CREW_EFFECT_02_FONT },
  pageNo: { x: 503, y: 764, fontSize: CREW_EFFECT_02_FONT },
  portOfCall: { x: 274, y: 750, fontSize: CREW_EFFECT_02_FONT, maxWidth: 120 },
  voyageDate: { x: 400, y: 750, fontSize: CREW_EFFECT_02_FONT, maxWidth: 90 },
  captainName: { x: 349, y: 120, fontSize: CREW_EFFECT_02_FONT, maxWidth: 200 },
  signatureDate: { x: 185, y: 120, fontSize: CREW_EFFECT_02_FONT, maxWidth: 150 },
} as const satisfies Record<string, CrewEffect02TextPlacement>;

export const CREW_EFFECT_02_ROW_COUNT = 18;

export const CREW_EFFECT_02_COL = {
  rowNo: 58,
  name: 71,
  rank: 169,
  cigarettes: 230,
  tobaccoCigars: 275,
  spirits: 321,
  beer: 366,
  other: 418,
  nameMaxWidth: 169 - 71 - 6,
  rankMaxWidth: 230 - 169 - 6,
  otherMaxWidth: 55,
} as const;

/** Row № baselines — user-measured (rows 1–18). */
export const CREW_EFFECT_02_ROW_PDFLIB_Y: readonly number[] = [
  694, 665, 633, 599, 570, 539, 510, 478, 448, 416, 383, 355, 324, 293, 262, 230, 200, 169,
];

export function crewEffect02RowPdfLibY(rowIndex: number): number {
  return CREW_EFFECT_02_ROW_PDFLIB_Y[rowIndex] ?? CREW_EFFECT_02_ROW_PDFLIB_Y[0];
}
