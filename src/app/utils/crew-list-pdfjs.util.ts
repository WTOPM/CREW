import type { PdfStampBox } from './overlay-stamp-box.util';

/** Screen CSS px per PDF point at 96 dpi (≈ print size on monitor). */
export const CREW_LIST_PREVIEW_CSS_PX_PER_PT = 96 / 72;

export interface CrewListPdfJsPoint {
  /** pdf-lib / drawText anchor (origin bottom-left, pt). */
  x: number;
  y: number;
}

export interface ViewportCssRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface PdfTextGlyph {
  char: string;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

type PdfJsTextItem = {
  str?: string;
  transform: number[];
  width?: number;
  height?: number;
};

function buildPdfTextGlyphs(items: PdfJsTextItem[]): PdfTextGlyph[] {
  const glyphs: PdfTextGlyph[] = [];
  for (const raw of items) {
    if (!('str' in raw)) continue;
    const item = raw as {
      str: string;
      transform: number[];
      width?: number;
      height?: number;
    };
    const str = item.str;
    if (!str) continue;
    const t = item.transform;
    const fontW = Math.hypot(t[0], t[1]) || 10;
    const fontH = Math.hypot(t[2], t[3]) || fontW;
    const x0 = t[4];
    const y0 = t[5];
    const totalW = item.width ?? str.length * fontW * 0.55;
    const charW = totalW / Math.max(1, str.length);
    const yMin = y0 - fontH * 0.75;
    const yMax = y0 + fontH * 0.25;
    for (let i = 0; i < str.length; i++) {
      glyphs.push({
        char: str[i],
        xMin: x0 + i * charW,
        xMax: x0 + (i + 1) * charW,
        yMin,
        yMax,
      });
    }
  }
  return glyphs;
}

function hitPdfTextGlyph(glyphs: PdfTextGlyph[], px: number, py: number): string | null {
  for (const g of glyphs) {
    if (px >= g.xMin && px < g.xMax && py >= g.yMin && py <= g.yMax) {
      return g.char;
    }
  }
  return null;
}

export interface PdfJsPageView {
  width: number;
  height: number;
  pageWidthPt: number;
  pageHeightPt: number;
  convertToPdfPoint(cssX: number, cssY: number): CrewListPdfJsPoint;
  /** Inverse of convertToPdfPoint — pdf-lib baseline anchor in viewport CSS px. */
  convertToViewportCss(pdfX: number, pdfY: number): { x: number; y: number };
  charAtPdfPoint(px: number, py: number): string | null;
  boxToViewportCss(box: PdfStampBox): ViewportCssRect;
  render(canvas: HTMLCanvasElement): Promise<void>;
  destroy(): void;
}

/** Map screen pointer to PDF.js viewport CSS space (matches canvas, accounts for zoom). */
export function clientToViewportCss(
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement,
  view: Pick<PdfJsPageView, 'width' | 'height'>,
): { x: number; y: number } | null {
  const rect = canvas.getBoundingClientRect();
  const relX = clientX - rect.left;
  const relY = clientY - rect.top;
  if (relX < 0 || relY < 0 || relX > rect.width || relY > rect.height) {
    return null;
  }
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }
  return {
    x: (relX / rect.width) * view.width,
    y: (relY / rect.height) * view.height,
  };
}

/** @deprecated Use PdfJsPageView */
export type CrewListPdfJsPageView = PdfJsPageView;

function stampBoxToViewportCss(
  box: PdfStampBox,
  viewport: import('pdfjs-dist').PageViewport,
): ViewportCssRect {
  const corners: [number, number][] = [
    [box.x, box.y],
    [box.x + box.width, box.y],
    [box.x + box.width, box.y + box.height],
    [box.x, box.y + box.height],
  ];
  const vp = corners.map(([px, py]) => viewport.convertToViewportPoint(px, py));
  const xs = vp.map((p) => p[0]);
  const ys = vp.map((p) => p[1]);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const right = Math.max(...xs);
  const bottom = Math.max(...ys);
  return {
    left: Math.round(left * 10) / 10,
    top: Math.round(top * 10) / 10,
    width: Math.round((right - left) * 10) / 10,
    height: Math.round((bottom - top) * 10) / 10,
  };
}

type PdfJsModule = typeof import('pdfjs-dist');

let pdfJsModule: Promise<PdfJsModule> | null = null;

const PDFJS_WORKER_FILE = 'pdf.worker.min.mjs';

