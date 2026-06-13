import { Injectable, inject } from '@angular/core';
import {
  AppData,
  filterActiveCrewListFromData,
  formatPortCallPortName,
} from '../models/crew.models';
import { filterActivePassengerListFromData } from '../models/passenger.models';
import { PdfDeliveryService } from './pdf-delivery.service';
import { formatDisplayDate } from '../utils/date.util';
import { shipStoresPdfFileName } from '../utils/pdf-filename.util';
import {
  formatShipStoresQuantityText,
  formatShipStoresUnitText,
  normalizeShipStoresForm,
} from '../models/ship-stores.models';
import {
  formatShipStoresPortsRoute,
  SHIP_STORES_BODY_ARTICLE_MAX_WIDTH,
  SHIP_STORES_BODY_ARTICLE_X,
  SHIP_STORES_BODY_FONT_SIZE,
  SHIP_STORES_BODY_QUANTITY_X,
  SHIP_STORES_BODY_ROW_COUNT,
  SHIP_STORES_BODY_UNIT_RIGHT_X,
  SHIP_STORES_FIELDS,
  SHIP_STORES_FONT,
  shipStoresBodyRowPdfLibY,
  formatShipStoresPeriodOfStay,
  shipStoresPeriodDays,
  type ShipStoresTextPlacement,
} from './ship-stores-field-positions';
import { PdfOverlayService } from './pdf-overlay.service';

const SHIP_STORES_TEMPLATE_URL = '/ship-stores-empty.pdf';

/** Ship Stores declaration (IMO FAL Form 3). */
@Injectable({ providedIn: 'root' })
export class PdfShipStoresService {
  private readonly overlay = inject(PdfOverlayService);
  private readonly delivery = inject(PdfDeliveryService);

  private templateBytes: Uint8Array | null = null;
  private loadedVersion = 0;
  private readonly templateVersion = 15;

  async buildFinalBytes(data: AppData): Promise<Uint8Array> {
    const bytes = await this.build(data);
    return this.overlay.applyToPdfBytes(bytes, data.documentOverlay.shipStores);
  }

  async openPreview(data: AppData): Promise<boolean> {
    const bytes = await this.buildFinalBytes(data);
    return this.delivery.deliver(bytes, this.fileName(data));
  }

  fileName(data: AppData): string {
    const { ship } = data;
    const voyageDate = ship.dateOfArrival || ship.dateOfDeparture;
    return shipStoresPdfFileName(ship.name, voyageDate);
  }

  async build(data: AppData): Promise<Uint8Array> {
    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
    const template = await this.loadTemplate();
    const doc = await PDFDocument.load(template);
    const page = doc.getPages()[0];
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const black = rgb(0, 0, 0);

    const draw = (text: string, placement: ShipStoresTextPlacement, useBold = false) => {
      const value = text.trim();
      if (!value) return;
      page.drawText(value, {
        x: placement.x,
        y: placement.y,
        size: placement.fontSize ?? SHIP_STORES_FONT,
        font: useBold ? bold : font,
        color: black,
        ...(placement.maxWidth != null ? { maxWidth: placement.maxWidth } : {}),
      });
    };

    const crewCount = filterActiveCrewListFromData(data, 'arrival').length;
    const paxCount = filterActivePassengerListFromData(data, 'arrival').length;
    const form = normalizeShipStoresForm(data.shipStoresForm);
    this.drawHeader(draw, data, crewCount + paxCount, form.placeOfStorage);
    this.drawBodyTable(page, font, black, form);

    return doc.save();
  }

  private drawHeader(
    draw: (text: string, placement: ShipStoresTextPlacement, useBold?: boolean) => void,
    data: AppData,
    personsOnBoard: number,
    placeOfStorage: string,
  ): void {
    const { ship } = data;
    const portsRoute = formatShipStoresPortsRoute(
      ship.lastPortOfCall,
      ship.nextPortOfCall,
      ship.portOfCall,
      formatPortCallPortName,
    );
    const periodDays = shipStoresPeriodDays(ship.dateOfArrival, ship.dateOfDeparture);

    draw('1', SHIP_STORES_FIELDS.pageNo);
    draw('X', SHIP_STORES_FIELDS.arrivalMark);
    draw(ship.name, SHIP_STORES_FIELDS.shipName, true);
    draw(formatPortCallPortName(ship.portOfCall), SHIP_STORES_FIELDS.portOfCall, true);
    draw(formatDisplayDate(ship.dateOfArrival), SHIP_STORES_FIELDS.voyageDate, true);
    draw(formatPortCallPortName(ship.nationality), SHIP_STORES_FIELDS.nationality, true);
    draw(portsRoute, SHIP_STORES_FIELDS.portsRoute, true);
    draw(String(personsOnBoard), SHIP_STORES_FIELDS.personsOnBoard, true);
    draw(formatShipStoresPeriodOfStay(periodDays), SHIP_STORES_FIELDS.periodOfStay, true);
    draw(placeOfStorage, SHIP_STORES_FIELDS.placeOfStorage, true);
  }

  private drawBodyTable(
    page: import('pdf-lib').PDFPage,
    font: import('pdf-lib').PDFFont,
    black: import('pdf-lib').RGB,
    form: ReturnType<typeof normalizeShipStoresForm>,
  ): void {
    const draw = (text: string, placement: ShipStoresTextPlacement) => {
      const value = text.trim();
      if (!value) return;
      page.drawText(value, {
        x: placement.x,
        y: placement.y,
        size: placement.fontSize ?? SHIP_STORES_BODY_FONT_SIZE,
        font,
        color: black,
        ...(placement.maxWidth != null ? { maxWidth: placement.maxWidth } : {}),
      });
    };

    const fontSize = SHIP_STORES_BODY_FONT_SIZE;
    for (let i = 0; i < SHIP_STORES_BODY_ROW_COUNT; i++) {
      const row = form.rows[i];
      const y = shipStoresBodyRowPdfLibY(i);
      draw(row.name, {
        x: SHIP_STORES_BODY_ARTICLE_X,
        y,
        fontSize,
        maxWidth: SHIP_STORES_BODY_ARTICLE_MAX_WIDTH,
      });
      const quantity = formatShipStoresQuantityText(row.name, row.quantity);
      const unit = formatShipStoresUnitText(row.name, row.quantity, row.unit);
      draw(quantity, { x: SHIP_STORES_BODY_QUANTITY_X, y, fontSize });
      if (unit) {
        const unitWidth = font.widthOfTextAtSize(unit, fontSize);
        page.drawText(unit, {
          x: SHIP_STORES_BODY_UNIT_RIGHT_X - unitWidth,
          y,
          size: fontSize,
          font,
          color: black,
        });
      }
    }
  }

  private async loadTemplate(): Promise<Uint8Array> {
    if (this.templateBytes && this.loadedVersion === this.templateVersion) {
      return this.templateBytes;
    }
    const res = await fetch(`${SHIP_STORES_TEMPLATE_URL}?v=${this.templateVersion}`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      throw new Error('Ship Stores template not found (public/ship-stores-empty.pdf)');
    }
    this.templateBytes = new Uint8Array(await res.arrayBuffer());
    this.loadedVersion = this.templateVersion;
    return this.templateBytes;
  }
}
