import { Injectable, inject } from '@angular/core';
import {
  AppData,
  CrewMember,
  filterActiveCrewList,
  formatCrewListName,
  formatPortCallPortName,
} from '../models/crew.models';
import {
  CREW_EFFECT_NIL_LABEL,
  normalizeCrewEffectForm03,
} from '../models/crew-effect.models';
import { PdfDeliveryService } from './pdf-delivery.service';
import { crewEffect03PdfFileName } from '../utils/pdf-filename.util';
import {
  CREW_EFFECT_03_COL,
  CREW_EFFECT_03_FIELDS,
  CREW_EFFECT_03_FONT,
  CREW_EFFECT_03_ROW_COUNT,
  CREW_EFFECT_03_TEMPLATE_VERSION,
  crewEffect03RowPdfLibY,
  type CrewEffect03TextPlacement,
} from './crew-effect-03-field-positions';
import { PdfOverlayService } from './pdf-overlay.service';

const CREW_EFFECT_03_TEMPLATE_URL = '/crew-effect-03-empty.pdf';

/** Crew Effect 03 — Germany; 2 pages, stamp on page 2 only. */
@Injectable({ providedIn: 'root' })
export class PdfCrewEffect03Service {
  private readonly overlay = inject(PdfOverlayService);
  private readonly delivery = inject(PdfDeliveryService);

  private templateBytes: Uint8Array | null = null;
  private loadedVersion = 0;

  async buildFinalBytes(data: AppData): Promise<Uint8Array> {
    const bytes = await this.build(data);
    return this.overlay.applyCrewEffect03Overlay(bytes, data.documentOverlay.crewEffect03);
  }

  async openPreview(data: AppData): Promise<boolean> {
    const bytes = await this.buildFinalBytes(data);
    return this.delivery.deliver(bytes, this.fileName(data));
  }

  fileName(data: AppData): string {
    const { ship } = data;
    const voyageDate = ship.dateOfArrival || ship.dateOfDeparture;
    return crewEffect03PdfFileName(ship.name, voyageDate);
  }

  async build(data: AppData): Promise<Uint8Array> {
    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
    const template = await this.loadTemplate();
    const doc = await PDFDocument.load(template);
    const pages = doc.getPages();
    if (!pages.length) {
      throw new Error('Crew Effect 03 template has no pages');
    }

    const page1 = pages[0];
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const black = rgb(0, 0, 0);

    const draw = (text: string, placement: CrewEffect03TextPlacement, useBold = false) => {
      const value = text.trim();
      if (!value) return;
      page1.drawText(value, {
        x: placement.x,
        y: placement.y,
        size: placement.fontSize ?? CREW_EFFECT_03_FONT,
        font: useBold ? bold : font,
        color: black,
        ...(placement.maxWidth != null ? { maxWidth: placement.maxWidth } : {}),
      });
    };

    const form = normalizeCrewEffectForm03(data.crewEffectForm03);
    const { ship } = data;
    const crew = this.arrivalCrewInHomeOrder(data);
    draw('1', CREW_EFFECT_03_FIELDS.pageNo);
    draw(ship.name, CREW_EFFECT_03_FIELDS.shipName, true);
    draw(formatPortCallPortName(ship.nationality), CREW_EFFECT_03_FIELDS.nationality, true);
    this.drawCrewRows(page1, font, black, crew, form);

    const master = this.findMaster(crew);
    if (master) {
      draw(this.formatCaptainName(master), CREW_EFFECT_03_FIELDS.captainName, true);
    }

    return doc.save();
  }

