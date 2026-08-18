import { Injectable, inject } from '@angular/core';
import { buildDgManifestExcelBytes } from '../utils/dg-manifest-excel-layout.util';
import { pdfFileDate, pdfFileToken } from '../utils/pdf-filename.util';
import type { DgManifestExportContext } from '../models/dg-manifest-export.models';
import { dgShipForExport } from '../utils/page-ship-context.util';
import { ExcelDeliveryService } from './excel-delivery.service';
import { StorageService } from './storage.service';

@Injectable({ providedIn: 'root' })
export class DgManifestExcelService {
  private readonly storage = inject(StorageService);
  private readonly delivery = inject(ExcelDeliveryService);

  async openManifest(exportContext?: DgManifestExportContext): Promise<boolean> {
    const ship = this.storage.ship();
    const library = this.storage.dgLibrary();
    const exportShip = dgShipForExport(ship, library.pageContext);
    const crew = this.storage.allCrew();
    const ports = this.storage.ports();
    const bytes = await buildDgManifestExcelBytes(exportShip, crew, library, ports, exportContext);
    const fileName = this.fileName(ship.name, exportShip.dateOfDeparture);
    return this.delivery.deliver(bytes, fileName);
  }

  private fileName(shipName: string, departureDate: string): string {
    const token = pdfFileToken(shipName, 'vessel');
    const date = pdfFileDate(departureDate);
    return `DG_Manifest_${token}_${date}.xlsx`;
  }
}
