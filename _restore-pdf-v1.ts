import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import { AppData, CrewMember } from '../models/crew.models';
import { formatBirthDateShort, formatDisplayDate } from '../utils/date.util';

export const CREW_LIST_ROW_COUNT = 23;

export interface CrewListFormData {
  shipName: string;
  nationality: string;
  port: string;
  date: string;
  portFrom: string;
  portTo: string;
  isArrival: boolean;
  pageNo: number;
}

/** Fixed A4 IMO FAL Form 5 — matches Книга1.pdf / DOCUMENT.xlsx Crew Arr. */
@Injectable({ providedIn: 'root' })
export class PdfCrewArrService {
  private readonly ROW_COUNT = CREW_LIST_ROW_COUNT;
  private readonly HEADER_H = 10;
  private readonly LEFT = 14;
  private readonly RIGHT = 196;
  private readonly TABLE_TOP = 52;
  private readonly TABLE_BOTTOM = 268;
  private readonly COL = {
    no: { x: 14, w: 10 },
    name: { x: 24, w: 46 },
    rank: { x: 70, w: 18 },
    nat: { x: 88, w: 24 },
    birth: { x: 112, w: 50 },
    passport: { x: 162, w: 34 },
  };

  build(data: AppData, crew: CrewMember[]): jsPDF {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const { ship, crewArr } = data;

    const form: CrewListFormData = {
      shipName: ship.name,
      nationality: ship.nationality,
      port: ship.portOfCall,
      date: formatDisplayDate(crewArr.isArrival ? ship.dateOfArrival : ship.dateOfDeparture),
      portFrom: ship.lastPortOfCall,
      portTo: ship.nextPortOfCall,
      isArrival: crewArr.isArrival,
      pageNo: crewArr.pageNo,
    };

    this.drawPage(doc, form, crew);
    return doc;
  }

  generate(data: AppData, crew: CrewMember[]): void {
    const doc = this.build(data, crew);
    doc.save(this.fileName(data));
  }

