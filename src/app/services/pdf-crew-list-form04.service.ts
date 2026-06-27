import { Injectable, inject } from '@angular/core';
import { AppData, CrewMember } from '../models/crew.models';
import { PdfDeliveryService } from './pdf-delivery.service';
import { crewListForm04EditorUrl } from '../models/crew-list-form-04.paths';
import { crewListForm04PdfFileName } from '../utils/pdf-filename.util';
import { captureHtmlFormFromUrl } from '../utils/html-form-pdf-capture.util';

/**
 * Form 04 - CREW LIST [P][E][PI][G] — HTML editor at `public/forms/crew-list-form-04/`.
 */
@Injectable({ providedIn: 'root' })
export class PdfCrewListForm04Service {
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
    const url = crewListForm04EditorUrl({
      mode: isArrival ? 'arrival' : 'departure',
      pdfExport: '1',
    });

    const canvas = await captureHtmlFormFromUrl({
      url,
      snapshot,
      iframeWidth: '210mm',
      iframeHeight: '297mm',
      pageSelector: '.a4-page',
    });

    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pageWidth, pageHeight);
    return new Uint8Array(doc.output('arraybuffer'));
  }

  fileName(data: AppData, isArrival: boolean): string {
    const { ship } = data;
    const voyageDate = isArrival ? ship.dateOfArrival : ship.dateOfDeparture;
    return crewListForm04PdfFileName(ship.name, ship.portOfCall, voyageDate, isArrival);
  }

  private buildSnapshot(data: AppData, crew: CrewMember[]) {
    return {
      ship: data.ship,
      ports: data.ports.map((p) => ({ name: p.name, country: p.country })),
      crewArr: data.crewArr,
      crew: crew.map((c) => ({
        familyName: c.familyName,
        givenNames: c.givenNames,
        rank: c.rank,
        nationality: c.nationality,
        dateOfBirth: c.dateOfBirth,
        placeOfBirth: c.placeOfBirth,
        passport: c.passport,
        passportExpiryDate: c.passportExpiryDate,
        passportPlaceOfIssue: c.passportPlaceOfIssue,
        gender: c.gender,
      })),
      documentOverlay: data.documentOverlay,
    };
  }
}
