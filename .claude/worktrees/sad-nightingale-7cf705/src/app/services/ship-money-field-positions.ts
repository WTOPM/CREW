/**
 * Ship Money cash declaration — pdf-lib coords (baselines from SHIP MONEY.pdf).
 */

import { SHIP_MONEY_PAGE_HEIGHT_PT } from '../models/ship-money.models';

export const SHIP_MONEY_FONT = 11;
export const SHIP_MONEY_FONT_DATE = 10;

export interface ShipMoneyTextPlacement {
  x: number;
  y: number;
  fontSize?: number;
  maxWidth?: number;
}

function pdfLibY(baselineY: number): number {
  return SHIP_MONEY_PAGE_HEIGHT_PT - baselineY;
}

export const SHIP_MONEY_FIELDS = {
  vessel: { x: 149, y: pdfLibY(188), fontSize: 12, maxWidth: 120 },
  port: { x: 357, y: pdfLibY(188), fontSize: SHIP_MONEY_FONT, maxWidth: 120 },
  portOfRegistry: { x: 149, y: pdfLibY(202), fontSize: SHIP_MONEY_FONT, maxWidth: 120 },
  date: { x: 344, y: pdfLibY(202), fontSize: SHIP_MONEY_FONT_DATE, maxWidth: 80 },
  masterName: { x: 332, y: pdfLibY(490), fontSize: SHIP_MONEY_FONT, maxWidth: 200 },
} as const satisfies Record<string, ShipMoneyTextPlacement>;

export const SHIP_MONEY_AMOUNT_X = 102;
export const SHIP_MONEY_CURRENCY_X = 134;
export const SHIP_MONEY_AMOUNT_MAX_WIDTH = 80;
export const SHIP_MONEY_CURRENCY_MAX_WIDTH = 80;