  openPreview(data: AppData, crew: CrewMember[]): boolean {
    const doc = this.build(data, crew);
    const blob = doc.output('blob');
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

  private drawPage(doc: jsPDF, h: CrewListFormData, crew: CrewMember[]): void {
    this.drawHeader(doc, h);

    const rowH = (this.TABLE_BOTTOM - this.TABLE_TOP - this.HEADER_H) / this.ROW_COUNT;
    const dataTop = this.TABLE_TOP + this.HEADER_H;

    this.drawTableGrid(doc, rowH, dataTop);
    this.drawTableHeaders(doc);
    this.drawVerticalLabel(doc);

    for (let i = 0; i < this.ROW_COUNT; i++) {
      const member = crew[i];
      if (!member) continue;
      const y = dataTop + rowH * (i + 1);
      const cy = y - rowH / 2 + 1.8;
      this.dataText(doc, String(i + 1), this.COL.no.x + 1, cy);
      this.dataText(doc, member.familyNameGivenNames, this.COL.name.x + 1, cy);
      this.dataText(doc, member.rank, this.COL.rank.x + 1, cy);
      this.dataText(doc, member.nationality, this.COL.nat.x + 1, cy);
      const birthDate = formatBirthDateShort(member.dateOfBirth);
      const birthPlace = member.placeOfBirth;
      this.dataText(doc, birthDate, this.COL.birth.x + 1, cy);
      if (birthPlace) {
        this.dataText(doc, birthPlace, this.COL.birth.x + 16, cy);
      }
      this.dataText(doc, member.passport, this.COL.passport.x + 1, cy);
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('IMO FAL', this.LEFT, 284);
    doc.text('Form 5', this.LEFT, 287);

    doc.setFontSize(8);
    doc.text('12.  Date and signature by master, authorised agent or officer', this.LEFT, 276);
  }

  private drawHeader(doc: jsPDF, h: CrewListFormData): void {
    const c1 = this.LEFT;
    const c2 = 69;
    const c3 = 134;
    const c1w = 55;
    const c2w = 65;
    const c3w = 62;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('IMO CREW LIST', 105, 12, { align: 'center' });

    doc.setDrawColor(0);
    doc.setLineWidth(0.2);
    doc.rect(168, 8, 28, 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('Page No.', 170, 11);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(String(h.pageNo), 182, 15, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Arrival', 95, 18);
    doc.rect(108, 14.5, 5, 5);
    if (h.isArrival) {
      doc.setFont('helvetica', 'bold');
      doc.text('X', 109.2, 18.2);
    }
    doc.setFont('helvetica', 'normal');
    doc.text('Departure', 118, 18);
    doc.rect(135, 14.5, 5, 5);
    if (!h.isArrival) {
      doc.setFont('helvetica', 'bold');
      doc.text('X', 136.2, 18.2);
    }

    const r1y = 22;
    const r1h = 14;
    doc.rect(c1, r1y, c1w, r1h);
    doc.rect(c2, r1y, c2w, r1h);
    doc.rect(c3, r1y, c3w, r1h);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('1.   Name of ship', c1 + 1.5, r1y + 4);
    doc.text('2.   Port of arrival / departure', c2 + 1.5, r1y + 4);
    doc.text('3.   Date of arrival / departure', c3 + 1.5, r1y + 4);

    this.dataText(doc, h.shipName, c1 + 1.5, r1y + 10);
    this.dataText(doc, h.port, c2 + 1.5, r1y + 10);
    this.dataText(doc, h.date, c3 + 1.5, r1y + 10);

    const r2y = 36;
    doc.rect(c1, r2y, c1w, r1h);
    doc.rect(c2, r2y, c2w, r1h);
    doc.rect(c3, r2y, c3w, r1h);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('4.   Nationality of Ship', c1 + 1.5, r2y + 4);
    doc.text('5.   Port arrived from / Sailing to', c2 + 1.5, r2y + 4);
    doc.text('6.   Nature und No.\n        of identity documents', c3 + 1.5, r2y + 4);

    this.dataText(doc, h.nationality, c1 + 1.5, r2y + 10);
    this.dataText(doc, `${h.portFrom} / ${h.portTo}`, c2 + 1.5, r2y + 10);
  }

  private drawTableHeaders(doc: jsPDF): void {
    const hy = this.TABLE_TOP;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text('7.   No.', this.COL.no.x + 0.5, hy + 4.5);
    doc.text('8.   Family names, given names', this.COL.name.x + 0.5, hy + 4.5);
    doc.text('9.   Rank or rating', this.COL.rank.x + 0.5, hy + 4.5);
    doc.text('10.   Nationality', this.COL.nat.x + 0.5, hy + 4.5);
    doc.text('11.   Date and place of birth', this.COL.birth.x + 0.5, hy + 4.5);
    doc.text('Passport', this.COL.passport.x + 0.5, hy + 8);
  }

  private drawTableGrid(doc: jsPDF, rowH: number, dataTop: number): void {
    doc.setDrawColor(0);
    doc.setLineWidth(0.2);

    doc.rect(this.LEFT, this.TABLE_TOP, this.RIGHT - this.LEFT, this.TABLE_BOTTOM - this.TABLE_TOP);

    for (const col of [this.COL.no, this.COL.name, this.COL.rank, this.COL.nat, this.COL.birth]) {
      doc.line(col.x + col.w, this.TABLE_TOP, col.x + col.w, this.TABLE_BOTTOM);
    }

    doc.line(this.LEFT, dataTop, this.RIGHT, dataTop);

    for (let i = 1; i <= this.ROW_COUNT; i++) {
      const y = dataTop + rowH * i;
      doc.line(this.LEFT, y, this.RIGHT, y);
    }
  }

  private drawVerticalLabel(doc: jsPDF): void {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.text('IMO Convention on Facilitation of International Maritime Traffic', 6, (this.TABLE_TOP + this.TABLE_BOTTOM) / 2, {
      angle: 90,
    });
  }

  private dataText(doc: jsPDF, text: string, x: number, y: number): void {
    if (!text) return;
    doc.setFont('times', 'bolditalic');
    doc.setFontSize(8);
    const maxW = this.RIGHT - x - 2;
    const lines = doc.splitTextToSize(text, maxW);
    doc.text(lines[0] ?? text, x, y);
  }
}
