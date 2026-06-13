import { Injectable, inject } from '@angular/core';
import { buildDgManifestPdfBytes } from '../utils/dg-manifest-pdf.util';
import { pdfFileDate, pdfFileToken } from '../utils/pdf-filename.util';
import type { DgManifestExportContext } from '../models/dg-manifest-export.models';
import { PdfDeliveryService } from './pdf-delivery.service';
import { StorageService } from './storage.service';

@Injectable({ providedIn: 'root' })
export class DgManifestPdfService {
  private readonly storage = inject(StorageService);
  private readonly delivery = inject(PdfDeliveryService);

  async openManifest(exportContext?: DgManifestExportContext): Promise<boolean> {
    const ship = this.storage.ship();
    const library = this.storage.dgLibrary();
    const crew = this.storage.allCrew();
    const ports = this.storage.ports();
    const bytes = buildDgManifestPdfBytes(ship, crew, library, ports, exportContext);
    const fileName = this.fileName(ship.name, ship.dateOfDeparture);
    return this.delivery.deliver(bytes, fileName);
  }

  private fileName(shipName: string, departureDate: string): string {
    const token = pdfFileToken(shipName, 'vessel');
    const date = pdfFileDate(departureDate);
    return `DG_Manifest_${token}_${date}.pdf`;
  }
}
