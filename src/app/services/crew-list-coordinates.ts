/** User-defined layout (top-left origin, Y down). */

export const CREW_LIST_SRC = {

  minX: 152,

  minY: 118,

  maxX: 2170,

  maxY: 2373,

};



/** 2 CSS pixels ≈ 1.5 pt at 96 dpi. */

export const CREW_LIST_LINE_PT = 1.5;



export interface CoordBox {

  id: string;

  x1: number;

  y1: number;

  x2: number;

  y2: number;

}



/** Rectangles 01–21 — borders exactly between these corners. */

export const CREW_LIST_BOXES: CoordBox[] = [

  { id: '01', x1: 152, y1: 192, x2: 1101, y2: 278 },

  { id: '02', x1: 152, y1: 277, x2: 1101, y2: 380 },

  { id: '03', x1: 152, y1: 379, x2: 237, y2: 448 },

  { id: '04', x1: 236, y1: 379, x2: 882, y2: 448 },

  { id: '05', x1: 881, y1: 379, x2: 1101, y2: 448 },

  { id: '06', x1: 1100, y1: 379, x2: 1305, y2: 448 },

  { id: '07', x1: 1100, y1: 153, x2: 1149, y2: 192 },

  { id: '08', x1: 1490, y1: 153, x2: 1536, y2: 192 },

  { id: '09', x1: 1871, y1: 117, x2: 2169, y2: 192 },

  { id: '10', x1: 1100, y1: 192, x2: 1491, y2: 278 },

  { id: '11', x1: 1490, y1: 192, x2: 2169, y2: 278 },

  { id: '12', x1: 1100, y1: 277, x2: 1872, y2: 380 },

  { id: '13', x1: 1304, y1: 379, x2: 1872, y2: 448 },

  { id: '14', x1: 1871, y1: 277, x2: 2170, y2: 448 },

  { id: '15', x1: 152, y1: 447, x2: 237, y2: 2373 },

  { id: '16', x1: 236, y1: 447, x2: 882, y2: 2373 },

  { id: '17', x1: 881, y1: 447, x2: 1101, y2: 2373 },

  { id: '18', x1: 1100, y1: 447, x2: 1305, y2: 2373 },

  { id: '19', x1: 1304, y1: 447, x2: 1491, y2: 2373 },

  { id: '20', x1: 1490, y1: 447, x2: 1872, y2: 2373 },

  { id: '21', x1: 1871, y1: 447, x2: 2169, y2: 2373 },

];



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



/** Map source coords → A4 pt, uniform scale, centered on page. */

export function createCoordScale(pageW = 595.28, pageH = 842, margin = 18): CoordScale {

  const srcW = CREW_LIST_SRC.maxX - CREW_LIST_SRC.minX;

  const srcH = CREW_LIST_SRC.maxY - CREW_LIST_SRC.minY;

  const scale = Math.min((pageW - margin * 2) / srcW, (pageH - margin * 2) / srcH);

  const offsetX = (pageW - srcW * scale) / 2;

  const offsetY = margin;



  const sx = (x: number) => offsetX + (x - CREW_LIST_SRC.minX) * scale;

  const sy = (y: number) => offsetY + (y - CREW_LIST_SRC.minY) * scale;



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


