import { Injectable, inject } from '@angular/core';
import { AppData } from '../models/crew.models';
import { portOfCallForm02EditorUrl } from '../models/port-of-call-form-02.paths';
import { PdfDeliveryService } from './pdf-delivery.service';
import { portOfCallPdfFileName } from '../utils/pdf-filename.util';
import { captureHtmlFormPdfBytes } from '../utils/html-form-pdf-capture.util';
import { buildPortOfCallHtmlPdfSnapshot } from '../utils/port-of-call-html-pdf.util';

/**
 * 02 - Port of Call - Security — HTML form at `public/forms/port-of-call-form-02/`.
 * Electron: vector PDF via printToPDF. Browser: html2canvas fallback.
 */
@Injectable({ providedIn: 'root' })
export class PdfPortOfCallTemplateService {
  private readonly delivery = inject(PdfDeliveryService);

  /** Preview bytes without stamp/signature (overlay placement UI). */
  build(data: AppData): Promise<Uint8Array> {
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
    return portOfCallPdfFileName(ship.name, voyageDate);
  }

  private capture(data: AppData, withOverlay: boolean): Promise<Uint8Array> {
    const snapshot = buildPortOfCallHtmlPdfSnapshot(data, withOverlay, 'portsOfCall');
    const url = portOfCallForm02EditorUrl({ pdfExport: '1' });
    return captureHtmlFormPdfBytes({
      url,
      snapshot,
      iframeWidth: '210mm',
      iframeHeight: '297mm',
      pageSelector: '.a4-page',
    });
  }
}
