import { CASH_ADVANCE_PAGE_HEIGHT_PT } from '../models/cash-advance.models';

export const CASH_ADVANCE_FONT = 11;
export const CASH_ADVANCE_FONT_TITLE = 12;

export interface CashAdvanceTextPlacement {
  x: number;
  y: number;
  fontSize?: number;
  maxWidth?: number;
}

function pdfLibY(baselineY: number): number {
  return CASH_ADVANCE_PAGE_HEIGHT_PT - baselineY;
}

export const CASH_ADVANCE_FIELDS = {
  title: { x: 120, y: pdfLibY(66), fontSize: CASH_ADVANCE_FONT_TITLE, maxWidth: 400 },
  vessel: { x: 84, y: pdfLibY(108), fontSize: CASH_ADVANCE_FONT, maxWidth: 200 },
  date: { x: 84, y: pdfLibY(138), fontSize: CASH_ADVANCE_FONT, maxWidth: 100 },
  masterSignature: { x: 453, y: pdfLibY(667), fontSize: CASH_ADVANCE_FONT, maxWidth: 200 },
  masterDate: { x: 482, y: pdfLibY(702), fontSize: CASH_ADVANCE_FONT, maxWidth: 80 },
} as const satisfies Record<string, CashAdvanceTextPlacement>;

export const CASH_ADVANCE_FIRST_ROW_BASELINE_Y = 197;
export const CASH_ADVANCE_ROW_STEP = 29;
/** TOTAL row baseline (from cash-advance-empty.pdf). */
export const CASH_ADVANCE_TOTAL_ROW_BASELINE_Y = 582;

export const CASH_ADVANCE_COL = {
  rowNo: 30,
  name: 76,
  rank: 270,
  usd: 356,
  eur: 439,
} as const;

export const CASH_ADVANCE_NAME_MAX_WIDTH = 190;
export const CASH_ADVANCE_RANK_MAX_WIDTH = 60;
export const CASH_ADVANCE_AMOUNT_MAX_WIDTH = 70;

export function cashAdvanceRowBaselineY(index: number): number {
  return CASH_ADVANCE_FIRST_ROW_BASELINE_Y + index * CASH_ADVANCE_ROW_STEP;
}
