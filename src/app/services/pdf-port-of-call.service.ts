import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import {
  AppData,
  PortCallHistoryEntry,
  formatPortCallPortName,
  selectPortCallHistoryForPdf,
} from '../models/crew.models';
import { formatDisplayDate } from '../utils/date.util';
import {
  POC_BODY_BOTTOM,
  POC_BODY_TOP,
  POC_COL_BOUNDS,
  POC_FRAME_LABELS,
  POC_HEADER_ROWS,
  POC_LINE_PT,
  POC_PAGE,
  POC_ROW_LINE_GRAY,
  POC_ROW_LINE_PT,
  POC_SIGNATURE_Y,
  POC_STATIC_LABELS,
  POC_TABLE,
  pocColRect,
  pocRect,
  type PocRect,
} from './port-of-call-coordinates';

@Injectable({ providedIn: 'root' })
export class PdfPortOfCallService {
  build(data: AppData): jsPDF {
    const rowCount = data.portOfCall.pdfRowCount;
    const rows = selectPortCallHistoryForPdf(data.portCallHistory, rowCount);

    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    this.drawPageBackground(doc);
    this.drawTitle(doc);
    this.drawGrid(doc, rowCount);
    this.drawStaticLabels(doc);
    this.fillHeader(doc, data);
    this.fillHistoryRows(doc, rows, rowCount);
    this.drawSignatureLabel(doc);
    return doc;
  }

  openPreview(data: AppData): boolean {
    const blob = this.build(data).output('blob');
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (!win) {
      URL.revokeObjectURL(url);
      return false;
    }
    win.addEventListener('beforeunload', () => URL.revokeObjectURL(url));
    return true;
  }

