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

export interface PdfJsPageView {
  width: number;
  height: number;
  pageWidthPt: number;
  pageHeightPt: number;
  convertToPdfPoint(cssX: number, cssY: number): CrewListPdfJsPoint;
  boxToViewportCss(box: PdfStampBox): ViewportCssRect;
  render(canvas: HTMLCanvasElement): Promise<void>;
  destroy(): void;
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

/** Resolve worker URL (base href may be relative, e.g. ./ in Electron). */
function pdfWorkerSrc(): string {
  const baseEl = document.querySelector('base');
  if (baseEl?.href) {
    try {
      return new URL(PDFJS_WORKER_FILE, baseEl.href).href;
    } catch {
      /* fall through */
    }
  }

  const path = window.location.pathname.replace(/\/[^/]*$/, '/');
  const root = `${window.location.origin}${path}`;
  return new URL(PDFJS_WORKER_FILE, root).href;
}

async function loadPdfJs(): Promise<PdfJsModule> {
  if (!pdfJsModule) {
    pdfJsModule = import('pdfjs-dist').then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc();
      return pdfjs;
    });
  }
  return pdfJsModule;
}

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
  const viewport = page.getViewport({ scale: cssPxPerPt });
  const outputScale = window.devicePixelRatio || 1;
  const pageWidthPt = mediaViewport.width;
  const pageHeightPt = mediaViewport.height;

  return {
    width: viewport.width,
    height: viewport.height,
    pageWidthPt,
    pageHeightPt,
    convertToPdfPoint(cssX, cssY) {
      const [x, y] = viewport.convertToPdfPoint(cssX, cssY);
      return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
    },
    boxToViewportCss(box) {
      return stampBoxToViewportCss(box, viewport);
    },
    async render(canvas) {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      const transform =
        outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;
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
  overlayRect: DOMRect,
  clientX: number,
  clientY: number,
  prevClientX: number,
  prevClientY: number,
): { dx: number; dy: number } {
  const cur = view.convertToPdfPoint(clientX - overlayRect.left, clientY - overlayRect.top);
  const prev = view.convertToPdfPoint(
    prevClientX - overlayRect.left,
    prevClientY - overlayRect.top,
  );
  return { dx: cur.x - prev.x, dy: cur.y - prev.y };
}

/** Map a small on-screen step to pdf-lib pt delta (arrow keys). */
export function pdfJsScreenStepToPdf(
  view: PdfJsPageView,
  overlayRect: DOMRect,
  cssDx: number,
  cssDy: number,
): { dx: number; dy: number } {
  const ox = overlayRect.width / 2;
  const oy = overlayRect.height / 2;
  const p0 = view.convertToPdfPoint(ox, oy);
  const p1 = view.convertToPdfPoint(ox + cssDx, oy + cssDy);
  return { dx: p1.x - p0.x, dy: p1.y - p0.y };
}
