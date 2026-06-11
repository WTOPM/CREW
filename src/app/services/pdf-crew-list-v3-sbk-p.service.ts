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
  CREW_LIST_V3_SBK_P_COL_TEXT_MAX_PT,
  CREW_LIST_V3_SBK_P_NATIONALITY_FIELD_MAX_PT,
  CREW_LIST_V3_SBK_P_NATIONALITY_MAX_LINES,
  CREW_LIST_V3_SBK_P_NATIONALITY_LINE_STEP,
  CREW_LIST_V3_SBK_P_NAME_FIELD_MAX_PT,
  CREW_LIST_V3_SBK_P_SBOOK_PLACE_FIELD_MAX_PT,
  CREW_LIST_V3_SBK_P_WRAP_LINE_STEP,
  CREW_LIST_V3_SBK_P_WRAP_MAX_LINES,
  CREW_LIST_V3_SBK_P_BIRTH_FIELD_MAX_PT,
  CREW_LIST_V3_SBK_P_BIRTH_PLACE_GAP,
  CREW_LIST_V3_SBK_P_COL_Y,
  CREW_LIST_V3_SBK_P_FONT,
  CREW_LIST_V3_SBK_P_TEXT_ROTATION,
  CREW_LIST_V3_SBK_P_HEADER,
  CREW_LIST_V3_SBK_P_FOOTER,
  CREW_LIST_V3_SBK_P_PORTS_FROM_TO_GAP,
  CREW_LIST_V3_SBK_P_MAX_ROWS,
  CREW_LIST_V3_SBK_P_TEMPLATE_URL,
  CREW_LIST_V3_SBK_P_TEMPLATE_VERSION,
  crewListV3SbkPColX,
  crewListV3SbkPRowNoPlacement,
  type CrewListV3SbkPColField,
  type CrewListV3SbkPTextPlacement,
} from './crew-list-v3-sbk-p-coordinates';
import { formatBirthDate, formatDisplayDate } from '../utils/date.util';
import { crewListV3SbkPPdfFileName } from '../utils/pdf-filename.util';

type PDFPage = import('pdf-lib').PDFPage;
type PDFFont = import('pdf-lib').PDFFont;
type RGB = import('pdf-lib').RGB;

