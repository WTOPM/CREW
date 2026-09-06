import { Injectable, inject } from '@angular/core';
import { AppData } from '../models/crew.models';
import { shipStoresForm01EditorUrl } from '../models/ship-stores-form-01.paths';
import { PdfDeliveryService } from './pdf-delivery.service';
import { shipStoresPdfFileName } from '../utils/pdf-filename.util';
import { voyageDateByArrivalFlag } from '../utils/voyage-date.util';
import { captureHtmlFormPdfBytes } from '../utils/html-form-pdf-capture.util';
import { buildShipStoresHtmlPdfSnapshot } from '../utils/ship-stores-html-pdf.util';

/**
 * 01 - Ship Stores Short — HTML form at `public/forms/ship-stores-form-01/`.
 * Electron: vector PDF via printToPDF. Browser: html2canvas fallback.
 */
@Injectable({ providedIn: 'root' })
export class PdfShipStoresService {
  private readonly delivery = inject(PdfDeliveryService);

  buildPdfBytes(data: AppData): Promise<Uint8Array> {
    return this.capture(data, false);
  }

  buildFinalBytes(data: AppData): Promise<Uint8Array> {
    return this.capture(data, true);
  }

  async openPreview(data: AppData): Promise<boolean> {
    const bytes = await this.buildFinalBytes(data);
    return this.delivery.deliver(bytes, this.fileName(data));
  }

  fileName(data: AppData): string {
    const { ship } = data;
    const cv = data.documentOverlay?.shipStores?.cellValues ?? {};
    const isArrival = cv['_ssMode'] !== 'departure';
    const voyageDate = voyageDateByArrivalFlag(ship, isArrival);
    return shipStoresPdfFileName(ship.name, voyageDate);
  }

  private capture(data: AppData, withOverlay: boolean): Promise<Uint8Array> {
    const snapshot = buildShipStoresHtmlPdfSnapshot(data, withOverlay, '01');
    const url = shipStoresForm01EditorUrl({ pdfExport: '1' });
    return captureHtmlFormPdfBytes({
      url,
      snapshot,
      iframeWidth: '210mm',
      iframeHeight: '297mm',
      pageSelector: '.ssd-sheet',
    });
  }
}
