import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { openExcelBytes } from '../utils/excel-open.util';
import {
  getOutputFolderPrefs,
  outputFolderSectionFromRoute,
} from '../utils/output-folder-section.util';
import { PdfDeliveryService } from './pdf-delivery.service';
import { StorageService } from './storage.service';

/** Open Excel exports and optionally save to the active output folder (same as PDF). */
@Injectable({ providedIn: 'root' })
export class ExcelDeliveryService {
  private readonly storage = inject(StorageService);
  private readonly delivery = inject(PdfDeliveryService);
  private readonly router = inject(Router);

  async deliver(bytes: Uint8Array, fileName: string): Promise<boolean> {
    const section = outputFolderSectionFromRoute(this.router.url);
    const prefs = section ? getOutputFolderPrefs(this.storage.outputSettings(), section) : null;
    if (prefs?.saveToFolder) {
      await this.delivery.saveBytesIfEnabled(bytes, fileName);
    }
    return openExcelBytes(fileName, bytes);
  }
}
