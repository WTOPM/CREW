import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import {
  AppData,
  CREW_IDENTITY_PASSPORT,
  CrewMember,
  formatCrewListName,
} from '../models/crew.models';
import { crewListPdfFileName, passengerListPdfFileName } from '../utils/pdf-filename.util';
import { PassengerMember } from '../models/passenger.models';
import { passengersToCrewRows } from '../utils/passenger-pdf.util';
import { openPdfPreview } from '../utils/pdf-download.util';
import { formatBirthDateShort, formatDisplayDate } from '../utils/date.util';
import {
  BODY_BOTTOM_Y,
  BODY_TOP_Y,
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

export { CREW_LIST_ROW_COUNT } from './crew-list-coordinates';

const CREW_LIST_PAGE_NO = 1;
export const IMO_PASSENGER_LIST_TITLE = 'IMO PASSENGER LIST';

export interface CrewListPdfOptions {
  title?: string;
  fileName?: string;
}

@Injectable({ providedIn: 'root' })
export class PdfCrewArrService {
  build(data: AppData, crew: CrewMember[], options?: CrewListPdfOptions): jsPDF {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    this.drawPageBackground(doc);
    const scale = createCoordScale();
    this.drawTitle(doc, scale, options?.title);
    this.drawCoordinateGrid(doc, scale);
    this.drawStaticExtras(doc, scale, data.crewArr.identityDocumentType, data.crewArr.isArrival);
    this.fillDynamicData(doc, scale, data, crew);
    this.drawFrameLabels(doc, scale);
    return doc;
  }

  generate(data: AppData, crew: CrewMember[], options?: CrewListPdfOptions): void {
    const doc = this.build(data, crew, options);
    doc.save(this.fileName(data, options));
  }

  openPreview(data: AppData, crew: CrewMember[], options?: CrewListPdfOptions): boolean {
    const doc = this.build(data, crew, options);
    return openPdfPreview(doc, this.fileName(data, options));
  }

  openPassengerPreview(data: AppData, passengers: PassengerMember[]): boolean {
    const { ship, paxArr } = data;
    const voyageDate = paxArr.isArrival ? ship.dateOfArrival : ship.dateOfDeparture;
    const pdfData: AppData = {
      ...data,
      crewArr: { ...data.crewArr, isArrival: paxArr.isArrival, identityDocumentType: CREW_IDENTITY_PASSPORT },
    };
    return this.openPreview(pdfData, passengersToCrewRows(passengers), {
      title: IMO_PASSENGER_LIST_TITLE,
      fileName: passengerListPdfFileName(ship.name, ship.portOfCall, voyageDate, paxArr.isArrival),
    });
  }

  fileName(data: AppData, options?: CrewListPdfOptions): string {
    if (options?.fileName) return options.fileName;
    const { ship, crewArr } = data;
    const voyageDate = crewArr.isArrival ? ship.dateOfArrival : ship.dateOfDeparture;
    return crewListPdfFileName(ship.name, ship.portOfCall, voyageDate, crewArr.isArrival);
  }

  private drawPageBackground(doc: jsPDF): void {
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, w, h, 'F');
  }

  private drawTitle(doc: jsPDF, s: CoordScale, title?: string): void {
    const heading = title ?? CREW_LIST_FRAME_LABELS.title;
    const centerX = (s.sx(152) + s.sx(1871)) / 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(heading, centerX, s.sy(CREW_LIST_TITLE_Y) - CREW_LIST_TITLE_OFFSET_UP_PT, {
      align: 'center',
    });
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

  /** IMO FAL / Form 5 — left of row 23. */
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
      const r = s.rect(box.x1, box.y1, box.x2, box.y2);
      doc.rect(r.x, r.y, r.w, r.h);
      this.drawFieldLabel(doc, box, r);
    }

    this.drawBodyRowDividers(doc, s);
  }

  private drawFieldLabel(doc: jsPDF, box: CoordBox, r: { x: number; y: number; w: number; h: number }): void {
    if (box.id === '14') {
      this.drawField14Label(doc, r);
      return;
    }
    if (!box.label) return;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(this.labelFontSize(r));
    const lines = doc.splitTextToSize(box.label, r.w - 4);
    doc.text(lines, r.x + 2, r.y + 8);
  }

  private drawField14Label(doc: jsPDF, r: { x: number; y: number; w: number; h: number }): void {
    doc.setFont('helvetica', 'normal');
    const fontSize = this.labelFontSize(r);
    doc.setFontSize(fontSize);

    const x0 = r.x + 2;
    const y0 = r.y + 8;
    doc.text('6.   Nature und No.', x0, y0);
    doc.text('of identity documents', x0 + doc.getTextWidth('6.   '), y0 + fontSize * 1.15);
  }

  private labelFontSize(r: { w: number; h: number }): number {
    return Math.max(5, Math.min(6.5, Math.min(r.w, r.h) * 0.35));
  }

  private drawStaticExtras(
    doc: jsPDF,
    s: CoordScale,
    identityDocumentType: string,
    isArrival: boolean,
  ): void {
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

    const field14 = s.rect(1871, 277, 2170, 448);
    const docType = identityDocumentType.trim() || 'Passport';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text(docType, field14.x + field14.w / 2, field14.y + field14.h - 6, {
      align: 'center',
      baseline: 'bottom',
    });
  }

  private drawCheckboxMark(doc: jsPDF, box: { x: number; y: number; w: number; h: number }): void {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(Math.min(box.w, box.h) * 0.72);
    doc.text('X', box.x + box.w / 2, box.y + box.h / 2, { align: 'center', baseline: 'middle' });
  }

  private fillDynamicData(doc: jsPDF, s: CoordScale, data: AppData, crew: CrewMember[]): void {
    const { ship, crewArr } = data;
    const voyageDate = formatDisplayDate(crewArr.isArrival ? ship.dateOfArrival : ship.dateOfDeparture);
    const portFromTo = [ship.lastPortOfCall, ship.nextPortOfCall].filter(Boolean).join('  /  ');
    const docType = crewArr.identityDocumentType.trim() || 'Passport';

    this.valueInBox(doc, s, 152, 192, 1101, 278, ship.name);
    this.valueInBox(doc, s, 152, 277, 1101, 380, ship.nationality);
    this.valueInBox(doc, s, 1100, 192, 1491, 278, ship.portOfCall);
    this.valueInBox(doc, s, 1490, 192, 2169, 278, voyageDate);
    this.valueInBox(doc, s, 1100, 277, 1872, 380, portFromTo);
    this.valueInBox(doc, s, 1871, 117, 2169, 192, String(CREW_LIST_PAGE_NO), 'center');

    this.fillCrewRows(doc, s, crew, docType);
  }

  private fillCrewRows(doc: jsPDF, s: CoordScale, crew: CrewMember[], identityDocumentType: string): void {
    const rowH = (BODY_BOTTOM_Y - BODY_TOP_Y) / CREW_LIST_ROW_COUNT;
    const bodyFont = this.bodyFontSize(s);

    for (let i = 0; i < CREW_LIST_ROW_COUNT; i++) {
      const member = crew[i];
      if (!member) continue;

      const cy = s.sy(BODY_TOP_Y + rowH * i + rowH * 0.62);

      this.dataAt(doc, s, 152, 237, cy, String(i + 1), bodyFont, 'center');
      this.dataAt(doc, s, 236, 882, cy, formatCrewListName(member), bodyFont);
      this.dataAt(doc, s, 881, 1101, cy, member.rank, bodyFont);
      this.dataAt(doc, s, 1100, 1305, cy, member.nationality, bodyFont);
      this.dataAt(doc, s, 1304, 1491, cy, formatBirthDateShort(member.dateOfBirth), bodyFont);
      this.dataAt(doc, s, 1490, 1872, cy, member.placeOfBirth, bodyFont);
      this.dataAt(doc, s, 1871, 2169, cy, this.identityNumber(member, identityDocumentType), bodyFont);
    }
  }

  private identityNumber(member: CrewMember, identityDocumentType: string): string {
    if (identityDocumentType.toLowerCase().includes('seaman')) {
      return member.seamansBook.trim();
    }
    return member.passport.trim();
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
