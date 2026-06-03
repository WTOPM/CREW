/** Screen CSS px per PDF point at 96 dpi (≈ print size on monitor). */
export const CREW_LIST_PREVIEW_CSS_PX_PER_PT = 96 / 72;

export interface CrewListPdfJsPoint {
  /** pdf-lib / drawText anchor (origin bottom-left, pt). */
  x: number;
  y: number;
}

export interface CrewListPdfJsPageView {
  width: number;
  height: number;
  convertToPdfPoint(cssX: number, cssY: number): CrewListPdfJsPoint;
  render(canvas: HTMLCanvasElement): Promise<void>;
  destroy(): void;
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

export async function openCrewListPdfJsPage(
  bytes: Uint8Array,
  cssPxPerPt = CREW_LIST_PREVIEW_CSS_PX_PER_PT,
): Promise<CrewListPdfJsPageView> {
  const pdfjs = await loadPdfJs();
  const loadingTask = pdfjs.getDocument({
    data: bytes.slice(),
    useSystemFonts: true,
  });
  const doc = await loadingTask.promise;
  const destroyDoc = () => void loadingTask.destroy();
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: cssPxPerPt });
  const outputScale = window.devicePixelRatio || 1;

  return {
    width: viewport.width,
    height: viewport.height,
    convertToPdfPoint(cssX, cssY) {
      const [x, y] = viewport.convertToPdfPoint(cssX, cssY);
      return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
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