  private drawCrewRows(
    page: import('pdf-lib').PDFPage,
    font: import('pdf-lib').PDFFont,
    black: import('pdf-lib').RGB,
    crew: CrewMember[],
    form: ReturnType<typeof normalizeCrewEffectForm03>,
  ): void {
    const others = form.others.trim();
    for (let i = 0; i < CREW_EFFECT_03_ROW_COUNT; i++) {
      const member = crew[i];
      const y = crewEffect03RowPdfLibY(i);
      const fontSize = CREW_EFFECT_03_FONT;
      if (!member) continue;
      this.drawTableCell(page, font, black, String(i + 1), CREW_EFFECT_03_COL.rowNo, y, fontSize);
      this.drawTableCell(
        page,
        font,
        black,
        formatCrewListName(member),
        CREW_EFFECT_03_COL.name,
        y,
        fontSize,
        CREW_EFFECT_03_COL.nameMaxWidth,
      );
      this.drawTableCell(
        page,
        font,
        black,
        member.rank,
        CREW_EFFECT_03_COL.rank,
        y,
        fontSize,
        CREW_EFFECT_03_COL.rankMaxWidth,
      );
      if (form.nilCigarettes) {
        this.drawTableCell(page, font, black, CREW_EFFECT_NIL_LABEL, CREW_EFFECT_03_COL.cigarettes, y, fontSize);
      }
      if (form.nilCigars) {
        this.drawTableCell(page, font, black, CREW_EFFECT_NIL_LABEL, CREW_EFFECT_03_COL.cigars, y, fontSize);
      }
      if (form.nilSpirits) {
        this.drawTableCell(page, font, black, CREW_EFFECT_NIL_LABEL, CREW_EFFECT_03_COL.spirits, y, fontSize);
      }
      if (form.nilWeapons) {
        this.drawTableCell(page, font, black, CREW_EFFECT_NIL_LABEL, CREW_EFFECT_03_COL.weapons, y, fontSize);
      }
      if (form.nilAmmunition) {
        this.drawTableCell(page, font, black, CREW_EFFECT_NIL_LABEL, CREW_EFFECT_03_COL.ammunition, y, fontSize);
      }
      if (others) {
        this.drawTableCell(
          page,
          font,
          black,
          others,
          CREW_EFFECT_03_COL.others,
          y,
          fontSize,
          CREW_EFFECT_03_COL.othersMaxWidth,
        );
      }
    }
  }

  private drawTableCell(
    page: import('pdf-lib').PDFPage,
    font: import('pdf-lib').PDFFont,
    black: import('pdf-lib').RGB,
    text: string,
    x: number,
    y: number,
    fontSize: number,
    maxWidth?: number,
  ): void {
    const value = text.trim();
    if (!value) return;
    let size = fontSize;
    let line = value;
    if (maxWidth != null) {
      size = this.fitFontSize(font, line, maxWidth, fontSize);
      line = this.truncateToWidth(font, line, size, maxWidth);
    }
    page.drawText(line, { x, y, size, font, color: black });
  }

  private fitFontSize(
    font: import('pdf-lib').PDFFont,
    text: string,
    maxWidth: number,
    baseSize: number,
  ): number {
    let size = baseSize;
    while (size > 5.5 && font.widthOfTextAtSize(text, size) > maxWidth) {
      size -= 0.25;
    }
    return size;
  }

  private truncateToWidth(
    font: import('pdf-lib').PDFFont,
    text: string,
    size: number,
    maxWidth: number,
  ): string {
    if (font.widthOfTextAtSize(text, size) <= maxWidth) {
      return text;
    }
    let trimmed = text;
    while (trimmed.length > 1 && font.widthOfTextAtSize(`${trimmed}…`, size) > maxWidth) {
      trimmed = trimmed.slice(0, -1);
    }
    return trimmed.length < text.length ? `${trimmed}…` : trimmed;
  }

  private findMaster(crew: CrewMember[]): CrewMember | undefined {
    const exact = crew.find((m) => m.rank.trim().toLowerCase() === 'master');
    if (exact) return exact;
    return crew.find((m) => m.rank.trim().toLowerCase().includes('master'));
  }

  private formatCaptainName(member: Pick<CrewMember, 'familyName' | 'givenNames'>): string {
    const parts = [member.familyName?.trim(), member.givenNames?.trim()].filter(Boolean);
    return parts.join(' ').toUpperCase();
  }

  private arrivalCrewInHomeOrder(data: AppData): CrewMember[] {
    return filterActiveCrewList(data.crew, 'arrival').slice(0, CREW_EFFECT_03_ROW_COUNT);
  }

  private async loadTemplate(): Promise<Uint8Array> {
    if (this.templateBytes && this.loadedVersion === CREW_EFFECT_03_TEMPLATE_VERSION) {
      return this.templateBytes;
    }
    const res = await fetch(
      `${CREW_EFFECT_03_TEMPLATE_URL}?v=${CREW_EFFECT_03_TEMPLATE_VERSION}`,
      { cache: 'no-store' },
    );
    if (!res.ok) {
      throw new Error('Crew Effect 03 template not found (public/crew-effect-03-empty.pdf)');
    }
    this.templateBytes = new Uint8Array(await res.arrayBuffer());
    this.loadedVersion = CREW_EFFECT_03_TEMPLATE_VERSION;
    return this.templateBytes;
  }
}
