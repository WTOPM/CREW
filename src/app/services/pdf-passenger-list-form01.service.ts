import { Injectable, inject } from '@angular/core';
import { AppData } from '../models/crew.models';
import { PassengerMember } from '../models/passenger.models';
import { passengerListForm01EditorUrl } from '../models/passenger-list-form-01.paths';
import { passengersToCrewRows } from '../utils/passenger-pdf.util';
import { passengerListPdfFileName } from '../utils/pdf-filename.util';
import { voyageDateByArrivalFlag } from '../utils/voyage-date.util';
import { captureHtmlFormPdfBytes } from '../utils/html-form-pdf-capture.util';
import { PdfDeliveryService } from './pdf-delivery.service';

/**
 * Form 01 - IMO PASSENGER LIST - P ID — HTML editor at `public/forms/passenger-list-form-01/`.
 * Electron: vector PDF via printToPDF. Browser: html2canvas fallback.
 */
@Injectable({ providedIn: 'root' })
export class PdfPassengerListForm01Service {
  private readonly delivery = inject(PdfDeliveryService);

  async openPreview(
    data: AppData,
    passengers: PassengerMember[],
    isArrival: boolean,
  ): Promise<boolean> {
    const bytes = await this.buildPdfBytes(data, passengers, isArrival);
    return this.delivery.deliver(bytes, this.fileName(data, isArrival));
  }

  async buildPdfBytes(
    data: AppData,
    passengers: PassengerMember[],
    isArrival: boolean,
  ): Promise<Uint8Array> {
    const mode = isArrival ? 'arrival' : 'departure';
    const snapshot = this.buildSnapshot(data, passengers);
    const url = passengerListForm01EditorUrl({
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
    return passengerListPdfFileName(ship.name, ship.portOfCall, voyageDate, isArrival);
  }

  private buildSnapshot(data: AppData, passengers: PassengerMember[]) {
    const rows = passengersToCrewRows(passengers);
    return {
      ship: data.ship,
      ports: data.ports.map((p) => ({ name: p.name, country: p.country })),
      crew: rows.map((c) => ({
        familyName: c.familyName,
        givenNames: c.givenNames,
        rank: c.rank,
        nationality: c.nationality,
        dateOfBirth: c.dateOfBirth,
        placeOfBirth: c.placeOfBirth,
        passport: c.passport,
      })),
      allCrew: data.crew.map((c) => ({
        familyName: c.familyName,
        givenNames: c.givenNames,
        rank: c.rank,
      })),
      documentOverlay: data.documentOverlay,
    };
  }
}
