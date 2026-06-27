import { Injectable, inject } from '@angular/core';
import { AppData, CrewMember } from '../models/crew.models';
import { PdfDeliveryService } from './pdf-delivery.service';
import { crewListForm07EditorUrl } from '../models/crew-list-form-07.paths';
import { crewListForm07PdfFileName } from '../utils/pdf-filename.util';
import { captureHtmlFormFromUrl } from '../utils/html-form-pdf-capture.util';

/**
 * Form 07 - CREW LIST [SBK][PI][E][P][PI][E] — HTML editor at `public/forms/crew-list-form-07/`, not a
 * pdf-lib template. Landscape A4 via hidden iframe → html2canvas + jsPDF → PdfDeliveryService.
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
      data: JSON.stringify(snapshot),
    });

    const canvas = await captureHtmlFormFromUrl({
      url,
      iframeWidth: '297mm',
      iframeHeight: '210mm',
      pageSelector: '.a4-landscape-page',
    });

    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pageWidth, pageHeight);
    return new Uint8Array(doc.output('arraybuffer'));
  }

  fileName(data: AppData, isArrival: boolean): string {
    const { ship } = data;
    const voyageDate = isArrival ? ship.dateOfArrival : ship.dateOfDeparture;
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
