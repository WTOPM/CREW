import { Injectable, inject } from '@angular/core';
import { AppData, CrewMember } from '../models/crew.models';
import { PdfDeliveryService } from './pdf-delivery.service';
import { crewListForm04EditorUrl } from '../models/crew-list-form-04.paths';
import { crewListV2PdfFileName } from '../utils/pdf-filename.util';

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
      data: JSON.stringify(snapshot),
    });

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.left = '-10000px';
    iframe.style.top = '0';
    iframe.style.width = '210mm';
    iframe.style.height = '297mm';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    try {
      await new Promise<void>((resolve, reject) => {
        iframe.addEventListener('load', () => resolve(), { once: true });
        iframe.addEventListener('error', () => reject(new Error('Failed to load Crew List form 04')), {
          once: true,
        });
        iframe.src = url;
      });

      const frameWindow = iframe.contentWindow as (Window & { __pdfReady?: boolean }) | null;
      const deadline = Date.now() + 8000;
      while (!frameWindow?.__pdfReady && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 80));
      }

      const frameDoc = iframe.contentDocument;
      if (!frameDoc?.querySelector('.a4-page')) {
        throw new Error('Crew List form 04 failed to render');
      }

      const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ]);

      const canvas = await html2canvas(frameDoc.body, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        foreignObjectRendering: true,
      });

      const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const imgHeight = (canvas.height * pageWidth) / canvas.width;
      doc.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pageWidth, imgHeight);

      return new Uint8Array(doc.output('arraybuffer'));
    } finally {
      iframe.remove();
    }
  }

  fileName(data: AppData, isArrival: boolean): string {
    const { ship } = data;
    const voyageDate = isArrival ? ship.dateOfArrival : ship.dateOfDeparture;
    return crewListV2PdfFileName(ship.name, ship.portOfCall, voyageDate, isArrival);
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
