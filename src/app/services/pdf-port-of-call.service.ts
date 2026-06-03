import { Injectable, inject } from '@angular/core';
import { jsPDF } from 'jspdf';
import { openPdfBlobPreview } from '../utils/pdf-blob.util';
import { PdfOverlayService } from './pdf-overlay.service';
import {
  AppData,
  PortCallHistoryEntry,
  chunkPortCallHistoryForPdf,
  formatPortCallPortName,
  selectPortCallHistoryForPdf,
} from '../models/crew.models';
import { portOfCallPdfFileName } from '../utils/pdf-filename.util';
import { formatDisplayDate } from '../utils/date.util';
import {
  POC_BORDER_WIDTH_PX,
  POC_DATA_COL_COUNT,
  POC_DATA_COL_KEYS,
  POC_DATA_FIRST_CELL_ID,
  POC_DATA_ROW_COUNT,
  POC_FRAME_LABELS,
  POC_HEADER_LABEL_SHIFT_UP_PT,
  POC_HEADER_VALUE_SHIFT_DOWN_PT,
  POC_HEADER_VALUE_CELLS,
  POC_LOCAL_TIME_SHIFT_DOWN_PT,
  POC_STATIC_LABELS,
  POC_VOY_NO_8_SHIFT_UP_PT,
  POC_VOY_NO_BOTTOM_SHIFT_DOWN_PT,
  POC_H_LINES,
  POC_LABEL_SPECS,
  POC_SIGNATURE_CELL_ID,
  POC_SIGNATURE_LINE_GAP_PT,
  POC_SIGNATURE_LINE_WIDTH_PT,
  POC_SRC,
  POC_TEMPLATE_ROW_COUNT,
  POC_TITLE_FONT_PT,
  POC_TITLE_Y_SRC,
  POC_V_LINES,
  buildPocGridCells,
  createPocScale,
  pocCellById,
  pocPortDataCellId,
  type PocCellTextLine,
  type PocGridCell,
  type PocLineH,
  type PocScale,
} from './port-of-call-coordinates';

/** Set true to overlay red cell IDs for layout checks. */
const POC_SHOW_CELL_NUMBERS = false;

@Injectable({ providedIn: 'root' })
export class PdfPortOfCallService {
  private readonly overlay = inject(PdfOverlayService);

  build(data: AppData): jsPDF {
    const selected = selectPortCallHistoryForPdf(data.portCallHistory, data.portOfCall.pdfRowCount);
    const pages = chunkPortCallHistoryForPdf(selected, POC_TEMPLATE_ROW_COUNT);
    const s = createPocScale();
    const cells = buildPocGridCells();
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

    pages.forEach((pageRows, pageIndex) => {
      if (pageIndex > 0) doc.addPage();
      this.drawPage(doc, s, cells, data, pageRows, pageIndex * POC_DATA_ROW_COUNT);
    });

    return doc;
  }

  buildPdfBytes(data: AppData): Uint8Array {
    const doc = this.build(data);
    return new Uint8Array(doc.output('arraybuffer') as ArrayBuffer);
  }

  async openPreview(data: AppData): Promise<boolean> {
    const doc = this.build(data);
    const bytes = await this.overlay.applyToJsPdf(doc, data.documentOverlay.portOfCall, 'portOfCall');
    return openPdfBlobPreview(bytes);
  }

  fileName(data: AppData): string {
    const { ship } = data;
    const voyageDate = ship.dateOfArrival || ship.dateOfDeparture;
    return portOfCallPdfFileName(ship.name, voyageDate);
  }

  private drawPage(
    doc: jsPDF,
    s: PocScale,
    cells: PocGridCell[],
    data: AppData,
    pageRows: PortCallHistoryEntry[],
    voyRowOffset: number,
  ): void {
    this.drawPageBackground(doc);
    this.drawTitle(doc, s);
    this.drawGrid(doc, s);
    this.drawStaticLabels(doc, s, cells);
    this.fillHeaderValues(doc, s, cells, data);
    this.fillPortRows(doc, s, cells, pageRows, voyRowOffset);
    if (POC_SHOW_CELL_NUMBERS) {
      this.drawCellNumbers(doc, s, cells);
    }
    this.drawSignatureLabel(doc, s, cells);
  }