@Injectable({ providedIn: 'root' })
export class PdfCrewListV3SbkPService {
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
    return crewListV3SbkPPdfFileName(ship.name, ship.portOfCall, voyageDate, crewArr.isArrival);
  }

  async build(data: AppData, crew: CrewMember[]): Promise<Uint8Array> {
    const { PDFDocument, StandardFonts, rgb, degrees } = await import('pdf-lib');
    const template = await this.loadTemplate();
    const doc = await PDFDocument.load(template);
    const templateDoc = await PDFDocument.load(template);
    const [embeddedTemplate] = await doc.embedPages([templateDoc.getPages()[0]]);

    const font = await doc.embedFont(StandardFonts.Helvetica);
    const black = rgb(0, 0, 0);
    const textRotate = degrees(CREW_LIST_V3_SBK_P_TEXT_ROTATION);
    const firstPage = doc.getPages()[0];

    if (crew.length === 0) {
      this.drawHeader(firstPage, font, black, data, textRotate);
      this.drawFooter(firstPage, font, black, data, crew, textRotate);
      return doc.save();
    }

    const pageCount = Math.ceil(crew.length / CREW_LIST_V3_SBK_P_MAX_ROWS);

    for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
      const page =
        pageIndex === 0
          ? firstPage
          : this.addTemplatePage(doc, firstPage, embeddedTemplate);

      const slice = crew.slice(
        pageIndex * CREW_LIST_V3_SBK_P_MAX_ROWS,
        (pageIndex + 1) * CREW_LIST_V3_SBK_P_MAX_ROWS,
      );
      const rowOffset = pageIndex * CREW_LIST_V3_SBK_P_MAX_ROWS;

      this.drawHeader(page, font, black, data, textRotate);
      this.drawCrewColumns(page, font, black, slice, rowOffset, textRotate);
      this.drawFooter(page, font, black, data, crew, textRotate);
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

  private colAt(colIndex: number, field: CrewListV3SbkPColField): CrewListV3SbkPTextPlacement {
    return { x: crewListV3SbkPColX(colIndex), y: CREW_LIST_V3_SBK_P_COL_Y[field] };
  }

  private drawText(
    page: PDFPage,
    text: string,
    placement: CrewListV3SbkPTextPlacement,
    font: PDFFont,
    color: RGB,
    textRotate: ReturnType<typeof import('pdf-lib').degrees>,
    size = CREW_LIST_V3_SBK_P_FONT,
  ): void {
    const value = text.trim();
    if (!value) return;
    page.drawText(value, {
      x: placement.x,
      y: placement.y,
      size,
      font,
      color,
      rotate: textRotate,
      ...(placement.maxWidth != null ? { maxWidth: placement.maxWidth } : {}),
    });
  }

  private drawFit(
    page: PDFPage,
    text: string,
    placement: CrewListV3SbkPTextPlacement,
    font: PDFFont,
    color: RGB,
    textRotate: ReturnType<typeof import('pdf-lib').degrees>,
    maxWidth = CREW_LIST_V3_SBK_P_COL_TEXT_MAX_PT,
  ): void {
    const value = text.trim();
    if (!value) return;
    const size = this.fitFontSize(font, value, maxWidth, CREW_LIST_V3_SBK_P_FONT);
    this.drawText(page, value, placement, font, color, textRotate, size);
  }

  private drawHeader(
    page: PDFPage,
    font: PDFFont,
    black: RGB,
    data: AppData,
    textRotate: ReturnType<typeof import('pdf-lib').degrees>,
  ): void {
    const { ship, crewArr, ports } = data;
    const isArrival = crewArr.isArrival;
    const voyageDate = formatDisplayDate(
      isArrival ? ship.dateOfArrival : ship.dateOfDeparture,
    );

    const draw = (text: string, placement: CrewListV3SbkPTextPlacement) =>
      this.drawText(page, text, placement, font, black, textRotate);

    draw(ship.charterer, CREW_LIST_V3_SBK_P_HEADER.charterer);
    draw(formatPortCallPortName(ship.name), CREW_LIST_V3_SBK_P_HEADER.shipName);
    draw(formatPortCallPortName(ship.nationality), CREW_LIST_V3_SBK_P_HEADER.shipNationality);
    draw(this.formatPortWithCountry(ship.portOfCall, ports), CREW_LIST_V3_SBK_P_HEADER.portOfCall);
    if (isArrival) {
      draw('X', CREW_LIST_V3_SBK_P_HEADER.arrivalMark);
    } else {
      draw('X', CREW_LIST_V3_SBK_P_HEADER.departureMark);
    }
    draw(this.portsFromTo(data), CREW_LIST_V3_SBK_P_HEADER.portsFromTo);
    draw(voyageDate, CREW_LIST_V3_SBK_P_HEADER.voyageDate);
    draw(ship.imoNo.trim(), CREW_LIST_V3_SBK_P_HEADER.imoNo);
    draw(ship.callSign.trim(), CREW_LIST_V3_SBK_P_HEADER.callSign);
    draw(ship.voyageNumber.trim(), CREW_LIST_V3_SBK_P_HEADER.voyageNumber);
  }

  private drawFooter(
    page: PDFPage,
    font: PDFFont,
    black: RGB,
    data: AppData,
    listCrew: CrewMember[],
    textRotate: ReturnType<typeof import('pdf-lib').degrees>,
  ): void {
    const { ship, crewArr } = data;
    const voyageDate = formatDisplayDate(
      crewArr.isArrival ? ship.dateOfArrival : ship.dateOfDeparture,
    );

    this.drawText(page, voyageDate, CREW_LIST_V3_SBK_P_FOOTER.signatureDate, font, black, textRotate);

    const roster = data.crew.length > 0 ? data.crew : listCrew;
    const master = this.findMaster(roster);
    if (master) {
      this.drawText(
        page,
        this.formatName(master),
        CREW_LIST_V3_SBK_P_FOOTER.masterName,
        font,
        black,
        textRotate,
      );
    }
  }

  private findMaster(crew: CrewMember[]): CrewMember | undefined {
    const exact = crew.find((m) => m.rank.trim().toLowerCase() === 'master');
    if (exact) return exact;
    return crew.find((m) => m.rank.trim().toLowerCase().includes('master'));
  }

  private portsFromTo(data: AppData): string {
    const { ship, ports } = data;
    const fmt = (portName: string) => this.formatPortWithCountry(portName, ports);
    return [fmt(ship.lastPortOfCall), fmt(ship.nextPortOfCall)]
      .filter(Boolean)
      .join(CREW_LIST_V3_SBK_P_PORTS_FROM_TO_GAP);
  }

  private formatPortWithCountry(portName: string, ports: AppData['ports']): string {
    const name = formatPortCallPortName(portName);
    if (!name) return '';
    const country = portCountry(portName, ports);
    return country ? `${name} / ${country}` : name;
  }

  /** One column per crew member (landscape /Rotate 90). */
  private drawCrewColumns(
    page: PDFPage,
    font: PDFFont,
    black: RGB,
    crew: CrewMember[],
    rowOffset: number,
    textRotate: ReturnType<typeof import('pdf-lib').degrees>,
  ): void {
    const draw = (
      text: string,
      colIndex: number,
      field: CrewListV3SbkPColField,
      mode: 'fit' | 'birth' | 'nationality' | 'wrap' | false = false,
    ) => {
      const placement = this.colAt(colIndex, field);
      if (mode === 'wrap') {
        const limits = this.wrapLimits(field);
        if (!limits) return;
        this.drawColWrap(page, text, placement, font, black, textRotate, limits.maxWidth, limits.maxLines);
      } else if (mode === 'nationality') {
        this.drawColWrap(
          page,
          text,
          placement,
          font,
          black,
          textRotate,
          CREW_LIST_V3_SBK_P_NATIONALITY_FIELD_MAX_PT,
          CREW_LIST_V3_SBK_P_NATIONALITY_MAX_LINES,
        );
      } else if (mode === 'birth') {
        this.drawFit(page, text, placement, font, black, textRotate, CREW_LIST_V3_SBK_P_BIRTH_FIELD_MAX_PT);
      } else if (mode === 'fit') {
        this.drawFit(page, text, placement, font, black, textRotate);
      } else {
        this.drawText(page, text, placement, font, black, textRotate);
      }
    };

    crew.forEach((member, colIndex) => {
      const no = crewListV3SbkPRowNoPlacement(colIndex);
      this.drawText(page, String(rowOffset + colIndex + 1), no, font, black, textRotate);

      draw(this.formatName(member), colIndex, 'name', 'wrap');
      draw(member.rank.trim(), colIndex, 'rank');
      draw(member.nationality.trim(), colIndex, 'nationality', 'nationality');
      draw(this.formatBirthAndPlace(member), colIndex, 'dateOfBirth', 'birth');
      draw(member.seamansBook.trim(), colIndex, 'sbookNo');
      draw(member.seamansBookPlaceOfIssue.trim(), colIndex, 'sbookPlaceOfIssue', 'wrap');
      draw(formatDisplayDate(member.sbookExpiryDate), colIndex, 'sbookExpiry');
      draw(member.passport.trim(), colIndex, 'passport');
      draw(this.formatJoiningPort(member.joiningPort), colIndex, 'joiningPort');
      draw(formatDisplayDate(member.joiningDate), colIndex, 'joiningDate');
    });
  }

  private drawColWrap(
    page: PDFPage,
    text: string,
    placement: CrewListV3SbkPTextPlacement,
    font: PDFFont,
    color: RGB,
    textRotate: ReturnType<typeof import('pdf-lib').degrees>,
    maxWidth: number,
    maxLines: number,
  ): void {
    const value = text.trim();
    if (!value) return;
    const lines = this.wrapCellLines(
      font,
      value,
      CREW_LIST_V3_SBK_P_FONT,
      maxWidth,
      maxLines,
    );
    // Rotate 90°: text runs along Y — stack extra lines in +X (column width).
    lines.forEach((line, index) => {
      const size = this.fitFontSize(font, line, maxWidth, CREW_LIST_V3_SBK_P_FONT);
      page.drawText(line, {
        x: placement.x + index * CREW_LIST_V3_SBK_P_WRAP_LINE_STEP,
        y: placement.y,
        size,
        font,
        color,
        rotate: textRotate,
      });
    });
  }

  private wrapLimits(
    field: CrewListV3SbkPColField,
  ): { maxWidth: number; maxLines: number } | null {
    switch (field) {
      case 'name':
        return {
          maxWidth: CREW_LIST_V3_SBK_P_NAME_FIELD_MAX_PT,
          maxLines: CREW_LIST_V3_SBK_P_WRAP_MAX_LINES,
        };
      case 'sbookPlaceOfIssue':
        return {
          maxWidth: CREW_LIST_V3_SBK_P_SBOOK_PLACE_FIELD_MAX_PT,
          maxLines: CREW_LIST_V3_SBK_P_WRAP_MAX_LINES,
        };
      default:
        return null;
    }
  }

  private wrapCellLines(
    font: PDFFont,
    text: string,
    size: number,
    maxWidth: number,
    maxLines: number,
  ): string[] {
    if (font.widthOfTextAtSize(text, size) <= maxWidth) {
      return [text];
    }
    if (maxLines <= 1) {
      return [text];
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
        lines.push(word);
        line = '';
      }
      if (lines.length === maxLines - 1) {
        const restWords = line ? [line, ...words.slice(wi + 1)] : words.slice(wi + 1);
        const rest = restWords.join(' ');
        lines.push(this.truncateToWidth(font, rest, size, maxWidth));
        return lines.slice(0, maxLines);
      }
    }
    if (line) {
      lines.push(line);
    }
    return lines.slice(0, maxLines);
  }

  /** Date of birth + two spaces + place of birth on one line. */
  private formatBirthAndPlace(member: Pick<CrewMember, 'dateOfBirth' | 'placeOfBirth'>): string {
    const dob = formatBirthDate(member.dateOfBirth).trim();
    const pob = member.placeOfBirth?.trim() ?? '';
    if (!dob) return pob;
    if (!pob) return dob;
    return `${dob}${CREW_LIST_V3_SBK_P_BIRTH_PLACE_GAP}${pob}`;
  }

  /** Joining port — port name only, ALL CAPS. */
  private formatJoiningPort(portName: string): string {
    return formatPortCallPortName(portName).toUpperCase();
  }

  /** Surname and given names — ALL CAPS, space-separated (no comma). */
  private formatName(member: Pick<CrewMember, 'familyName' | 'givenNames'>): string {
    const parts = [member.familyName?.trim(), member.givenNames?.trim()].filter(Boolean);
    return parts.join(' ').toUpperCase();
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

  private fitFontSize(font: PDFFont, text: string, maxWidth: number, baseSize: number): number {
    let size = baseSize;
    while (size > 5.5 && font.widthOfTextAtSize(text, size) > maxWidth) {
      size -= 0.25;
    }
    return size;
  }

  private async loadTemplate(): Promise<Uint8Array> {
    if (this.templateBytes && this.loadedVersion === CREW_LIST_V3_SBK_P_TEMPLATE_VERSION) {
      return this.templateBytes;
    }
    const res = await fetch(
      `${CREW_LIST_V3_SBK_P_TEMPLATE_URL}?v=${CREW_LIST_V3_SBK_P_TEMPLATE_VERSION}`,
      { cache: 'no-store' },
    );
    if (!res.ok) {
      throw new Error('Crew List v3 SBK/P template not found (public/crew-list-v3-sbk-p-empty.pdf)');
    }
    this.templateBytes = new Uint8Array(await res.arrayBuffer());
    this.loadedVersion = CREW_LIST_V3_SBK_P_TEMPLATE_VERSION;
    return this.templateBytes;
  }
}
