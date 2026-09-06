import { Injectable, inject } from '@angular/core';
import { AppData } from '../models/crew.models';
import { crewEffectForm01EditorUrl } from '../models/crew-effect-form-01.paths';
import { PdfDeliveryService } from './pdf-delivery.service';
import { crewEffectPdfFileName } from '../utils/pdf-filename.util';
import { arrivalVoyageDate } from '../utils/voyage-date.util';
import { captureHtmlFormPdfBytes } from '../utils/html-form-pdf-capture.util';
import { buildCrewEffectHtmlPdfSnapshot } from '../utils/crew-effect-html-pdf.util';

/**
 * 01 - Crew Effect — HTML form at `public/forms/crew-effect-form-01/`.
 * Electron: vector PDF via printToPDF. Browser: html2canvas fallback.
 */
@Injectable({ providedIn: 'root' })
export class PdfCrewEffectService {
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
    const voyageDate = arrivalVoyageDate(ship);
    return crewEffectPdfFileName(ship.name, voyageDate);
  }

  private capture(data: AppData, withOverlay: boolean): Promise<Uint8Array> {
    const snapshot = buildCrewEffectHtmlPdfSnapshot(data, withOverlay);
    const url = crewEffectForm01EditorUrl({ pdfExport: '1' });
    return captureHtmlFormPdfBytes({
      url,
      snapshot,
      iframeWidth: '210mm',
      iframeHeight: '297mm',
      pageSelector: '.ced-sheet',
    });
  }
}
