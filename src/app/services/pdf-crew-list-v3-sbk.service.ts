import { Injectable, inject } from '@angular/core';
import {
  AppData,
  CrewMember,
  formatPortCallPortName,
  portCountry,
} from '../models/crew.models';
import { resolveCrewListStampOptions } from '../models/document-overlay.models';
import { PdfDeliveryService } from './pdf-delivery.service';
import { PdfOverlayService } from './pdf-overlay.service';
import {
  CREW_LIST_V3_SBK_FONT,
  CREW_LIST_V3_SBK_ROW_LINE_HEIGHT,
  CREW_LIST_V3_SBK_FOOTER,
  CREW_LIST_V3_SBK_HEADER,
  CREW_LIST_V3_SBK_PORTS_FROM_TO_GAP,
  CREW_LIST_V3_SBK_MAX_ROWS,
  CREW_LIST_V3_SBK_ROW_COLS,
  CREW_LIST_V3_SBK_ROW_NO_X,
  CREW_LIST_V3_SBK_TEMPLATE_URL,
  CREW_LIST_V3_SBK_TEMPLATE_VERSION,
  crewListV3SbkRowY,
  type CrewListV3SbkRowCol,
  type CrewListV3SbkTextPlacement,
} from './crew-list-v3-sbk-coordinates';
import { formatBirthDate, formatDisplayDate } from '../utils/date.util';
import { crewListV3SbkPdfFileName } from '../utils/pdf-filename.util';

type PDFPage = import('pdf-lib').PDFPage;
type PDFFont = import('pdf-lib').PDFFont;
type RGB = import('pdf-lib').RGB;

@Injectable({ providedIn: 'root' })
export class PdfCrewListV3SbkService {
  private readonly overlay = inject(PdfOverlayService);
  private readonly delivery = inject(PdfDeliveryService);

  private templateBytes: Uint8Array | null = null;
  private loadedVersion = 0;

  async buildPreviewBytes(data: AppData, crew: CrewMember[]): Promise<Uint8Array> {
    const bytes = await this.build(data, crew);
    return this.overlay.applyToPdfBytes(bytes, resolveCrewListStampOptions(data.documentOverlay.crewList));
  }

  async openPreview(data: AppData, crew: CrewMember[]): Promise<boolean> {
    const bytes = await this.buildPreviewBytes(data, crew);
    return this.delivery.deliver(bytes, this.fileName(data));
  }

  fileName(data: AppData): string {
    const { ship, crewArr } = data;
    const voyageDate = crewArr.isArrival ? ship.dateOfArrival : ship.dateOfDeparture;
    return crewListV3SbkPdfFileName(ship.name, ship.portOfCall, voyageDate, crewArr.isArrival);
  }

  async build(data: AppData, crew: CrewMember[]): Promise<Uint8Array> {
    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
    const template = await this.loadTemplate();
    const doc = await PDFDocument.load(template);
    const templateDoc = await PDFDocument.load(template);
    const [embeddedTemplate] = await doc.embedPages([templateDoc.getPages()[0]]);

    const font = await doc.embedFont(StandardFonts.Helvetica);
    const black = rgb(0, 0, 0);

    if (crew.length === 0) {
      const page = doc.getPages()[0];
      this.drawHeader(page, font, black, data);
      this.drawFooter(page, font, black, data, crew);
      return doc.save();
    }

    const pageCount = Math.ceil(crew.length / CREW_LIST_V3_SBK_MAX_ROWS);
    const firstPage = doc.getPages()[0];

    for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
      const page =
        pageIndex === 0
          ? firstPage
          : this.addTemplatePage(doc, firstPage, embeddedTemplate);

      const slice = crew.slice(
        pageIndex * CREW_LIST_V3_SBK_MAX_ROWS,
        (pageIndex + 1) * CREW_LIST_V3_SBK_MAX_ROWS,
      );
      const rowOffset = pageIndex * CREW_LIST_V3_SBK_MAX_ROWS;

      this.drawHeader(page, font, black, data);
      this.drawCrewRows(page, font, black, slice, rowOffset);
      this.drawFooter(page, font, black, data, crew);
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
    placement: CrewListV3SbkTextPlacement,
    font: PDFFont,
    color: RGB,
  ): void {
    const value = text.trim();
    if (!value) return;
    page.drawText(value, {
      x: placement.x,
      y: placement.y,
      size: CREW_LIST_V3_SBK_FONT,
      font,
      color,
    });
  }

  private drawWrappedText(
    page: PDFPage,
    text: string,
    placement: CrewListV3SbkTextPlacement,
    font: PDFFont,
    color: RGB,
    maxLines: number,
  ): void {
    const value = text.trim();
    if (!value) return;
    const maxWidth = placement.maxWidth ?? 320;
    const lines = this.wrapCellLines(font, value, CREW_LIST_V3_SBK_FONT, maxWidth, maxLines);
    lines.forEach((line, index) => {
      page.drawText(line, {
        x: placement.x,
        y: placement.y - index * CREW_LIST_V3_SBK_ROW_LINE_HEIGHT,
        size: CREW_LIST_V3_SBK_FONT,
        font,
        color,
      });
    });
  }

