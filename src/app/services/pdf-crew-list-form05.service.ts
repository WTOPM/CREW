import { Injectable, inject } from '@angular/core';
import { AppData, CrewMember } from '../models/crew.models';
import { PdfDeliveryService } from './pdf-delivery.service';
import { crewListForm05EditorUrl } from '../models/crew-list-form-05.paths';
import { crewListForm05PdfFileName } from '../utils/pdf-filename.util';

/**
 * Form 05 - CREW LIST [SBK][E] — HTML editor at `public/forms/crew-list-form-05/`, not a
 * pdf-lib template. Renders that page in a hidden iframe, captures with jsPDF/html2canvas,
 * then delivers bytes through PdfDeliveryService like every other form.
 */
@Injectable({ providedIn: 'root' })
export class PdfCrewListForm05Service {
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
    const url = crewListForm05EditorUrl({
      mode,
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
        iframe.addEventListener('error', () => reject(new Error('Failed to load Crew List form')), {
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
        throw new Error('Crew List form failed to render');
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
    return crewListForm05PdfFileName(ship.name, ship.portOfCall, voyageDate, isArrival);
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
        seamansBook: c.seamansBook,
        sbookExpiryDate: c.sbookExpiryDate,
      })),
      documentOverlay: data.documentOverlay,
    };
  }
}
