import type { jsPDF } from 'jspdf';

/**
 * Open PDF in a new browser tab (preview only, no automatic download).
 * Note: built-in PDF viewers usually show a blob:… URL; the suggested file name
 * cannot be set in that viewer — use Save/Download from the app if we add that later.
 */
export function openPdfPreview(doc: jsPDF, _fileName?: string): boolean {
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) {
    URL.revokeObjectURL(url);
    return false;
  }
  win.addEventListener('beforeunload', () => URL.revokeObjectURL(url));
  return true;
}
