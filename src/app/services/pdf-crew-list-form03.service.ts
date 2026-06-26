import { Injectable, inject } from '@angular/core';
import { AppData, CrewMember } from '../models/crew.models';
import { PdfDeliveryService } from './pdf-delivery.service';
import { crewListForm03EditorUrl } from '../models/crew-list-form-03.paths';
import { crewListType2PdfFileName } from '../utils/pdf-filename.util';
import { captureHtmlFormFromUrl } from '../utils/html-form-pdf-capture.util';

/**
 * Form 03 - IMO CREW LIST [P][SBK][J][T] — HTML editor at `public/forms/crew-list-form-03/`.
 * Landscape A4 via html2canvas + jsPDF.
 */
@Injectable({ providedIn: 'root' })
export class PdfCrewListForm03Service {
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
    const url = crewListForm03EditorUrl({
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
    return crewListType2PdfFileName(ship.name, ship.portOfCall, voyageDate, isArrival);
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
        passport: c.passport,
        seamansBook: c.seamansBook,
        joiningDate: c.joiningDate,
        joiningPort: c.joiningPort,
      })),
      documentOverlay: data.documentOverlay,
    };
  }
}
