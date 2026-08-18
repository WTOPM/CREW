import { CREW_MONEY_LIST_PAGE_HEIGHT_PT } from '../models/crew-money-list.models';

export const CREW_MONEY_LIST_FONT = 11;

export interface CrewMoneyListTextPlacement {
  x: number;
  y: number;
  fontSize?: number;
  maxWidth?: number;
}

function pdfLibY(baselineY: number): number {
  return CREW_MONEY_LIST_PAGE_HEIGHT_PT - baselineY;
}

export const CREW_MONEY_LIST_FIELDS = {
  pageNo: { x: 502, y: pdfLibY(107), fontSize: CREW_MONEY_LIST_FONT },
  shipName: { x: 167, y: pdfLibY(135), fontSize: CREW_MONEY_LIST_FONT, maxWidth: 120 },
  nationality: { x: 167, y: pdfLibY(163), fontSize: CREW_MONEY_LIST_FONT, maxWidth: 120 },
} as const satisfies Record<string, CrewMoneyListTextPlacement>;

export const CREW_MONEY_LIST_FIRST_ROW_BASELINE_Y = 202;
export const CREW_MONEY_LIST_ROW_STEP = 19;

export const CREW_MONEY_LIST_COL = {
  rowNo: 90,
  name: 109,
  rank: 260,
  /** Left inner edge of currency cells (Others per template: x 392). */
  usd: 306,
  euro: 356,
  others: 392,
} as const;

/** Space from name X to rank column (fit text on one line, no wrap). */
export const CREW_MONEY_LIST_NAME_MAX_WIDTH =
  CREW_MONEY_LIST_COL.rank - CREW_MONEY_LIST_COL.name - 4;
export const CREW_MONEY_LIST_RANK_MAX_WIDTH = 45;
export const CREW_MONEY_LIST_USD_MAX_WIDTH = CREW_MONEY_LIST_COL.euro - CREW_MONEY_LIST_COL.usd - 4;
export const CREW_MONEY_LIST_EURO_MAX_WIDTH =
  CREW_MONEY_LIST_COL.others - CREW_MONEY_LIST_COL.euro - 4;
/** Others column inner width (to signature column at ~451). */
export const CREW_MONEY_LIST_OTHERS_MAX_WIDTH = 451 - CREW_MONEY_LIST_COL.others - 4;

export function crewMoneyListRowBaselineY(index: number): number {
  return CREW_MONEY_LIST_FIRST_ROW_BASELINE_Y + index * CREW_MONEY_LIST_ROW_STEP;
}
