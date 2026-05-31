import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import { AppData, CrewMember, formatCrewListName } from '../models/crew.models';
import { formatBirthDateShort, formatDisplayDate } from '../utils/date.util';

export const CREW_LIST_ROW_COUNT = 23;

/** Left edges of Excel columns B…J (from Книга1.xlsx). */
const EX_EDGE = [69, 111, 433.5, 543, 567, 645, 738, 760.5, 928.5, 1077];

interface CrewListFormData {
  shipName: string;
  nationality: string;
  port: string;
  date: string;
  portFrom: string;
  portTo: string;
  isArrival: boolean;
  pageNo: number;
  identityDocumentType: string;
}

/**
 * IMO FAL Form 5 — Книга1.xlsx layout.
 * Column J is one merged strip: field 6 label → document type → passport numbers.
 */
@Injectable({ providedIn: 'root' })
export class PdfCrewArrService {
  private readonly ROW_COUNT = CREW_LIST_ROW_COUNT;
  private readonly M_LEFT = 14;
  private readonly M_RIGHT = 196;
  private readonly TABLE_TOP = 50;
  private readonly TABLE_BOTTOM = 268;
  private readonly HDR_H = 7;
  private readonly COL_HDR_H = 9;

  build(data: AppData, crew: CrewMember[]): jsPDF {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const { ship, crewArr } = data;

    this.drawPage(doc, {
      shipName: ship.name,
      nationality: ship.nationality,
      port: ship.portOfCall,
      date: formatDisplayDate(crewArr.isArrival ? ship.dateOfArrival : ship.dateOfDeparture),
      portFrom: ship.lastPortOfCall,
      portTo: ship.nextPortOfCall,
      isArrival: crewArr.isArrival,
      pageNo: crewArr.pageNo,
      identityDocumentType: crewArr.identityDocumentType || 'Passport',
    }, crew);
    return doc;
  }

  generate(data: AppData, crew: CrewMember[]): void {
    this.build(data, crew).save(this.fileName(data));
  }

  openPreview(data: AppData, crew: CrewMember[]): boolean {
    const blob = this.build(data, crew).output('blob');
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (!win) {
      URL.revokeObjectURL(url);
      return false;
    }
    win.addEventListener('beforeunload', () => URL.revokeObjectURL(url));
    return true;
  }

  private fileName(data: AppData): string {
    const { ship, crewArr } = data;
    const date = formatDisplayDate(crewArr.isArrival ? ship.dateOfArrival : ship.dateOfDeparture);
    return `Crew_Arr_${ship.name}_${ship.portOfCall}_${date.replace(/\./g, '-')}.pdf`;
  }

  private x(col: number): number {
    const min = EX_EDGE[0];
    const max = EX_EDGE[9];
    return this.M_LEFT + ((EX_EDGE[col - 2] - min) / (max - min)) * (this.M_RIGHT - this.M_LEFT);
  }

  private xr(col: number): number {
    if (col >= 10) return this.M_RIGHT;
    return this.x(col + 1);
  }

  private jCol() {
    return { x: this.x(10), w: this.M_RIGHT - this.x(10) };
  }

