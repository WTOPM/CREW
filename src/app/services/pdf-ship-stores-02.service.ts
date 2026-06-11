import { Injectable, inject } from '@angular/core';
import {
  AppData,
  CrewMember,
  filterActiveCrewList,
  formatPortCallPortName,
  portCountry,
} from '../models/crew.models';
import { filterActivePassengerList } from '../models/passenger.models';
import { PdfDeliveryService } from './pdf-delivery.service';
import { formatDisplayDate } from '../utils/date.util';
import { shipStores02PdfFileName } from '../utils/pdf-filename.util';
import {
  formatShipStoresQuantityText,
  formatShipStoresUnitText,
  normalizeShipStoresForm02,
} from '../models/ship-stores.models';
import {
  formatShipStoresPeriodOfStay,
  shipStoresPeriodDays,
} from './ship-stores-field-positions';
import {
  formatShipStores02PortsRoute,
  SHIP_STORES_02_BODY_ARTICLE_MAX_WIDTH,
  SHIP_STORES_02_BODY_ARTICLE_X,
  SHIP_STORES_02_BODY_FONT_SIZE,
  SHIP_STORES_02_BODY_QUANTITY_X,
  SHIP_STORES_02_BODY_ROW_COUNT,
  SHIP_STORES_02_BODY_UNIT_X,
  SHIP_STORES_02_FIELDS,
  SHIP_STORES_02_FONT,
  SHIP_STORES_02_TEMPLATE_VERSION,
  shipStores02BodyRowPdfLibY,
  type ShipStores02TextPlacement,
} from './ship-stores-02-field-positions';
import { PdfOverlayService } from './pdf-overlay.service';

const SHIP_STORES_02_TEMPLATE_URL = '/ship-stores-02-empty.pdf';

/** Ship Stores form 02 — portrait, 2 pages; stamp on page 2 only. */
@Injectable({ providedIn: 'root' })
export class PdfShipStores02Service {
  private readonly overlay = inject(PdfOverlayService);
  private readonly delivery = inject(PdfDeliveryService);

  private templateBytes: Uint8Array | null = null;
  private loadedVersion = 0;

  async buildFinalBytes(data: AppData): Promise<Uint8Array> {
    const bytes = await this.build(data);
    return this.overlay.applyShipStores02Overlay(bytes, data.documentOverlay.shipStores02);
  }

  async openPreview(data: AppData): Promise<boolean> {
    const bytes = await this.buildFinalBytes(data);
    return this.delivery.deliver(bytes, this.fileName(data));
  }

  fileName(data: AppData): string {
    const { ship } = data;
    const voyageDate = ship.dateOfArrival || ship.dateOfDeparture;
    return shipStores02PdfFileName(ship.name, voyageDate);
  }

  async build(data: AppData): Promise<Uint8Array> {
    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
    const template = await this.loadTemplate();
    const doc = await PDFDocument.load(template);
    const pages = doc.getPages();
    if (!pages.length) {
      throw new Error('Ship Stores 02 template has no pages');
    }

    const page1 = pages[0];
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const black = rgb(0, 0, 0);

    const draw = (text: string, placement: ShipStores02TextPlacement, useBold = false) => {
      const value = text.trim();
      if (!value) return;
      page1.drawText(value, {
        x: placement.x,
        y: placement.y,
        size: placement.fontSize ?? SHIP_STORES_02_FONT,
        font: useBold ? bold : font,
        color: black,
        ...(placement.maxWidth != null ? { maxWidth: placement.maxWidth } : {}),
      });
    };

    const form = normalizeShipStoresForm02(data.shipStoresForm02);
    this.drawHeader(draw, data, form.placeOfStorage);
    this.drawBodyTable(page1, font, black, form);

    return doc.save();
  }

