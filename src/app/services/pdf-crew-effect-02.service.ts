import { Injectable, inject } from '@angular/core';
import {
  AppData,
  CrewMember,
  formatCrewListName,
  formatPortCallPortName,
  portCountry,
} from '../models/crew.models';
import { crewEffectListRows } from '../utils/passenger-pdf.util';
import { CREW_EFFECT_NIL_LABEL, normalizeCrewEffectForm02 } from '../models/crew-effect.models';
import { PdfDeliveryService } from './pdf-delivery.service';
import { formatDisplayDate } from '../utils/date.util';
import { crewEffect02PdfFileName } from '../utils/pdf-filename.util';
import {
  CREW_EFFECT_02_COL,
  CREW_EFFECT_02_FIELDS,
  CREW_EFFECT_02_FONT,
  CREW_EFFECT_02_ROW_COUNT,
  CREW_EFFECT_02_TEMPLATE_VERSION,
  crewEffect02RowPdfLibY,
  type CrewEffect02TextPlacement,
} from './crew-effect-02-field-positions';
import { PdfOverlayService } from './pdf-overlay.service';

const CREW_EFFECT_02_TEMPLATE_URL = '/crew-effect-02-empty.pdf';

/** Crew Effect 02 — IMO (123.pdf), 1 page. */
@Injectable({ providedIn: 'root' })
export class PdfCrewEffect02Service {
  private readonly overlay = inject(PdfOverlayService);
  private readonly delivery = inject(PdfDeliveryService);

  private templateBytes: Uint8Array | null = null;
  private loadedVersion = 0;

  async buildFinalBytes(data: AppData): Promise<Uint8Array> {
    const bytes = await this.build(data);
    let out = await this.overlay.applyToPdfBytes(bytes, data.documentOverlay.crewEffect02);
    out = await this.overlay.applyCrewEffectCrewSignatures(out, data, 'crewEffect02');
    return out;
  }

  async openPreview(data: AppData): Promise<boolean> {
    const bytes = await this.buildFinalBytes(data);
    return this.delivery.deliver(bytes, this.fileName(data));
  }

  fileName(data: AppData): string {
    const { ship } = data;
    const voyageDate = ship.dateOfArrival || ship.dateOfDeparture;
    return crewEffect02PdfFileName(ship.name, voyageDate);
  }

  async build(data: AppData): Promise<Uint8Array> {
    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
    const template = await this.loadTemplate();
    const doc = await PDFDocument.load(template);
    const page = doc.getPages()[0];
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const black = rgb(0, 0, 0);

    const draw = (text: string, placement: CrewEffect02TextPlacement, useBold = false) => {
      const value = text.trim();
      if (!value) return;
      page.drawText(value, {
        x: placement.x,
        y: placement.y,
        size: placement.fontSize ?? CREW_EFFECT_02_FONT,
        font: useBold ? bold : font,
        color: black,
        ...(placement.maxWidth != null ? { maxWidth: placement.maxWidth } : {}),
      });
    };

    const form = normalizeCrewEffectForm02(data.crewEffectForm02);
    const { ship, crewArr, ports } = data;
    const isArrival = crewArr.isArrival;
    const crew = crewEffectListRows(data, form.appendPassengers, CREW_EFFECT_02_ROW_COUNT);

    const portName = formatPortCallPortName(ship.portOfCall);
    const country = portCountry(ship.portOfCall, ports);
    const portLine = country ? `${portName} / ${country}` : portName;

    draw('1', CREW_EFFECT_02_FIELDS.pageNo);
    if (isArrival) {
      draw('X', CREW_EFFECT_02_FIELDS.arrivalMark);
    } else {
      draw('X', CREW_EFFECT_02_FIELDS.departureMark);
    }
    draw(ship.name, CREW_EFFECT_02_FIELDS.shipName, true);
    draw(formatPortCallPortName(ship.nationality), CREW_EFFECT_02_FIELDS.nationality, true);
    draw(portLine, CREW_EFFECT_02_FIELDS.portOfCall, true);
    draw(
      formatDisplayDate(isArrival ? ship.dateOfArrival : ship.dateOfDeparture),
      CREW_EFFECT_02_FIELDS.voyageDate,
      true,
    );
    draw(formatDisplayDate(ship.dateOfArrival), CREW_EFFECT_02_FIELDS.signatureDate, true);

    this.drawCrewRows(page, font, black, crew, form);

    const master = this.findMaster(crew);
    if (master) {
      draw(this.formatCaptainName(master), CREW_EFFECT_02_FIELDS.captainName, true);
    }

    return doc.save();
  }

