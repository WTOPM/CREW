/** SSO-0108 Port Calls — pdf-lib coords (measured on public/sso-0108-port-calls-empty.pdf). */

export const SSO0108_PAGE_HEIGHT_PT = 841;

export const SSO0108_FONT = 10;

export interface Sso0108TextPlacement {
  x: number;
  y: number;
  fontSize?: number;
  maxWidth?: number;
}

/** Header value baselines — pdf-lib coords (user-measured on 123.pdf). */
export const SSO0108_HEADER = {
  vesselName: { x: 140, y: 745, fontSize: SSO0108_FONT, maxWidth: 140 },
  shipSecurityOfficer: { x: 365, y: 741, fontSize: SSO0108_FONT, maxWidth: 200 },
  isscIssueDate: { x: 91, y: 716, fontSize: SSO0108_FONT, maxWidth: 90 },
  isscExpiryDate: { x: 226, y: 716, fontSize: SSO0108_FONT, maxWidth: 90 },
  isscIssuedByRso: { x: 361, y: 716, fontSize: SSO0108_FONT, maxWidth: 90 },
  presentMarsecLevel: { x: 487, y: 716, fontSize: SSO0108_FONT, maxWidth: 72 },
} as const satisfies Record<string, Sso0108TextPlacement>;

export const SSO0108_TABLE_COL = {
  port: 75,
  arrival: 181,
  departure: 258,
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
