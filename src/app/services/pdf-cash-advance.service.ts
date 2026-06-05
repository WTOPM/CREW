import { Injectable, inject } from '@angular/core';
import {
  AppData,
  CrewMember,
  filterActiveCrewList,
  formatCrewListName,
  formatPortCallPortName,
} from '../models/crew.models';
import {
  CASH_ADVANCE_MAX_CREW_ROWS,
  CASH_ADVANCE_PAGE_HEIGHT_PT,
  CASH_ADVANCE_TEMPLATE_TITLE,
  cashAdvanceAmountsFor,
  normalizeCashAdvanceForm,
  sumCashAdvanceCurrency,
} from '../models/cash-advance.models';
import { PdfDeliveryService } from './pdf-delivery.service';
import { formatDisplayDate } from '../utils/date.util';
import { cashAdvancePdfFileName } from '../utils/pdf-filename.util';
import {
  CASH_ADVANCE_COL,
  CASH_ADVANCE_FIELDS,
  CASH_ADVANCE_FONT,
  CASH_ADVANCE_NAME_MAX_WIDTH,
  CASH_ADVANCE_RANK_MAX_WIDTH,
  CASH_ADVANCE_AMOUNT_MAX_WIDTH,
  cashAdvanceRowBaselineY,
  CASH_ADVANCE_TOTAL_ROW_BASELINE_Y,
  type CashAdvanceTextPlacement,
} from './cash-advance-field-positions';
import { PdfOverlayService } from './pdf-overlay.service';

const CASH_ADVANCE_TEMPLATE_URL = '/cash-advance-empty.pdf';

@Injectable({ providedIn: 'root' })
export class PdfCashAdvanceService {
  private readonly overlay = inject(PdfOverlayService);
  private readonly delivery = inject(PdfDeliveryService);

  private templateBytes: Uint8Array | null = null;
  private loadedVersion = 0;
  private readonly templateVersion = 1;

  async buildFinalBytes(data: AppData): Promise<Uint8Array> {
    const bytes = await this.build(data);
    return this.overlay.applyToPdfBytes(bytes, data.documentOverlay.cashAdvance);
  }

  async openPreview(data: AppData): Promise<boolean> {
    const bytes = await this.buildFinalBytes(data);
    return this.delivery.deliver(bytes, this.fileName(data));
  }

  fileName(data: AppData): string {
    const { ship } = data;
    const voyageDate = ship.dateOfArrival || ship.dateOfDeparture;
    return cashAdvancePdfFileName(ship.name, voyageDate);
  }

  async build(data: AppData): Promise<Uint8Array> {
    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
    const template = await this.loadTemplate();
    const doc = await PDFDocument.load(template);
    const page = doc.getPages()[0];
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const black = rgb(0, 0, 0);

    const draw = (text: string, placement: CashAdvanceTextPlacement, useBold = false) => {
      const value = text.trim();
      if (!value) return;
      page.drawText(value, {
        x: placement.x,
        y: placement.y,
        size: placement.fontSize ?? CASH_ADVANCE_FONT,
        font: useBold ? bold : font,
        color: black,
        ...(placement.maxWidth != null ? { maxWidth: placement.maxWidth } : {}),
      });
    };

    const form = normalizeCashAdvanceForm(data.cashAdvanceForm);
    const { ship } = data;
    const crew = filterActiveCrewList(data.crew, 'arrival');
    const master = this.findMaster(crew);
    const payrollDate = form.payrollDate || formatDisplayDate(ship.dateOfArrival);
    const title = form.title.trim();

    if (title && title !== CASH_ADVANCE_TEMPLATE_TITLE) {
      const placement = CASH_ADVANCE_FIELDS.title;
      page.drawRectangle({
        x: placement.x - 4,
        y: placement.y - 3,
        width: (placement.maxWidth ?? 400) + 8,
        height: (placement.fontSize ?? 12) + 6,
        color: rgb(1, 1, 1),
      });
      draw(title, placement, true);
    }

    draw(ship.name, CASH_ADVANCE_FIELDS.vessel, true);
    draw(payrollDate, CASH_ADVANCE_FIELDS.date, true);
    if (master) {
      draw(`/ ${formatCrewListName(master)} /`, CASH_ADVANCE_FIELDS.masterSignature, true);
    }
    draw(payrollDate, CASH_ADVANCE_FIELDS.masterDate, true);

    const crewRows = crew.slice(0, CASH_ADVANCE_MAX_CREW_ROWS);
    const usdAmounts: string[] = [];
    const eurAmounts: string[] = [];

    crewRows.forEach((member, index) => {
      const amounts = cashAdvanceAmountsFor(form, member.id);
      usdAmounts.push(amounts.usd);
      eurAmounts.push(amounts.eur);
      const y = CASH_ADVANCE_PAGE_HEIGHT_PT - cashAdvanceRowBaselineY(index);
      draw(String(index + 1), { x: CASH_ADVANCE_COL.rowNo, y, fontSize: CASH_ADVANCE_FONT });
      draw(formatCrewListName(member), {
        x: CASH_ADVANCE_COL.name,
        y,
        fontSize: CASH_ADVANCE_FONT,
        maxWidth: CASH_ADVANCE_NAME_MAX_WIDTH,
      });
      draw(member.rank, {
        x: CASH_ADVANCE_COL.rank,
        y,
        fontSize: CASH_ADVANCE_FONT,
        maxWidth: CASH_ADVANCE_RANK_MAX_WIDTH,
      });
      if (amounts.usd) {
        draw(amounts.usd, {
          x: CASH_ADVANCE_COL.usd,
          y,
          fontSize: CASH_ADVANCE_FONT,
          maxWidth: CASH_ADVANCE_AMOUNT_MAX_WIDTH,
        });
      }
      if (amounts.eur) {
        draw(amounts.eur, {
          x: CASH_ADVANCE_COL.eur,
          y,
          fontSize: CASH_ADVANCE_FONT,
          maxWidth: CASH_ADVANCE_AMOUNT_MAX_WIDTH,
        });
      }
    });

    const totalY = CASH_ADVANCE_PAGE_HEIGHT_PT - CASH_ADVANCE_TOTAL_ROW_BASELINE_Y;
    const totalUsd = sumCashAdvanceCurrency(usdAmounts);
    const totalEur = sumCashAdvanceCurrency(eurAmounts);
    if (totalUsd) {
      draw(totalUsd, {
        x: CASH_ADVANCE_COL.usd,
        y: totalY,
        fontSize: CASH_ADVANCE_FONT,
        maxWidth: CASH_ADVANCE_AMOUNT_MAX_WIDTH,
      });
    }
    if (totalEur) {
      draw(totalEur, {
        x: CASH_ADVANCE_COL.eur,
        y: totalY,
        fontSize: CASH_ADVANCE_FONT,
        maxWidth: CASH_ADVANCE_AMOUNT_MAX_WIDTH,
      });
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
    const res = await fetch(`${CASH_ADVANCE_TEMPLATE_URL}?v=${this.templateVersion}`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      throw new Error('Cash Advance template not found (public/cash-advance-empty.pdf)');
    }
    this.templateBytes = new Uint8Array(await res.arrayBuffer());
    this.loadedVersion = this.templateVersion;
    return this.templateBytes;
  }
}
