import { Injectable, inject } from '@angular/core';
import { openPdfBlobPreview } from '../utils/pdf-blob.util';
import { appendTodayDate } from '../utils/pdf-filename.util';
import { uint8ToBase64 } from '../utils/base64.util';
import { StorageService } from './storage.service';
import { ToastService } from './toast.service';
import { ConfirmDialogService } from './confirm-dialog.service';
import { FolderAccessService } from './folder-access.service';

/**
 * Single delivery point for generated PDFs.
 * - "Save to folder" off  → open a blob preview (legacy behaviour).
 * - "Save to folder" on    → write the file (Electron) or download it (browser)
 *   under a name that ends with today's date, and ALSO open the preview.
 */
@Injectable({ providedIn: 'root' })
export class PdfDeliveryService {
  private readonly storage = inject(StorageService);
  private readonly toast = inject(ToastService);
  private readonly folderAccess = inject(FolderAccessService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  async deliver(bytes: Uint8Array, fileName: string): Promise<boolean> {
    const settings = this.storage.outputSettings();
    // Always open the document; additionally save it when "Save to folder" is on.
    const opened = openPdfBlobPreview(bytes);
    if (settings.saveToFolder) {
      await this.saveToFolder(bytes, appendTodayDate(fileName), settings.activePath);
    }
    return opened;
  }

  /** Open a PDF in its own window/tab. */
  openBytes(bytes: Uint8Array): boolean {
    return openPdfBlobPreview(bytes);
  }

  /**
   * Save to the active folder when "Save to folder" is on (today's date appended).
   * Returns true if a save was attempted (used by batch open/print).
   */
  async saveBytesIfEnabled(bytes: Uint8Array, fileName: string): Promise<boolean> {
    const settings = this.storage.outputSettings();
    if (!settings.saveToFolder) return false;
    await this.saveToFolder(bytes, appendTodayDate(fileName), settings.activePath);
    return true;
  }

  private async saveToFolder(bytes: Uint8Array, fileName: string, dirPath: string): Promise<void> {
    const electron = window.electronAPI;

    // Desktop (Electron): write to the typed absolute path.
    if (electron) {
      if (!dirPath) {
        this.toast.showError('Choose an output folder first');
        return;
      }
      try {
        const exists = await electron.pdfExists(dirPath, fileName);
        if (exists && !(await this.confirmOverwrite(fileName, dirPath))) {
          this.toast.showCancelled('PDF save cancelled');
          return;
        }
        const base64 = uint8ToBase64(bytes);
        const { fullPath } = await electron.savePdfToPath(dirPath, fileName, base64);
        this.toast.show(`${exists ? 'PDF overwritten' : 'PDF saved'}: ${fullPath}`, 'success');
      } catch (err) {
        this.toast.showError(
          err instanceof Error ? `Save failed: ${err.message}` : 'Failed to save PDF',
        );
      }
      return;
    }

    // Website (Chrome/Edge): write into the folder the user granted access to.
    if (this.folderAccess.supported) {
      if (!this.folderAccess.hasFolder()) {
        this.toast.showError('Choose an output folder first (Browse)');
        return;
      }
      try {
        const exists = await this.folderAccess.fileExists(fileName);
        if (exists && !(await this.confirmOverwrite(fileName, this.folderAccess.activeName()))) {
          this.toast.showCancelled('PDF save cancelled');
          return;
        }
        const saved = await this.folderAccess.write(fileName, bytes);
        this.toast.show(`${exists ? 'PDF overwritten' : 'PDF saved'}: ${saved}`, 'success');
      } catch (err) {
        this.toast.showError(
          err instanceof Error ? `Save failed: ${err.message}` : 'Failed to save PDF',
        );
      }
      return;
    }

    // Older browsers: no folder access — download with the proper name.
    this.downloadNamed(bytes, fileName);
  }

  private async confirmOverwrite(fileName: string, location: string): Promise<boolean> {
    return this.confirmDialog.confirm({
      title: 'Overwrite file',
      message: `A file named "${fileName}" already exists in "${location}".\n\nOverwrite it?`,
      confirmLabel: 'Overwrite',
      variant: 'danger',
    });
  }

  private downloadNamed(bytes: Uint8Array, fileName: string): void {
    const blob = new Blob([bytes.slice()], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    this.toast.show(`Downloaded: ${fileName}`, 'success');
  }
}
