/**
 * Crew Effect 03 — Germany (1234.pdf). pdf-lib coords (origin bottom-left, pt).
 */

export const CREW_EFFECT_03_TEMPLATE_VERSION = 1;

export const CREW_EFFECT_03_FONT = 9;

export interface CrewEffect03TextPlacement {
  x: number;
  y: number;
  fontSize?: number;
  maxWidth?: number;
}

/** Header — user-measured on 1234.pdf. */
export const CREW_EFFECT_03_FIELDS = {
  shipName: { x: 130, y: 744, fontSize: CREW_EFFECT_03_FONT, maxWidth: 200 },
  pageNo: { x: 545, y: 780, fontSize: CREW_EFFECT_03_FONT },
  nationality: { x: 130, y: 709, fontSize: CREW_EFFECT_03_FONT, maxWidth: 200 },
  captainName: { x: 298, y: 76, fontSize: CREW_EFFECT_03_FONT, maxWidth: 280 },
} as const satisfies Record<string, CrewEffect03TextPlacement>;

export const CREW_EFFECT_03_ROW_COUNT = 20;

export const CREW_EFFECT_03_COL = {
  rowNo: 74,
  name: 96,
  rank: 212,
  cigarettes: 282,
  cigars: 302,
  spirits: 322,
  weapons: 342,
  ammunition: 362,
  others: 384,
  nameMaxWidth: 212 - 96 - 6,
  rankMaxWidth: 282 - 212 - 6,
  othersMaxWidth: 160,
} as const;

export const CREW_EFFECT_03_ROW_PDFLIB_Y: readonly number[] = [
  662, 634, 605, 577, 549, 520, 493, 464, 435, 407, 379, 350, 322, 294, 265, 237, 209, 181, 153,
  124,
];

export function crewEffect03RowPdfLibY(rowIndex: number): number {
  return CREW_EFFECT_03_ROW_PDFLIB_Y[rowIndex] ?? CREW_EFFECT_03_ROW_PDFLIB_Y[0];
}