  private drawPageBackground(doc: jsPDF): void {
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, w, h, 'F');
  }

  private drawTitle(doc: jsPDF, s: PocScale): void {
    const centerX = s.sx((POC_SRC.minX + POC_SRC.maxX) / 2);
    const y = s.sy(POC_TITLE_Y_SRC);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(POC_TITLE_FONT_PT);
    doc.text(POC_FRAME_LABELS.title, centerX, y, { align: 'center' });
    const w = doc.getTextWidth(POC_FRAME_LABELS.title);
    doc.setLineWidth(0.75);
    doc.setDrawColor(0);
    doc.line(centerX - w / 2, y + 3, centerX + w / 2, y + 3);
  }

  private drawGrid(doc: jsPDF, s: PocScale): void {
    doc.setDrawColor(0);
    doc.setFillColor(0, 0, 0);

    const outer = s.rect(POC_SRC.minX, POC_SRC.minY, POC_SRC.maxX, POC_SRC.maxY);
    doc.setLineWidth(s.linePt(POC_BORDER_WIDTH_PX));
    doc.rect(outer.x, outer.y, outer.w, outer.h, 'S');

    for (const line of POC_H_LINES) {
      this.drawHorizontalBand(doc, s, line);
    }
    for (const line of POC_V_LINES) {
      this.drawVerticalBand(doc, s, line);
    }
  }

  private drawHorizontalBand(doc: jsPDF, s: PocScale, line: PocLineH): void {
    const r = s.rect(POC_SRC.minX, line.y1, POC_SRC.maxX, line.y2);
    if (r.h < 0.25) return;
    doc.rect(r.x, r.y, r.w, r.h, 'F');
  }

  private drawVerticalBand(
    doc: jsPDF,
    s: PocScale,
    line: { x1: number; x2: number; y1: number; y2: number },
  ): void {
    const r = s.rect(line.x1, line.y1, line.x2, line.y2);
    if (r.w < 0.25) return;
    doc.rect(r.x, r.y, r.w, r.h, 'F');
  }

  private drawStaticLabels(doc: jsPDF, s: PocScale, cells: PocGridCell[]): void {
    for (let cellId = 2; cellId < POC_LABEL_SPECS.length; cellId++) {
      const spec = POC_LABEL_SPECS[cellId];
      if (!spec?.length) continue;
      const cell = pocCellById(cells, cellId);
      if (!cell) continue;
      this.drawCellTextLines(doc, s, cell, spec, 'label');
    }
  }

  private fillHeaderValues(doc: jsPDF, s: PocScale, cells: PocGridCell[], data: AppData): void {
    const { ship } = data;
    const values: Record<keyof typeof POC_HEADER_VALUE_CELLS, string> = {
      shipName: ship.name,
      callSign: ship.callSign,
      portOfArrival: ship.portOfCall,
      dateOfArrival: formatDisplayDate(ship.dateOfArrival),
      nationality: ship.nationality,
      homeport: ship.homeport,
      arrivedFrom: ship.lastPortOfCall,
      sailingTo: ship.nextPortOfCall,
    };

    for (const [key, cellId] of Object.entries(POC_HEADER_VALUE_CELLS)) {
      const text = values[key as keyof typeof POC_HEADER_VALUE_CELLS];
      const cell = pocCellById(cells, cellId);
      if (!cell || !text) continue;
      this.drawCellTextLines(doc, s, cell, [{ text, placement: 'valueBottomCenter' }], 'value');
    }
  }

  private fillPortRows(
    doc: jsPDF,
    s: PocScale,
    cells: PocGridCell[],
    pageRows: PortCallHistoryEntry[],
    voyOffset: number,
  ): void {
    for (let row = 0; row < POC_DATA_ROW_COUNT; row++) {
      const entry = pageRows[row];
      if (!entry) continue;

      const voyCell = pocCellById(cells, pocPortDataCellId(row, 0));
      if (voyCell) {
        this.drawCellTextLines(
          doc,
          s,
          voyCell,
          [{ text: String(voyOffset + row + 1), placement: 'middleCenter' }],
          'value',
        );
      }

      const rowValues: Record<(typeof POC_DATA_COL_KEYS)[number], string> = {
        voy: '',
        port: formatPortCallPortName(entry.portName),
        country: entry.country,
        arrDate: formatDisplayDate(entry.arrivalDate),
        arrTime: entry.arrivalTime,
        depDate: formatDisplayDate(entry.departureDate),
        depTime: entry.departureTime,
      };

      for (let col = 1; col < POC_DATA_COL_COUNT; col++) {
        const key = POC_DATA_COL_KEYS[col];
        const text = rowValues[key];
        if (!text) continue;
        const cell = pocCellById(cells, pocPortDataCellId(row, col));
        if (!cell) continue;
        this.drawCellTextLines(doc, s, cell, [{ text, placement: 'middleLeft' }], 'value');
      }
    }
  }

  private drawCellTextLines(
    doc: jsPDF,
    s: PocScale,
    cell: PocGridCell,
    lines: PocCellTextLine[],
    kind: 'label' | 'value',
  ): void {
    const r = s.rect(cell.x1, cell.y1, cell.x2, cell.y2);
    const padX = 3;
    const padY = 4;
    const isHeaderCell = cell.id >= 2 && cell.id <= 9;
    const isVoyNoCell = cell.id === 10;

    for (const line of lines) {
      const isValue =
        kind === 'value' || line.placement === 'valueBottom' || line.placement === 'valueBottomCenter';
      const fontSize = isValue
        ? Math.max(7, Math.min(10, r.h * 0.45))
        : Math.max(4.5, Math.min(6.5, Math.min(r.w, r.h) * 0.38));
      const subSize = fontSize * 0.85;

      const isLocalTime =
        kind === 'label' &&
        line.placement === 'bottomCenter' &&
        line.text === POC_STATIC_LABELS.arrTimeSub;
      doc.setFont('helvetica', isValue || isLocalTime ? 'bold' : 'normal');
      const isSubLabel = kind === 'label' && line.placement === 'bottomCenter' && lines.length > 1;
      doc.setFontSize(isSubLabel ? subSize : fontSize);

      const textLines = doc.splitTextToSize(line.text, r.w - 6);
      const blockH = textLines.length * fontSize * 1.05;
      let x = r.x + padX;
      let y: number;
      let align: 'left' | 'center' = 'left';

      switch (line.placement) {
        case 'topCenter':
          align = 'center';
          x = r.x + r.w / 2;
          y = r.y + padY + fontSize;
          if (isVoyNoCell && line.text === '8.') {
            y -= POC_VOY_NO_8_SHIFT_UP_PT;
          }
          break;
        case 'middleCenter':
          align = 'center';
          x = r.x + r.w / 2;
          y = r.y + r.h / 2 + fontSize * 0.35;
          break;
        case 'bottomCenter':
          align = 'center';
          x = r.x + r.w / 2;
          y = r.y + r.h - padY - fontSize * 0.2;
          if (isLocalTime) {
            y += POC_LOCAL_TIME_SHIFT_DOWN_PT;
          } else if (isVoyNoCell && line.text === 'No.') {
            y += POC_VOY_NO_BOTTOM_SHIFT_DOWN_PT;
          }
          break;
        case 'middleLeft':
          y = r.y + (r.h - blockH) / 2 + fontSize;
          break;
        case 'valueBottom':
          y = r.y + r.h - padY - fontSize * 0.15;
          break;
        case 'valueBottomCenter':
          align = 'center';
          x = r.x + r.w / 2;
          y = r.y + r.h - padY - fontSize * 0.15 + (isHeaderCell ? POC_HEADER_VALUE_SHIFT_DOWN_PT : 0);
          break;
        case 'topLeft':
        default:
          y = r.y + padY + fontSize;
          if (isHeaderCell && kind === 'label') {
            y -= POC_HEADER_LABEL_SHIFT_UP_PT;
          }
          break;
      }

      doc.text(textLines, x, y, { align, maxWidth: r.w - 6 });
    }
  }

  private drawCellNumbers(doc: jsPDF, s: PocScale, cells: PocGridCell[]): void {
    for (const cell of cells) {
      const r = s.rect(cell.x1, cell.y1, cell.x2, cell.y2);
      const text = String(cell.id);
      const fontSize = Math.max(5, Math.min(11, Math.min(r.w, r.h) * 0.42));
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(fontSize);
      doc.setTextColor(180, 0, 0);
      doc.text(text, r.x + r.w / 2, r.y + r.h / 2, { align: 'center', baseline: 'middle' });
    }
    doc.setTextColor(0, 0, 0);
  }

  private drawSignatureLabel(doc: jsPDF, s: PocScale, cells: PocGridCell[]): void {
    const footer = pocCellById(cells, POC_SIGNATURE_CELL_ID);
    const r = footer
      ? s.rect(footer.x1, footer.y1, footer.x2, footer.y2)
      : s.rect(POC_SRC.minX, 1918, POC_SRC.maxX, POC_SRC.maxY);
    const pad = 8;
    const text = POC_FRAME_LABELS.signature;
    const textX = r.x + r.w - pad;
    const textY = r.y + r.h - pad;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    const textW = doc.getTextWidth(text);
    const lineX2 = textX;
    const lineX1 = lineX2 - Math.max(textW * 1.05, r.w * 0.38);
    const lineY = textY - POC_SIGNATURE_LINE_GAP_PT;

    doc.setDrawColor(0);
    doc.setLineWidth(POC_SIGNATURE_LINE_WIDTH_PT);
    doc.line(lineX1, lineY, lineX2, lineY);

    doc.text(text, textX, textY, {
      align: 'right',
      baseline: 'bottom',
      maxWidth: r.w - pad * 2,
    });
  }
}
