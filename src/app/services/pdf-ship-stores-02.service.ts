import { Injectable, inject } from '@angular/core';
import { AppData } from '../models/crew.models';
import { shipStoresForm02EditorUrl } from '../models/ship-stores-form-02.paths';
import { PdfDeliveryService } from './pdf-delivery.service';
import { shipStores02PdfFileName } from '../utils/pdf-filename.util';
import { captureHtmlFormPdfBytes } from '../utils/html-form-pdf-capture.util';
import { buildShipStoresHtmlPdfSnapshot } from '../utils/ship-stores-html-pdf.util';

/**
 * 02 - Ship Stores Long — HTML form at `public/forms/ship-stores-form-02/`.
 */
@Injectable({ providedIn: 'root' })
export class PdfShipStores02Service {
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
    const voyageDate = ship.dateOfArrival || ship.dateOfDeparture;
    return shipStores02PdfFileName(ship.name, voyageDate);
  }

  private capture(data: AppData, withOverlay: boolean): Promise<Uint8Array> {
    const snapshot = buildShipStoresHtmlPdfSnapshot(data, withOverlay, '02');
    const url = shipStoresForm02EditorUrl({ pdfExport: '1' });
    return captureHtmlFormPdfBytes({
      url,
      snapshot,
      iframeWidth: '210mm',
      iframeHeight: '297mm',
      pageSelector: '.a4-page',
    });
  }
}
