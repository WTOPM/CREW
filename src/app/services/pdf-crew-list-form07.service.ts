import { Injectable, inject } from '@angular/core';
import { AppData, CrewMember } from '../models/crew.models';
import { PdfDeliveryService } from './pdf-delivery.service';
import { crewListForm07EditorUrl } from '../models/crew-list-form-07.paths';
import { crewListForm07PdfFileName } from '../utils/pdf-filename.util';
import { voyageDateByArrivalFlag } from '../utils/voyage-date.util';
import { captureHtmlFormPdfBytes } from '../utils/html-form-pdf-capture.util';

/**
 * Form 07 - CREW LIST [SBK][PI][E][P][PI][E] — HTML editor at `public/forms/crew-list-form-07/`.
 * Landscape A4. Electron: vector PDF via printToPDF. Browser: html2canvas fallback.
 */
@Injectable({ providedIn: 'root' })
export class PdfCrewListForm07Service {
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
    const snapshot = this.buildSnapshot(data, crew);
    const url = crewListForm07EditorUrl({
      mode: isArrival ? 'arrival' : 'departure',
      pdfExport: '1',
    });

    return captureHtmlFormPdfBytes({
      url,
      snapshot,
      iframeWidth: '297mm',
      iframeHeight: '210mm',
      pageSelector: '.a4-landscape-page',
      landscape: true,
    });
  }

  fileName(data: AppData, isArrival: boolean): string {
    const { ship } = data;
    const voyageDate = voyageDateByArrivalFlag(ship, isArrival);
    return crewListForm07PdfFileName(ship.name, ship.portOfCall, voyageDate, isArrival);
  }

  /** Minimal AppData slice the HTML form reads — already filtered/ordered by the caller. */
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
        passport: c.passport,
        passportPlaceOfIssue: c.passportPlaceOfIssue,
        passportExpiryDate: c.passportExpiryDate,
        seamansBook: c.seamansBook,
        seamansBookPlaceOfIssue: c.seamansBookPlaceOfIssue,
        sbookExpiryDate: c.sbookExpiryDate,
      })),
      documentOverlay: data.documentOverlay,
    };
  }
}