  private drawPageBackground(doc: jsPDF): void {
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, POC_PAGE.w, POC_PAGE.h, 'F');
  }

  private drawTitle(doc: jsPDF): void {
    const centerX = (POC_TABLE.left + POC_TABLE.right) / 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(POC_FRAME_LABELS.title, centerX, 93, { align: 'center' });
  }

  private drawGrid(doc: jsPDF, rowCount: number): void {
    const { left, right, top, bottom } = POC_TABLE;
    doc.setDrawColor(0);
    doc.setLineWidth(POC_LINE_PT);
    doc.rect(left, top, right - left, bottom - top);

    const colXs = [82, 205, 304, 368, 432, 496];
    for (const x of colXs) {
      doc.line(x, POC_HEADER_ROWS.row1.top, x, bottom);
    }

    for (const y of [POC_HEADER_ROWS.row1.top, POC_HEADER_ROWS.row2.top, POC_HEADER_ROWS.tableHead.top, POC_BODY_TOP]) {
      doc.line(left, y, right, y);
    }

    const rowH = (POC_BODY_BOTTOM - POC_BODY_TOP) / rowCount;
    doc.setDrawColor(POC_ROW_LINE_GRAY);
    doc.setLineWidth(POC_ROW_LINE_PT);
    for (let i = 1; i < rowCount; i++) {
      const y = POC_BODY_TOP + rowH * i;
      doc.line(left, y, right, y);
    }

    doc.setDrawColor(0);
    doc.setLineWidth(POC_LINE_PT);
    doc.line(left, POC_BODY_BOTTOM, right, POC_BODY_BOTTOM);
  }

  private drawStaticLabels(doc: jsPDF): void {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);

    this.labelInRect(doc, pocRect(63, 118, 205, 132), POC_STATIC_LABELS.shipName);
    this.labelInRect(doc, pocRect(205, 118, 304, 132), POC_STATIC_LABELS.callSign);
    this.labelInRect(doc, pocRect(304, 118, 432, 132), POC_STATIC_LABELS.portOfArrival);
    this.labelInRect(doc, pocRect(432, 118, 560, 132), POC_STATIC_LABELS.dateOfArrival);

    this.labelInRect(doc, pocRect(63, 143, 205, 156), POC_STATIC_LABELS.nationality);
    this.labelInRect(doc, pocRect(205, 143, 304, 156), POC_STATIC_LABELS.homeport);
    this.labelInRect(doc, pocRect(304, 143, 432, 156), POC_STATIC_LABELS.arrivedFrom);
    this.labelInRect(doc, pocRect(432, 143, 560, 156), POC_STATIC_LABELS.sailingTo);

    this.labelInRect(doc, pocColRect('voy', 166, 178), POC_STATIC_LABELS.voyNo);
    this.labelInRect(doc, pocColRect('port', 166, 178), POC_STATIC_LABELS.lastPort);
    this.labelInRect(doc, pocColRect('country', 166, 178), POC_STATIC_LABELS.country);
    this.labelInRect(doc, pocColRect('arrDate', 166, 178), POC_STATIC_LABELS.arrDate);
    this.labelInRect(doc, pocColRect('arrTime', 166, 178), POC_STATIC_LABELS.arrTime);
    this.labelInRect(doc, pocColRect('arrTime', 178, 188), POC_STATIC_LABELS.arrTimeSub, 7);
    this.labelInRect(doc, pocColRect('depDate', 166, 178), POC_STATIC_LABELS.depDate);
    this.labelInRect(doc, pocColRect('depTime', 166, 178), POC_STATIC_LABELS.depTime);
    this.labelInRect(doc, pocColRect('depTime', 178, 188), POC_STATIC_LABELS.depTimeSub, 7);
  }

  private drawSignatureLabel(doc: jsPDF): void {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(POC_FRAME_LABELS.signature, POC_TABLE.left + 4, POC_SIGNATURE_Y);
  }

  private fillHeader(doc: jsPDF, data: AppData): void {
    const { ship } = data;
    this.valueInRect(doc, pocRect(63, 132, 205, 143), ship.name);
    this.valueInRect(doc, pocRect(205, 132, 304, 143), ship.callSign);
    this.valueInRect(doc, pocRect(304, 132, 432, 143), ship.portOfCall);
    this.valueInRect(doc, pocRect(432, 132, 560, 143), formatDisplayDate(ship.dateOfArrival));

    this.valueInRect(doc, pocRect(63, 156, 205, 166), ship.nationality);
    this.valueInRect(doc, pocRect(205, 156, 304, 166), ship.homeport);
    this.valueInRect(doc, pocRect(304, 156, 432, 166), ship.lastPortOfCall);
    this.valueInRect(doc, pocRect(432, 156, 560, 166), ship.nextPortOfCall);
  }

  private fillHistoryRows(doc: jsPDF, rows: PortCallHistoryEntry[], rowCount: number): void {
    const rowH = (POC_BODY_BOTTOM - POC_BODY_TOP) / rowCount;
    const fontSize = Math.max(6, Math.min(8, rowH * 0.38));

    for (let i = 0; i < rowCount; i++) {
      const entry = rows[i];
      if (!entry) continue;

      const yMid = POC_BODY_TOP + rowH * i + rowH * 0.62;
      this.dataAt(doc, POC_COL_BOUNDS.voy[0], POC_COL_BOUNDS.voy[1], yMid, String(i + 1), fontSize, 'center');
      this.dataAt(
        doc,
        POC_COL_BOUNDS.port[0],
        POC_COL_BOUNDS.port[1],
        yMid,
        formatPortCallPortName(entry.portName),
        fontSize,
      );
      this.dataAt(doc, POC_COL_BOUNDS.country[0], POC_COL_BOUNDS.country[1], yMid, entry.country, fontSize);
      this.dataAt(
        doc,
        POC_COL_BOUNDS.arrDate[0],
        POC_COL_BOUNDS.arrDate[1],
        yMid,
        formatDisplayDate(entry.arrivalDate),
        fontSize,
      );
      this.dataAt(doc, POC_COL_BOUNDS.arrTime[0], POC_COL_BOUNDS.arrTime[1], yMid, entry.arrivalTime, fontSize);
      this.dataAt(
        doc,
        POC_COL_BOUNDS.depDate[0],
        POC_COL_BOUNDS.depDate[1],
        yMid,
        formatDisplayDate(entry.departureDate),
        fontSize,
      );
      this.dataAt(doc, POC_COL_BOUNDS.depTime[0], POC_COL_BOUNDS.depTime[1], yMid, entry.departureTime, fontSize);
    }
  }

  private labelInRect(doc: jsPDF, r: PocRect, text: string, fontSize = 6.5): void {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(fontSize);
    doc.text(text, r.x + 2, r.y + 8, { maxWidth: r.w - 4 });
  }

  private valueInRect(doc: jsPDF, r: PocRect, text: string): void {
    if (!text) return;
    doc.setFont('times', 'bolditalic');
    doc.setFontSize(9);
    doc.text(text, r.x + 3, r.y + r.h * 0.72, { maxWidth: r.w - 6 });
  }

  private dataAt(
    doc: jsPDF,
    x1: number,
    x2: number,
    y: number,
    text: string,
    fontSize: number,
    align: 'left' | 'center' = 'left',
  ): void {
    if (!text) return;
    const w = x2 - x1;
    doc.setFont('times', 'bolditalic');
    doc.setFontSize(fontSize);
    const line = doc.splitTextToSize(text, w - 4)[0] ?? text;
    if (align === 'center') {
      doc.text(line, x1 + w / 2, y, { align: 'center' });
    } else {
      doc.text(line, x1 + 2, y);
    }
  }
}
