import { Injectable, inject } from '@angular/core';
import { buildDgManifestExcelBytes } from '../utils/dg-manifest-excel-layout.util';
import { openExcelBytes } from '../utils/excel-open.util';
import { pdfFileDate, pdfFileToken } from '../utils/pdf-filename.util';
import type { DgManifestExportContext } from '../models/dg-manifest-export.models';
import { StorageService } from './storage.service';

@Injectable({ providedIn: 'root' })
export class DgManifestExcelService {
  private readonly storage = inject(StorageService);

  async openManifest(exportContext?: DgManifestExportContext): Promise<boolean> {
    const ship = this.storage.ship();
    const library = this.storage.dgLibrary();
    const crew = this.storage.allCrew();
    const ports = this.storage.ports();
    const bytes = await buildDgManifestExcelBytes(ship, crew, library, ports, exportContext);
    const fileName = this.fileName(ship.name, ship.dateOfDeparture);
    return openExcelBytes(fileName, bytes);
  }

  private fileName(shipName: string, departureDate: string): string {
    const token = pdfFileToken(shipName, 'vessel');
    const date = pdfFileDate(departureDate);
    return `DG_Manifest_${token}_${date}.xlsx`;
  }
}
