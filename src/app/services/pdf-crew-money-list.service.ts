import { Injectable, inject } from '@angular/core';
import {
  AppData,
  CrewMember,
  filterActiveCrewList,
  formatCrewListName,
  formatPortCallPortName,
} from '../models/crew.models';
import {
  CREW_MONEY_LIST_MAX_CREW_ROWS,
  CREW_MONEY_LIST_PAGE_HEIGHT_PT,
  crewMoneyListAmountsFor,
  normalizeCrewMoneyListForm,
} from '../models/crew-money-list.models';
import { PdfDeliveryService } from './pdf-delivery.service';
import { crewMoneyListPdfFileName } from '../utils/pdf-filename.util';
import {
  CREW_MONEY_LIST_COL,
  CREW_MONEY_LIST_FIELDS,
  CREW_MONEY_LIST_FONT,
  CREW_MONEY_LIST_NAME_MAX_WIDTH,
  CREW_MONEY_LIST_RANK_MAX_WIDTH,
  CREW_MONEY_LIST_EURO_MAX_WIDTH,
  CREW_MONEY_LIST_OTHERS_MAX_WIDTH,
  CREW_MONEY_LIST_USD_MAX_WIDTH,
  crewMoneyListRowBaselineY,
  type CrewMoneyListTextPlacement,
} from './crew-money-list-field-positions';
import { PdfOverlayService } from './pdf-overlay.service';

const CREW_MONEY_LIST_TEMPLATE_URL = '/crew-money-empty.pdf';

@Injectable({ providedIn: 'root' })
export class PdfCrewMoneyListService {
  private readonly overlay = inject(PdfOverlayService);
  private readonly delivery = inject(PdfDeliveryService);

  private templateBytes: Uint8Array | null = null;
  private loadedVersion = 0;
  private readonly templateVersion = 1;

  async openPreview(data: AppData): Promise<boolean> {
    let bytes = await this.build(data);
    bytes = await this.overlay.applyToPdfBytes(bytes, data.documentOverlay.crewMoney);
    return this.delivery.deliver(bytes, this.fileName(data));
  }

  fileName(data: AppData): string {
    const { ship } = data;
    const voyageDate = ship.dateOfArrival || ship.dateOfDeparture;
    return crewMoneyListPdfFileName(ship.name, voyageDate);
  }

  async build(data: AppData): Promise<Uint8Array> {
    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
    const template = await this.loadTemplate();
    const doc = await PDFDocument.load(template);
    const page = doc.getPages()[0];
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const black = rgb(0, 0, 0);

    const draw = (text: string, placement: CrewMoneyListTextPlacement, useBold = false) => {
      const value = text.trim();
      if (!value) return;
      page.drawText(value, {
        x: placement.x,
        y: placement.y,
        size: placement.fontSize ?? CREW_MONEY_LIST_FONT,
        font: useBold ? bold : font,
        color: black,
        ...(placement.maxWidth != null ? { maxWidth: placement.maxWidth } : {}),
      });
    };

    const drawAmount = (text: string, x: number, y: number, maxWidth: number) => {
      const value = text.trim();
      if (!value) return;
      const size = this.fitFontSize(font, value, CREW_MONEY_LIST_FONT, maxWidth);
      page.drawText(value, {
        x,
        y,
        size,
        font,
        color: black,
      });
    };

    const form = normalizeCrewMoneyListForm(data.crewMoneyListForm);
    const { ship } = data;
    const crew = filterActiveCrewList(data.crew, 'arrival');

    draw('1', CREW_MONEY_LIST_FIELDS.pageNo);
    draw(ship.name, CREW_MONEY_LIST_FIELDS.shipName, true);
    draw(formatPortCallPortName(ship.nationality), CREW_MONEY_LIST_FIELDS.nationality, true);

    crew.slice(0, CREW_MONEY_LIST_MAX_CREW_ROWS).forEach((member, index) => {
      const amounts = crewMoneyListAmountsFor(form, member.id);
      const y = CREW_MONEY_LIST_PAGE_HEIGHT_PT - crewMoneyListRowBaselineY(index);
      draw(String(index + 1), { x: CREW_MONEY_LIST_COL.rowNo, y, fontSize: CREW_MONEY_LIST_FONT });
      const name = formatCrewListName(member);
      const nameSize = this.fitFontSize(font, name, CREW_MONEY_LIST_FONT, CREW_MONEY_LIST_NAME_MAX_WIDTH);
      if (name) {
        page.drawText(name, {
          x: CREW_MONEY_LIST_COL.name,
          y,
          size: nameSize,
          font,
          color: black,
        });
      }
      draw(member.rank, {
        x: CREW_MONEY_LIST_COL.rank,
        y,
        fontSize: CREW_MONEY_LIST_FONT,
        maxWidth: CREW_MONEY_LIST_RANK_MAX_WIDTH,
      });
      drawAmount(amounts.usd, CREW_MONEY_LIST_COL.usd, y, CREW_MONEY_LIST_USD_MAX_WIDTH);
      drawAmount(amounts.euro, CREW_MONEY_LIST_COL.euro, y, CREW_MONEY_LIST_EURO_MAX_WIDTH);
      drawAmount(amounts.others, CREW_MONEY_LIST_COL.others, y, CREW_MONEY_LIST_OTHERS_MAX_WIDTH);
    });

    return doc.save();
  }

  /** Single line: shrink font to fit column width (never wrap to second line). */
  private fitFontSize(
    font: import('pdf-lib').PDFFont,
    text: string,
    baseSize: number,
    maxWidth: number,
  ): number {
    let size = baseSize;
    while (size > 7 && font.widthOfTextAtSize(text, size) > maxWidth) {
      size -= 0.5;
    }
    return size;
  }

  private async loadTemplate(): Promise<Uint8Array> {
    if (this.templateBytes && this.loadedVersion === this.templateVersion) {
      return this.templateBytes;
    }
    const res = await fetch(`${CREW_MONEY_LIST_TEMPLATE_URL}?v=${this.templateVersion}`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      throw new Error('Crew Money template not found (public/crew-money-empty.pdf)');
    }
    this.templateBytes = new Uint8Array(await res.arrayBuffer());
    this.loadedVersion = this.templateVersion;
    return this.templateBytes;
  }
}