  private drawHeader(page: PDFPage, font: PDFFont, black: RGB, data: AppData): void {
    const { ship, crewArr, ports } = data;
    const isArrival = crewArr.isArrival;
    const voyageDate = formatDisplayDate(
      isArrival ? ship.dateOfArrival : ship.dateOfDeparture,
    );

    const draw = (text: string, placement: CrewListV3SbkTextPlacement) =>
      this.drawText(page, text, placement, font, black);

    draw(ship.charterer, CREW_LIST_V3_SBK_HEADER.charterer);
    if (isArrival) {
      draw('X', CREW_LIST_V3_SBK_HEADER.arrivalMark);
    } else {
      draw('X', CREW_LIST_V3_SBK_HEADER.departureMark);
    }
    draw(formatPortCallPortName(ship.name), CREW_LIST_V3_SBK_HEADER.shipName);
    this.drawWrappedText(
      page,
      this.formatPortWithCountry(ship.portOfCall, ports),
      CREW_LIST_V3_SBK_HEADER.portOfCall,
      font,
      black,
      2,
    );
    draw(voyageDate, CREW_LIST_V3_SBK_HEADER.voyageDate);
    draw(formatPortCallPortName(ship.nationality), CREW_LIST_V3_SBK_HEADER.shipNationality);
    this.drawWrappedText(
      page,
      this.portsFromTo(data),
      CREW_LIST_V3_SBK_HEADER.portsFromTo,
      font,
      black,
      2,
    );
  }

  /** Previous port / country — next port / country on one line. */
  private portsFromTo(data: AppData): string {
    const { ship, ports } = data;
    const fmt = (portName: string) => this.formatPortWithCountry(portName, ports);
    return [fmt(ship.lastPortOfCall), fmt(ship.nextPortOfCall)]
      .filter(Boolean)
      .join(CREW_LIST_V3_SBK_PORTS_FROM_TO_GAP);
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
    black: RGB,
    data: AppData,
    listCrew: CrewMember[],
  ): void {
    const { ship, crewArr } = data;
    const isArrival = crewArr.isArrival;
    const voyageDate = formatDisplayDate(
      isArrival ? ship.dateOfArrival : ship.dateOfDeparture,
    );

    this.drawText(page, voyageDate, CREW_LIST_V3_SBK_FOOTER.signatureDate, font, black);

    const roster = data.crew.length > 0 ? data.crew : listCrew;
    const master = this.findMaster(roster);
    if (master) {
      this.drawWrappedText(
        page,
        this.formatCrewListV3SbkName(master),
        CREW_LIST_V3_SBK_FOOTER.masterName,
        font,
        black,
        2,
      );
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
    const rowOpts = { size: CREW_LIST_V3_SBK_FONT, font, color: black };

    crew.forEach((member, index) => {
      const y = crewListV3SbkRowY(index);

      page.drawText(String(rowOffset + index + 1), {
        x: CREW_LIST_V3_SBK_ROW_NO_X,
        y,
        ...rowOpts,
      });

      this.drawRowCell(page, this.formatCrewListV3SbkName(member), CREW_LIST_V3_SBK_ROW_COLS.name, y, rowOpts);
      this.drawRowCell(page, member.rank.trim(), CREW_LIST_V3_SBK_ROW_COLS.rank, y, rowOpts);
      this.drawRowCell(page, member.nationality.trim(), CREW_LIST_V3_SBK_ROW_COLS.nationality, y, rowOpts);
      this.drawRowCell(page, formatBirthDate(member.dateOfBirth), CREW_LIST_V3_SBK_ROW_COLS.dateOfBirth, y, rowOpts);
      this.drawRowCell(page, member.placeOfBirth.trim(), CREW_LIST_V3_SBK_ROW_COLS.placeOfBirth, y, rowOpts);
      this.drawRowCell(page, member.seamansBook.trim(), CREW_LIST_V3_SBK_ROW_COLS.sbookNo, y, rowOpts);
      this.drawRowCell(
        page,
        formatDisplayDate(member.sbookExpiryDate),
        CREW_LIST_V3_SBK_ROW_COLS.sbookExpiry,
        y,
        rowOpts,
      );
    });
  }

  private drawRowCell(
    page: PDFPage,
    text: string,
    col: CrewListV3SbkRowCol,
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
      const lineY = y - index * CREW_LIST_V3_SBK_ROW_LINE_HEIGHT;
      const size = this.fitFontSize(opts.font, line, col.maxWidth, opts.size);
      page.drawText(line, {
        x: col.x,
        y: lineY,
        size,
        font: opts.font,
        color: opts.color,
      });
    });
  }

  /** Shrink only when needed — full date/number, no ellipsis. */
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
      } else {
        lines.push(truncate ? this.truncateToWidth(font, word, size, maxWidth) : word);
        line = '';
      }
      if (lines.length === maxLines - 1) {
        const restWords = line ? [line, ...words.slice(wi + 1)] : words.slice(wi + 1);
        const rest = restWords.join(' ');
        lines.push(
          truncate ? this.truncateToWidth(font, rest, size, maxWidth) : rest,
        );
        return lines;
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
  private formatCrewListV3SbkName(member: Pick<CrewMember, 'familyName' | 'givenNames'>): string {
    const parts = [member.familyName?.trim(), member.givenNames?.trim()].filter(Boolean);
    return parts.join(' ').toUpperCase();
  }

  private async loadTemplate(): Promise<Uint8Array> {
    if (this.templateBytes && this.loadedVersion === CREW_LIST_V3_SBK_TEMPLATE_VERSION) {
      return this.templateBytes;
    }
    const res = await fetch(
      `${CREW_LIST_V3_SBK_TEMPLATE_URL}?v=${CREW_LIST_V3_SBK_TEMPLATE_VERSION}`,
      { cache: 'no-store' },
    );
    if (!res.ok) {
      throw new Error('Crew List v3 SBK template not found (public/crew-list-v3-sbk-empty.pdf)');
    }
    this.templateBytes = new Uint8Array(await res.arrayBuffer());
    this.loadedVersion = CREW_LIST_V3_SBK_TEMPLATE_VERSION;
    return this.templateBytes;
  }
}
