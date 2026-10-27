import { Injectable, inject } from '@angular/core';
import { pdfFileDate, pdfFileToken } from '../utils/pdf-filename.util';
import { PdfDeliveryService } from './pdf-delivery.service';
import { StorageService } from './storage.service';

export interface DepRepPdfCellUpdate {
  address: string;
  kind: string;
  value?: string | number;
  formula?: string;
  iso?: string;
}

/**
 * DEP REP PDF = Excel ExportAsFixedFormat using the sheet print area.
 * Applies the current form cell updates in memory and does not save the workbook.
 */
@Injectable({ providedIn: 'root' })
export class PdfDepRepService {
  private readonly delivery = inject(PdfDeliveryService);
  private readonly storage = inject(StorageService);

  async openFromCurrent(
    filePath: string,
    payload: { sheetName: string; updates: DepRepPdfCellUpdate[] },
  ): Promise<boolean> {
    const electron = window.electronAPI;
    if (!electron?.exportDepRepPdf) {
      throw new Error('Excel PDF export requires the desktop app');
    }
    const result = await electron.exportDepRepPdf(filePath, payload);
    if (!result.ok || !result.base64) {
      throw new Error(result.error || 'Excel PDF export failed');
    }
    const bytes = base64ToUint8(result.base64);
    const ship = this.storage.ship();
    const fileName = this.fileName(ship.name, ship.dateOfDeparture, payload.sheetName);
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
