/** SSO-0108 Port Calls — pdf-lib coords (baselines from dump-pdf-text on filled sample). */

export const SSO0108_PAGE_HEIGHT_PT = 841;

export const SSO0108_FONT = 10;

export interface Sso0108TextPlacement {
  x: number;
  y: number;
  fontSize?: number;
  maxWidth?: number;
}

function pdfLibY(baselineY: number): number {
  return SSO0108_PAGE_HEIGHT_PT - baselineY;
}

export const SSO0108_HEADER = {
  /** +2 pt up vs template baseline 101 — avoids covering row line below. */
  vesselName: { x: 169, y: pdfLibY(99), fontSize: SSO0108_FONT, maxWidth: 140 },
  shipSecurityOfficer: { x: 369, y: pdfLibY(101), fontSize: SSO0108_FONT, maxWidth: 200 },
  isscIssueDate: { x: 96, y: pdfLibY(126), fontSize: SSO0108_FONT, maxWidth: 90 },
  isscExpiryDate: { x: 224, y: pdfLibY(126), fontSize: SSO0108_FONT, maxWidth: 90 },
  isscIssuedByRso: { x: 329, y: pdfLibY(126), fontSize: SSO0108_FONT, maxWidth: 90 },
  /** Full “1 (one) 1” line — replaces template “1 (one)” + trailing digit. */
  presentMarsecLevel: { x: 472, y: pdfLibY(126), fontSize: SSO0108_FONT, maxWidth: 72 },
} as const satisfies Record<string, Sso0108TextPlacement>;

export const SSO0108_TABLE_COL = {
  port: 75,
  arrival: 181,
  departure: 258,
  /** Template defaults (pdf dump); not drawn — avoids duplicate "1" with overlay. */
  marsecPort: 341,
  marsecShip: 394,
  measures: 435,
} as const;

/** First data row baseline (top-down Y); rows alternate +17 / +16 pt. */
export const SSO0108_FIRST_ROW_Y = 187;
export const SSO0108_MAX_ROWS = 27;

export function sso0108RowBaselineY(rowIndex: number): number {
  let y = SSO0108_FIRST_ROW_Y;
  for (let r = 0; r < rowIndex; r++) {
    y += r % 2 === 0 ? 17 : 16;
  }
  return y;
}

export function sso0108PdfLibY(baselineY: number): number {
  return SSO0108_PAGE_HEIGHT_PT - baselineY;
}
