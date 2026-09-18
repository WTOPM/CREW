import { Injectable, inject } from '@angular/core';
import { pdfFileDate, pdfFileToken } from '../utils/pdf-filename.util';
import { PdfDeliveryService } from './pdf-delivery.service';
import { StorageService } from './storage.service';

/**
 * DEP REP PDF = Excel's own ExportAsFixedFormat (Print → PDF) for the named sheet.
 * Does not invent a layout — uses the sheet print area / page setup as in Excel.
 */
@Injectable({ providedIn: 'root' })
export class PdfDepRepService {
  private readonly delivery = inject(PdfDeliveryService);
  private readonly storage = inject(StorageService);

  async openFromExcel(filePath: string, sheetName: string): Promise<boolean> {
    const electron = window.electronAPI;
    if (!electron?.exportDepRepPdf) {
      throw new Error('Excel PDF export requires the desktop app');
    }
    const result = await electron.exportDepRepPdf(filePath, sheetName);
    if (!result.ok || !result.base64) {
      throw new Error(result.error || 'Excel PDF export failed');
    }
    const bytes = base64ToUint8(result.base64);
    const ship = this.storage.ship();
    const fileName = this.fileName(ship.name, ship.dateOfDeparture, sheetName);
    return this.delivery.deliver(bytes, fileName);
  }

  private fileName(shipName: string, departureDate: string, sheetName: string): string {
    const token = pdfFileToken(shipName, 'vessel');
    const date = pdfFileDate(departureDate);
    const sheet = sheetName.trim().replace(/[^\w.-]+/g, '_') || 'sheet';
    return `DEP_REP_${token}_${sheet}_${date}.pdf`;
  }
}

function base64ToUint8(base64: string): Uint8Array {
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
