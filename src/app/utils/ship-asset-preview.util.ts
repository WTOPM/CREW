/** Preview URL (object URL or data URL) for stamp/signature upload UI. */
export async function shipAssetPreviewUrl(
  bytes: Uint8Array,
  fileName: string,
): Promise<string | null> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf')) {
    return renderPdfPreviewDataUrl(bytes);
  }
  const mime = lower.endsWith('.png')
    ? 'image/png'
    : lower.endsWith('.jpg') || lower.endsWith('.jpeg')
      ? 'image/jpeg'
      : 'image/png';
  const blob = new Blob([copyBytes(bytes)], { type: mime });
  return URL.createObjectURL(blob);
}

function copyBytes(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function renderPdfPreviewDataUrl(bytes: Uint8Array): Promise<string | null> {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await getDocument({ data: copyBytes(bytes) }).promise;
  const page = await doc.getPage(1);
  const base = page.getViewport({ scale: 1 });
  const maxW = 220;
  const maxH = 110;
  const scale = Math.min(maxW / base.width, maxH / base.height, 2);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL('image/png');
}

export function revokeShipAssetPreviewUrl(url: string | null | undefined): void {
  if (url?.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}