  private drawPage(doc: jsPDF, h: CrewListFormData, crew: CrewMember[]): void {
    doc.setDrawColor(0);
    doc.setLineWidth(0.2);

    const y1 = 18;
    const y2 = y1 + this.HDR_H;
    const y3 = y2 + 1;
    const y4 = y3 + this.HDR_H;
    const j = this.jCol();

    this.drawTitleRow(doc, h);

    // Fields 1–5 and 3 (date) — without column J
    this.field(doc, this.x(2), y1, this.xr(4), y2, '1.   Name of ship', h.shipName);
    this.field(doc, this.x(5), y1, this.xr(7), y2, '2.   Port of arrival / departure', h.port);
    this.field(doc, this.x(8), y1, this.xr(9), y2, '3.   Date of arrival / departure', h.date);
    this.field(doc, this.x(2), y3, this.xr(4), y4, '4.   Nationality of Ship', h.nationality);

    this.drawField5(doc, h, y3, y4);

    // Column J — one strip: field 6 + Passport + numbers (J7:J35 in Excel)
    doc.rect(j.x, y3, j.w, this.TABLE_BOTTOM - y3);
    this.label(doc, '6.   Nature und No.', j.x + 0.8, y3 + 1.5, 5.5, j.w - 1.5);
    this.label(doc, '        of identity documents', j.x + 0.8, y3 + 4.5, 5.5, j.w - 1.5);

    const colHdrMid = this.TABLE_TOP + this.COL_HDR_H * 0.55;
    doc.line(j.x, colHdrMid, j.x + j.w, colHdrMid);
    this.label(doc, h.identityDocumentType, j.x + 0.8, colHdrMid + 2, 6.5, j.w - 1.5);

    this.drawColumnHeaders(doc);
    this.drawTableGrid(doc);

    const dataTop = this.TABLE_TOP + this.COL_HDR_H;
    const rowH = (this.TABLE_BOTTOM - dataTop) / this.ROW_COUNT;

    for (let i = 0; i < this.ROW_COUNT; i++) {
      const m = crew[i];
      if (!m) continue;
      const cy = dataTop + rowH * (i + 0.55);
      this.dataText(doc, String(i + 1), this.x(2) + 1, cy, this.xr(2) - this.x(2) - 2);
      this.dataText(doc, formatCrewListName(m), this.x(3) + 1, cy, this.xr(3) - this.x(3) - 2);
      this.dataText(doc, m.rank, this.x(4) + 1, cy, this.xr(4) - this.x(4) - 2);
      this.dataText(doc, m.nationality, this.x(5) + 1, cy, this.xr(6) - this.x(5) - 2);
      this.dataText(doc, formatBirthDateShort(m.dateOfBirth), this.x(7) + 1, cy, this.xr(7) - this.x(7) - 2);
      this.dataText(doc, m.placeOfBirth, this.x(8) + 1, cy, this.xr(9) - this.x(8) - 2);
      this.dataText(doc, m.passport.trim(), j.x + 1, cy, j.w - 2);
    }

    this.drawVerticalLabel(doc);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('IMO FAL', this.M_LEFT, 284);
    doc.text('Form 5', this.M_LEFT, 287);
    doc.setFontSize(8);
    doc.text('12.  Date and signature by master, authorised agent or officer', this.M_LEFT, 276);
  }

  private drawTitleRow(doc: jsPDF, h: CrewListFormData): void {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('IMO CREW LIST', (this.M_LEFT + this.x(10)) / 2, 11, { align: 'center' });
    doc.line(this.M_LEFT, 12.5, this.x(10), 12.5);

    const j = this.jCol();
    doc.rect(j.x, 8, j.w, 5);
    this.label(doc, 'Page No.', j.x + 1, 8.5, 6);
    this.dataText(doc, String(h.pageNo), j.x + j.w / 2, 12, j.w - 2, 'center');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    if (h.isArrival) this.dataText(doc, 'x', this.x(5) + 1, 16.5, 3);
    doc.text('Arrival', this.x(5) + 4, 16.5);
    if (!h.isArrival) this.dataText(doc, 'x', this.x(9) + 1, 16.5, 3);
    doc.text('Departure', this.x(9) + 4, 16.5);
  }

  private drawField5(doc: jsPDF, h: CrewListFormData, y3: number, y4: number): void {
    const labelH = this.HDR_H * 0.42;
    doc.rect(this.x(5), y3, this.xr(9) - this.x(5), labelH);
    this.label(doc, '5.   Port arrived from / Sailing to', this.x(5) + 1, y3 + 1.5, 6);

    const valY = y3 + labelH;
    const valH = y4 - valY;
    doc.rect(this.x(5), valY, this.xr(7) - this.x(5), valH);
    doc.rect(this.x(8), valY, this.xr(8) - this.x(8), valH);
    doc.rect(this.x(9), valY, this.xr(9) - this.x(9), valH);
    this.dataText(doc, h.portFrom, this.x(5) + 1, valY + valH * 0.65, this.xr(7) - this.x(5) - 2);
    this.dataText(doc, '/', this.x(8) + 0.5, valY + valH * 0.65, this.xr(8) - this.x(8) - 1, 'center');
    this.dataText(doc, h.portTo, this.x(9) + 1, valY + valH * 0.65, this.xr(9) - this.x(9) - 2);
  }

