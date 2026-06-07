import { NARCOTIC_LIST_PAGE_HEIGHT_PT } from '../models/narcotic-list.models';

export const NARCOTIC_LIST_FONT = 10;
export const NARCOTIC_LIST_FONT_HEADER = 11;

export interface NarcoticListTextPlacement {
  x: number;
  y: number;
  fontSize?: number;
  maxWidth?: number;
}

function pdfLibY(baselineY: number): number {
  return NARCOTIC_LIST_PAGE_HEIGHT_PT - baselineY;
}

export const NARCOTIC_LIST_FIELDS = {
  shipName: { x: 124, y: pdfLibY(137), fontSize: NARCOTIC_LIST_FONT_HEADER, maxWidth: 110 },
  portOfArrival: { x: 288, y: pdfLibY(137), fontSize: NARCOTIC_LIST_FONT, maxWidth: 70 },
  date: { x: 429, y: pdfLibY(137), fontSize: NARCOTIC_LIST_FONT, maxWidth: 80 },
  nationality: { x: 128, y: pdfLibY(164), fontSize: NARCOTIC_LIST_FONT, maxWidth: 100 },
  portFrom: { x: 291, y: pdfLibY(164), fontSize: NARCOTIC_LIST_FONT, maxWidth: 70 },
  portDestination: { x: 432, y: pdfLibY(164), fontSize: NARCOTIC_LIST_FONT, maxWidth: 80 },
  masterSignature: { x: 48, y: pdfLibY(476), fontSize: NARCOTIC_LIST_FONT, maxWidth: 280 },
} as const satisfies Record<string, NarcoticListTextPlacement>;

export const NARCOTIC_LIST_COL = {
  rowNo: 54,
  name: 70,
  quantity: 226,
  /** Left edge of Units cell (from Narcotic List.pdf: "20 tabs." ≈ x 252). */
  units: 252,
  totalQuantity: 320,
  expirationDate: 378,
  controlNo: 437,
  placeOfStorage: 486,
} as const;

export const NARCOTIC_LIST_NAME_MAX_WIDTH = 145;
export const NARCOTIC_LIST_UNITS_MAX_WIDTH = 45;

export function narcoticListPdfLibY(baselineY: number): number {
  return NARCOTIC_LIST_PAGE_HEIGHT_PT - baselineY;
}
