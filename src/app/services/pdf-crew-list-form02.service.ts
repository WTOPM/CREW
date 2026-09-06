import { Injectable, inject } from '@angular/core';
import { AppData, CrewMember, CREW_IDENTITY_SEAMANS_BOOK } from '../models/crew.models';
import { PdfDeliveryService } from './pdf-delivery.service';
import { crewListForm02EditorUrl } from '../models/crew-list-form-02.paths';
import { crewListIdentityPdfFileName } from '../utils/pdf-filename.util';
import { voyageDateByArrivalFlag } from '../utils/voyage-date.util';
import { captureHtmlFormPdfBytes } from '../utils/html-form-pdf-capture.util';

/**
 * Form 02 - IMO CREW LIST - SBK — HTML editor at `public/forms/crew-list-form-02/`.
 * Electron: vector PDF via printToPDF. Browser: html2canvas fallback.
 */
@Injectable({ providedIn: 'root' })
export class PdfCrewListForm02Service {
  private readonly delivery = inject(PdfDeliveryService);

  async openPreview(data: AppData, crew: CrewMember[], isArrival: boolean): Promise<boolean> {
    const bytes = await this.buildPdfBytes(data, crew, isArrival);
    return this.delivery.deliver(bytes, this.fileName(data, isArrival));
  }

  async buildPdfBytes(
    data: AppData,
    crew: CrewMember[],
    isArrival: boolean,
  ): Promise<Uint8Array> {
    const mode = isArrival ? 'arrival' : 'departure';
    const snapshot = this.buildSnapshot(data, crew);
    const url = crewListForm02EditorUrl({
      mode,
      pdfExport: '1',
    });

    return captureHtmlFormPdfBytes({
      url,
      snapshot,
      iframeWidth: '210mm',
      iframeHeight: '297mm',
      pageSelector: '.a4-page',
    });
  }

  fileName(data: AppData, isArrival: boolean): string {
    const { ship } = data;
    const voyageDate = voyageDateByArrivalFlag(ship, isArrival);
    return crewListIdentityPdfFileName(
      ship.name,
      ship.portOfCall,
      voyageDate,
      isArrival,
      CREW_IDENTITY_SEAMANS_BOOK,
    );
  }

  private buildSnapshot(data: AppData, crew: CrewMember[]) {
    return {
      ship: data.ship,
      ports: data.ports.map((p) => ({ name: p.name, country: p.country })),
      crew: crew.map((c) => ({
        familyName: c.familyName,
        givenNames: c.givenNames,
        rank: c.rank,
        nationality: c.nationality,
        dateOfBirth: c.dateOfBirth,
        placeOfBirth: c.placeOfBirth,
        seamansBook: c.seamansBook,
      })),
      documentOverlay: data.documentOverlay,
    };
  }
}
