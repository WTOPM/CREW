import { Injectable, inject } from '@angular/core';
import {
  AppData,
  CrewMember,
  filterActiveCrewListFromData,
  formatCrewListName,
  formatPortCallPortName,
} from '../models/crew.models';
import {
  narcoticListCellBottomBaselineY,
  narcoticListCellTopBaselineY,
  narcoticListRowBaselineY,
  normalizeNarcoticListForm,
} from '../models/narcotic-list.models';
import { PdfDeliveryService } from './pdf-delivery.service';
import { formatDisplayDate } from '../utils/date.util';
import { narcoticListPdfFileName } from '../utils/pdf-filename.util';
import {
  NARCOTIC_LIST_COL,
  NARCOTIC_LIST_FIELDS,
  NARCOTIC_LIST_FONT,
  narcoticListPdfLibY,
  type NarcoticListTextPlacement,
} from './narcotic-list-field-positions';
import { PdfOverlayService } from './pdf-overlay.service';

const NARCOTIC_LIST_TEMPLATE_URL = '/narcotic-list-empty.pdf';

@Injectable({ providedIn: 'root' })
export class PdfNarcoticListService {
  private readonly overlay = inject(PdfOverlayService);
  private readonly delivery = inject(PdfDeliveryService);

  private templateBytes: Uint8Array | null = null;
  private loadedVersion = 0;
  private readonly templateVersion = 4;

  async buildFinalBytes(data: AppData): Promise<Uint8Array> {
    const bytes = await this.build(data);
    return this.overlay.applyToPdfBytes(bytes, data.documentOverlay.narcoticList);
  }

  async openPreview(data: AppData): Promise<boolean> {
    const bytes = await this.buildFinalBytes(data);
    return this.delivery.deliver(bytes, this.fileName(data));
  }

  fileName(data: AppData): string {
    const { ship } = data;
    const voyageDate = ship.dateOfArrival || ship.dateOfDeparture;
    return narcoticListPdfFileName(ship.name, voyageDate);
  }

  async build(data: AppData): Promise<Uint8Array> {
    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
    const template = await this.loadTemplate();
    const doc = await PDFDocument.load(template);
    const page = doc.getPages()[0];
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const black = rgb(0, 0, 0);

    const draw = (text: string, placement: NarcoticListTextPlacement, useBold = false) => {
      const value = text.trim();
      if (!value) return;
      page.drawText(value, {
        x: placement.x,
        y: placement.y,
        size: placement.fontSize ?? NARCOTIC_LIST_FONT,
        font: useBold ? bold : font,
        color: black,
      });
    };

    const drawAtBaseline = (
      text: string,
      x: number,
      baselineY: number,
      fontSize = NARCOTIC_LIST_FONT,
    ) => {
      const value = text.trim();
      if (!value) return;
      page.drawText(value, {
        x,
        y: narcoticListPdfLibY(baselineY),
        size: fontSize,
        font,
        color: black,
      });
    };

    const form = normalizeNarcoticListForm(data.narcoticListForm);
    const { ship } = data;
    const crew = filterActiveCrewListFromData(data, 'arrival');
    const master = this.findMaster(crew);

    draw(ship.name, NARCOTIC_LIST_FIELDS.shipName, true);
    draw(formatPortCallPortName(ship.portOfCall), NARCOTIC_LIST_FIELDS.portOfArrival, true);
    draw(formatDisplayDate(ship.dateOfArrival), NARCOTIC_LIST_FIELDS.date, true);
    draw(formatPortCallPortName(ship.nationality), NARCOTIC_LIST_FIELDS.nationality, true);
    draw(formatPortCallPortName(ship.lastPortOfCall), NARCOTIC_LIST_FIELDS.portFrom, true);
    draw(
      formatPortCallPortName(ship.nextPortOfCall || ship.portOfCall),
      NARCOTIC_LIST_FIELDS.portDestination,
      true,
    );
    if (master) {
      draw(`Capt. ${formatCrewListName(master)}`, NARCOTIC_LIST_FIELDS.masterSignature, true);
    }

    let row = 0;
    for (const entry of form.entries) {
      if (
        !entry.name.trim() &&
        !entry.dosage.trim() &&
        !entry.quantity.trim() &&
        !entry.unitsPack.trim()
      ) {
        continue;
      }
      const rowBaseline = narcoticListRowBaselineY(row);
      drawAtBaseline(String(row + 1), NARCOTIC_LIST_COL.rowNo, rowBaseline);
      drawAtBaseline(entry.name, NARCOTIC_LIST_COL.name, narcoticListCellTopBaselineY(row));
      drawAtBaseline(entry.dosage, NARCOTIC_LIST_COL.name, narcoticListCellBottomBaselineY(row));
      drawAtBaseline(entry.quantity, NARCOTIC_LIST_COL.quantity, rowBaseline);
      drawAtBaseline(entry.unitsPack, NARCOTIC_LIST_COL.units, narcoticListCellTopBaselineY(row));
      drawAtBaseline(entry.unitsPer, NARCOTIC_LIST_COL.units, narcoticListCellBottomBaselineY(row));
      drawAtBaseline(entry.totalQuantity, NARCOTIC_LIST_COL.totalQuantity, rowBaseline);
      drawAtBaseline(entry.expirationDate, NARCOTIC_LIST_COL.expirationDate, rowBaseline);
      drawAtBaseline(entry.controlNo, NARCOTIC_LIST_COL.controlNo, rowBaseline);
      drawAtBaseline(entry.placeOfStorage, NARCOTIC_LIST_COL.placeOfStorage, rowBaseline);
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
    const res = await fetch(`${NARCOTIC_LIST_TEMPLATE_URL}?v=${this.templateVersion}`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      throw new Error('Narcotic List template not found (public/narcotic-list-empty.pdf)');
    }
    this.templateBytes = new Uint8Array(await res.arrayBuffer());
    this.loadedVersion = this.templateVersion;
    return this.templateBytes;
  }
}
