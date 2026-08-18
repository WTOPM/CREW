import { Injectable, inject } from '@angular/core';
import { openExcelBytes } from '../utils/excel-open.util';
import { PdfDeliveryService } from './pdf-delivery.service';
import { StorageService } from './storage.service';

/** Open Excel exports and optionally save to the active output folder (same as PDF). */
@Injectable({ providedIn: 'root' })
export class ExcelDeliveryService {
  private readonly storage = inject(StorageService);
  private readonly delivery = inject(PdfDeliveryService);

  async deliver(bytes: Uint8Array, fileName: string): Promise<boolean> {
    if (this.storage.outputSettings().saveToFolder) {
      await this.delivery.saveBytesIfEnabled(bytes, fileName);
    }
    return openExcelBytes(fileName, bytes);
  }
}
