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
  CREW_LIST_V3_SBK_P2_WRAP_LINE_STEP,
  CREW_LIST_V3_SBK_P2_WRAP_MAX_LINES,
  crewListV3SbkP2FieldMaxPt,
  CREW_LIST_V3_SBK_P2_BIRTH_PLACE_GAP,
  CREW_LIST_V3_SBK_P2_COL_Y,
  CREW_LIST_V3_SBK_P2_FONT,
  CREW_LIST_V3_SBK_P2_TEXT_ROTATION,
  CREW_LIST_V3_SBK_P2_HEADER,
  CREW_LIST_V3_SBK_P2_FOOTER,
  CREW_LIST_V3_SBK_P2_PORTS_FROM_TO_GAP,
  CREW_LIST_V3_SBK_P2_MAX_ROWS,
  CREW_LIST_V3_SBK_P2_TEMPLATE_URL,
  CREW_LIST_V3_SBK_P2_TEMPLATE_VERSION,
  crewListV3SbkP2ColX,
  crewListV3SbkP2RowNoPlacement,
  type CrewListV3SbkP2ColField,
  type CrewListV3SbkP2TextPlacement,
} from './crew-list-v3-sbk-p2-coordinates';
import { formatBirthDate, formatDisplayDate } from '../utils/date.util';
import { crewListV3SbkP2PdfFileName } from '../utils/pdf-filename.util';

type PDFPage = import('pdf-lib').PDFPage;
type PDFFont = import('pdf-lib').PDFFont;
type RGB = import('pdf-lib').RGB;

