/** Port of Call List — layout from coordinate table (top-left origin, Y down). */

export const POC_SRC = {
  minX: 223,
  minY: 217,
  maxX: 2334,
  maxY: 2591,
};

export const POC_MARGIN_TOP_PT = 36;
export const POC_MARGIN_LEFT_PT = 40;
export const POC_MARGIN_RIGHT_PT = 28;
export const POC_MARGIN_BOTTOM_PT = 28;

/** Space above form border for title. */
export const POC_TITLE_BAND_SRC = 211;
/** Space below last data row for signature. */
export const POC_FOOTER_BAND_SRC = 673;

export const POC_TITLE_Y_SRC = 320;
export const POC_TITLE_FONT_PT = 19;

/** Footer label cell (line grid). */
export const POC_SIGNATURE_CELL_ID = 94;
/** Bold line above signature caption (pt). */
export const POC_SIGNATURE_LINE_WIDTH_PT = 1.2;
export const POC_SIGNATURE_LINE_GAP_PT = 40;

/** Template: 11 port rows (10 filled + 1 empty). */
export const POC_TEMPLATE_ROW_COUNT = 11;
export const POC_DEFAULT_ROW_COUNT = 11;
/** Max port-call rows to include in one PDF (pages of 11). */
export const POC_MAX_ROW_COUNT = 99;
export const POC_MIN_ROW_COUNT = 1;

/** Data zone — below thick line 05 (y=720). */
export const POC_DATA_TOP_Y = 720;
export const POC_DATA_BOTTOM_Y = 1918;

/** Row dividers (y bottom of each row) for 11-row template. */
export const POC_DATA_ROW_BOTTOMS_Y = [
  826, 935, 1044, 1153, 1262, 1371, 1480, 1589, 1698, 1807, 1918,
];

export interface PocLineH {
  y1: number;
  y2: number;
  widthPx: number;
}

export interface PocLineV {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  widthPx: number;
}

/** 01 — main border drawn separately. */
export const POC_BORDER_WIDTH_PX = 3;

/** 02–16 horizontal lines. */
export const POC_H_LINES: PocLineH[] = [
  { y1: 428, y2: 433, widthPx: 6 },
  { y1: 523, y2: 525, widthPx: 3 },
  { y1: 616, y2: 618, widthPx: 3 },
  { y1: 715, y2: 720, widthPx: 6 },
  { y1: 826, y2: 828, widthPx: 3 },
  { y1: 935, y2: 937, widthPx: 3 },
  { y1: 1044, y2: 1046, widthPx: 3 },
  { y1: 1153, y2: 1155, widthPx: 3 },
  { y1: 1262, y2: 1264, widthPx: 3 },
  { y1: 1371, y2: 1373, widthPx: 3 },
  { y1: 1480, y2: 1482, widthPx: 3 },
  { y1: 1589, y2: 1591, widthPx: 3 },
  { y1: 1698, y2: 1700, widthPx: 3 },
  { y1: 1807, y2: 1809, widthPx: 3 },
  { y1: 1916, y2: 1918, widthPx: 3 },
];

/** 17–23 vertical lines. */
export const POC_V_LINES: PocLineV[] = [
  { x1: 301, x2: 303, y1: 616, y2: 1918, widthPx: 3 },
  { x1: 814, x2: 816, y1: 428, y2: 1918, widthPx: 3 },
  { x1: 1225, x2: 1227, y1: 523, y2: 1918, widthPx: 3 },
  { x1: 1471, x2: 1473, y1: 428, y2: 525, widthPx: 3 },
  { x1: 1471, x2: 1473, y1: 616, y2: 1918, widthPx: 3 },
  { x1: 1741, x2: 1743, y1: 428, y2: 1918, widthPx: 3 },
  { x1: 2032, x2: 2034, y1: 616, y2: 1918, widthPx: 3 },
];

/** Column bounds for port history rows (between vertical lines). */
export const POC_COL_BOUNDS = {
  voy: [223, 303] as const,
  port: [303, 816] as const,
  country: [816, 1227] as const,
  arrDate: [1227, 1471] as const,
  arrTime: [1471, 1741] as const,
  depDate: [1741, 2032] as const,
  depTime: [2032, 2334] as const,
};

