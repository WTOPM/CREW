/** Open raw PDF bytes in a new browser tab (preview only). */
export function openPdfBlobPreview(bytes: Uint8Array): boolean {
  const blob = new Blob([bytes.slice()], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) {
    URL.revokeObjectURL(url);
    return false;
  }
  win.addEventListener('beforeunload', () => URL.revokeObjectURL(url));
  return true;
}
