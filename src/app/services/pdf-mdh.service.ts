import { Injectable, inject } from '@angular/core';
import { PdfOverlayService } from './pdf-overlay.service';
import type { PDFPage, RGB } from 'pdf-lib';
import {
  AppData,
  CrewMember,
  filterActiveCrewListFromData,
  formatCrewListName,
  formatPortCallPortName,
  orderPortCallHistoryForPdf,
  portCode,
} from '../models/crew.models';
import { PdfDeliveryService } from './pdf-delivery.service';
import { mdhPdfFileName } from '../utils/pdf-filename.util';
import { arrivalVoyageDate } from '../utils/voyage-date.util';
import { formatMdhPortDate, formatMdhShortDate } from '../utils/mdh-date.util';
import {
  MDH_DEFAULT_LIFT,
  MDH_FIELDS,
  MDH_HEALTH_NO,
  MDH_PORT_COL,
  MDH_PORT_ROWS,
  mdhBaselineY,
  type MdhPlacement,
} from './mdh-field-positions';

const MDH_TEMPLATE_URL = '/mdh-template.pdf';
const MDH_TEMPLATE_PAGE2_URL = '/mdh-template-page2.pdf';
const MDH_MAX_PORT_ROWS = 10;
const MDH_FONT_SIZE = 9;

@Injectable({ providedIn: 'root' })
export class PdfMdhService {
  private readonly overlay = inject(PdfOverlayService);
  private readonly delivery = inject(PdfDeliveryService);

  private templateBytes: Uint8Array | null = null;
  private templatePage2Bytes: Uint8Array | null = null;
  private templateVersion = 3;

  async buildFinalBytes(data: AppData): Promise<Uint8Array> {
    const bytes = await this.build(data);
    return this.overlay.applyMdhOverlay(bytes, data.documentOverlay.mdh);
  }

  async openPreview(data: AppData): Promise<boolean> {
    const bytes = await this.buildFinalBytes(data);
    return this.delivery.deliver(bytes, this.fileName(data));
  }

  fileName(data: AppData): string {
    const { ship } = data;
    const voyageDate = arrivalVoyageDate(ship);
    return mdhPdfFileName(ship.name, ship.portOfCall, voyageDate);
  }

  async build(data: AppData): Promise<Uint8Array> {
    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
    const template = await this.loadTemplate();
    const doc = await PDFDocument.load(template);
    const page = doc.getPages()[0];
    const { height } = page.getSize();
    const font = await doc.embedFont(StandardFonts.Helvetica);

    const draw = (text: string, placement: MdhPlacement) => {
      this.drawPlacement(page, height, font, rgb, placement, text);
    };

    const { ship, ports } = data;
    const crewArrival = filterActiveCrewListFromData(data, 'arrival');
    const paxArrival = data.passengers.filter((m) => !m.archived && m.onArrivalList);
    const master = this.findMaster(crewArrival);
    const paxCount = paxArrival.length;

    draw(formatPortCallPortName(ship.portOfCall), MDH_FIELDS.portOfCall);
    draw(ship.name, MDH_FIELDS.vesselName);
    draw(ship.nationality, MDH_FIELDS.nationality);
    draw(formatMdhShortDate(ship.dateOfArrival), MDH_FIELDS.voyageDate);
    draw(formatPortCallPortName(ship.lastPortOfCall), MDH_FIELDS.fromPort);
    draw(formatPortCallPortName(ship.nextPortOfCall || ship.portOfCall), MDH_FIELDS.toPort);
    draw(master ? formatCrewListName(master) : '', MDH_FIELDS.masterName);
    draw(ship.netTonnage, MDH_FIELDS.netTonnage);
    draw(ship.charterer, MDH_FIELDS.agentOwner);
    draw(formatPortCallPortName(ship.sanitationCertificateIssuedAt), MDH_FIELDS.sanitationIssuedAt);
    draw(formatMdhPortDate(ship.sanitationCertificateIssueDate), MDH_FIELDS.sanitationDated);

    const waterParts = [
      ship.waterTestPort ? formatPortCallPortName(ship.waterTestPort) : '',
      formatMdhPortDate(ship.waterTestDate),
    ].filter(Boolean);
    draw(waterParts.join(' '), MDH_FIELDS.waterTest);

    draw(String(crewArrival.length), MDH_FIELDS.crewCount);
    if (paxCount === 0) {
      draw('nil', MDH_FIELDS.passengerFirst);
      draw('nil', MDH_FIELDS.passengerCabin);
      draw('nil', MDH_FIELDS.passengerTourist);
      draw('nil', MDH_FIELDS.passengerThird);
    } else {
      draw('nil', MDH_FIELDS.passengerFirst);
      draw('nil', MDH_FIELDS.passengerCabin);
      draw(String(paxCount), MDH_FIELDS.passengerTourist);
      draw('nil', MDH_FIELDS.passengerThird);
    }

    const portHistory = orderPortCallHistoryForPdf(data.portCallHistory).slice(
      0,
      MDH_MAX_PORT_ROWS,
    );
    portHistory.forEach((entry, i) => {
      const row = MDH_PORT_ROWS[i];
      if (!row) return;
      this.drawPlacement(
        page,
        height,
        font,
        rgb,
        {
          x: MDH_PORT_COL.port.x,
          lineY: row.lineY,
          lift: MDH_PORT_COL.port.lift,
        },
        formatPortCallPortName(entry.portName),
      );
      this.drawPlacement(
        page,
        height,
        font,
        rgb,
        {
          x: MDH_PORT_COL.date.x,
          lineY: row.lineY,
          lift: MDH_PORT_COL.date.lift,
        },
        formatMdhPortDate(entry.departureDate || entry.arrivalDate),
      );
      this.drawPlacement(
        page,
        height,
        font,
        rgb,
        {
          x: MDH_PORT_COL.code.x,
          lineY: row.lineY,
          lift: MDH_PORT_COL.code.lift,
        },
        portCode(entry.portName, ports),
      );
    });

    for (const slot of MDH_HEALTH_NO) {
      draw('No', slot);
    }

    draw(master ? formatCrewListName(master) : '', MDH_FIELDS.masterSignature);
    draw(ship.imoNo, MDH_FIELDS.imoNo);
    draw(ship.charterer || 'N/A', MDH_FIELDS.agentFooter);
    draw('N/A', MDH_FIELDS.shipsSurgeon);

    await this.appendStaticPages(doc);

    return doc.save();
  }

