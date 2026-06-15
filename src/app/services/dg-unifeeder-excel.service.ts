import { Injectable, inject } from '@angular/core';
import type { DgUnifeederExportContext } from '../models/dg-manifest-export.models';
import { buildUnifeederDgListExcelBytes } from '../utils/dg-unifeeder-excel-layout.util';
import { pdfFileDate, pdfFileToken } from '../utils/pdf-filename.util';
import { dgShipForExport } from '../utils/page-ship-context.util';
import { ExcelDeliveryService } from './excel-delivery.service';
import { StorageService } from './storage.service';

@Injectable({ providedIn: 'root' })
export class DgUnifeederExcelService {
  private readonly storage = inject(StorageService);
  private readonly delivery = inject(ExcelDeliveryService);

  async openDgList(exportContext?: DgUnifeederExportContext): Promise<boolean> {
    const ship = this.storage.ship();
    const library = this.storage.dgLibrary();
    const exportShip = dgShipForExport(ship, library.pageContext);
    const ctx = exportContext ?? {
      rows: library.unifeeder.onboard.filter((row) => row.status === 'onboard'),
      grossTotalKg: library.unifeeder.grossTotalKg,
    };
    const bytes = await buildUnifeederDgListExcelBytes(
      exportShip,
      library.pageContext,
      ctx.rows,
      this.storage.ports(),
      { grossTotalKg: ctx.grossTotalKg },
    );
    const fileName = this.fileName(ship.name, exportShip.dateOfDeparture);
    return this.delivery.deliver(bytes, fileName);
  }

  private fileName(shipName: string, departureDate: string): string {
    const token = pdfFileToken(shipName, 'vessel');
    const date = pdfFileDate(departureDate);
    return `DG_List_${token}_${date}.xlsx`;
  }
}
