import { Injectable, inject } from '@angular/core';
import { AppData, CrewMember, formatPortCallPortName, portCountry } from '../models/crew.models';
import { resolveCrewListStampOptions } from '../models/document-overlay.models';
import { PdfDeliveryService } from './pdf-delivery.service';
import { PdfOverlayService } from './pdf-overlay.service';
import {
  CREW_LIST_V2_FONT_HEADER,
  CREW_LIST_V2_FONT_ROW,
  CREW_LIST_V2_ROW_LINE_HEIGHT,
  CREW_LIST_V2_FOOTER,
  CREW_LIST_V2_HEADER,
  CREW_LIST_V2_PORTS_FROM_TO_GAP,
  CREW_LIST_V2_MAX_ROWS,
  CREW_LIST_V2_ROW_COLS,
  CREW_LIST_V2_ROW_NO_X,
  CREW_LIST_V2_TEMPLATE_URL,
  CREW_LIST_V2_TEMPLATE_VERSION,
  crewListV2RowY,
  type CrewListV2RowCol,
  type CrewListV2TextPlacement,
} from './crew-list-v2-coordinates';
import { formatBirthDate, formatDisplayDate } from '../utils/date.util';
import { crewListV2PdfFileName } from '../utils/pdf-filename.util';
import { CREW_LIST_BODY_NIL_LABEL, CREW_LIST_BODY_NIL_GRAY } from './crew-list-coordinates';

type PDFPage = import('pdf-lib').PDFPage;
type PDFFont = import('pdf-lib').PDFFont;
type RGB = import('pdf-lib').RGB;

@Injectable({ providedIn: 'root' })
export class PdfCrewListV2Service {
  private readonly overlay = inject(PdfOverlayService);
  private readonly delivery = inject(PdfDeliveryService);

  private templateBytes: Uint8Array | null = null;
  private loadedVersion = 0;

  async buildPreviewBytes(data: AppData, crew: CrewMember[]): Promise<Uint8Array> {
    const bytes = await this.build(data, crew);
    return this.overlay.applyToPdfBytes(
      bytes,
      resolveCrewListStampOptions(data.documentOverlay.crewList),
    );
  }

  async openPreview(data: AppData, crew: CrewMember[]): Promise<boolean> {
    const bytes = await this.buildPreviewBytes(data, crew);
    return this.delivery.deliver(bytes, this.fileName(data));
  }

  fileName(data: AppData): string {
    const { ship, crewArr } = data;
    const voyageDate = crewArr.isArrival ? ship.dateOfArrival : ship.dateOfDeparture;
    return crewListV2PdfFileName(ship.name, ship.portOfCall, voyageDate, crewArr.isArrival);
  }

  async build(data: AppData, crew: CrewMember[]): Promise<Uint8Array> {
    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
    const template = await this.loadTemplate();
    const doc = await PDFDocument.load(template);
    const templateDoc = await PDFDocument.load(template);
    const [embeddedTemplate] = await doc.embedPages([templateDoc.getPages()[0]]);

    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const black = rgb(0, 0, 0);
    const nilGray = rgb(
      CREW_LIST_BODY_NIL_GRAY.r / 255,
      CREW_LIST_BODY_NIL_GRAY.g / 255,
      CREW_LIST_BODY_NIL_GRAY.b / 255,
    );

    if (crew.length === 0) {
      const page = doc.getPages()[0];
      this.drawHeader(page, font, bold, black, data, 1);
      this.drawBodyNil(page, bold, nilGray);
      this.drawFooter(page, font, bold, black, data, crew);
      return doc.save();
    }

    const pageCount = Math.ceil(crew.length / CREW_LIST_V2_MAX_ROWS);
    const firstPage = doc.getPages()[0];

    for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
      const page =
        pageIndex === 0 ? firstPage : this.addTemplatePage(doc, firstPage, embeddedTemplate);

      const slice = crew.slice(
        pageIndex * CREW_LIST_V2_MAX_ROWS,
        (pageIndex + 1) * CREW_LIST_V2_MAX_ROWS,
      );
      const rowOffset = pageIndex * CREW_LIST_V2_MAX_ROWS;

      this.drawHeader(page, font, bold, black, data, pageIndex + 1);
      this.drawCrewRows(page, font, black, slice, rowOffset);
      this.drawFooter(page, font, bold, black, data, crew);
    }