  /** Page 2+ — static schedule/attachment (stamp overlay applied in applyMdhOverlay). */
  private async appendStaticPages(
    doc: Awaited<ReturnType<typeof import('pdf-lib').PDFDocument.load>>,
  ): Promise<void> {
    const { PDFDocument } = await import('pdf-lib');
    const page2 = await this.loadTemplatePage2();
    const attachment = await PDFDocument.load(page2);
    const indices = attachment.getPageIndices();
    if (indices.length === 0) return;
    const copied = await doc.copyPages(attachment, indices);
    for (const page of copied) {
      doc.addPage(page);
    }
  }

  private drawPlacement(
    page: PDFPage,
    pageHeight: number,
    font: Awaited<ReturnType<typeof import('pdf-lib').PDFDocument.prototype.embedFont>>,
    rgb: (r: number, g: number, b: number) => RGB,
    placement: MdhPlacement,
    text: string,
  ): void {
    const value = text.trim();
    if (!value) return;
    const size = placement.fontSize ?? MDH_FONT_SIZE;
    const lift = placement.lift ?? MDH_DEFAULT_LIFT;
    page.drawText(value, {
      x: placement.x,
      y: mdhBaselineY(pageHeight, placement.lineY, lift),
      size,
      font,
      color: rgb(0, 0, 0),
      maxWidth: placement.maxWidth,
    });
  }

  private async loadTemplate(): Promise<Uint8Array> {
    if (this.templateBytes) return this.templateBytes;
    const res = await fetch(`${MDH_TEMPLATE_URL}?v=${this.templateVersion}`, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error('MDH template not found (public/mdh-template.pdf)');
    }
    this.templateBytes = new Uint8Array(await res.arrayBuffer());
    return this.templateBytes;
  }

  private async loadTemplatePage2(): Promise<Uint8Array> {
    if (this.templatePage2Bytes) return this.templatePage2Bytes;
    const res = await fetch(`${MDH_TEMPLATE_PAGE2_URL}?v=${this.templateVersion}`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      throw new Error('MDH page 2 not found (public/mdh-template-page2.pdf)');
    }
    this.templatePage2Bytes = new Uint8Array(await res.arrayBuffer());
    return this.templatePage2Bytes;
  }

  private findMaster(crew: CrewMember[]): CrewMember | undefined {
    const exact = crew.find((m) => m.rank.trim().toLowerCase() === 'master');
    if (exact) return exact;
    return crew.find((m) => m.rank.trim().toLowerCase().includes('master'));
  }
}
