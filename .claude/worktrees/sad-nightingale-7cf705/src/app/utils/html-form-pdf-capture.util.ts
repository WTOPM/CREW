import {
  HTML_FORM_PDF_DATA_PARAM,
  HTML_FORM_PDF_SNAPSHOT_STORAGE_KEY,
} from '../models/html-form-pdf-snapshot.model';
import { base64ToUint8 } from './base64.util';

/** Relative editor path (/forms/...) for Electron printToPDF IPC. */
export function htmlFormPdfRelativeUrl(relativePath: string): string {
  if (relativePath.startsWith('http://') || relativePath.startsWith('https://') || relativePath.startsWith('app://')) {
    const url = new URL(relativePath);
    return url.pathname + url.search;
  }
  return relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
}

export interface HtmlFormPdfCaptureOptions {
  url: string;
  snapshot?: unknown;
  iframeWidth: string;
  iframeHeight: string;
  pageSelector: string;
  /** A4 landscape (forms 03, 06, 07). Default portrait. */
  landscape?: boolean;
}

/**
 * PDF bytes from an HTML form editor.
 * Electron: Chromium printToPDF (vector text, searchable).
 * Browser: html2canvas raster fallback.
 */
export async function captureHtmlFormPdfBytes(
  options: HtmlFormPdfCaptureOptions,
): Promise<Uint8Array> {
  const relativeUrl = htmlFormPdfRelativeUrl(options.url);
  const api = typeof window !== 'undefined' ? window.electronAPI : undefined;
  const landscape = options.landscape ?? false;

  if (api?.captureHtmlFormPdf && options.snapshot !== undefined) {
    const base64 = await api.captureHtmlFormPdf(relativeUrl, options.snapshot, { landscape });
    return base64ToUint8(base64);
  }

  const canvas = await captureHtmlFormFromUrl({
    url: relativeUrl,
    snapshot: options.snapshot,
    iframeWidth: options.iframeWidth,
    iframeHeight: options.iframeHeight,
    pageSelector: options.pageSelector,
  });
  return canvasToPdfBytes(canvas, landscape);
}

/** Raster fallback: A4 JPEG page from html2canvas capture. */
export async function canvasToPdfBytes(
  canvas: HTMLCanvasElement,
  landscape = false,
): Promise<Uint8Array> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4',
    orientation: landscape ? 'landscape' : 'portrait',
  });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pageWidth, pageHeight);
  return new Uint8Array(doc.output('arraybuffer'));
}

/** Resolve a root-absolute editor path (/forms/...) against the current page origin (app:// or http://). */
export function resolveHtmlFormEditorUrl(relativePath: string): string {
  return new URL(relativePath, window.location.href).href;
}

/** Append ?pdfData=1 and store snapshot in sessionStorage (avoids HTTP 431 on large URLs). */
export function resolvePdfCaptureUrl(relativePath: string, snapshot: unknown): string {
  sessionStorage.setItem(HTML_FORM_PDF_SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshot));
  const url = new URL(relativePath, window.location.href);
  url.searchParams.set(HTML_FORM_PDF_DATA_PARAM, '1');
  url.searchParams.delete('data');
  return url.pathname + url.search;
}

/** Wait until the hidden iframe has rendered the form and set window.__pdfReady. */
export async function waitForHtmlFormPdfReady(
  iframe: HTMLIFrameElement,
  pageSelector: string,
  timeoutMs = 12000,
): Promise<Document> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const doc = iframe.contentDocument;
      const ready = (iframe.contentWindow as (Window & { __pdfReady?: boolean }) | null)?.__pdfReady;
      if (doc?.querySelector(pageSelector) && ready) {
        return doc;
      }
    } catch {
      /* iframe still loading or temporarily cross-origin */
    }
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  throw new Error('HTML form failed to render for PDF export');
}

/**
 * Capture the fixed-size page root (`.a4-page` / `.a4-landscape-page`).
 * Overlays may extend past the page edge in the DOM but are clipped by CSS — never widen the canvas.
 */
export async function captureHtmlFormPageCanvas(
  frameDoc: Document,
  pageSelector: string,
): Promise<HTMLCanvasElement> {
  const pageEl = frameDoc.querySelector<HTMLElement>(pageSelector);
  if (!pageEl) {
    throw new Error(`HTML form capture root not found: ${pageSelector}`);
  }

  const rect = pageEl.getBoundingClientRect();
  const width = Math.round(rect.width);
  const height = Math.round(rect.height);

  const { default: html2canvas } = await import('html2canvas');
  return html2canvas(pageEl, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    foreignObjectRendering: true,
    width,
    height,
    windowWidth: width,
    windowHeight: height,
    scrollX: 0,
    scrollY: 0,
    x: 0,
    y: 0,
  });
}

/** Load an HTML form editor in a hidden iframe and capture its page (PDF / Excel export). */
export async function captureHtmlFormFromUrl(options: {
  url: string;
  /** When set, stored in sessionStorage — not placed in the query string. */
  snapshot?: unknown;
  iframeWidth: string;
  iframeHeight: string;
  pageSelector: string;
}): Promise<HTMLCanvasElement> {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-10000px';
  iframe.style.top = '0';
  iframe.style.width = options.iframeWidth;
  iframe.style.height = options.iframeHeight;
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const iframeSrc =
    options.snapshot !== undefined
      ? resolvePdfCaptureUrl(options.url, options.snapshot)
      : resolveHtmlFormEditorUrl(options.url);

  try {
    await new Promise<void>((resolve, reject) => {
      iframe.addEventListener('load', () => resolve(), { once: true });
      iframe.addEventListener('error', () => reject(new Error('Failed to load HTML form')), {
        once: true,
      });
      iframe.src = iframeSrc;
    });

    const frameDoc = await waitForHtmlFormPdfReady(iframe, options.pageSelector);
    const canvas = await captureHtmlFormPageCanvas(frameDoc, options.pageSelector);
    return detachCanvasToDocument(canvas);
  } finally {
    iframe.remove();
  }
}

/** Copy canvas pixels into the parent document before the source window is torn down. */
function detachCanvasToDocument(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const detached = document.createElement('canvas');
  detached.width = canvas.width;
  detached.height = canvas.height;
  const ctx = detached.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context is unavailable');
  }
  ctx.drawImage(canvas, 0, 0);
  return detached;
}
