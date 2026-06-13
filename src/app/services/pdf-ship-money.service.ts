import { Injectable, inject } from '@angular/core';
import {
  AppData,
  CrewMember,
  filterActiveCrewListFromData,
  formatCrewListName,
  formatPortCallPortName,
} from '../models/crew.models';
import {
  normalizeShipMoneyForm,
  shipMoneyRowBaselineY,
  SHIP_MONEY_PAGE_HEIGHT_PT,
} from '../models/ship-money.models';
import { PdfDeliveryService } from './pdf-delivery.service';
import { formatDisplayDate } from '../utils/date.util';
import { shipMoneyPdfFileName } from '../utils/pdf-filename.util';
import {
  SHIP_MONEY_AMOUNT_MAX_WIDTH,
  SHIP_MONEY_AMOUNT_X,
  SHIP_MONEY_CURRENCY_MAX_WIDTH,
  SHIP_MONEY_CURRENCY_X,
  SHIP_MONEY_FIELDS,
  SHIP_MONEY_FONT,
  type ShipMoneyTextPlacement,
} from './ship-money-field-positions';
import { PdfOverlayService } from './pdf-overlay.service';

const SHIP_MONEY_TEMPLATE_URL = '/ship-money-empty.pdf';

@Injectable({ providedIn: 'root' })
export class PdfShipMoneyService {
  private readonly overlay = inject(PdfOverlayService);
  private readonly delivery = inject(PdfDeliveryService);

  private templateBytes: Uint8Array | null = null;
  private loadedVersion = 0;
  private readonly templateVersion = 1;

  async buildFinalBytes(data: AppData): Promise<Uint8Array> {
    const bytes = await this.build(data);
    return this.overlay.applyToPdfBytes(bytes, data.documentOverlay.shipMoney);
  }

  async openPreview(data: AppData): Promise<boolean> {
    const bytes = await this.buildFinalBytes(data);
    return this.delivery.deliver(bytes, this.fileName(data));
  }

  fileName(data: AppData): string {
    const { ship } = data;
    const voyageDate = ship.dateOfArrival || ship.dateOfDeparture;
    return shipMoneyPdfFileName(ship.name, voyageDate);
  }

  async build(data: AppData): Promise<Uint8Array> {
    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
    const template = await this.loadTemplate();
    const doc = await PDFDocument.load(template);
    const page = doc.getPages()[0];
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const black = rgb(0, 0, 0);

    const draw = (text: string, placement: ShipMoneyTextPlacement, useBold = false) => {
      const value = text.trim();
      if (!value) return;
      page.drawText(value, {
        x: placement.x,
        y: placement.y,
        size: placement.fontSize ?? SHIP_MONEY_FONT,
        font: useBold ? bold : font,
        color: black,
        ...(placement.maxWidth != null ? { maxWidth: placement.maxWidth } : {}),
      });
    };

    const form = normalizeShipMoneyForm(data.shipMoneyForm);
    const { ship } = data;
    const crewArrival = filterActiveCrewListFromData(data, 'arrival');
    const master = this.findMaster(crewArrival);

    draw(ship.name, SHIP_MONEY_FIELDS.vessel, true);
    draw(formatPortCallPortName(ship.portOfCall), SHIP_MONEY_FIELDS.port, true);
    draw(formatPortCallPortName(ship.homeport), SHIP_MONEY_FIELDS.portOfRegistry, true);
    draw(formatDisplayDate(ship.dateOfArrival), SHIP_MONEY_FIELDS.date, true);
    if (master) {
      draw(formatCrewListName(master), SHIP_MONEY_FIELDS.masterName, true);
    }

    let row = 0;
    for (const entry of form.entries) {
      const amount = entry.amount.trim();
      const currency = entry.currency.trim();
      if (!amount && !currency) continue;
      const baselineY = shipMoneyRowBaselineY(row);
      const y = SHIP_MONEY_PAGE_HEIGHT_PT - baselineY;
      if (amount) {
        draw(amount, {
          x: SHIP_MONEY_AMOUNT_X,
          y,
          fontSize: SHIP_MONEY_FONT,
          maxWidth: SHIP_MONEY_AMOUNT_MAX_WIDTH,
        });
      }
      if (currency) {
        draw(currency, {
          x: SHIP_MONEY_CURRENCY_X,
          y,
          fontSize: SHIP_MONEY_FONT,
          maxWidth: SHIP_MONEY_CURRENCY_MAX_WIDTH,
        });
      }
      row += 1;
    }

    return doc.save();
  }

  private findMaster(crew: CrewMember[]): CrewMember | undefined {
    const exact = crew.find((m) => m.rank.trim().toLowerCase() === 'master');
    if (exact) return exact;
    return crew.find((m) => m.rank.trim().toLowerCase().includes('master'));
  }

  private async loadTemplate(): Promise<Uint8Array> {
    if (this.templateBytes && this.loadedVersion === this.templateVersion) {
      return this.templateBytes;
    }
    const res = await fetch(`${SHIP_MONEY_TEMPLATE_URL}?v=${this.templateVersion}`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      throw new Error('Ship Money template not found (public/ship-money-empty.pdf)');
    }
    this.templateBytes = new Uint8Array(await res.arrayBuffer());
    this.loadedVersion = this.templateVersion;
    return this.templateBytes;
  }
}