  /** Column headers 7–11 in B–I only; J is part of the merged field-6 strip. */
  private drawColumnHeaders(doc: jsPDF): void {
    const y = this.TABLE_TOP;
    const mid = y + this.COL_HDR_H * 0.55;

    doc.rect(this.x(2), y, this.xr(2) - this.x(2), this.COL_HDR_H);
    doc.rect(this.x(3), y, this.xr(3) - this.x(3), this.COL_HDR_H);
    doc.rect(this.x(4), y, this.xr(4) - this.x(4), this.COL_HDR_H);
    doc.rect(this.x(5), y, this.xr(6) - this.x(5), mid - y);
    doc.rect(this.x(5), mid, this.xr(6) - this.x(5), y + this.COL_HDR_H - mid);
    doc.rect(this.x(7), y, this.xr(9) - this.x(7), mid - y);
    doc.rect(this.x(7), mid, this.xr(7) - this.x(7), y + this.COL_HDR_H - mid);
    doc.rect(this.x(8), mid, this.xr(9) - this.x(8), y + this.COL_HDR_H - mid);

    doc.line(this.x(2), y, this.x(10), y);

    this.label(doc, '7.   No.', this.x(2) + 0.5, y + 2, 6);
    this.label(doc, '8.   Family names, given names', this.x(3) + 0.5, y + 2, 6);
    this.label(doc, '9.   Rank or rating', this.x(4) + 0.5, y + 2, 6);
    this.label(doc, '10.   Nationality', this.x(5) + 0.5, y + 2, 6);
    this.label(doc, '11.   Date and place of birth', this.x(7) + 0.5, y + 2, 6);
  }

  private drawTableGrid(doc: jsPDF): void {
    const dataTop = this.TABLE_TOP + this.COL_HDR_H;
    const rowH = (this.TABLE_BOTTOM - dataTop) / this.ROW_COUNT;
    const j = this.jCol();

    doc.rect(this.x(2), this.TABLE_TOP, j.x - this.x(2), this.TABLE_BOTTOM - this.TABLE_TOP);

    for (const col of [3, 4, 5, 7, 8]) {
      doc.line(this.x(col), this.TABLE_TOP, this.x(col), this.TABLE_BOTTOM);
    }
    doc.line(this.xr(6), this.TABLE_TOP, this.xr(6), this.TABLE_BOTTOM);
    doc.line(this.xr(9), this.TABLE_TOP, this.xr(9), this.TABLE_BOTTOM);

    for (let i = 1; i <= this.ROW_COUNT; i++) {
      const y = dataTop + rowH * i;
      doc.line(this.x(2), y, j.x, y);
      doc.line(j.x, y, j.x + j.w, y);
    }
  }

  private drawVerticalLabel(doc: jsPDF): void {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.text(
      'IMO Convention on Facilitation of International Maritime Traffic',
      this.M_LEFT - 2,
      (this.TABLE_TOP + this.TABLE_BOTTOM) / 2,
      { angle: 90 },
    );
  }

  private field(doc: jsPDF, x: number, y: number, x2: number, y2: number, label: string, value: string): void {
    const w = x2 - x;
    const h = y2 - y;
    doc.rect(x, y, w, h);
    doc.line(x, y + h * 0.42, x2, y + h * 0.42);
    this.label(doc, label, x + 1, y + 1.5, 6);
    this.dataText(doc, value, x + 1, y + h * 0.72, w - 2);
  }

  private label(doc: jsPDF, text: string, x: number, y: number, size: number, maxW?: number): void {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(size);
    const w = maxW ?? 80;
    const lines = doc.splitTextToSize(text, w);
    doc.text(lines, x, y);
  }

  private dataText(
    doc: jsPDF,
    text: string,
    x: number,
    y: number,
    maxW: number,
    align: 'left' | 'center' = 'left',
  ): void {
    if (!text) return;
    doc.setFont('times', 'bolditalic');
    doc.setFontSize(8);
    const lines = doc.splitTextToSize(text, maxW);
    const line = lines[0] ?? text;
    if (align === 'center') {
      doc.text(line, x + maxW / 2, y, { align: 'center' });
    } else {
      doc.text(line, x, y);
    }
  }
}
