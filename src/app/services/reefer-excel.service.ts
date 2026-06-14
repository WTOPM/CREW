import { Injectable, inject } from '@angular/core';
import { buildReeferMonitoringExcelBytes } from '../utils/reefer-excel.util';
import { pdfFileDate, pdfFileToken } from '../utils/pdf-filename.util';
import { ExcelDeliveryService } from './excel-delivery.service';
import { StorageService } from './storage.service';

@Injectable({ providedIn: 'root' })
export class ReeferExcelService {
  private readonly storage = inject(StorageService);
  private readonly delivery = inject(ExcelDeliveryService);

  async openMonitoringLog(): Promise<boolean> {
    const ship = this.storage.ship();
    const library = this.storage.reeferLibrary();
    const ports = this.storage.ports();
    const bytes = await buildReeferMonitoringExcelBytes(ship, library, ports);
    const fileName = this.fileName(ship.name, ship.dateOfDeparture);
    return this.delivery.deliver(bytes, fileName);
  }

  private fileName(shipName: string, departureDate: string): string {
    const token = pdfFileToken(shipName, 'vessel');
    const date = pdfFileDate(departureDate);
    return `Reefer_Log_${token}_${date}.xlsx`;
  }
}
