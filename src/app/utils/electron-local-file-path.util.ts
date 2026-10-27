/**
 * Absolute path for a File from Electron drag/drop or file input.
 * Electron 32+ removed File.path — use preload webUtils.getPathForFile.
 */
export function electronLocalFilePath(file: File | null | undefined): string {
  if (!file) return '';
  const api = window.electronAPI;
  if (api?.getPathForFile) {
    try {
      return String(api.getPathForFile(file) || '').trim();
    } catch {
      /* fall through */
    }
  }
  // Legacy Electron / non-sandboxed: File.path may still exist.
  const legacy = (file as File & { path?: string }).path;
  return typeof legacy === 'string' ? legacy.trim() : '';
}
