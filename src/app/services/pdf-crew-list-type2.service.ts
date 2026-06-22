import { Injectable, inject } from '@angular/core';
import {
  AppData,
  CrewMember,
  CREW_IDENTITY_PASSPORT,
  CREW_IDENTITY_SEAMANS_BOOK,
  formatCrewListName,
  formatPortCallPortName,
  portCode,
} from '../models/crew.models';
import { PdfDeliveryService } from './pdf-delivery.service';
import { formatBirthDate, formatDisplayDate } from '../utils/date.util';
import { crewListType2PdfFileName } from '../utils/pdf-filename.util';
import {
  CREW_LIST_ALGER_COL_TEXT_MAX_PT,
  CREW_LIST_ALGER_FONT_ROW,
  CREW_LIST_ALGER_HEADER,
  CREW_LIST_ALGER_FONT_HEADER,
  CREW_LIST_ALGER_MAX_ROWS,
  CREW_LIST_ALGER_ROW_Y,
  CREW_LIST_ALGER_TEXT_ROTATION,
  CREW_LIST_ALGER_BODY_NIL,
  crewListAlgerColX,
  crewListAlgerFontSizeToFit,
  randomCrewTemperature,
  type AlgerRowField,
  type AlgerTextPlacement,
} from './crew-list-alger-coordinates';
import { resolveCrewListStampOptions } from '../models/document-overlay.models';
import { PdfOverlayService } from './pdf-overlay.service';
import { CREW_LIST_BODY_NIL_GRAY, CREW_LIST_BODY_NIL_LABEL } from './crew-list-coordinates';

const CREW_LIST_ALGER_TEMPLATE_URL = '/crew-list-alger-empty.pdf';

type PDFPage = import('pdf-lib').PDFPage;
type PDFFont = import('pdf-lib').PDFFont;
type RGB = import('pdf-lib').RGB;

/** Crew list Type 2 — Alger (arrival only, landscape /Rotate 90). */
@Injectable({ providedIn: 'root' })
export class PdfCrewListType2Service {
  private readonly overlay = inject(PdfOverlayService);
  private readonly delivery = inject(PdfDeliveryService);