/**
 * Resolve the pdf.js worker URL at the app root.
 *
 * Electron portable builds use `baseHref: "./"` with PathLocationStrategy, so on
 * a deep route like `/dg/reference` a relative base resolves to `…/dg/` and the
 * worker fetch becomes `app://local/dg/pdf.worker.min.mjs` (404). The worker is
 * always copied next to `index.html`, so pin it to the origin root.
 */
function pdfWorkerSrc(): string {
  try {
    return new URL(`/${PDFJS_WORKER_FILE}`, `${window.location.origin}/`).href;
  } catch {
    return `${window.location.origin}/${PDFJS_WORKER_FILE}`;
  }
}

async function loadPdfJs(): Promise<PdfJsModule> {
  if (!pdfJsModule) {
    pdfJsModule = import('pdfjs-dist');
  }
  const pdfjs = await pdfJsModule;
  // Re-apply on every call — the first import may have happened on a deep route.
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc();
  return pdfjs;
}

/** Shared pdf.js loader with worker configured (browser / Electron). */
export { loadPdfJs };

export async function openPdfJsPageView(
  bytes: Uint8Array,
  cssPxPerPt = CREW_LIST_PREVIEW_CSS_PX_PER_PT,
  pageNumber = 1,
): Promise<PdfJsPageView> {
  const pdfjs = await loadPdfJs();
  const loadingTask = pdfjs.getDocument({
    data: bytes.slice(),
    useSystemFonts: true,
  });
  const doc = await loadingTask.promise;
  const destroyDoc = () => void loadingTask.destroy();
  const page = await doc.getPage(pageNumber);
  /** pdf-lib user space (media box) — independent of /Rotate display. */
  const mediaViewport = page.getViewport({ scale: 1, rotation: 0 });
  /** Display viewport follows /Rotate; convertToPdfPoint returns media-box pt (pdf-lib space). */
  const viewport = page.getViewport({ scale: cssPxPerPt });
  const outputScale = window.devicePixelRatio || 1;
  const pageWidthPt = mediaViewport.width;
  const pageHeightPt = mediaViewport.height;
  const textGlyphs = buildPdfTextGlyphs((await page.getTextContent()).items as PdfJsTextItem[]);

  return {
    width: viewport.width,
    height: viewport.height,
    pageWidthPt,
    pageHeightPt,
    convertToPdfPoint(cssX, cssY) {
      const [x, y] = viewport.convertToPdfPoint(cssX, cssY);
      return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
    },
    convertToViewportCss(pdfX, pdfY) {
      const [x, y] = viewport.convertToViewportPoint(pdfX, pdfY);
      return { x, y };
    },
    charAtPdfPoint(px, py) {
      return hitPdfTextGlyph(textGlyphs, px, py);
    },
    boxToViewportCss(box) {
      return stampBoxToViewportCss(box, viewport);
    },
    async render(canvas) {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;
      await page.render({
        canvas,
        canvasContext: ctx,
        viewport,
        transform,
      }).promise;
    },
    destroy: destroyDoc,
  };
}

export const openCrewListPdfJsPage = openPdfJsPageView;

/** Map on-screen pointer movement to pdf-lib pt delta (handles /Rotate 90 etc.). */
export function pdfJsPointerDeltaPdf(
  view: PdfJsPageView,
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  prevClientX: number,
  prevClientY: number,
): { dx: number; dy: number } {
  const cur = clientToViewportCss(clientX, clientY, canvas, view);
  const prev = clientToViewportCss(prevClientX, prevClientY, canvas, view);
  if (!cur || !prev) {
    return { dx: 0, dy: 0 };
  }
  const curPt = view.convertToPdfPoint(cur.x, cur.y);
  const prevPt = view.convertToPdfPoint(prev.x, prev.y);
  return { dx: curPt.x - prevPt.x, dy: curPt.y - prevPt.y };
}

/** Map a small on-screen step to pdf-lib pt delta (arrow keys). */
export function pdfJsScreenStepToPdf(
  view: PdfJsPageView,
  canvas: HTMLCanvasElement,
  screenDx: number,
  screenDy: number,
): { dx: number; dy: number } {
  const rect = canvas.getBoundingClientRect();
  const ox = view.width / 2;
  const oy = view.height / 2;
  const scaleX = view.width / rect.width;
  const scaleY = view.height / rect.height;
  const p0 = view.convertToPdfPoint(ox, oy);
  const p1 = view.convertToPdfPoint(ox + screenDx * scaleX, oy + screenDy * scaleY);
  return { dx: p1.x - p0.x, dy: p1.y - p0.y };
}