/** Header field regions (ship / voyage — from main page). */
export const POC_HEADER_FIELDS = {
  shipName: { x1: 303, y1: 523, x2: 816, y2: 616 },
  callSign: { x1: 816, y1: 523, x2: 1227, y2: 616 },
  portOfArrival: { x1: 1227, y1: 523, x2: 1741, y2: 616 },
  dateOfArrival: { x1: 1741, y1: 523, x2: 2334, y2: 616 },
  nationality: { x1: 303, y1: 650, x2: 816, y2: 683 },
  homeport: { x1: 816, y1: 650, x2: 1227, y2: 683 },
  arrivedFrom: { x1: 1227, y1: 650, x2: 1741, y2: 683 },
  sailingTo: { x1: 1741, y1: 650, x2: 2334, y2: 683 },
} as const;

/** Static label bands (y ranges) — matches PORT OF CALL.xlsx rows 4–9. */
export const POC_LABEL_BANDS = {
  /** Labels 1–3 (values in 523–616). */
  shipRow: { y1: 428, y2: 523 },
  /** Labels 4–7 (one row above former 616–650; values in 650–683). */
  voyageLabelRow: { y1: 523, y2: 616 },
  /** Column headers 8–14 (data from y=720). */
  tableHead: { y1: 683, y2: 715 },
} as const;

/** Label-only cell bounds (x from grid lines; y from label bands). */
export const POC_STATIC_LABEL_CELLS = {
  shipRow: {
    shipName: { x1: 223, x2: 816 },
    callSign: { x1: 816, x2: 1227 },
    portOfArrival: { x1: 1227, x2: 1471 },
    dateOfArrival: { x1: 1741, x2: 2334 },
  },
  voyageLabelRow: {
    nationality: { x1: 303, x2: 816 },
    homeport: { x1: 816, x2: 1227 },
    arrivedFrom: { x1: 1227, x2: 1741 },
    sailingTo: { x1: 1741, x2: 2334 },
  },
} as const;

export const POC_SIGNATURE_Y_SRC = 2480;

export const POC_FRAME_LABELS = {
  title: 'Port of Call List',
  signature: '15. Date and signature by master, authorised agent or officer',
} as const;

/** Overlay stamp/signature above field 15 signature line (pdf-lib, origin bottom-left). */
export function pocStampBoxPdfLib(
  pageW = 595.28,
  pageH = 842,
): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const s = createPocScale(pageW, pageH);
  const cells = buildPocGridCells();
  const footer = pocCellById(cells, POC_SIGNATURE_CELL_ID);
  const r = footer
    ? s.rect(footer.x1, footer.y1, footer.x2, footer.y2)
    : s.rect(POC_SRC.minX, 1918, POC_SRC.maxX, POC_SRC.maxY);
  const pad = 8;
  const text = POC_FRAME_LABELS.signature;
  const textY = r.y + r.h - pad;
  const lineY = textY - POC_SIGNATURE_LINE_GAP_PT;
  const textX = r.x + r.w - pad;
  const textW = text.length * 2.35;
  const lineW = Math.max(textW * 1.05, r.w * 0.38);
  const lineX2 = textX;
  const lineX1 = lineX2 - lineW;
  const gapAboveLine = 5;
  const stampH = Math.min(105, Math.max(72, lineY - r.y - 12));
  const stampW = lineX2 - lineX1;
  const lineFromTop = lineY - gapAboveLine;
  return {
    x: lineX1,
    y: pageH - lineFromTop,
    width: stampW,
    height: stampH,
  };
}

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

export interface PdfRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PocScale {
  sx: (x: number) => number;
  sy: (y: number) => number;
  rect: (x1: number, y1: number, x2: number, y2: number) => PdfRect;
  linePt: (widthPx: number) => number;
}