  private drawCrewRows(
    page: import('pdf-lib').PDFPage,
    font: import('pdf-lib').PDFFont,
    black: import('pdf-lib').RGB,
    crew: CrewMember[],
    form: ReturnType<typeof normalizeCrewEffectForm02>,
  ): void {
    const pe = form.others.trim();
    for (let i = 0; i < CREW_EFFECT_02_ROW_COUNT; i++) {
      const member = crew[i];
      const y = crewEffect02RowPdfLibY(i);
      const fontSize = CREW_EFFECT_02_FONT;
      if (!member) continue;
      this.drawTableCell(page, font, black, String(i + 1), CREW_EFFECT_02_COL.rowNo, y, fontSize);
      this.drawNameCell(
        page,
        font,
        black,
        formatCrewListName(member),
        CREW_EFFECT_02_COL.name,
        y,
        fontSize,
        CREW_EFFECT_02_COL.nameMaxWidth,
      );
      this.drawTableCell(
        page,
        font,
        black,
        member.rank,
        CREW_EFFECT_02_COL.rank,
        y,
        fontSize,
        CREW_EFFECT_02_COL.rankMaxWidth,
      );
      if (form.nilCigarettes) {
        this.drawTableCell(
          page,
          font,
          black,
          CREW_EFFECT_NIL_LABEL,
          CREW_EFFECT_02_COL.cigarettes,
          y,
          fontSize,
        );
      }
      if (form.nilTobaccoCigars) {
        this.drawTableCell(
          page,
          font,
          black,
          CREW_EFFECT_NIL_LABEL,
          CREW_EFFECT_02_COL.tobaccoCigars,
          y,
          fontSize,
        );
      }
      if (form.nilSpirits) {
        this.drawTableCell(
          page,
          font,
          black,
          CREW_EFFECT_NIL_LABEL,
          CREW_EFFECT_02_COL.spirits,
          y,
          fontSize,
        );
      }
      if (form.nilBeer) {
        this.drawTableCell(
          page,
          font,
          black,
          CREW_EFFECT_NIL_LABEL,
          CREW_EFFECT_02_COL.beer,
          y,
          fontSize,
        );
      }
      if (pe) {
        this.drawTableCell(
          page,
          font,
          black,
          pe,
          CREW_EFFECT_02_COL.other,
          y,
          fontSize,
          CREW_EFFECT_02_COL.otherMaxWidth,
        );
      }
    }
  }

  /** Family name, given names — fixed font; surname on row baseline, overflow below. */
  private drawNameCell(
    page: import('pdf-lib').PDFPage,
    font: import('pdf-lib').PDFFont,
    black: import('pdf-lib').RGB,
    text: string,
    x: number,
    y: number,
    fontSize: number,
    maxWidth: number,
  ): void {
    const value = text.trim();
    if (!value) return;

    const lines = this.splitCrewEffectNameLines(font, value, fontSize, maxWidth);
    lines.forEach((line, index) => {
      page.drawText(line, { x, y: y - index * fontSize, size: fontSize, font, color: black });
    });
  }

  /** Line 1 starts with surname; add given names while they fit; rest on line 2. */
  private splitCrewEffectNameLines(
    font: import('pdf-lib').PDFFont,
    text: string,
    fontSize: number,
    maxWidth: number,
  ): string[] {
    const fits = (line: string) => font.widthOfTextAtSize(line, fontSize) <= maxWidth;
    if (fits(text)) return [text];

    const words = text.split(/\s+/).filter(Boolean);
    if (words.length <= 1) return [text];

    let line1 = words[0];
    let nextIndex = 1;
    for (; nextIndex < words.length; nextIndex++) {
      const candidate = `${line1} ${words[nextIndex]}`;
      if (!fits(candidate)) break;
      line1 = candidate;
    }

    if (nextIndex >= words.length) return [line1];

    const line2 = words.slice(nextIndex).join(' ');
    return [line1, line2];
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

  private async loadTemplate(): Promise<Uint8Array> {
    if (this.templateBytes && this.loadedVersion === CREW_EFFECT_02_TEMPLATE_VERSION) {
      return this.templateBytes;
    }
    const res = await fetch(`${CREW_EFFECT_02_TEMPLATE_URL}?v=${CREW_EFFECT_02_TEMPLATE_VERSION}`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      throw new Error('Crew Effect 02 template not found (public/crew-effect-02-empty.pdf)');
    }
    this.templateBytes = new Uint8Array(await res.arrayBuffer());
    this.loadedVersion = CREW_EFFECT_02_TEMPLATE_VERSION;
    return this.templateBytes;
  }
}
