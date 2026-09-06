import { Injectable, inject } from '@angular/core';
import { jsPDF } from 'jspdf';
import {
  AppData,
  CrewMember,
  formatCrewListName,
  formatPortCallPortName,
  portCountry,
} from '../models/crew.models';
import { PassengerMember } from '../models/passenger.models';
import { passengersToCrewRows } from '../utils/passenger-pdf.util';
import { passengerListV2PdfFileName } from '../utils/pdf-filename.util';
import { voyageDateByArrivalFlag } from '../utils/voyage-date.util';
import { formatBirthDate, formatDisplayDate } from '../utils/date.util';
import { IMO_PASSENGER_LIST_TITLE } from './pdf-crew-arr.service';
import { PdfOverlayService } from './pdf-overlay.service';
import { PdfDeliveryService } from './pdf-delivery.service';
import {
  BODY_BOTTOM_Y,
  BODY_TOP_Y,
  CREW_LIST_BODY_BOUNDS,
  CREW_LIST_BODY_NIL_LABEL,
  CREW_LIST_BODY_NIL_GRAY,
  CREW_LIST_BOXES,
  CREW_LIST_FAL_FORM_X_PT,
  CREW_LIST_FAL_FORM_OFFSET_LEFT_PT,
  CREW_LIST_FRAME_LABELS,
  CREW_LIST_LINE_PT,
  CREW_LIST_ROW_COUNT,
  CREW_LIST_ROW_LINE_GRAY,
  CREW_LIST_ROW_LINE_PT,
  CREW_LIST_SIDE_LABEL_GAP_FROM_TABLE_PT,
  CREW_LIST_STATIC_LABELS,
  CREW_LIST_TITLE_OFFSET_UP_PT,
  CREW_LIST_TITLE_Y,
  createCoordScale,
  type CoordBox,
  type CoordScale,
} from './crew-list-coordinates';
import {
  PAX_V2_COL6_HEADER_DIVIDER_Y,
  PAX_V2_COL6_SPLIT_X,
  PAX_V2_COL6_SUBLABELS,
  PAX_V2_COL6_X1,
  PAX_V2_COL6_X2,
  PAX_V2_FIELD6_MAIN_LABEL,
  PAX_V2_FOOTER,
  PAX_V2_PASSPORT_LABEL_Y1,
  PAX_V2_PASSPORT_LABEL_LINE_STEP_PT,
  PAX_V2_PLACE_OF_BIRTH_X1,
  PAX_V2_PLACE_OF_BIRTH_X2,
  PAX_V2_TABLE_X1,
  PAX_V2_TABLE_X2,
  paxV2LayoutBox,
} from './passenger-list-v2-coordinates';

const CREW_LIST_PAGE_NO = 1;

/** Passenger list v2 — IMO FAL Form 5 with Passport/ID + Expiry Date in column 6. */
@Injectable({ providedIn: 'root' })
export class PdfPassengerListV2Service {
  private readonly overlay = inject(PdfOverlayService);
  private readonly delivery = inject(PdfDeliveryService);

  async openPreview(data: AppData, passengers: PassengerMember[]): Promise<boolean> {
    const bytes = await this.buildPdfBytes(data, passengers);
    return this.delivery.deliver(bytes, this.fileName(data));
  }

  async buildPdfBytes(data: AppData, passengers: PassengerMember[]): Promise<Uint8Array> {
    const doc = this.build(data, passengersToCrewRows(passengers));
    const bytes = await this.overlay.applyToJsPdf(
      doc,
      data.documentOverlay.paxV2,
      'crewList',
      'paxV2',
    );
    return new Uint8Array(bytes);
  }

  fileName(data: AppData): string {
    const { ship, paxArr } = data;
    const voyageDate = voyageDateByArrivalFlag(ship, paxArr.isArrival);
    return passengerListV2PdfFileName(ship.name, ship.portOfCall, voyageDate, paxArr.isArrival);
  }