  private templateBytes: Uint8Array | null = null;
  private loadedVersion = 0;
  private readonly templateVersion = 8;

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
    const { ship } = data;
    return crewListType2PdfFileName(ship.name, ship.portOfCall, ship.dateOfArrival, true);
  }

  async build(data: AppData, crew: CrewMember[]): Promise<Uint8Array> {
    const { PDFDocument, StandardFonts, rgb, degrees } = await import('pdf-lib');
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
    const textRotate = degrees(CREW_LIST_ALGER_TEXT_ROTATION);

    if (crew.length === 0) {
      this.drawBodyNil(doc.getPages()[0], bold, textRotate, nilGray);
      return doc.save();
    }

    const pageCount = Math.ceil(crew.length / CREW_LIST_ALGER_MAX_ROWS);
    const firstPage = doc.getPages()[0];

    for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
      const page =
        pageIndex === 0 ? firstPage : this.addTemplatePage(doc, firstPage, embeddedTemplate);

      const slice = crew.slice(
        pageIndex * CREW_LIST_ALGER_MAX_ROWS,
        (pageIndex + 1) * CREW_LIST_ALGER_MAX_ROWS,
      );
      const rowOffset = pageIndex * CREW_LIST_ALGER_MAX_ROWS;

      const { draw, drawFit } = this.createDrawHelpers(page, font, bold, black, textRotate);
      this.drawHeader(draw, data, pageIndex + 1);
      this.drawCrewBody(draw, drawFit, data, slice, rowOffset);
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

  private createDrawHelpers(
    page: PDFPage,
    font: PDFFont,
    bold: PDFFont,
    black: RGB,
    textRotate: ReturnType<typeof import('pdf-lib').degrees>,
  ) {
    const draw = (
      text: string,
      placement: AlgerTextPlacement,
      useBold = false,
      allowWrap = false,
    ) => {
      const value = text.trim();
      if (!value) return;
      page.drawText(value, {
        x: placement.x,
        y: placement.y,
        size: placement.fontSize ?? CREW_LIST_ALGER_FONT_HEADER,
        font: useBold ? bold : font,
        color: black,
        rotate: textRotate,
        ...(allowWrap && placement.maxWidth != null ? { maxWidth: placement.maxWidth } : {}),
      });
    };

    const rowAt = (colX: number, field: AlgerRowField): AlgerTextPlacement => ({
      x: colX,
      y: CREW_LIST_ALGER_ROW_Y[field].y,
      fontSize: CREW_LIST_ALGER_ROW_Y[field].fontSize,
    });

    const drawFit = (text: string, placement: AlgerTextPlacement) => {
      const value = text.trim();
      if (!value) return;
      const base = placement.fontSize ?? CREW_LIST_ALGER_FONT_ROW;
      const size = crewListAlgerFontSizeToFit(
        (s) => font.widthOfTextAtSize(value, s),
        base,
        CREW_LIST_ALGER_COL_TEXT_MAX_PT,
      );
      draw(value, { ...placement, fontSize: size });
    };

    return { draw, drawFit, rowAt };
  }

  private drawHeader(
    draw: (text: string, placement: AlgerTextPlacement, useBold?: boolean) => void,
    data: AppData,
    pageNo: number,
  ): void {
    const { ship } = data;
    const voyageDate = formatDisplayDate(ship.dateOfArrival);
    const portsFromTo = [ship.lastPortOfCall, ship.nextPortOfCall]
      .filter(Boolean)
      .map((p) => formatPortCallPortName(p))
      .join(' / ');

    draw(String(pageNo), CREW_LIST_ALGER_HEADER.pageNo);
    draw('x', CREW_LIST_ALGER_HEADER.arrivalMark);
    draw(formatPortCallPortName(ship.name), CREW_LIST_ALGER_HEADER.shipName, true);
    draw(formatPortCallPortName(ship.nationality), CREW_LIST_ALGER_HEADER.shipNationality, true);
    draw(formatPortCallPortName(ship.portOfCall), CREW_LIST_ALGER_HEADER.portOfCall, true);
    draw(voyageDate, CREW_LIST_ALGER_HEADER.voyageDate, true);
    draw(portsFromTo, CREW_LIST_ALGER_HEADER.portsFromTo, true);
    draw(CREW_IDENTITY_PASSPORT, CREW_LIST_ALGER_HEADER.natureOfDocumentPassport);
    draw(CREW_IDENTITY_SEAMANS_BOOK, CREW_LIST_ALGER_HEADER.natureOfDocumentSeamans);
  }

  private drawBodyNil(
    page: PDFPage,
    bold: PDFFont,
    textRotate: ReturnType<typeof import('pdf-lib').degrees>,
    color: RGB,
  ): void {
    page.drawText(CREW_LIST_BODY_NIL_LABEL, {
      x: CREW_LIST_ALGER_BODY_NIL.x,
      y: CREW_LIST_ALGER_BODY_NIL.y,
      size: CREW_LIST_ALGER_BODY_NIL.fontSize,
      font: bold,
      color,
      rotate: textRotate,
    });
  }

  /** Body: one column per crew member — same order as Arrival list on Home (no rank resort). */
  private drawCrewBody(
    draw: (text: string, placement: AlgerTextPlacement, useBold?: boolean) => void,
    drawFit: (text: string, placement: AlgerTextPlacement) => void,
    data: AppData,
    crew: CrewMember[],
    rowOffset: number,
  ): void {
    const rowAt = (colX: number, field: AlgerRowField): AlgerTextPlacement => ({
      x: colX,
      y: CREW_LIST_ALGER_ROW_Y[field].y,
      fontSize: CREW_LIST_ALGER_ROW_Y[field].fontSize,
    });

    crew.forEach((member, index) => {
      const colX = crewListAlgerColX(index);

      draw(String(rowOffset + index + 1), rowAt(colX, 'no'));
      draw(formatCrewListName(member), rowAt(colX, 'name'));
      draw(member.rank, rowAt(colX, 'rank'));
      drawFit(member.nationality, rowAt(colX, 'nationality'));
      draw(formatBirthDate(member.dateOfBirth), rowAt(colX, 'dateOfBirth'));
      drawFit(member.placeOfBirth, rowAt(colX, 'placeOfBirth'));
      draw(member.passport, rowAt(colX, 'passport'));
      draw(member.seamansBook, rowAt(colX, 'seamansBook'));
      draw(formatDisplayDate(member.joiningDate), rowAt(colX, 'joiningDate'));
      draw(portCode(member.joiningPort, data.ports), rowAt(colX, 'joiningPort'));
      draw(randomCrewTemperature(), rowAt(colX, 'temperature'));
    });
  }

  private async loadTemplate(): Promise<Uint8Array> {
    if (this.templateBytes && this.loadedVersion === this.templateVersion) {
      return this.templateBytes;
    }
    const res = await fetch(`${CREW_LIST_ALGER_TEMPLATE_URL}?v=${this.templateVersion}`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      throw new Error('Crew list Alger template not found (public/crew-list-alger-empty.pdf)');
    }
    this.templateBytes = new Uint8Array(await res.arrayBuffer());
    this.loadedVersion = this.templateVersion;
    return this.templateBytes;
  }
}
