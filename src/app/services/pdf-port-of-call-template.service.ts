import { Injectable, inject } from '@angular/core';
import {
  AppData,
  CrewMember,
  Port,
  PortCallHistoryEntry,
  chunkPortCallHistoryForPdf,
  formatPortCallPortName,
  portCode,
  normalizePortSecLvl,
  portCountry,
  selectPortCallHistoryForPdf,
} from '../models/crew.models';
import { PdfDeliveryService } from './pdf-delivery.service';
import { PdfOverlayService } from './pdf-overlay.service';
import { formatDisplayDate } from '../utils/date.util';
import { portOfCallPdfFileName } from '../utils/pdf-filename.util';
import {
  POC_TEMPLATE_FONT,
  POC_TEMPLATE_HEADER,
  POC_TEMPLATE_ROWS_PER_PAGE,
  POC_TEMPLATE_TABLE_COL,
  POC_TEMPLATE_URL,
  POC_TEMPLATE_VERSION,
  type PocTemplateTextPlacement,
  pocTemplateRowBaselineY,
} from './port-of-call-template-coordinates';

type PDFPage = import('pdf-lib').PDFPage;
type PDFFont = import('pdf-lib').PDFFont;

@Injectable({ providedIn: 'root' })
export class PdfPortOfCallTemplateService {
  private readonly overlay = inject(PdfOverlayService);
  private readonly delivery = inject(PdfDeliveryService);

  private templateBytes: Uint8Array | null = null;
  private loadedVersion = 0;

  async buildFinalBytes(data: AppData): Promise<Uint8Array> {
    const bytes = await this.build(data);
    return this.overlay.applyToPdfBytes(bytes, data.documentOverlay.portsOfCall, 'portsOfCall');
  }

  async openPreview(data: AppData): Promise<boolean> {
    const bytes = await this.buildFinalBytes(data);
    return this.delivery.deliver(bytes, this.fileName(data));
  }

  fileName(data: AppData): string {
    const { ship } = data;
    const voyageDate = ship.dateOfArrival || ship.dateOfDeparture;
    return portOfCallPdfFileName(ship.name, voyageDate);
  }