@Injectable({ providedIn: 'root' })
export class PdfCrewListV3SbkP2Service {
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
    return crewListV3SbkP2PdfFileName(ship.name, ship.portOfCall, voyageDate, crewArr.isArrival);
  }

  async build(data: AppData, crew: CrewMember[]): Promise<Uint8Array> {
    const { PDFDocument, StandardFonts, rgb, degrees } = await import('pdf-lib');
    const template = await this.loadTemplate();
    const doc = await PDFDocument.load(template);
    const templateDoc = await PDFDocument.load(template);
    const [embeddedTemplate] = await doc.embedPages([templateDoc.getPages()[0]]);

    const font = await doc.embedFont(StandardFonts.Helvetica);
    const black = rgb(0, 0, 0);
    const textRotate = degrees(CREW_LIST_V3_SBK_P2_TEXT_ROTATION);
    const firstPage = doc.getPages()[0];

    if (crew.length === 0) {
      this.drawHeader(firstPage, font, black, data, textRotate);
      this.drawFooter(firstPage, font, black, data, crew, textRotate);
      return doc.save();
    }

    const pageCount = Math.ceil(crew.length / CREW_LIST_V3_SBK_P2_MAX_ROWS);

    for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
      const page =
        pageIndex === 0
          ? firstPage
          : this.addTemplatePage(doc, firstPage, embeddedTemplate);

      const slice = crew.slice(
        pageIndex * CREW_LIST_V3_SBK_P2_MAX_ROWS,
        (pageIndex + 1) * CREW_LIST_V3_SBK_P2_MAX_ROWS,
      );
      const rowOffset = pageIndex * CREW_LIST_V3_SBK_P2_MAX_ROWS;

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

  private colAt(colIndex: number, field: CrewListV3SbkP2ColField): CrewListV3SbkP2TextPlacement {
    return { x: crewListV3SbkP2ColX(colIndex), y: CREW_LIST_V3_SBK_P2_COL_Y[field] };
  }

  private drawText(
    page: PDFPage,
    text: string,
    placement: CrewListV3SbkP2TextPlacement,
    font: PDFFont,
    color: RGB,
    textRotate: ReturnType<typeof import('pdf-lib').degrees>,
    size = CREW_LIST_V3_SBK_P2_FONT,
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

    const draw = (text: string, placement: CrewListV3SbkP2TextPlacement) =>
      this.drawText(page, text, placement, font, black, textRotate);

    draw(ship.charterer, CREW_LIST_V3_SBK_P2_HEADER.charterer);
    draw(formatPortCallPortName(ship.name), CREW_LIST_V3_SBK_P2_HEADER.shipName);
    draw(formatPortCallPortName(ship.nationality), CREW_LIST_V3_SBK_P2_HEADER.shipNationality);
    draw(this.formatPortWithCountry(ship.portOfCall, ports), CREW_LIST_V3_SBK_P2_HEADER.portOfCall);
    if (isArrival) {
      draw('X', CREW_LIST_V3_SBK_P2_HEADER.arrivalMark);
    } else {
      draw('X', CREW_LIST_V3_SBK_P2_HEADER.departureMark);
    }
    draw(this.portsFromTo(data), CREW_LIST_V3_SBK_P2_HEADER.portsFromTo);
    draw(voyageDate, CREW_LIST_V3_SBK_P2_HEADER.voyageDate);
    draw(ship.imoNo.trim(), CREW_LIST_V3_SBK_P2_HEADER.imoNo);
    draw(ship.callSign.trim(), CREW_LIST_V3_SBK_P2_HEADER.callSign);
    draw(ship.voyageNumber.trim(), CREW_LIST_V3_SBK_P2_HEADER.voyageNumber);
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

    this.drawText(page, voyageDate, CREW_LIST_V3_SBK_P2_FOOTER.signatureDate, font, black, textRotate);

    const roster = data.crew.length > 0 ? data.crew : listCrew;
    const master = this.findMaster(roster);
    if (master) {
      this.drawText(
        page,
        this.formatName(master),
        CREW_LIST_V3_SBK_P2_FOOTER.masterName,
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
      .join(CREW_LIST_V3_SBK_P2_PORTS_FROM_TO_GAP);
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
    const drawCell = (text: string, colIndex: number, field: CrewListV3SbkP2ColField) => {
      this.drawColWrap(
        page,
        text,
        this.colAt(colIndex, field),
        font,
        black,
        textRotate,
        crewListV3SbkP2FieldMaxPt(field),
        CREW_LIST_V3_SBK_P2_WRAP_MAX_LINES,
      );
    };

    crew.forEach((member, colIndex) => {
      const no = crewListV3SbkP2RowNoPlacement(colIndex);
      this.drawText(page, String(rowOffset + colIndex + 1), no, font, black, textRotate);

      drawCell(this.formatName(member), colIndex, 'name');
      drawCell(member.rank.trim(), colIndex, 'rank');
      drawCell(member.nationality.trim(), colIndex, 'nationality');
      drawCell(this.formatBirthAndPlace(member), colIndex, 'dateOfBirth');
      drawCell(member.seamansBook.trim(), colIndex, 'sbookNo');
      drawCell(this.formatPlaceOfIssue(member.seamansBookPlaceOfIssue), colIndex, 'sbookPlaceOfIssue');
      drawCell(formatDisplayDate(member.sbookExpiryDate), colIndex, 'sbookExpiry');
      drawCell(member.passport.trim(), colIndex, 'passport');
      drawCell(this.formatPlaceOfIssue(member.passportPlaceOfIssue), colIndex, 'passportPlaceOfIssue');
      drawCell(formatDisplayDate(member.passportExpiryDate), colIndex, 'passportExpiry');
    });
  }

  private drawColWrap(
    page: PDFPage,
    text: string,
    placement: CrewListV3SbkP2TextPlacement,
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
      CREW_LIST_V3_SBK_P2_FONT,
      maxWidth,
      maxLines,
    );
    // Rotate 90°: text runs along Y — stack extra lines in +X (column width).
    lines.forEach((line, index) => {
      const size = this.fitFontSize(font, line, maxWidth, CREW_LIST_V3_SBK_P2_FONT);
      page.drawText(line, {
        x: placement.x + index * CREW_LIST_V3_SBK_P2_WRAP_LINE_STEP,
        y: placement.y,
        size,
        font,
        color,
        rotate: textRotate,
      });
    });
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
        lines.push(restWords.join(' '));
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
    return `${dob}${CREW_LIST_V3_SBK_P2_BIRTH_PLACE_GAP}${pob}`;
  }

  /** Place of issue — ALL CAPS. */
  private formatPlaceOfIssue(value: string): string {
    return value.trim().toUpperCase();
  }

  /** Surname and given names — ALL CAPS, space-separated (no comma). */
  private formatName(member: Pick<CrewMember, 'familyName' | 'givenNames'>): string {
    const parts = [member.familyName?.trim(), member.givenNames?.trim()].filter(Boolean);
    return parts.join(' ').toUpperCase();
  }

  private fitFontSize(font: PDFFont, text: string, maxWidth: number, baseSize: number): number {
    let size = baseSize;
    while (size > 5.5 && font.widthOfTextAtSize(text, size) > maxWidth) {
      size -= 0.25;
    }
    return size;
  }

  private async loadTemplate(): Promise<Uint8Array> {
    if (this.templateBytes && this.loadedVersion === CREW_LIST_V3_SBK_P2_TEMPLATE_VERSION) {
      return this.templateBytes;
    }
    const res = await fetch(
      `${CREW_LIST_V3_SBK_P2_TEMPLATE_URL}?v=${CREW_LIST_V3_SBK_P2_TEMPLATE_VERSION}`,
      { cache: 'no-store' },
    );
    if (!res.ok) {
      throw new Error('Crew List v3 SBK/P 2 template not found (public/crew-list-v3-sbk-p2-empty.pdf)');
    }
    this.templateBytes = new Uint8Array(await res.arrayBuffer());
    this.loadedVersion = CREW_LIST_V3_SBK_P2_TEMPLATE_VERSION;
    return this.templateBytes;
  }
}
