/**
 * Ship Stores 03 (Germany) — pdf-lib placements (origin bottom-left, pt).
 * Template: public/ship-stores-03-empty.pdf (from 12.pdf).
 */

import type { Port } from '../models/crew.models';

export const SHIP_STORES_03_TEMPLATE_VERSION = 1;

export const SHIP_STORES_03_FONT = 9;

export interface ShipStores03TextPlacement {
  x: number;
  y: number;
  fontSize?: number;
  maxWidth?: number;
}

/** Header — user-measured on 12.pdf. */
export const SHIP_STORES_03_FIELDS = {
  shipName: { x: 150, y: 749, fontSize: SHIP_STORES_03_FONT, maxWidth: 158 },
  nationality: { x: 150, y: 726, fontSize: SHIP_STORES_03_FONT, maxWidth: 145 },
  arrivalMark: { x: 285, y: 775, fontSize: SHIP_STORES_03_FONT },
  departureMark: { x: 430, y: 775, fontSize: SHIP_STORES_03_FONT },
  pageNo: { x: 545, y: 778, fontSize: SHIP_STORES_03_FONT },
  portOfCall: { x: 314, y: 749, fontSize: SHIP_STORES_03_FONT, maxWidth: 128 },
  voyageDate: { x: 450, y: 749, fontSize: SHIP_STORES_03_FONT, maxWidth: 88 },
  portsRoute: { x: 302, y: 726, fontSize: SHIP_STORES_03_FONT, maxWidth: 238 },
  personsOnBoard: { x: 150, y: 698, fontSize: SHIP_STORES_03_FONT, maxWidth: 82 },
  periodOfStay: { x: 238, y: 698, fontSize: SHIP_STORES_03_FONT, maxWidth: 88 },
  placeOfStorage: { x: 331, y: 698, fontSize: SHIP_STORES_03_FONT, maxWidth: 210 },
  captainName: { x: 221, y: 74, fontSize: SHIP_STORES_03_FONT, maxWidth: 280 },
} as const satisfies Record<string, ShipStores03TextPlacement>;

/** Field 5 — last / next port with country. */
export function formatShipStores03PortsRoute(
  lastPortOfCall: string,
  nextPortOfCall: string,
  portOfCall: string,
  ports: Port[],
  formatPort: (name: string) => string,
  portCountry: (name: string, ports: Port[]) => string,
): string {
  const fmt = (portName: string) => {
    const name = formatPort(portName);
    if (!name) return '';
    const country = portCountry(portName, ports);
    return country ? `${name} / ${country}` : name;
  };
  const from = fmt(lastPortOfCall);
  const to = fmt(nextPortOfCall || portOfCall);
  if (from && to) return `${from}    ${to}`;
  return from || to;
}

export const SHIP_STORES_03_BODY_FONT_SIZE = 9;
export const SHIP_STORES_03_BODY_ARTICLE_X = 67;
export const SHIP_STORES_03_BODY_QUANTITY_X = 213;
export const SHIP_STORES_03_BODY_UNIT_X = 240;
export const SHIP_STORES_03_BODY_ARTICLE_MAX_WIDTH =
  SHIP_STORES_03_BODY_QUANTITY_X - SHIP_STORES_03_BODY_ARTICLE_X - 10;

export const SHIP_STORES_03_BODY_ROW_COUNT = 19;

/** Rows 1–4, 6–19 measured; row 5 interpolated (541 → 484). */
export const SHIP_STORES_03_BODY_ROW_PDFLIB_Y: readonly number[] = [
  628, 598, 570, 541, 513, 484, 456, 427, 398, 370, 342, 315, 286, 257, 229, 201, 173, 144, 118,
];

export function shipStores03BodyRowPdfLibY(rowIndex: number): number {
  return SHIP_STORES_03_BODY_ROW_PDFLIB_Y[rowIndex] ?? SHIP_STORES_03_BODY_ROW_PDFLIB_Y[0];
}
