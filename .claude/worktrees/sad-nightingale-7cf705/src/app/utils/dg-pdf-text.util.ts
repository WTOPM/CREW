import { loadPdfJs } from './crew-list-pdfjs.util';

/** Positioned text line from a PDF page (top-left origin, pt). */
export interface DgPdfTextItem {
  str: string;
  x: number;
  y: number;
  page: number;
}

function copyPdfBytes(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** Extract all non-empty text items with coordinates from every page. */
export async function extractDgPdfTextItems(bytes: Uint8Array): Promise<DgPdfTextItem[]> {
  const pdfjs = await loadPdfJs();
  const doc = await pdfjs.getDocument({ data: copyPdfBytes(bytes), useSystemFonts: true }).promise;
  const out: DgPdfTextItem[] = [];

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
  }

  return out;
}
