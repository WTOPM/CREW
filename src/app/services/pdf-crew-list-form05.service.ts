import { Injectable, inject } from '@angular/core';
import { AppData, CrewMember } from '../models/crew.models';
import { PdfDeliveryService } from './pdf-delivery.service';
import { crewListForm05PdfFileName } from '../utils/pdf-filename.util';

/**
 * Form 05 - CREW LIST [SBK][E] is authored as an HTML page (test-crew-list.html), not a
 * pdf-lib template. To match every other crew-list form's UX — a PDF generated and opened
 * in its own window, no print dialog — this renders that page in a hidden iframe and
 * captures it to a real PDF with jsPDF/html2canvas (already app dependencies), then delivers
 * the bytes through the same PdfDeliveryService as every other form.
 */
@Injectable({ providedIn: 'root' })
export class PdfCrewListForm05Service {
  private readonly delivery = inject(PdfDeliveryService);

  async openPreview(data: AppData, crew: CrewMember[], isArrival: boolean): Promise<boolean> {
    const mode = isArrival ? 'arrival' : 'departure';
    const snapshot = this.buildSnapshot(data, crew);
    const url = `/test-crew-list.html?mode=${mode}&pdfExport=1&data=${encodeURIComponent(JSON.stringify(snapshot))}`;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.left = '-10000px';
    iframe.style.top = '0';
    iframe.style.width = '900px';
    iframe.style.height = '1300px';
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

      const pageEl = iframe.contentDocument?.querySelector<HTMLElement>('.a4-page');
      if (!pageEl) {
        throw new Error('Crew List form failed to render');
      }

      const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ]);
      // foreignObjectRendering hands painting to the browser engine itself rather than
      // html2canvas's manual canvas-painting path, which: mangles `writing-mode: vertical-rl`
      // text (the side label) into garbage glyphs, doubles up collapsed table borders, and
      // drops `mix-blend-mode` overlays (the stamp/signature) entirely.
      const canvas = await html2canvas(pageEl, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        foreignObjectRendering: true,
      });

      // Fit the captured page as a single full-bleed image on one A4 page — avoids
      // jsPDF's doc.html() autopaging, which mis-scales text into dozens of pages.
      const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const imgHeight = (canvas.height * pageWidth) / canvas.width;
      doc.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pageWidth, imgHeight);

      const bytes = new Uint8Array(doc.output('arraybuffer'));
      return this.delivery.deliver(bytes, this.fileName(data, isArrival));
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
    };
  }
}
