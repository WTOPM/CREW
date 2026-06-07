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
        y: placement.y - 4,
        width: (placement.maxWidth ?? 400) + 8,
        height: (placement.fontSize ?? 12) + 8,
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

    const allCrew = crew;
    const usdAmounts: string[] = [];
    const eurAmounts: string[] = [];

    for (let i = 0; i < allCrew.length; i++) {
      const member = allCrew[i];
      const amounts = cashAdvanceAmountsFor(form, member.id);
      usdAmounts.push(amounts.usd);
      eurAmounts.push(amounts.eur);

      const pageIndex = Math.floor(i / CASH_ADVANCE_MAX_CREW_ROWS);
      const rowIndex = i % CASH_ADVANCE_MAX_CREW_ROWS;

      if (pageIndex > 0 && rowIndex === 0) {
        const templateDoc = await PDFDocument.load(template);
        const [embeddedPage] = await doc.embedPages([templateDoc.getPages()[0]]);
        const newPage = doc.addPage([page.getWidth(), page.getHeight()]);
        newPage.drawPage(embeddedPage);
        
        // Clear all pre-printed row numbers on new page
        for (let clearIdx = 0; clearIdx < CASH_ADVANCE_MAX_CREW_ROWS; clearIdx++) {
          const clearY = CASH_ADVANCE_PAGE_HEIGHT_PT - cashAdvanceRowBaselineY(clearIdx);
          newPage.drawRectangle({
            x: CASH_ADVANCE_COL.rowNo - 2,
            y: clearY - 3,
            width: 30,
            height: 14,
            color: rgb(1, 1, 1),
          });
        }
      }

      const currentPage = pageIndex === 0 ? page : doc.getPages()[pageIndex];
      const y = CASH_ADVANCE_PAGE_HEIGHT_PT - cashAdvanceRowBaselineY(rowIndex);

      // Clear pre-printed row number from template
      currentPage.drawRectangle({
        x: CASH_ADVANCE_COL.rowNo - 2,
        y: y - 3,
        width: 30,
        height: 14,
        color: rgb(1, 1, 1),
      });

      const drawOnPage = (text: string, x: number, opts: { fontSize?: number; maxWidth?: number; useBold?: boolean }) => {
        const value = text.trim();
        if (!value) return;
        currentPage.drawText(value, {
          x,
          y,
          size: opts.fontSize ?? CASH_ADVANCE_FONT,
          font: opts.useBold ? bold : font,
          color: black,
          ...(opts.maxWidth != null ? { maxWidth: opts.maxWidth } : {}),
        });
      };

      drawOnPage(String(i + 1), CASH_ADVANCE_COL.rowNo, { fontSize: CASH_ADVANCE_FONT });
      drawOnPage(formatCrewListName(member), CASH_ADVANCE_COL.name, {
        fontSize: CASH_ADVANCE_FONT,
        maxWidth: CASH_ADVANCE_NAME_MAX_WIDTH,
      });
      drawOnPage(member.rank, CASH_ADVANCE_COL.rank, {
        fontSize: CASH_ADVANCE_FONT,
        maxWidth: CASH_ADVANCE_RANK_MAX_WIDTH,
      });
      if (amounts.usd) {
        drawOnPage(amounts.usd, CASH_ADVANCE_COL.usd, {
          fontSize: CASH_ADVANCE_FONT,
          maxWidth: CASH_ADVANCE_AMOUNT_MAX_WIDTH,
        });
      }
      if (amounts.eur) {
        drawOnPage(amounts.eur, CASH_ADVANCE_COL.eur, {
          fontSize: CASH_ADVANCE_FONT,
          maxWidth: CASH_ADVANCE_AMOUNT_MAX_WIDTH,
        });
      }
    }

    // Clear remaining empty rows on the last page
    const lastPageIndex = Math.floor((allCrew.length - 1) / CASH_ADVANCE_MAX_CREW_ROWS);
    const lastRowIndex = (allCrew.length - 1) % CASH_ADVANCE_MAX_CREW_ROWS;
    const lastPage = lastPageIndex === 0 ? page : doc.getPages()[lastPageIndex];
    
    for (let emptyRow = lastRowIndex + 1; emptyRow < CASH_ADVANCE_MAX_CREW_ROWS; emptyRow++) {
      const clearY = CASH_ADVANCE_PAGE_HEIGHT_PT - cashAdvanceRowBaselineY(emptyRow);
      lastPage.drawRectangle({
        x: CASH_ADVANCE_COL.rowNo - 2,
        y: clearY - 3,
        width: 30,
        height: 14,
        color: rgb(1, 1, 1),
      });
    }

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
