import { Injectable, inject } from '@angular/core';
import { AppData } from '../models/crew.models';
import { crewEffectForm02EditorUrl } from '../models/crew-effect-form-02.paths';
import { PdfDeliveryService } from './pdf-delivery.service';
import { crewEffect02PdfFileName } from '../utils/pdf-filename.util';
import { captureHtmlFormPdfBytes } from '../utils/html-form-pdf-capture.util';
import { buildCrewEffect02HtmlPdfSnapshot } from '../utils/crew-effect-02-html-pdf.util';

/**
 * 02 - Crew Effect — HTML form at `public/forms/crew-effect-form-02/`.
 */
@Injectable({ providedIn: 'root' })
export class PdfCrewEffect02Service {
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
    return crewEffect02PdfFileName(ship.name, voyageDate);
  }

  private capture(data: AppData, withOverlay: boolean): Promise<Uint8Array> {
    const snapshot = buildCrewEffect02HtmlPdfSnapshot(data, withOverlay);
    const url = crewEffectForm02EditorUrl({ pdfExport: '1' });
    return captureHtmlFormPdfBytes({
      url,
      snapshot,
      iframeWidth: '210mm',
      iframeHeight: '297mm',
      pageSelector: '.ced-sheet',
    });
  }
}
