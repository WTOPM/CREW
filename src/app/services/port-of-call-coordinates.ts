/** Port of Call List — native A4 pt, origin top-left (matches PORT OF CALL.pdf). */
export const POC_PAGE = { w: 595.28, h: 842 };

export const POC_TABLE = { left: 63, right: 560, top: 71, bottom: 627 };

export const POC_COL_BOUNDS = {
  voy: [63, 82] as const,
  port: [82, 205] as const,
  country: [205, 304] as const,
  arrDate: [304, 368] as const,
  arrTime: [368, 432] as const,
  depDate: [432, 496] as const,
  depTime: [496, 560] as const,
};

export const POC_HEADER_ROWS = {
  row1: { top: 118, bottom: 143 },
  row2: { top: 143, bottom: 166 },
  tableHead: { top: 166, bottom: 192 },
};

export const POC_BODY_TOP = 192;
export const POC_BODY_BOTTOM = 627;
export const POC_SIGNATURE_Y = 638;

export const POC_DEFAULT_ROW_COUNT = 10;
export const POC_MAX_ROW_COUNT = 25;
export const POC_MIN_ROW_COUNT = 1;

export const POC_LINE_PT = 0.75;
export const POC_ROW_LINE_PT = 0.5;
export const POC_ROW_LINE_GRAY = 175;

export const POC_FRAME_LABELS = {
  title: 'Port of Call List',
  signature: '15. Date and signature by master, authorised agent or officer',
} as const;

export const POC_STATIC_LABELS = {
  shipName: '1.Name of Ship',
  callSign: 'Call Sign',
  portOfArrival: '2.Port of Arrival',
  dateOfArrival: '3.Date of Arrival',
  nationality: '4.Nationality of Ship',
  homeport: '5. Homeport',
  arrivedFrom: '6.Port arrived from',
  sailingTo: '7.Sailing to',
  voyNo: '8. Voy. No.',
  lastPort: '9. Last Port of Call',
  country: '10. Country',
  arrDate: '11.Date of Arrival',
  arrTime: '12. Time of arrival',
  arrTimeSub: 'Local Time',
  depDate: '13.Date of Departure',
  depTime: '14. Time of Departure',
  depTimeSub: 'Local Time',
} as const;

export interface PocRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function pocRect(x1: number, y1: number, x2: number, y2: number): PocRect {
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

export function pocColRect(col: keyof typeof POC_COL_BOUNDS, y1: number, y2: number): PocRect {
  const [x1, x2] = POC_COL_BOUNDS[col];
  return pocRect(x1, y1, x2, y2);
}
