import { Injectable, inject } from '@angular/core';
import { ConfirmDialogService } from './confirm-dialog.service';
import { ToastService } from './toast.service';

/**
 * Open a stored DG source PDF path, or prompt the user to relocate it
 * when the file is missing (other PC / deleted file).
 */
@Injectable({ providedIn: 'root' })
export class DgManifestSourcePdfService {
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);

  async openOrRelink(
    currentPath: string,
    options?: { label?: string },
  ): Promise<{ path: string; relocated: boolean } | null> {
    const electron = window.electronAPI;
    if (!electron?.openFilePath || !electron.pathExists || !electron.pickPdfFile) {
      this.toast.showError('Opening the source PDF requires the desktop app');
      return null;
    }

    const label = options?.label?.trim() || 'this manifest';
    let path = currentPath.trim();

    if (path) {
      const exists = await electron.pathExists(path);
      if (exists) {
        const opened = await electron.openFilePath(path);
        if (opened.ok) return { path, relocated: false };
        this.toast.showError(opened.error || 'Could not open PDF');
        return null;
      }
    }

    const ok = await this.confirmDialog.confirm({
      title: 'PDF not found',
      message: path
        ? `The source PDF for ${label} was not found:\n${path}\n\nLocate the file on this computer?`
        : `No source PDF path is stored for ${label} (e.g. after copying a save to another PC).\n\nLocate the PDF now?`,
      confirmLabel: 'Locate PDF…',
      cancelLabel: 'Cancel',
    });
    if (!ok) return null;

    const picked = await electron.pickPdfFile(path || undefined);
    if (!picked) return null;
    const opened = await electron.openFilePath(picked);
    if (!opened.ok) {
      this.toast.showError(opened.error || 'Could not open PDF');
      return null;
    }
    return { path: picked, relocated: true };
  }

  async pickPdfPath(defaultPath?: string): Promise<string | null> {
    const electron = window.electronAPI;
    if (!electron?.pickPdfFile) {
      this.toast.showError('Choosing a PDF path requires the desktop app');
      return null;
    }
    return electron.pickPdfFile(defaultPath?.trim() || undefined);
  }
}
