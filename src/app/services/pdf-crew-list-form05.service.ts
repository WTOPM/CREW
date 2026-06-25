import { Injectable, inject } from '@angular/core';
import { AppData, CrewMember } from '../models/crew.models';
import { PdfDeliveryService } from './pdf-delivery.service';
import { base64ToUint8 } from '../utils/base64.util';
import { crewListForm05PdfFileName } from '../utils/pdf-filename.util';

/**
 * Form 05 - CREW LIST [SBK][E] is authored as an HTML page (test-crew-list.html), not a
 * pdf-lib template. To match the other crew-list forms' UX (PDF generated and opened in its
 * own window), this renders that HTML headlessly in Electron (printToPDF) and delivers the
 * resulting bytes through the same PdfDeliveryService as every other form.
 */
@Injectable({ providedIn: 'root' })
export class PdfCrewListForm05Service {
  private readonly delivery = inject(PdfDeliveryService);

  async openPreview(data: AppData, crew: CrewMember[], isArrival: boolean): Promise<boolean> {
    const mode = isArrival ? 'arrival' : 'departure';
    const electron = window.electronAPI;

    if (!electron) {
      // Browser/dev fallback (no native PDF render available): open the printable HTML form
      // and let the browser's own print-to-PDF dialog produce the document.
      const win = window.open(`/test-crew-list.html?mode=${mode}&print=1`, '_blank');
      return !!win;
    }

    const snapshot = this.buildSnapshot(data, crew);
    const url = `/test-crew-list.html?mode=${mode}&data=${encodeURIComponent(JSON.stringify(snapshot))}`;
    const base64 = await electron.renderHtmlToPdf(url);
    const bytes = base64ToUint8(base64);
    return this.delivery.deliver(bytes, this.fileName(data, isArrival));
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
