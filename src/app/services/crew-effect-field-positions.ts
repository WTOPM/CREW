/**
 * Crew Effect (IMO Crew's Effects Declaration) — pdf-lib coords (origin bottom-left, pt).
 * Value positions from filled Crew effect.pdf; template: Crew effect - empty.pdf.
 */

export const CREW_EFFECT_PAGE_HEIGHT_PT = 842;
export const CREW_EFFECT_FONT = 9;

export interface CrewEffectTextPlacement {
  x: number;
  y: number;
  fontSize?: number;
  maxWidth?: number;
}

/** pdf.js top-down baseline Y → pdf-lib bottom-left baseline Y. */
function pdfLibY(baselineY: number): number {
  return CREW_EFFECT_PAGE_HEIGHT_PT - baselineY;
}

export const CREW_EFFECT_FIELDS = {
  pageNo: { x: 501, y: pdfLibY(104), fontSize: CREW_EFFECT_FONT },
  shipName: { x: 150, y: pdfLibY(132), fontSize: CREW_EFFECT_FONT, maxWidth: 130 },
  nationality: { x: 150, y: pdfLibY(160), fontSize: CREW_EFFECT_FONT, maxWidth: 130 },
} as const satisfies Record<string, CrewEffectTextPlacement>;

export const CREW_EFFECT_ROW_COUNT = 13;

export const CREW_EFFECT_COL = {
  rowNo: 65,
  name: 84,
  rank: 252,
  cigarettes: 298,
  spirits: 333,
  wines: 361,
  others: 400,
  nameMaxWidth: 155,
  rankMaxWidth: 130,
  effectsMaxWidth: 28,
} as const;

/** Row baselines (pdf.js top-Y) from reference PDF. */
export const CREW_EFFECT_ROW_TOP_Y: readonly number[] = [
  199, 218, 237, 256, 275, 294, 312, 331, 350, 369, 388, 407, 426,
];

export function crewEffectRowPdfLibY(rowIndex: number): number {
  const baseline = CREW_EFFECT_ROW_TOP_Y[rowIndex] ?? CREW_EFFECT_ROW_TOP_Y[0];
  return pdfLibY(baseline);
}
