/**
 * MDH placements: each app field maps to underline position + lift above it.
 * Origin: page top-left (pdfjs). pdf-lib baseline = pageHeight - lineY + lift.
 */
export const MDH_PAGE_HEIGHT = 842;

/** Default gap between baseline and underline (pt). */
export const MDH_DEFAULT_LIFT = 1;

export interface MdhPlacement {
  x: number;
  /** Horizontal rule Y from page top. */
  lineY: number;
  /** Baseline offset above lineY (pt). */
  lift?: number;
  maxWidth?: number;
  fontSize?: number;
}

export function mdhBaselineY(
  pageHeight: number,
  lineY: number,
  lift: number = MDH_DEFAULT_LIFT,
): number {
  return pageHeight - lineY + lift;
}

/** Ship / voyage header (Settings → Ship information + dates). */
export const MDH_FIELDS = {
  /** ship.portOfCall */
  portOfCall: { x: 173, lineY: 108, lift: 1 },
  /** ship.name */
  vesselName: { x: 173, lineY: 118, lift: 1 },
  /** ship.nationality */
  nationality: { x: 173, lineY: 128, lift: 1 },
  /** ship.dateOfArrival */
  voyageDate: { x: 369, lineY: 108, lift: 1 },
  /** (optional time — not in app yet) */
  voyageTime: { x: 478, lineY: 108, lift: 1 },
  /** ship.lastPortOfCall */
  fromPort: { x: 369, lineY: 118, lift: 1 },
  /** ship.nextPortOfCall */
  toPort: { x: 506, lineY: 118, lift: 1 },
  /** Master (crew rank) */
  masterName: { x: 369, lineY: 128, lift: 1, maxWidth: 150 },
  /** ship.netTonnage */
  netTonnage: { x: 205, lineY: 138, lift: 1, maxWidth: 90 },
  /** ship.charterer */
  agentOwner: { x: 369, lineY: 138, lift: 1, maxWidth: 150 },
  /** ship.sanitationCertificateIssuedAt */
  sanitationIssuedAt: { x: 244, lineY: 157, lift: 1, maxWidth: 65 },
  /** ship.sanitationCertificateIssueDate (pdf-lib baseline Y=686) */
  sanitationDated: { x: 368, lineY: 157, lift: 1, maxWidth: 80 },
  /** ship.waterTestPort + waterTestDate */
  waterTest: { x: 369, lineY: 177, lift: 1, maxWidth: 200 },
  /** passengers — First Class (pdf-lib baseline Y=646) */
  passengerFirst: { x: 210, lineY: 197, lift: 1 },
  /** passengers — Cabin Class (pdf-lib baseline Y=636) */
  passengerCabin: { x: 210, lineY: 207, lift: 1 },
  /** passengers — Tourist Class (pdf-lib baseline Y=626) */
  passengerTourist: { x: 210, lineY: 217, lift: 1 },
  /** passengers — Third Class (pdf-lib baseline Y=615) */
  passengerThird: { x: 210, lineY: 228, lift: 1 },
  /** crew arrival list count */
  crewCount: { x: 398, lineY: 198, lift: 1.5 },
  /** ship.imoNo */
  imoNo: { x: 174, lineY: 654, lift: 1, maxWidth: 120 },
  /** ship.charterer (footer) */
  agentFooter: { x: 200, lineY: 668, lift: 1, maxWidth: 150 },
  /** Master signature */
  masterSignature: { x: 441, lineY: 644, lift: 1, maxWidth: 150 },
  /** Ship's surgeon (static N/A) */
  shipsSurgeon: { x: 522, lineY: 668, lift: 1 },
} as const satisfies Record<string, MdhPlacement>;

export type MdhFieldKey = keyof typeof MDH_FIELDS;

/** Port call history — underline per row (max 10). pdf-lib baseline Y per row. */
export const MDH_PORT_ROWS: readonly MdhPlacement[] = [
  { x: 0, lineY: 257, lift: 1 }, // Y=586
  { x: 0, lineY: 268, lift: 1 }, // Y=575
  { x: 0, lineY: 277, lift: 1 }, // Y=566
  { x: 0, lineY: 287, lift: 1 }, // Y=556
  { x: 0, lineY: 298, lift: 1 }, // Y=545
  { x: 0, lineY: 307, lift: 1 }, // Y=536
  { x: 0, lineY: 317, lift: 1 }, // Y=526
  { x: 0, lineY: 327, lift: 1 }, // Y=516
  { x: 0, lineY: 338, lift: 1 }, // Y=505
  { x: 0, lineY: 350, lift: 1 }, // Y=493
];

export const MDH_PORT_COL = {
  /** entry.portName */
  port: { x: 133, lift: 1 },
  /** entry.departureDate */
  date: { x: 383, lift: 1 },
  /** port code */
  code: { x: 459, lift: 1 },
} as const;

/**
 * Health questions — default answer "No" (7 lines per MDH Hanna.pdf).
 * Q1–Q5: one each; Q6 has two answer lines (576 / 586 block).
 */
export const MDH_HEALTH_NO: readonly MdhPlacement[] = [
  { x: 524, lineY: 379, lift: 1 }, // 1. plague / cholera / …
  { x: 524, lineY: 409, lift: 1 }, // 2. rats / mice
  { x: 524, lineY: 438, lift: 1 }, // 3. deaths
  { x: 524, lineY: 468, lift: 1 }, // 4. infectious illness
  { x: 524, lineY: 487, lift: 1 }, // 5. sick person on board
  { x: 524, lineY: 566, lift: 1 }, // 6. other conditions (line 1)
  { x: 524, lineY: 596, lift: 1 }, // 6. other conditions (line 2)
];
