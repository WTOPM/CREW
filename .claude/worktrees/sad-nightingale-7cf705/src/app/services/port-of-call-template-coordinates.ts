/** Port of Call — template PDF (public/port-of-call-template-empty.pdf, from 123.pdf). */

export const POC_TEMPLATE_URL = '/port-of-call-template-empty.pdf';

/** Bump when coordinates or public/port-of-call-template-empty.pdf change. */
export const POC_TEMPLATE_VERSION = 6;

export const POC_TEMPLATE_PAGE_HEIGHT_PT = 842;

export const POC_TEMPLATE_FONT = 9;

export interface PocTemplateTextPlacement {
  x: number;
  /** pdf-lib baseline Y (origin bottom-left), same as stamp placement cursor. */
  y: number;
  fontSize?: number;
  maxWidth?: number;
}

/** Header values — pdf-lib Y (measured with overlay cursor: y from bottom). */
export const POC_TEMPLATE_HEADER = {
  shipName: { x: 40, y: 694, fontSize: POC_TEMPLATE_FONT, maxWidth: 88 },
  nationality: { x: 40, y: 650, fontSize: POC_TEMPLATE_FONT, maxWidth: 105 },
  imoNo: { x: 135, y: 694, fontSize: POC_TEMPLATE_FONT, maxWidth: 68 },
  portOfArrival: { x: 207, y: 694, fontSize: POC_TEMPLATE_FONT, maxWidth: 108 },
  dateOfArrival: { x: 320, y: 694, fontSize: POC_TEMPLATE_FONT, maxWidth: 90 },
  arrivedFrom: { x: 151, y: 650, fontSize: POC_TEMPLATE_FONT, maxWidth: 198 },
  nextPort: { x: 354, y: 650, fontSize: POC_TEMPLATE_FONT, maxWidth: 220 },
  /** Master — surname and given names, ALL CAPS, space-separated. */
  captainName: { x: 314, y: 415, fontSize: POC_TEMPLATE_FONT, maxWidth: 220 },
} as const satisfies Record<string, PocTemplateTextPlacement>;

/** Table columns — pdf-lib X (row 1 measured at y=603). */
export const POC_TEMPLATE_TABLE_COL = {
  port: 22,
  country: 118,
  code: 203,
  arrDate: 317,
  depDate: 397,
  secLvl: 491,
} as const;

/** Row baselines — pdf-lib Y (rows 1–11). */
export const POC_TEMPLATE_ROW_BASELINE_Y: readonly number[] = [
  603, 588, 574, 559, 545, 530, 515, 501, 486, 472, 457,
];

export const POC_TEMPLATE_ROWS_PER_PAGE = POC_TEMPLATE_ROW_BASELINE_Y.length;

export function pocTemplateRowBaselineY(rowIndex: number): number {
  return POC_TEMPLATE_ROW_BASELINE_Y[rowIndex] ?? POC_TEMPLATE_ROW_BASELINE_Y.at(-1)!;
}
