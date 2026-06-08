import { uint8ToBase64 } from './base64.util';

/** Open an .xlsx file with the system default app (Excel), or download in the browser. */
export async function openExcelBytes(fileName: string, bytes: Uint8Array): Promise<boolean> {
  const safeName = fileName.toLowerCase().endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
  const electron = window.electronAPI;

  if (electron?.openTempFile) {
    const res = await electron.openTempFile(safeName, uint8ToBase64(bytes));
    return !!res?.ok;
  }

  const blob = new Blob([bytes as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = safeName;
  link.click();
  URL.revokeObjectURL(url);
  return true;
}
