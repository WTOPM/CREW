import { Injectable, inject } from '@angular/core';
import { AppData } from '../models/crew.models';
import { nilListFormEditorUrl } from '../models/nil-list-form.paths';
import { PdfDeliveryService } from './pdf-delivery.service';
import { nilListPdfFileName } from '../utils/pdf-filename.util';
import { arrivalVoyageDate } from '../utils/voyage-date.util';
import { captureHtmlFormPdfBytes } from '../utils/html-form-pdf-capture.util';
import { buildNilListHtmlPdfSnapshot } from '../utils/nil-list-html-pdf.util';

/**
 * NIL List — HTML form at `public/forms/nil-list-form/`.
 * Electron: vector PDF via printToPDF. Browser: html2canvas fallback.
 */
@Injectable({ providedIn: 'root' })
export class PdfNilListService {
  private readonly delivery = inject(PdfDeliveryService);

  buildPdfBytes(data: AppData): Promise<Uint8Array> {
    return this.capture(data, false);
  }

  /** @deprecated Use buildPdfBytes — kept for overlay preview callers. */
  build(data: AppData): Promise<Uint8Array> {
    return this.buildPdfBytes(data);
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
    const voyageDate = arrivalVoyageDate(ship);
    return nilListPdfFileName(ship.name, voyageDate);
  }

  private capture(data: AppData, withOverlay: boolean): Promise<Uint8Array> {
    const snapshot = buildNilListHtmlPdfSnapshot(data, withOverlay);
    const url = nilListFormEditorUrl({ pdfExport: '1' });
    return captureHtmlFormPdfBytes({
      url,
      snapshot,
      iframeWidth: '210mm',
      iframeHeight: '297mm',
      pageSelector: '.nil-page',
    });
  }
}