  private build(data: AppData, rows: CrewMember[]): jsPDF {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const scale = createCoordScale();
    const isArrival = data.paxArr.isArrival;

    this.drawPageBackground(doc);
    this.drawTitle(doc, scale);
    this.drawCoordinateGrid(doc, scale);
    this.drawStaticExtras(doc, scale, isArrival);
    this.fillDynamicData(doc, scale, data, rows, isArrival);
    if (rows.length === 0) {
      this.drawBodyNil(doc, scale);
    }
    this.drawFrameLabels(doc, scale);
    return doc;
  }

  private drawPageBackground(doc: jsPDF): void {
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, w, h, 'F');
  }

  private drawTitle(doc: jsPDF, s: CoordScale): void {
    const centerX = (s.sx(152) + s.sx(1871)) / 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(
      IMO_PASSENGER_LIST_TITLE,
      centerX,
      s.sy(CREW_LIST_TITLE_Y) - CREW_LIST_TITLE_OFFSET_UP_PT,
      {
        align: 'center',
      },
    );
  }

  private drawFrameLabels(doc: jsPDF, s: CoordScale): void {
    const bodyMidY = (s.sy(BODY_TOP_Y) + s.sy(BODY_BOTTOM_Y)) / 2;
    const tableLeft = s.sx(152);
    const field12Y = s.sy(BODY_BOTTOM_Y) + 10;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.text(
      CREW_LIST_FRAME_LABELS.sideVertical,
      tableLeft - CREW_LIST_SIDE_LABEL_GAP_FROM_TABLE_PT,
      bodyMidY,
      { angle: 90 },
    );

    this.drawFalFormLabel(doc, s);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(CREW_LIST_FRAME_LABELS.field12, tableLeft, field12Y);
  }

  private drawFalFormLabel(doc: jsPDF, s: CoordScale): void {
    const rowH = (BODY_BOTTOM_Y - BODY_TOP_Y) / CREW_LIST_ROW_COUNT;
    const row23MidY = s.sy(BODY_TOP_Y + rowH * 22 + rowH * 0.42);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    const falX = CREW_LIST_FAL_FORM_X_PT - CREW_LIST_FAL_FORM_OFFSET_LEFT_PT;
    doc.text(CREW_LIST_FRAME_LABELS.falFormLine1, falX, row23MidY - 5);
    doc.text(CREW_LIST_FRAME_LABELS.falFormLine2, falX, row23MidY + 5);
  }

  private drawCoordinateGrid(doc: jsPDF, s: CoordScale): void {
    doc.setDrawColor(0);
    doc.setLineWidth(CREW_LIST_LINE_PT);

    for (const box of CREW_LIST_BOXES) {
      const layout = paxV2LayoutBox(box);
      const r = s.rect(layout.x1, layout.y1, layout.x2, layout.y2);
      doc.rect(r.x, r.y, r.w, r.h);
      this.drawFieldLabel(doc, layout, r, s);
    }

    this.drawColumn6Split(doc, s);
    this.drawBodyRowDividers(doc, s);
  }

  private drawColumn6Split(doc: jsPDF, s: CoordScale): void {
    const splitX = s.sx(PAX_V2_COL6_SPLIT_X);
    const dividerY = s.sy(PAX_V2_COL6_HEADER_DIVIDER_Y);
    const bodyBottom = s.sy(BODY_BOTTOM_Y);

    doc.setDrawColor(0);
    doc.setLineWidth(CREW_LIST_LINE_PT);
    // Г — horizontal below “Nature…” across the full table width
    doc.line(s.sx(PAX_V2_TABLE_X1), dividerY, s.sx(PAX_V2_TABLE_X2), dividerY);
    // Г — vertical stem from that line through sub-headers and body to the table bottom
    doc.line(splitX, dividerY, splitX, bodyBottom);
  }

  private drawFieldLabel(
    doc: jsPDF,
    box: CoordBox,
    r: { x: number; y: number; w: number; h: number },
    s: CoordScale,
  ): void {
    if (box.id === '14') {
      this.drawField14Label(doc, s);
      return;
    }
    if (!box.label) return;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(this.labelFontSize(r));
    const lines = doc.splitTextToSize(box.label, r.w - 4);
    doc.text(lines, r.x + 2, r.y + 8);
  }

  private drawField14Label(doc: jsPDF, s: CoordScale): void {
    const top = s.rect(PAX_V2_COL6_X1, 277, PAX_V2_COL6_X2 + 1, PAX_V2_COL6_HEADER_DIVIDER_Y);
    doc.setFont('helvetica', 'normal');
    const fontSize = this.labelFontSize(top);
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(PAX_V2_FIELD6_MAIN_LABEL, top.w - 4);
    doc.text(lines, top.x + 2, top.y + 8);
  }

  private labelFontSize(r: { w: number; h: number }): number {
    return Math.max(5, Math.min(6.5, Math.min(r.w, r.h) * 0.35));
  }

  private drawStaticExtras(doc: jsPDF, s: CoordScale, isArrival: boolean): void {
    const arrivalBox = s.rect(1100, 153, 1149, 192);
    const departureBox = s.rect(1490, 153, 1536, 192);

    if (isArrival) {
      this.drawCheckboxMark(doc, arrivalBox);
    } else {
      this.drawCheckboxMark(doc, departureBox);
    }

    doc.setFontSize(7);
    doc.setFont('helvetica', isArrival ? 'bold' : 'normal');
    doc.text(CREW_LIST_STATIC_LABELS.arrival, s.sx(1155), s.sy(178));
    doc.setFont('helvetica', isArrival ? 'normal' : 'bold');
    doc.text(CREW_LIST_STATIC_LABELS.departure, s.sx(1545), s.sy(178));

    this.drawColumn6SubLabels(doc, s);
  }

  private drawColumn6SubLabels(doc: jsPDF, s: CoordScale): void {
    const left = s.rect(PAX_V2_COL6_X1, PAX_V2_COL6_HEADER_DIVIDER_Y, PAX_V2_COL6_SPLIT_X, 448);
    const right = s.rect(
      PAX_V2_COL6_SPLIT_X,
      PAX_V2_COL6_HEADER_DIVIDER_Y,
      PAX_V2_COL6_X2 + 1,
      448,
    );

    const fontSize = 6.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(fontSize);

    const leftCenterX = left.x + left.w / 2;
    const passportY = s.sy(PAX_V2_PASSPORT_LABEL_Y1);
    const lineStep = PAX_V2_PASSPORT_LABEL_LINE_STEP_PT;

    doc.text(PAX_V2_COL6_SUBLABELS.docTypeLine1, leftCenterX, passportY, { align: 'center' });
    doc.text(PAX_V2_COL6_SUBLABELS.docTypeLine2, leftCenterX, passportY + lineStep, {
      align: 'center',
    });

    const blockMidY = passportY + lineStep / 2;
    doc.text(PAX_V2_COL6_SUBLABELS.expiry, right.x + right.w / 2, blockMidY, {
      align: 'center',
      baseline: 'middle',
    });
  }

  private drawCheckboxMark(doc: jsPDF, box: { x: number; y: number; w: number; h: number }): void {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(Math.min(box.w, box.h) * 0.72);
    doc.text('X', box.x + box.w / 2, box.y + box.h / 2, { align: 'center', baseline: 'middle' });
  }

  private fillDynamicData(
    doc: jsPDF,
    s: CoordScale,
    data: AppData,
    rows: CrewMember[],
    isArrival: boolean,
  ): void {
    const { ship, ports } = data;
    const voyageDate = formatDisplayDate(isArrival ? ship.dateOfArrival : ship.dateOfDeparture);
    const portFromTo = this.portsFromTo(ship.lastPortOfCall, ship.nextPortOfCall, ports);

    this.valueInBox(doc, s, 152, 192, 1101, 278, ship.name);
    this.valueInBox(doc, s, 152, 277, 1101, 380, ship.nationality);
    this.valueInBox(
      doc,
      s,
      1100,
      192,
      1491,
      278,
      this.formatPortWithCountry(ship.portOfCall, ports),
    );
    this.valueInBox(doc, s, 1490, 192, 2169, 278, voyageDate);
    this.valueInBox(doc, s, 1100, 277, PAX_V2_COL6_X1, 380, portFromTo);
    this.valueInBox(doc, s, 1871, 117, 2169, 192, String(CREW_LIST_PAGE_NO), 'center');

    this.fillPassengerRows(doc, s, rows);
    this.drawFooter(doc, s, data, isArrival);
  }

  private drawFooter(doc: jsPDF, s: CoordScale, data: AppData, isArrival: boolean): void {
    const voyageDate = formatDisplayDate(
      isArrival ? data.ship.dateOfArrival : data.ship.dateOfDeparture,
    );
    this.textAtSource(
      doc,
      s,
      PAX_V2_FOOTER.signatureDate.x,
      PAX_V2_FOOTER.signatureDate.y,
      voyageDate,
    );

    this.textAtSource(
      doc,
      s,
      PAX_V2_FOOTER.masterLabel.x,
      PAX_V2_FOOTER.masterLabel.y,
      PAX_V2_FOOTER.masterLabel.text,
    );

    const master = this.findMaster(data.crew);
    if (master) {
      const placement = PAX_V2_FOOTER.masterName;
      this.textAtSource(
        doc,
        s,
        placement.x,
        placement.y,
        this.formatMasterName(master),
        placement.maxWidth,
        placement.align,
      );
    }
  }

  private textAtSource(
    doc: jsPDF,
    s: CoordScale,
    x: number,
    y: number,
    text: string,
    maxWidth?: number,
    align: 'left' | 'right' = 'left',
  ): void {
    if (!text) return;

    doc.setFont('times', 'bolditalic');
    let fontSize = this.headerFontSize(s);
    const width = maxWidth ?? 400;
    while (fontSize > 6 && doc.getTextWidth(text) > width) {
      fontSize -= 0.25;
    }
    doc.setFontSize(fontSize);
    const px = s.sx(x);
    const py = s.sy(y);
    doc.text(text, px, py, { align });
  }

  private findMaster(crew: CrewMember[]): CrewMember | undefined {
    const exact = crew.find((m) => m.rank.trim().toLowerCase() === 'master');
    if (exact) return exact;
    return crew.find((m) => m.rank.trim().toLowerCase().includes('master'));
  }

  /** Surname and given names — ALL CAPS, space-separated. */
  private formatMasterName(member: Pick<CrewMember, 'familyName' | 'givenNames'>): string {
    const parts = [member.familyName?.trim(), member.givenNames?.trim()].filter(Boolean);
    return parts.join(' ').toUpperCase();
  }

  private drawBodyNil(doc: jsPDF, s: CoordScale): void {
    const r = s.rect(
      CREW_LIST_BODY_BOUNDS.x1,
      CREW_LIST_BODY_BOUNDS.y1,
      CREW_LIST_BODY_BOUNDS.x2,
      CREW_LIST_BODY_BOUNDS.y2,
    );
    const fontSize = Math.min(r.w * 0.28, r.h * 0.44, 192);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(fontSize);
    doc.setTextColor(
      CREW_LIST_BODY_NIL_GRAY.r,
      CREW_LIST_BODY_NIL_GRAY.g,
      CREW_LIST_BODY_NIL_GRAY.b,
    );
    doc.text(CREW_LIST_BODY_NIL_LABEL, r.x + r.w / 2, r.y + r.h / 2, {
      align: 'center',
      baseline: 'middle',
    });
  }

  private fillPassengerRows(doc: jsPDF, s: CoordScale, rows: CrewMember[]): void {
    const rowH = (BODY_BOTTOM_Y - BODY_TOP_Y) / CREW_LIST_ROW_COUNT;
    const bodyFont = this.bodyFontSize(s);

    for (let i = 0; i < CREW_LIST_ROW_COUNT; i++) {
      const member = rows[i];
      if (!member) continue;

      const cy = s.sy(BODY_TOP_Y + rowH * i + rowH * 0.62);

      this.dataAt(doc, s, 152, 237, cy, String(i + 1), bodyFont, 'center');
      this.dataAt(doc, s, 236, 882, cy, formatCrewListName(member), bodyFont);
      this.dataAt(doc, s, 881, 1101, cy, member.rank, bodyFont);
      this.dataAt(doc, s, 1100, 1305, cy, member.nationality, bodyFont);
      this.dataAt(doc, s, 1304, 1491, cy, formatBirthDate(member.dateOfBirth), bodyFont);
      this.dataAt(
        doc,
        s,
        PAX_V2_PLACE_OF_BIRTH_X1,
        PAX_V2_PLACE_OF_BIRTH_X2,
        cy,
        member.placeOfBirth,
        bodyFont,
      );
      this.dataAt(
        doc,
        s,
        PAX_V2_COL6_X1,
        PAX_V2_COL6_SPLIT_X,
        cy,
        member.passport.trim(),
        bodyFont,
        'center',
      );
      this.dataAt(
        doc,
        s,
        PAX_V2_COL6_SPLIT_X,
        PAX_V2_COL6_X2,
        cy,
        formatDisplayDate(member.passportExpiryDate),
        bodyFont,
        'center',
      );
    }
  }

  private bodyFontSize(s: CoordScale): number {
    const bodyH = s.sy(BODY_BOTTOM_Y) - s.sy(BODY_TOP_Y);
    return Math.max(6, Math.min(8.5, (bodyH / CREW_LIST_ROW_COUNT) * 0.42));
  }

  private headerFontSize(s: CoordScale): number {
    const sampleH = s.rect(152, 192, 1101, 278).h;
    return Math.max(7, Math.min(10, sampleH * 0.28));
  }

  private valueInBox(
    doc: jsPDF,
    s: CoordScale,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    text: string,
    align: 'left' | 'center' = 'left',
  ): void {
    if (!text) return;

    const r = s.rect(x1, y1, x2, y2);
    doc.setFont('times', 'bolditalic');
    doc.setFontSize(this.headerFontSize(s));

    const x = align === 'center' ? r.x + r.w / 2 : r.x + 3;
    const y = r.y + r.h * 0.72;
    doc.text(text, x, y, {
      align: align === 'center' ? 'center' : 'left',
      maxWidth: r.w - 6,
    });
  }

  private dataAt(
    doc: jsPDF,
    s: CoordScale,
    x1: number,
    x2: number,
    y: number,
    text: string,
    fontSize: number,
    align: 'left' | 'center' = 'left',
  ): void {
    if (!text) return;

    const x = s.sx(x1);
    const w = s.sx(x2) - x;
    doc.setFont('times', 'bolditalic');
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, w - 4);
    const line = lines[0] ?? text;

    if (align === 'center') {
      doc.text(line, x + w / 2, y, { align: 'center' });
    } else {
      doc.text(line, x + 2, y);
    }
  }

  private formatPortWithCountry(portName: string, ports: AppData['ports']): string {
    const name = formatPortCallPortName(portName);
    if (!name) return '';
    const country = portCountry(portName, ports);
    return country ? `${name} / ${country}` : name;
  }

  private portsFromTo(last: string, next: string, ports: AppData['ports']): string {
    const fmt = (portName: string) => this.formatPortWithCountry(portName, ports);
    return [fmt(last), fmt(next)].filter(Boolean).join('       ');
  }

  private drawBodyRowDividers(doc: jsPDF, s: CoordScale): void {
    const left = s.sx(152);
    const right = s.sx(2169);
    const rowH = (BODY_BOTTOM_Y - BODY_TOP_Y) / CREW_LIST_ROW_COUNT;

    doc.setDrawColor(CREW_LIST_ROW_LINE_GRAY);
    doc.setLineWidth(CREW_LIST_ROW_LINE_PT);

    for (let i = 1; i < CREW_LIST_ROW_COUNT; i++) {
      const y = s.sy(BODY_TOP_Y + rowH * i);
      doc.line(left, y, right, y);
    }

    doc.setDrawColor(0);
    doc.setLineWidth(CREW_LIST_LINE_PT);
  }
}
