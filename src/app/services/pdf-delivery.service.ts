import { Injectable, inject } from '@angular/core';
import { openPdfBlobPreview } from '../utils/pdf-blob.util';
import { appendTodayDate } from '../utils/pdf-filename.util';
import { StorageService } from './storage.service';
import { ToastService } from './toast.service';
import { FolderAccessService } from './folder-access.service';

/** Convert PDF bytes to base64 in chunks (avoids call-stack limits on large files). */
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

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

  async deliver(bytes: Uint8Array, fileName: string): Promise<boolean> {
    const settings = this.storage.outputSettings();
    const named = appendTodayDate(fileName);

    if (settings.saveToFolder) {
      // Save mode: write to the folder only, do not open a preview tab.
      await this.saveToFolder(bytes, named, settings.activePath);
      return true;
    }

    return openPdfBlobPreview(bytes);
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
        if (exists && !this.confirmOverwrite(fileName, dirPath)) {
          this.toast.show('Save cancelled', 'info');
          return;
        }
        const base64 = uint8ToBase64(bytes);
        const { fullPath } = await electron.savePdfToPath(dirPath, fileName, base64);
        this.toast.show(`${exists ? 'Overwritten' : 'Saved'}: ${fullPath}`, 'success');
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
        if (exists && !this.confirmOverwrite(fileName, this.folderAccess.activeName())) {
          this.toast.show('Save cancelled', 'info');
          return;
        }
        const saved = await this.folderAccess.write(fileName, bytes);
        this.toast.show(`${exists ? 'Overwritten' : 'Saved'}: ${saved}`, 'success');
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

  private confirmOverwrite(fileName: string, location: string): boolean {
    return window.confirm(
      `A file named "${fileName}" already exists in "${location}".\n\nOverwrite it?`,
    );
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
