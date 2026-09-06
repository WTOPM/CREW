import { loadPdfJs } from './crew-list-pdfjs.util';

/** Positioned text line from a PDF page (top-left origin, pt). */
export interface DgPdfTextItem {
  str: string;
  x: number;
  y: number;
  page: number;
}

/**
 * Own copy of the PDF bytes for pdf.js.
 * Always allocate a fresh ArrayBuffer — pdf.js may transfer/detach the one it is given,
 * and a view into a larger shared buffer would otherwise break a second open of the same file.
 */
function copyPdfBytes(bytes: Uint8Array): Uint8Array {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

/** Extract all non-empty text items with coordinates from every page. */
export async function extractDgPdfTextItems(
  bytes: Uint8Array,
  onProgress?: (page: number, totalPages: number) => void | Promise<void>,
): Promise<DgPdfTextItem[]> {
  const pdfjs = await loadPdfJs();
  const loadingTask = pdfjs.getDocument({ data: copyPdfBytes(bytes), useSystemFonts: true });
  const doc = await loadingTask.promise;
  const out: DgPdfTextItem[] = [];

  try {
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const vp = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      for (const raw of content.items) {
        const it = raw as { str?: string; transform?: number[] };
        const str = (it.str ?? '').trim();
        if (!str) continue;
        out.push({
          str,
          x: Math.round(it.transform?.[4] ?? 0),
          y: Math.round(vp.height - (it.transform?.[5] ?? 0)),
          page: pageNum,
        });
      }
      await onProgress?.(pageNum, doc.numPages);
    }
  } finally {
    // Release the worker document so a second drop of the same 170-page PDF can open again.
    try {
      await loadingTask.destroy();
    } catch {
      /* already torn down */
    }
  }

  return out;
}
