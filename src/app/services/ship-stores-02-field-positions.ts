/**
 * Ship Stores 02 — pdf-lib placements (origin bottom-left, pt).
 * Template: public/ship-stores-02-empty.pdf (from 123.pdf).
 */

import type { Port } from '../models/crew.models';

export const SHIP_STORES_02_TEMPLATE_VERSION = 8;

export const SHIP_STORES_02_FONT = 9;

export interface ShipStores02TextPlacement {
  x: number;
  y: number;
  fontSize?: number;
  maxWidth?: number;
}

/** Header — user-measured on 123.pdf (pdf-lib, origin bottom-left). */
export const SHIP_STORES_02_FIELDS = {
  shipName: { x: 40, y: 734, fontSize: SHIP_STORES_02_FONT, maxWidth: 100 },
  imoNo: { x: 145, y: 734, fontSize: SHIP_STORES_02_FONT, maxWidth: 70 },
  callSign: { x: 220, y: 734, fontSize: SHIP_STORES_02_FONT, maxWidth: 90 },
  /** Arrival mark — user-measured 317, 756. */
  arrivalMark: { x: 317, y: 756, fontSize: SHIP_STORES_02_FONT },
  /** Departure mark — reserved (432, 756). */
  departureMark: { x: 432, y: 756, fontSize: SHIP_STORES_02_FONT },
  pageNo: { x: 528, y: 756, fontSize: SHIP_STORES_02_FONT },
  nationality: { x: 40, y: 711, fontSize: SHIP_STORES_02_FONT, maxWidth: 270 },
  portsRoute: { x: 317, y: 711, fontSize: SHIP_STORES_02_FONT, maxWidth: 250 },
  placeOfStorage: { x: 317, y: 689, fontSize: SHIP_STORES_02_FONT, maxWidth: 250 },
  personsOnBoard: { x: 40, y: 689, fontSize: SHIP_STORES_02_FONT, maxWidth: 100 },
  periodOfStay: { x: 145, y: 689, fontSize: SHIP_STORES_02_FONT, maxWidth: 130 },
  captainName: { x: 293, y: 128, fontSize: SHIP_STORES_02_FONT, maxWidth: 280 },
} as const satisfies Record<string, ShipStores02TextPlacement>;

/** Last / next port — PORT, COUNTRY    PORT, COUNTRY. */
export function formatShipStores02PortsRoute(
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
    return country ? `${name}, ${country}` : name;
  };
  const from = fmt(lastPortOfCall);
  const to = fmt(nextPortOfCall || portOfCall);
  if (from && to) return `${from}    ${to}`;
  return from || to;
}

export const SHIP_STORES_02_BODY_FONT_SIZE = 8;
export const SHIP_STORES_02_BODY_ARTICLE_X = 21;
export const SHIP_STORES_02_BODY_QUANTITY_X = 232;
export const SHIP_STORES_02_BODY_UNIT_X = 274;
export const SHIP_STORES_02_BODY_ARTICLE_MAX_WIDTH =
  SHIP_STORES_02_BODY_QUANTITY_X - SHIP_STORES_02_BODY_ARTICLE_X - 8;

export const SHIP_STORES_02_BODY_ROW_COUNT = 43;

/** 43 rows — first 21/665, last 21/147 (user-measured). */
const SHIP_STORES_02_BODY_FIRST_Y = 665;
const SHIP_STORES_02_BODY_LAST_Y = 147;

export const SHIP_STORES_02_BODY_ROW_PDFLIB_Y: readonly number[] = Array.from(
  { length: SHIP_STORES_02_BODY_ROW_COUNT },
  (_, i) =>
    Math.round(
      SHIP_STORES_02_BODY_FIRST_Y -
        (i * (SHIP_STORES_02_BODY_FIRST_Y - SHIP_STORES_02_BODY_LAST_Y)) /
          (SHIP_STORES_02_BODY_ROW_COUNT - 1),
    ),
);

export function shipStores02BodyRowPdfLibY(rowIndex: number): number {
  return SHIP_STORES_02_BODY_ROW_PDFLIB_Y[rowIndex] ?? SHIP_STORES_02_BODY_ROW_PDFLIB_Y[0];
}
