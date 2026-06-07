/**
 * Ship Stores (IMO FAL Form 3) — pdf-lib placements (origin bottom-left, pt).
 * Value Y positions measured from reference Ship Stores.pdf; Arrival mark from coordinate picker.
 */

export const SHIP_STORES_FONT = 9;

export interface ShipStoresTextPlacement {
  x: number;
  y: number;
  fontSize?: number;
  maxWidth?: number;
}

/** Header / voyage block (fields 1–7, page no., Arrival mark). */
export const SHIP_STORES_FIELDS = {
  pageNo: { x: 518, y: 764, fontSize: SHIP_STORES_FONT },
  /** Arrival checkbox — coordinate picker (pdf-lib). */
  arrivalMark: { x: 323, y: 765, fontSize: 8 },
  shipName: { x: 191, y: 744, fontSize: SHIP_STORES_FONT, maxWidth: 120 },
  portOfCall: { x: 356, y: 745, fontSize: SHIP_STORES_FONT, maxWidth: 70 },
  voyageDate: { x: 457, y: 745, fontSize: SHIP_STORES_FONT, maxWidth: 80 },
  nationality: { x: 191, y: 723, fontSize: SHIP_STORES_FONT, maxWidth: 120 },
  /** Field 5 — "PORT FROM / PORT TO" on one line. */
  portsRoute: { x: 397, y: 724, fontSize: SHIP_STORES_FONT, maxWidth: 150 },
  personsOnBoard: { x: 148, y: 702, fontSize: SHIP_STORES_FONT },
  periodOfStay: { x: 257, y: 703, fontSize: SHIP_STORES_FONT },
  /** Field 8 — Place of storage. */
  placeOfStorage: { x: 396, y: 703, fontSize: SHIP_STORES_FONT, maxWidth: 120 },
} as const satisfies Record<string, ShipStoresTextPlacement>;

/** Article table — pdf-lib baseline (origin bottom-left). */
export const SHIP_STORES_BODY_FONT_SIZE = 9;
export const SHIP_STORES_BODY_ARTICLE_X = 112;
/** Right edge of unit label — right-aligned, just left of quantity column (x 266). */
export const SHIP_STORES_BODY_UNIT_RIGHT_X = 252;
export const SHIP_STORES_BODY_QUANTITY_X = 266;
/** Max width for article name so it does not overlap unit labels. */
export const SHIP_STORES_BODY_ARTICLE_MAX_WIDTH =
  SHIP_STORES_BODY_UNIT_RIGHT_X - SHIP_STORES_BODY_ARTICLE_X - 10;

/** Empty article rows on the template (field 9 table). */
export const SHIP_STORES_BODY_ROW_COUNT = 27;

/** Row number baselines (pdf-lib Y), coordinate picker. */
export const SHIP_STORES_BODY_ROW_PDFLIB_Y: readonly number[] = [
  663, 645, 627, 609, 590, 572, 554, 536, 518, 500, 482, 463, 445, 427, 410, 390, 371, 354,
  336, 317, 301, 282, 264, 245, 227, 209, 191,
];

export function shipStoresBodyRowPdfLibY(rowIndex: number): number {
  return SHIP_STORES_BODY_ROW_PDFLIB_Y[rowIndex] ?? SHIP_STORES_BODY_ROW_PDFLIB_Y[0];
}

export function formatShipStoresPortsRoute(
  lastPortOfCall: string,
  nextPortOfCall: string,
  portOfCall: string,
  formatPort: (name: string) => string,
): string {
  const from = formatPort(lastPortOfCall);
  const to = formatPort(nextPortOfCall || portOfCall);
  if (from && to) return `${from} / ${to}`;
  return from || to;
}

/** Days in port: departure − arrival; minimum 1 (including same calendar day). */
export function shipStoresPeriodDays(
  arrivalIso: string | undefined | null,
  departureIso: string | undefined | null,
): number {
  const arrival = parseIsoMidnight(arrivalIso);
  const departure = parseIsoMidnight(departureIso);
  if (!arrival || !departure) return 1;
  const diffMs = departure.getTime() - arrival.getTime();
  const days = Math.floor(diffMs / 86_400_000);
  return days <= 0 ? 1 : days;
}

function parseIsoMidnight(value: string | undefined | null): Date | null {
  const v = (value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}
