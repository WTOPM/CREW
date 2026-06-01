/** User-defined layout (top-left origin, Y down). */
export const CREW_LIST_SRC = {
  minX: 152,
  minY: 118,
  maxX: 2170,
  maxY: 2373,
};

/** Page margins on A4 (pt). */
export const CREW_LIST_MARGIN_TOP_PT = 36;
export const CREW_LIST_MARGIN_LEFT_PT = 40;
export const CREW_LIST_MARGIN_RIGHT_PT = 28;
export const CREW_LIST_MARGIN_BOTTOM_PT = 28;

/** Vertical side label — offset left from table edge (pt). */
export const CREW_LIST_SIDE_LABEL_GAP_FROM_TABLE_PT = 5;
export const CREW_LIST_FAL_FORM_X_PT = 14;

/** Fine-tune frame labels (CSS px → pt at 96 dpi). */
export const CREW_LIST_TITLE_OFFSET_UP_PT = 7.5;
export const CREW_LIST_FAL_FORM_OFFSET_LEFT_PT = 3.75;

/** Extra source space above grid (title) and below grid (footer). */
export const CREW_LIST_TITLE_BAND_SRC = 110;
export const CREW_LIST_FOOTER_BAND_SRC = 85;

export const CREW_LIST_TITLE_Y = 95;

export const CREW_LIST_FRAME_LABELS = {
  title: 'IMO CREW LIST',
  sideVertical: 'IMO Convention on Facilitation of International Maritime Traffic',
  field12: '12.  Date and signature by master, authorised agent or officer',
  falFormLine1: 'IMO FAL',
  falFormLine2: 'Form 5',
} as const;

/** 2 CSS pixels ≈ 1.5 pt at 96 dpi. */
export const CREW_LIST_LINE_PT = 1.5;

export const CREW_LIST_ROW_LINE_PT = 0.5;
export const CREW_LIST_ROW_LINE_GRAY = 175;

export const BODY_TOP_Y = 447;
export const BODY_BOTTOM_Y = 2373;

export interface CoordBox {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
}

export const CREW_LIST_BOXES: CoordBox[] = [
  { id: '01', x1: 152, y1: 192, x2: 1101, y2: 278, label: '1.   Name of ship' },
  { id: '02', x1: 152, y1: 277, x2: 1101, y2: 380, label: '4.   Nationality of Ship' },
  { id: '03', x1: 152, y1: 379, x2: 237, y2: 448, label: '7.   No.' },
  { id: '04', x1: 236, y1: 379, x2: 882, y2: 448, label: '8.   Family names, given names' },
  { id: '05', x1: 881, y1: 379, x2: 1101, y2: 448, label: '9.   Rank or rating' },
  { id: '06', x1: 1100, y1: 379, x2: 1305, y2: 448, label: '10.   Nationality' },
  { id: '07', x1: 1100, y1: 153, x2: 1149, y2: 192, label: '' },
  { id: '08', x1: 1490, y1: 153, x2: 1536, y2: 192, label: '' },
  { id: '09', x1: 1871, y1: 117, x2: 2169, y2: 192, label: 'Page No.' },
  { id: '10', x1: 1100, y1: 192, x2: 1491, y2: 278, label: '2.   Port of arrival / departure' },
  { id: '11', x1: 1490, y1: 192, x2: 2169, y2: 278, label: '3.   Date of arrival / departure' },
  { id: '12', x1: 1100, y1: 277, x2: 1872, y2: 380, label: '5.   Port arrived from / Sailing to' },
  { id: '13', x1: 1304, y1: 379, x2: 1872, y2: 448, label: '11.   Date and place of birth' },
  { id: '14', x1: 1871, y1: 277, x2: 2170, y2: 448, label: '6.   Nature und No.' },
  { id: '15', x1: 152, y1: 447, x2: 237, y2: 2373, label: '' },
  { id: '16', x1: 236, y1: 447, x2: 882, y2: 2373, label: '' },
  { id: '17', x1: 881, y1: 447, x2: 1101, y2: 2373, label: '' },
  { id: '18', x1: 1100, y1: 447, x2: 1305, y2: 2373, label: '' },
  { id: '19', x1: 1304, y1: 447, x2: 1491, y2: 2373, label: '' },
  { id: '20', x1: 1490, y1: 447, x2: 1872, y2: 2373, label: '' },
  { id: '21', x1: 1871, y1: 447, x2: 2169, y2: 2373, label: '' },
];

export const CREW_LIST_STATIC_LABELS = {
  arrival: 'Arrival',
  departure: 'Departure',
} as const;

export const CREW_LIST_ROW_COUNT = 23;

export interface PdfRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CoordScale {
  sx: (x: number) => number;
  sy: (y: number) => number;
  rect: (x1: number, y1: number, x2: number, y2: number) => PdfRect;
}

export function createCoordScale(
  pageW = 595.28,
  pageH = 842,
  marginLeft = CREW_LIST_MARGIN_LEFT_PT,
  marginRight = CREW_LIST_MARGIN_RIGHT_PT,
  marginTop = CREW_LIST_MARGIN_TOP_PT,
  marginBottom = CREW_LIST_MARGIN_BOTTOM_PT,
): CoordScale {
  const srcW = CREW_LIST_SRC.maxX - CREW_LIST_SRC.minX;
  const srcH =
    CREW_LIST_SRC.maxY -
    CREW_LIST_SRC.minY +
    CREW_LIST_TITLE_BAND_SRC +
    CREW_LIST_FOOTER_BAND_SRC;
  const usableW = pageW - marginLeft - marginRight;
  const usableH = pageH - marginTop - marginBottom;
  const scale = Math.min(usableW / srcW, usableH / srcH);
  const offsetX = marginLeft;
  const offsetY = marginTop;

  const sx = (x: number) => offsetX + (x - CREW_LIST_SRC.minX) * scale;
  const sy = (y: number) => offsetY + (y - CREW_LIST_SRC.minY + CREW_LIST_TITLE_BAND_SRC) * scale;

  return {
    sx,
    sy,
    rect(x1, y1, x2, y2) {
      const x = sx(x1);
      const y = sy(y1);
      return { x, y, w: sx(x2) - x, h: sy(y2) - y };
    },
  };
}