export function createPocScale(pageW = 595.28, pageH = 842): PocScale {
  const srcW = POC_SRC.maxX - POC_SRC.minX;
  const srcH = POC_SRC.maxY - POC_SRC.minY + POC_TITLE_BAND_SRC + POC_FOOTER_BAND_SRC;
  const usableW = pageW - POC_MARGIN_LEFT_PT - POC_MARGIN_RIGHT_PT;
  const usableH = pageH - POC_MARGIN_TOP_PT - POC_MARGIN_BOTTOM_PT;
  const scale = Math.min(usableW / srcW, usableH / srcH);

  const sx = (x: number) => POC_MARGIN_LEFT_PT + (x - POC_SRC.minX) * scale;
  const sy = (y: number) => POC_MARGIN_TOP_PT + (y - POC_SRC.minY + POC_TITLE_BAND_SRC) * scale;
  const linePt = (widthPx: number) => Math.max(0.4, widthPx * scale * 0.5);

  return {
    sx,
    sy,
    linePt,
    rect(x1, y1, x2, y2) {
      return { x: sx(x1), y: sy(y1), w: sx(x2) - sx(x1), h: sy(y2) - sy(y1) };
    },
  };
}

export interface PocGridCell {
  id: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Right edge of a vertical line stripe → boundary to the next column. */
function pocVerticalBoundaryX(line: PocLineV): number {
  return Math.max(line.x1, line.x2);
}

/** Content rows between horizontal lines (excludes line thickness bands). */
export function pocContentRowBands(): Array<{ y1: number; y2: number }> {
  const bands: Array<{ y1: number; y2: number }> = [];
  let yTop = POC_SRC.minY;
  const sorted = [...POC_H_LINES].sort((a, b) => a.y1 - b.y1);

  for (const line of sorted) {
    if (line.y1 > yTop) {
      bands.push({ y1: yTop, y2: line.y1 });
    }
    yTop = line.y2;
  }
  if (yTop < POC_SRC.maxY) {
    bands.push({ y1: yTop, y2: POC_SRC.maxY });
  }
  return bands;
}

/** Active vertical boundaries inside a horizontal band (from line segments). */
function pocVerticalBoundariesInBand(y1: number, y2: number): number[] {
  const xs = new Set<number>();
  for (const line of POC_V_LINES) {
    if (line.y1 < y2 && line.y2 > y1) {
      xs.add(pocVerticalBoundaryX(line));
    }
  }
  return [...xs].sort((a, b) => a - b);
}

/** All rectangular cells inside the form border, numbered top→bottom, left→right. */
export function buildPocGridCells(): PocGridCell[] {
  const cells: PocGridCell[] = [];
  let id = 1;

  for (const row of pocContentRowBands()) {
    const xCuts = [POC_SRC.minX, ...pocVerticalBoundariesInBand(row.y1, row.y2), POC_SRC.maxX];
    for (let xi = 0; xi < xCuts.length - 1; xi++) {
      const x1 = xCuts[xi];
      const x2 = xCuts[xi + 1];
      if (x2 - x1 < 2 || row.y2 - row.y1 < 2) continue;
      cells.push({ id: id++, x1, y1: row.y1, x2, y2: row.y2 });
    }
  }

  return cells;
}

export function pocCellById(cells: PocGridCell[], id: number): PocGridCell | undefined {
  return cells.find((c) => c.id === id);
}

/** First cell of 11×7 port-history grid (IDs 17–93). */
export const POC_DATA_FIRST_CELL_ID = 17;
export const POC_DATA_COL_COUNT = 7;
export const POC_DATA_ROW_COUNT = 11;

export type PocTextPlacement =
  | 'topLeft'
  | 'middleLeft'
  | 'topCenter'
  | 'middleCenter'
  | 'bottomCenter'
  | 'valueBottom'
  | 'valueBottomCenter';

export interface PocCellTextLine {
  text: string;
  placement: PocTextPlacement;
}

/** Static field labels by grid cell ID (from line-based numbering). */
export const POC_LABEL_SPECS: PocCellTextLine[][] = [
  [], // 0
  [], // 1
  [{ text: POC_STATIC_LABELS.shipName, placement: 'topLeft' }],
  [{ text: POC_STATIC_LABELS.callSign, placement: 'topLeft' }],
  [{ text: POC_STATIC_LABELS.portOfArrival, placement: 'topLeft' }],
  [{ text: POC_STATIC_LABELS.dateOfArrival, placement: 'topLeft' }],
  [{ text: POC_STATIC_LABELS.nationality, placement: 'topLeft' }],
  [{ text: POC_STATIC_LABELS.homeport, placement: 'topLeft' }],
  [{ text: POC_STATIC_LABELS.arrivedFrom, placement: 'topLeft' }],
  [{ text: POC_STATIC_LABELS.sailingTo, placement: 'topLeft' }],
  [
    { text: '8.', placement: 'topCenter' },
    { text: 'Voy.', placement: 'middleCenter' },
    { text: 'No.', placement: 'bottomCenter' },
  ],
  [{ text: POC_STATIC_LABELS.lastPort, placement: 'middleLeft' }],
  [{ text: POC_STATIC_LABELS.country, placement: 'middleLeft' }],
  [{ text: POC_STATIC_LABELS.arrDate, placement: 'topLeft' }],
  [
    { text: POC_STATIC_LABELS.arrTime, placement: 'topLeft' },
    { text: POC_STATIC_LABELS.arrTimeSub, placement: 'bottomCenter' },
  ],
  [{ text: POC_STATIC_LABELS.depDate, placement: 'topLeft' }],
  [
    { text: POC_STATIC_LABELS.depTime, placement: 'topLeft' },
    { text: POC_STATIC_LABELS.depTimeSub, placement: 'bottomCenter' },
  ],
];

/** Header label cells 2–9: shift titles up (pt). */
export const POC_HEADER_LABEL_SHIFT_UP_PT = 5;
/** Header value cells 2–9: shift data down (pt). */
export const POC_HEADER_VALUE_SHIFT_DOWN_PT = 4;
/** «Local Time» in cells 14 & 16 — extra offset down from base (pt). */
export const POC_LOCAL_TIME_SHIFT_DOWN_PT = 3;
/** Cell 10 — «8. Voy. No.» line tweaks (pt). */
export const POC_VOY_NO_8_SHIFT_UP_PT = 5;
export const POC_VOY_NO_BOTTOM_SHIFT_DOWN_PT = 4;

/** Header values (user data) — same cells 2–9. */
export const POC_HEADER_VALUE_CELLS = {
  shipName: 2,
  callSign: 3,
  portOfArrival: 4,
  dateOfArrival: 5,
  nationality: 6,
  homeport: 7,
  arrivedFrom: 8,
  sailingTo: 9,
} as const;

/** Port row column order in data cells 17+. */
export const POC_DATA_COL_KEYS = [
  'voy',
  'port',
  'country',
  'arrDate',
  'arrTime',
  'depDate',
  'depTime',
] as const;

export function pocPortDataCellId(rowIndex: number, colIndex: number): number {
  return POC_DATA_FIRST_CELL_ID + rowIndex * POC_DATA_COL_COUNT + colIndex;
}

/** Row top/bottom Y in source coords for N data rows. */
export function pocDataRowBounds(rowCount: number): { tops: number[]; bottoms: number[] } {
  const n = Math.max(POC_MIN_ROW_COUNT, Math.min(POC_MAX_ROW_COUNT, rowCount));

  if (n === POC_TEMPLATE_ROW_COUNT) {
    const tops = [POC_DATA_TOP_Y, ...POC_DATA_ROW_BOTTOMS_Y.slice(0, -1)];
    return { tops, bottoms: [...POC_DATA_ROW_BOTTOMS_Y] };
  }

  const tops: number[] = [];
  const bottoms: number[] = [];
  const h = (POC_DATA_BOTTOM_Y - POC_DATA_TOP_Y) / n;
  for (let i = 0; i < n; i++) {
    tops.push(POC_DATA_TOP_Y + h * i);
    bottoms.push(POC_DATA_TOP_Y + h * (i + 1));
  }
  return { tops, bottoms };
}