  async build(data: AppData): Promise<Uint8Array> {
    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
    const template = await this.loadTemplate();
    const doc = await PDFDocument.load(template);
    const templateDoc = await PDFDocument.load(template);
    const [embeddedTemplate] = await doc.embedPages([templateDoc.getPages()[0]]);

    const font = await doc.embedFont(StandardFonts.Helvetica);
    const black = rgb(0, 0, 0);

    const selected = selectPortCallHistoryForPdf(data.portCallHistory, data.portOfCall.pdfRowCount);
    const pages = chunkPortCallHistoryForPdf(selected, POC_TEMPLATE_ROWS_PER_PAGE);
    const firstPage = doc.getPages()[0];

    pages.forEach((pageRows, pageIndex) => {
      const page =
        pageIndex === 0
          ? firstPage
          : this.addTemplatePage(doc, firstPage, embeddedTemplate);

      this.drawHeader(page, font, black, data);
      this.drawPortRows(page, font, black, data.ports, pageRows);
    });

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

  private drawHeader(page: PDFPage, font: PDFFont, color: import('pdf-lib').RGB, data: AppData): void {
    const { ship } = data;
    const ports = data.ports;
    const draw = (text: string, placement: PocTemplateTextPlacement) => {
      this.drawText(page, text, placement, font, color);
    };

    draw(ship.name, POC_TEMPLATE_HEADER.shipName);
    draw(formatPortCallPortName(ship.nationality), POC_TEMPLATE_HEADER.nationality);
    draw(ship.imoNo, POC_TEMPLATE_HEADER.imoNo);
    draw(this.formatPortWithCountry(ship.portOfCall, ports), POC_TEMPLATE_HEADER.portOfArrival);
    draw(formatDisplayDate(ship.dateOfArrival), POC_TEMPLATE_HEADER.dateOfArrival);
    draw(this.formatPortWithCountry(ship.lastPortOfCall, ports), POC_TEMPLATE_HEADER.arrivedFrom);
    draw(this.formatPortWithCountry(ship.nextPortOfCall, ports), POC_TEMPLATE_HEADER.nextPort);

    const master = this.findMaster(data.crew);
    if (master) {
      draw(this.formatCaptainName(master), POC_TEMPLATE_HEADER.captainName);
    }
  }

  private findMaster(crew: CrewMember[]): CrewMember | undefined {
    const exact = crew.find((m) => m.rank.trim().toLowerCase() === 'master');
    if (exact) return exact;
    return crew.find((m) => m.rank.trim().toLowerCase().includes('master'));
  }

  /** Surname and given names — ALL CAPS, space-separated (no comma). */
  private formatCaptainName(member: Pick<CrewMember, 'familyName' | 'givenNames'>): string {
    const parts = [member.familyName?.trim(), member.givenNames?.trim()].filter(Boolean);
    return parts.join(' ').toUpperCase();
  }

  private drawPortRows(
    page: PDFPage,
    font: PDFFont,
    color: import('pdf-lib').RGB,
    ports: Port[],
    rows: PortCallHistoryEntry[],
  ): void {
    for (let i = 0; i < rows.length; i++) {
      const entry = rows[i];
      const portName = formatPortCallPortName(entry.portName);
      if (!portName) continue;

      const y = pocTemplateRowBaselineY(i);
      const country =
        entry.country.trim().toUpperCase() || portCountry(entry.portName, ports).toUpperCase();
      const code = portCode(entry.portName, ports);

      this.drawAtBaseline(page, portName, POC_TEMPLATE_TABLE_COL.port, y, font, color, 88);
      this.drawAtBaseline(page, country, POC_TEMPLATE_TABLE_COL.country, y, font, color, 78);
      this.drawAtBaseline(page, code, POC_TEMPLATE_TABLE_COL.code, y, font, color, 105);
      this.drawAtBaseline(
        page,
        formatDisplayDate(entry.arrivalDate),
        POC_TEMPLATE_TABLE_COL.arrDate,
        y,
        font,
        color,
        72,
      );
      this.drawAtBaseline(
        page,
        formatDisplayDate(entry.departureDate),
        POC_TEMPLATE_TABLE_COL.depDate,
        y,
        font,
        color,
        72,
      );
      this.drawAtBaseline(
        page,
        normalizePortSecLvl(entry.secLvl),
        POC_TEMPLATE_TABLE_COL.secLvl,
        y,
        font,
        color,
        24,
      );
    }
  }

  private formatPortWithCountry(portName: string, ports: Port[]): string {
    const name = formatPortCallPortName(portName);
    if (!name) return '';
    const country = portCountry(portName, ports);
    return country ? `${name} / ${country}` : name;
  }

  private drawText(
    page: PDFPage,
    text: string,
    placement: PocTemplateTextPlacement,
    font: PDFFont,
    color: import('pdf-lib').RGB,
  ): void {
    const value = text.trim();
    if (!value) return;
    page.drawText(value, {
      x: placement.x,
      y: placement.y,
      size: placement.fontSize ?? POC_TEMPLATE_FONT,
      font,
      color,
      maxWidth: placement.maxWidth,
    });
  }

  private drawAtBaseline(
    page: PDFPage,
    text: string,
    x: number,
    baselineY: number,
    font: PDFFont,
    color: import('pdf-lib').RGB,
    maxWidth?: number,
  ): void {
    const value = text.trim();
    if (!value) return;
    page.drawText(value, {
      x,
      y: baselineY,
      size: POC_TEMPLATE_FONT,
      font,
      color,
      ...(maxWidth ? { maxWidth } : {}),
    });
  }

  private async loadTemplate(): Promise<Uint8Array> {
    if (this.templateBytes && this.loadedVersion === POC_TEMPLATE_VERSION) {
      return this.templateBytes;
    }
    const res = await fetch(POC_TEMPLATE_URL);
    if (!res.ok) {
      throw new Error('Port of Call template not found (public/port-of-call-template-empty.pdf)');
    }
    this.templateBytes = new Uint8Array(await res.arrayBuffer());
    this.loadedVersion = POC_TEMPLATE_VERSION;
    return this.templateBytes;
  }
}