    return doc.save();
  }

  private addTemplatePage(
    doc: import('pdf-lib').PDFDocument,
    firstPage: PDFPage,
    embeddedTemplate: import('pdf-lib').PDFEmbeddedPage,
  ): PDFPage {
    const page = doc.addPage([firstPage.getWidth(), firstPage.getHeight()]);
    page.drawPage(embeddedTemplate);
    return page;
  }

  private drawText(
    page: PDFPage,
    text: string,
    placement: CrewListV2TextPlacement,
    font: PDFFont,
    bold: PDFFont,
    color: RGB,
    useBold = false,
  ): void {
    const value = text.trim();
    if (!value) return;
    page.drawText(value, {
      x: placement.x,
      y: placement.y,
      size: placement.fontSize ?? CREW_LIST_V2_FONT_HEADER,
      font: useBold ? bold : font,
      color,
      ...(placement.maxWidth != null ? { maxWidth: placement.maxWidth } : {}),
    });
  }

  private drawHeader(
    page: PDFPage,
    font: PDFFont,
    bold: PDFFont,
    black: RGB,
    data: AppData,
    pageNo: number,
  ): void {
    const { ship, crewArr, ports } = data;
    const isArrival = crewArr.isArrival;
    const voyageDate = formatDisplayDate(isArrival ? ship.dateOfArrival : ship.dateOfDeparture);

    const draw = (text: string, placement: CrewListV2TextPlacement, useBold = false) =>
      this.drawText(page, text, placement, font, bold, black, useBold);

    draw(formatPortCallPortName(ship.name), CREW_LIST_V2_HEADER.shipName, true);
    draw(formatPortCallPortName(ship.nationality), CREW_LIST_V2_HEADER.shipNationality, true);
    if (isArrival) {
      draw('X', CREW_LIST_V2_HEADER.arrivalMark);
    } else {
      draw('X', CREW_LIST_V2_HEADER.departureMark);
    }
    draw(this.formatPortWithCountry(ship.portOfCall, ports), CREW_LIST_V2_HEADER.portOfCall, true);
    draw(voyageDate, CREW_LIST_V2_HEADER.voyageDate, true);
    draw(String(pageNo), CREW_LIST_V2_HEADER.pageNo);
    this.drawPortsFromTo(
      page,
      bold,
      black,
      this.portsFromTo(data),
      CREW_LIST_V2_HEADER.portsFromTo,
    );
  }

  private drawPortsFromTo(
    page: PDFPage,
    bold: PDFFont,
    color: RGB,
    text: string,
    placement: CrewListV2TextPlacement,
  ): void {
    const value = text.trim();
    if (!value) return;
    const maxWidth = placement.maxWidth ?? 320;
    const baseSize = placement.fontSize ?? CREW_LIST_V2_FONT_HEADER;
    const size = this.fitFontSize(bold, value, maxWidth, baseSize);
    page.drawText(value, {
      x: placement.x,
      y: placement.y,
      size,
      font: bold,
      color,
    });
  }

  /** Field 5 — last port + next port on one line. */
  private portsFromTo(data: AppData): string {
    const { ship, ports } = data;
    const fmt = (portName: string) => this.formatPortWithCountry(portName, ports);
    return [fmt(ship.lastPortOfCall), fmt(ship.nextPortOfCall)]
      .filter(Boolean)
      .join(CREW_LIST_V2_PORTS_FROM_TO_GAP);
  }

  private formatPortWithCountry(portName: string, ports: AppData['ports']): string {
    const name = formatPortCallPortName(portName);
    if (!name) return '';
    const country = portCountry(portName, ports);
    return country ? `${name} / ${country}` : name;
  }

  private drawFooter(
    page: PDFPage,
    font: PDFFont,
    bold: PDFFont,
    black: RGB,
    data: AppData,
    listCrew: CrewMember[],
  ): void {
    const { ship, crewArr } = data;
    const isArrival = crewArr.isArrival;
    const voyageDate = formatDisplayDate(isArrival ? ship.dateOfArrival : ship.dateOfDeparture);
    const draw = (text: string, placement: CrewListV2TextPlacement, useBold = false) =>
      this.drawText(page, text, placement, font, bold, black, useBold);

    draw(voyageDate, CREW_LIST_V2_FOOTER.signatureDate, true);

    const roster = data.crew.length > 0 ? data.crew : listCrew;
    const master = this.findMaster(roster);
    if (master) {
      const name = this.formatCrewListV2Name(master);
      const placement = CREW_LIST_V2_FOOTER.masterName;
      const maxWidth = placement.maxWidth ?? 155;
      const baseSize = placement.fontSize ?? CREW_LIST_V2_FONT_HEADER;
      const size = this.fitFontSize(bold, name, maxWidth, baseSize);
      page.drawText(name, {
        x: placement.x,
        y: placement.y,
        size,
        font: bold,
        color: black,
      });
    }
  }

  private findMaster(crew: CrewMember[]): CrewMember | undefined {
    const exact = crew.find((m) => m.rank.trim().toLowerCase() === 'master');
    if (exact) return exact;
    return crew.find((m) => m.rank.trim().toLowerCase().includes('master'));
  }

  private drawCrewRows(
    page: PDFPage,
    font: PDFFont,
    black: RGB,
    crew: CrewMember[],
    rowOffset: number,
  ): void {
    crew.forEach((member, index) => {
      const y = crewListV2RowY(index);
      const rowOpts = { size: CREW_LIST_V2_FONT_ROW, font, color: black };

      page.drawText(String(rowOffset + index + 1), {
        x: CREW_LIST_V2_ROW_NO_X,
        y,
        ...rowOpts,
      });

      this.drawRowCell(
        page,
        this.formatCrewListV2Name(member),
        CREW_LIST_V2_ROW_COLS.name,
        y,
        rowOpts,
      );
      this.drawRowCell(page, member.rank.trim(), CREW_LIST_V2_ROW_COLS.rank, y, rowOpts);
      this.drawRowCell(
        page,
        member.nationality.trim(),
        CREW_LIST_V2_ROW_COLS.nationality,
        y,
        rowOpts,
      );
      this.drawRowCell(
        page,
        formatBirthDate(member.dateOfBirth),
        CREW_LIST_V2_ROW_COLS.dateOfBirth,
        y,
        rowOpts,
      );
      this.drawRowCell(
        page,
        member.placeOfBirth.trim(),
        CREW_LIST_V2_ROW_COLS.placeOfBirth,
        y,
        rowOpts,
      );
      this.drawRowCell(page, member.passport.trim(), CREW_LIST_V2_ROW_COLS.passportNo, y, rowOpts);
      this.drawRowCell(
        page,
        formatDisplayDate(member.passportExpiryDate),
        CREW_LIST_V2_ROW_COLS.passportExpiry,
        y,
        rowOpts,
      );
      this.drawRowCell(
        page,
        member.passportPlaceOfIssue.trim().toUpperCase(),
        CREW_LIST_V2_ROW_COLS.passportPlaceOfIssue,
        y,
        rowOpts,
      );
      this.drawRowCell(
        page,
        this.formatCrewListV2Gender(member.gender),
        CREW_LIST_V2_ROW_COLS.gender,
        y,
        rowOpts,
      );
    });
  }

  private drawRowCell(
    page: PDFPage,
    text: string,
    col: CrewListV2RowCol,
    y: number,
    opts: { size: number; font: PDFFont; color: RGB },
  ): void {
    const value = text.trim();
    if (!value) return;
    const truncate = col.truncate !== false;
    const lines = this.wrapCellLines(
      opts.font,
      value,
      opts.size,
      col.maxWidth,
      col.maxLines,
      truncate,
    );
    lines.forEach((line, index) => {
      const lineY = y - index * CREW_LIST_V2_ROW_LINE_HEIGHT;
      const size = this.fitFontSize(opts.font, line, col.maxWidth, opts.size);
      const textWidth = opts.font.widthOfTextAtSize(line, size);
      const cellLeft = col.x;
      const cellRight = col.drawRight ?? col.x + col.maxWidth;
      let drawX = col.x;
      if (col.align === 'center' && col.drawRight != null) {
        drawX = cellLeft + (cellRight - cellLeft - textWidth) / 2;
      } else if (col.align === 'right' && col.drawRight != null) {
        drawX = cellRight - textWidth;
      }
      page.drawText(line, {
        x: drawX,
        y: lineY,
        size,
        font: opts.font,
        color: opts.color,
      });
    });
  }

  /** Shrink only when needed — full text, no ellipsis (dates, passport no.). */
  private fitFontSize(font: PDFFont, text: string, maxWidth: number, baseSize: number): number {
    let size = baseSize;
    while (size > 4.75 && font.widthOfTextAtSize(text, size) > maxWidth) {
      size -= 0.25;
    }
    return size;
  }

  private wrapCellLines(
    font: PDFFont,
    text: string,
    size: number,
    maxWidth: number,
    maxLines: number,
    truncate = true,
  ): string[] {
    if (font.widthOfTextAtSize(text, size) <= maxWidth) {
      return [text];
    }
    if (maxLines <= 1) {
      return truncate ? [this.truncateToWidth(font, text, size, maxWidth)] : [text];
    }

    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = '';

    for (let wi = 0; wi < words.length; wi++) {
      const word = words[wi];
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) {
        lines.push(line);
        line = word;
      } else if (truncate) {
        lines.push(this.truncateToWidth(font, word, size, maxWidth));
        line = '';
      } else {
        lines.push(word);
        line = '';
      }
      if (lines.length === maxLines - 1) {
        const restWords = line ? [line, ...words.slice(wi + 1)] : words.slice(wi + 1);
        lines.push(restWords.join(' '));
        return lines.slice(0, maxLines);
      }
    }
    if (line) {
      lines.push(line);
    }
    return lines.slice(0, maxLines);
  }

  private truncateToWidth(font: PDFFont, text: string, size: number, maxWidth: number): string {
    if (font.widthOfTextAtSize(text, size) <= maxWidth) {
      return text;
    }
    let trimmed = text;
    while (trimmed.length > 1 && font.widthOfTextAtSize(`${trimmed}…`, size) > maxWidth) {
      trimmed = trimmed.slice(0, -1);
    }
    return trimmed.length < text.length ? `${trimmed}…` : trimmed;
  }

  /** Surname and given names — ALL CAPS, space-separated (no comma). */
  private formatCrewListV2Name(member: Pick<CrewMember, 'familyName' | 'givenNames'>): string {
    const parts = [member.familyName?.trim(), member.givenNames?.trim()].filter(Boolean);
    return parts.join(' ').toUpperCase();
  }

  private formatCrewListV2Gender(gender: CrewMember['gender']): string {
    if (gender === 'MALE' || gender === 'FEMALE') return gender;
    return '';
  }

  private drawBodyNil(page: PDFPage, bold: PDFFont, color: RGB): void {
    page.drawText(CREW_LIST_BODY_NIL_LABEL, {
      x: 280,
      y: 520,
      size: 14,
      font: bold,
      color,
    });
  }

  private async loadTemplate(): Promise<Uint8Array> {
    if (this.templateBytes && this.loadedVersion === CREW_LIST_V2_TEMPLATE_VERSION) {
      return this.templateBytes;
    }
    const res = await fetch(`${CREW_LIST_V2_TEMPLATE_URL}?v=${CREW_LIST_V2_TEMPLATE_VERSION}`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      throw new Error('Crew List v2 template not found (public/crew-list-v2-empty.pdf)');
    }
    this.templateBytes = new Uint8Array(await res.arrayBuffer());
    this.loadedVersion = CREW_LIST_V2_TEMPLATE_VERSION;
    return this.templateBytes;
  }
}