  private drawHeader(
    draw: (text: string, placement: ShipStores02TextPlacement, useBold?: boolean) => void,
    data: AppData,
    placeOfStorage: string,
  ): void {
    const { ship, crewArr, ports } = data;
    const isArrival = crewArr.isArrival;
    const portsRoute = formatShipStores02PortsRoute(
      ship.lastPortOfCall,
      ship.nextPortOfCall,
      ship.portOfCall,
      ports,
      formatPortCallPortName,
      portCountry,
    );
    const periodDays = shipStoresPeriodDays(ship.dateOfArrival, ship.dateOfDeparture);
    const voyageDate = formatDisplayDate(
      isArrival ? ship.dateOfArrival : ship.dateOfDeparture,
    );
    const portOfCall = formatPortCallPortName(ship.portOfCall);
    const portCountryName = portCountry(ship.portOfCall, ports);
    const portOfCallLine = portCountryName
      ? `${portOfCall} / ${portCountryName}`
      : portOfCall;

    const crewCount = filterActiveCrewList(data.crew, isArrival ? 'arrival' : 'departure').length;
    const paxCount = filterActivePassengerList(
      data.passengers,
      isArrival ? 'arrival' : 'departure',
    ).length;

    draw('1', SHIP_STORES_02_FIELDS.pageNo);
    if (isArrival) {
      draw('X', SHIP_STORES_02_FIELDS.arrivalMark);
    } else {
      draw('X', SHIP_STORES_02_FIELDS.departureMark);
    }
    draw(formatPortCallPortName(ship.name), SHIP_STORES_02_FIELDS.shipName, true);
    draw(portOfCallLine, SHIP_STORES_02_FIELDS.portOfCall, true);
    draw(voyageDate, SHIP_STORES_02_FIELDS.voyageDate, true);
    draw(formatPortCallPortName(ship.nationality), SHIP_STORES_02_FIELDS.nationality, true);
    draw(portsRoute, SHIP_STORES_02_FIELDS.portsRoute, true);
    draw(String(crewCount + paxCount), SHIP_STORES_02_FIELDS.personsOnBoard, true);
    draw(formatShipStoresPeriodOfStay(periodDays), SHIP_STORES_02_FIELDS.periodOfStay, true);
    draw(placeOfStorage, SHIP_STORES_02_FIELDS.placeOfStorage, true);

    const master = this.findMaster(
      filterActiveCrewList(data.crew, isArrival ? 'arrival' : 'departure'),
    );
    if (master) {
      draw(this.formatCaptainName(master), SHIP_STORES_02_FIELDS.captainName, true);
    }
  }

  private findMaster(crew: CrewMember[]): CrewMember | undefined {
    const exact = crew.find((m) => m.rank.trim().toLowerCase() === 'master');
    if (exact) return exact;
    return crew.find((m) => m.rank.trim().toLowerCase().includes('master'));
  }

  /** Surname and given names — ALL CAPS, space-separated. */
  private formatCaptainName(member: Pick<CrewMember, 'familyName' | 'givenNames'>): string {
    const parts = [member.familyName?.trim(), member.givenNames?.trim()].filter(Boolean);
    return parts.join(' ').toUpperCase();
  }

  private drawBodyTable(
    page: import('pdf-lib').PDFPage,
    font: import('pdf-lib').PDFFont,
    black: import('pdf-lib').RGB,
    form: ReturnType<typeof normalizeShipStoresForm02>,
  ): void {
    const draw = (text: string, placement: ShipStores02TextPlacement) => {
      const value = text.trim();
      if (!value) return;
      page.drawText(value, {
        x: placement.x,
        y: placement.y,
        size: placement.fontSize ?? SHIP_STORES_02_BODY_FONT_SIZE,
        font,
        color: black,
        ...(placement.maxWidth != null ? { maxWidth: placement.maxWidth } : {}),
      });
    };

    const fontSize = SHIP_STORES_02_BODY_FONT_SIZE;
    for (let i = 0; i < SHIP_STORES_02_BODY_ROW_COUNT; i++) {
      const row = form.rows[i];
      const y = shipStores02BodyRowPdfLibY(i);
      draw(row.name, {
        x: SHIP_STORES_02_BODY_ARTICLE_X,
        y,
        fontSize,
        maxWidth: SHIP_STORES_02_BODY_ARTICLE_MAX_WIDTH,
      });
      const quantity = formatShipStoresQuantityText(row.name, row.quantity);
      const unit = formatShipStoresUnitText(row.name, row.quantity, row.unit);
      draw(quantity, { x: SHIP_STORES_02_BODY_QUANTITY_X, y, fontSize });
      draw(unit, { x: SHIP_STORES_02_BODY_UNIT_X, y, fontSize });
    }
  }

  private async loadTemplate(): Promise<Uint8Array> {
    if (this.templateBytes && this.loadedVersion === SHIP_STORES_02_TEMPLATE_VERSION) {
      return this.templateBytes;
    }
    const res = await fetch(
      `${SHIP_STORES_02_TEMPLATE_URL}?v=${SHIP_STORES_02_TEMPLATE_VERSION}`,
      { cache: 'no-store' },
    );
    if (!res.ok) {
      throw new Error('Ship Stores 02 template not found (public/ship-stores-02-empty.pdf)');
    }
    this.templateBytes = new Uint8Array(await res.arrayBuffer());
    this.loadedVersion = SHIP_STORES_02_TEMPLATE_VERSION;
    return this.templateBytes;
  }
}
