import { jsPDF } from 'jspdf';
import type { ReeferExportContext } from '../models/reefer-export.models';
import {
  resolveReeferExportPortCode,
  type ReeferLibrarySettings,
  type ReeferOnboardUnit,
} from '../models/reefer.models';
import { portCode, ShipInfo, type Port } from '../models/crew.models';
import { formatDisplayDate } from './date.util';
import {
  REEFER_FIXED_HEADERS,
  REEFER_LOG_DATA_START,
  REEFER_LOG_DATA_END,
  buildReeferLogGridMetrics,
  buildReeferLogLayout,
  buildReeferMonitoringDateBlocks,
  padReeferExportUnits,
  parseReeferSetPointNumber,
  reeferExportOnboardUnits,
  reeferLogCellRect,
  reeferLogFontSize,
  reeferLogTitleYear,
  type ReeferLogGridMetrics,
  type ReeferLogLayout,
  type ReeferMonitoringDateBlock,
} from './reefer-monitoring-layout.util';
import {
  drawReeferCheckSignoffInPdf,
  drawReeferSigFieldInPdf,
  reeferCheckSignoffSegments,
} from './reefer-check-signoff.util';

const FONT = 'helvetica';

function strokeCell(doc: jsPDF, x: number, y: number, w: number, h: number): void {
  doc.setDrawColor(0);
  doc.setLineWidth(0.35);
  doc.rect(x, y, w, h);
}

function drawTextInRect(
  doc: jsPDF,
  text: string,
  rect: { x: number; y: number; w: number; h: number },
  opts: {
    size: number;
    align?: 'left' | 'center' | 'right';
    bold?: boolean;
    pad?: number;
  },
): void {
  const label = text.trim();
  if (!label) return;
  doc.setFont(FONT, opts.bold ? 'bold' : 'normal');
  doc.setFontSize(opts.size);
  const pad = opts.pad ?? 2;
  const align = opts.align ?? 'center';
  const maxW = Math.max(2, rect.w - pad * 2);
  const lines =
    doc.getTextWidth(label) > maxW ? (doc.splitTextToSize(label, maxW) as string[]) : [label];

  if (lines.length === 1) {
    const x =
      align === 'left'
        ? rect.x + pad
        : align === 'right'
          ? rect.x + rect.w - pad
          : rect.x + rect.w / 2;
    doc.text(lines[0], x, rect.y + rect.h / 2, {
      align: align === 'left' ? 'left' : align === 'right' ? 'right' : 'center',
      baseline: 'middle',
    });
    return;
  }

  const lineH = opts.size * 1.12;
  const blockH = lines.length * lineH;
  let y = rect.y + (rect.h - blockH) / 2 + opts.size * 0.35;
  for (const line of lines) {
    const x =
      align === 'left'
        ? rect.x + pad
        : align === 'right'
          ? rect.x + rect.w - pad
          : rect.x + rect.w / 2;
    doc.text(line, x, y, {
      align: align === 'left' ? 'left' : align === 'right' ? 'right' : 'center',
      baseline: 'alphabetic',
    });
    y += lineH;
  }
}

function drawWrappedTextInRect(
  doc: jsPDF,
  text: string,
  rect: { x: number; y: number; w: number; h: number },
  opts: { size: number; pad?: number },
): void {
  const label = text.trim();
  if (!label) return;
  doc.setFont(FONT, 'normal');
  doc.setFontSize(opts.size);
  const pad = opts.pad ?? 3;
  const maxW = Math.max(4, rect.w - pad * 2);
  const lines = doc.splitTextToSize(label, maxW) as string[];
  const lineH = opts.size * 1.15;
  const blockH = lines.length * lineH;
  let y = rect.y + Math.max(pad, (rect.h - blockH) / 2) + opts.size * 0.35;
  for (const line of lines) {
    doc.text(line, rect.x + pad, y, { baseline: 'alphabetic' });
    y += lineH;
  }
}

function drawTopHeader(
  doc: jsPDF,
  metrics: ReeferLogGridMetrics,
  ship: ShipInfo,
  year: string,
  depPortCode: string,
  depDate: string,
  layout: ReeferLogLayout,
): void {
  const metaSize = reeferLogFontSize(metrics, 11);
  const { lastCol } = layout;
  const depLabelStart = lastCol - 4;
  const depLabelEnd = lastCol - 2;
  const depValueStart = lastCol - 1;

  drawTextInRect(doc, 'SHIP NAME:', reeferLogCellRect(metrics, 1, 2), {
    size: metaSize,
    align: 'left',
  });
  drawTextInRect(doc, ship.name || '', reeferLogCellRect(metrics, 1, 3, 1, 4), { size: metaSize });
  drawTextInRect(
    doc,
    'DEPARTURE PORT:',
    reeferLogCellRect(metrics, 1, depLabelStart, 1, depLabelEnd),
    {
      size: metaSize,
      align: 'right',
      pad: 4,
    },
  );
  drawTextInRect(doc, depPortCode || '', reeferLogCellRect(metrics, 1, depValueStart, 1, lastCol), {
    size: metaSize,
  });

  drawTextInRect(doc, 'IMO:', reeferLogCellRect(metrics, 2, 2), { size: metaSize, align: 'left' });
  drawTextInRect(doc, ship.imoNo || '', reeferLogCellRect(metrics, 2, 3, 2, 4), { size: metaSize });
  drawTextInRect(
    doc,
    'DEPARTURE DATE:',
    reeferLogCellRect(metrics, 2, depLabelStart, 2, depLabelEnd),
    {
      size: metaSize,
      align: 'right',
      pad: 4,
    },
  );
  drawTextInRect(doc, depDate || '', reeferLogCellRect(metrics, 2, depValueStart, 2, lastCol), {
    size: metaSize,
  });

  drawTextInRect(doc, `REEFER MONITORING LOG - ${year}`, reeferLogCellRect(metrics, 4, 7, 4, 11), {
    size: metaSize,
  });
}

function drawTableHeader(
  doc: jsPDF,
  metrics: ReeferLogGridMetrics,
  dateBlocks: readonly ReeferMonitoringDateBlock[],
  layout: ReeferLogLayout,
): void {
  const headSize = reeferLogFontSize(metrics, 12);

  for (let col = 1; col <= 7; col++) {
    const rect = reeferLogCellRect(metrics, 6, col);
    strokeCell(doc, rect.x, rect.y, rect.w, rect.h);
  }

  REEFER_FIXED_HEADERS.forEach(({ col, label, wrap }) => {
    const rect = reeferLogCellRect(metrics, 7, col);
    strokeCell(doc, rect.x, rect.y, rect.w, rect.h);
    if (wrap && label.includes(' ')) {
      const parts = label.split(' ');
      doc.setFont(FONT, 'normal');
      doc.setFontSize(headSize);
      const lineH = headSize + 1;
      const blockH = parts.length * lineH;
      let cy = rect.y + (rect.h - blockH) / 2 + headSize * 0.35;
      for (const part of parts) {
        doc.text(part, rect.x + rect.w / 2, cy, { align: 'center', baseline: 'alphabetic' });
        cy += lineH;
      }
    } else {
      drawTextInRect(doc, label, rect, { size: headSize });
    }
  });

  dateBlocks.forEach((day, i) => {
    const startCol = layout.dateMergeStarts[i];
    const dateRect = reeferLogCellRect(metrics, 6, startCol, 6, startCol + 1);
    strokeCell(doc, dateRect.x, dateRect.y, dateRect.w, dateRect.h);
    drawTextInRect(doc, day.label, dateRect, { size: headSize });
  });

  layout.timeRow7.forEach(({ col, time }) => {
    const rect = reeferLogCellRect(metrics, 7, col);
    strokeCell(doc, rect.x, rect.y, rect.w, rect.h);
    drawTextInRect(doc, time, rect, { size: headSize });
  });
}

function drawDataRows(
  doc: jsPDF,
  metrics: ReeferLogGridMetrics,
  units: readonly (ReeferOnboardUnit | null)[],
  ports: readonly Port[],
  lastCol: number,
): void {
  const indexSize = reeferLogFontSize(metrics, 9);
  const dataSize = reeferLogFontSize(metrics, 10);

  units.forEach((unit, index) => {
    const row = REEFER_LOG_DATA_START + index;
    const rowNum = index + 1;

    for (let col = 1; col <= lastCol; col++) {
      const rect = reeferLogCellRect(metrics, row, col);
      strokeCell(doc, rect.x, rect.y, rect.w, rect.h);
    }

    drawTextInRect(doc, String(rowNum), reeferLogCellRect(metrics, row, 1), { size: indexSize });

    if (!unit) return;

    drawTextInRect(doc, unit.containerNo, reeferLogCellRect(metrics, row, 2), {
      size: dataSize,
      align: 'left',
      pad: 3,
    });
    drawTextInRect(
      doc,
      resolveReeferExportPortCode(unit.loadPort, ports),
      reeferLogCellRect(metrics, row, 3),
      { size: dataSize, align: 'left', pad: 3 },
    );
    drawTextInRect(
      doc,
      resolveReeferExportPortCode(unit.dischargePort, ports),
      reeferLogCellRect(metrics, row, 4),
      { size: dataSize },
    );
    const setPoint = parseReeferSetPointNumber(unit.setPointTemp);
    drawTextInRect(
      doc,
      setPoint === '' ? '' : String(setPoint),
      reeferLogCellRect(metrics, row, 5),
      {
        size: dataSize,
      },
    );
    drawTextInRect(doc, unit.position, reeferLogCellRect(metrics, row, 7), {
      size: dataSize,
      align: 'left',
      pad: 3,
    });
  });
}

function shiftRectY(
  rect: { x: number; y: number; w: number; h: number },
  dy: number,
): { x: number; y: number; w: number; h: number } {
  return { ...rect, y: rect.y + dy };
}

function drawFooter(
  doc: jsPDF,
  metrics: ReeferLogGridMetrics,
  lastCol: number,
  library: ReeferLibrarySettings,
): void {
  const footSize = reeferLogFontSize(metrics, 9);
  const lastDataRow = reeferLogCellRect(
    metrics,
    REEFER_LOG_DATA_END,
    1,
    REEFER_LOG_DATA_END,
    lastCol,
  );
  const footerStart = reeferLogCellRect(metrics, 38, 1).y;
  const footerShift = lastDataRow.y + lastDataRow.h + footSize * 1.1 - footerStart;

  const footerRect = (row: number, col1: number, col2 = col1) =>
    shiftRectY(reeferLogCellRect(metrics, row, col1, row, col2), footerShift);

  drawReeferCheckSignoffInPdf(
    doc,
    footerRect(38, 1, 7),
    reeferCheckSignoffSegments('08:30', library.monitoringMorningSigners),
    footSize,
    3,
  );
  for (let col = 8; col <= lastCol; col++) {
    drawReeferSigFieldInPdf(doc, footerRect(38, col), footSize);
  }

  drawReeferCheckSignoffInPdf(
    doc,
    footerRect(39, 1, 7),
    reeferCheckSignoffSegments('16:55', library.monitoringEveningSigners),
    footSize,
    3,
  );
  for (let col = 8; col <= lastCol; col++) {
    drawReeferSigFieldInPdf(doc, footerRect(39, col), footSize);
  }

  drawWrappedTextInRect(
    doc,
    "All temperatures of above written reefers were checked on the moment of loading and frequently (at 08:30 & 16:55) until their POD by ship's deck crew.",
    footerRect(40, 1, lastCol),
    { size: footSize, pad: 3 },
  );
  drawWrappedTextInRect(
    doc,
    "In case of Reefer's malfunction or temperature non-conformity - Officer On Watch or Captain must be informed immediately !",
    footerRect(41, 1, lastCol),
    { size: footSize, pad: 3 },
  );
}

export function buildReeferMonitoringPdfBytes(
  ship: ShipInfo,
  library: ReeferLibrarySettings,
  ports: readonly Port[] = [],
  exportContext?: ReeferExportContext,
): Uint8Array {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const layout = buildReeferLogLayout(library);
  const metrics = buildReeferLogGridMetrics(pageW, pageH, layout.colWidths);
  const year = reeferLogTitleYear(ship.dateOfDeparture);
  const depPortCode =
    portCode(ship.portOfCall, [...ports]) || resolveReeferExportPortCode(ship.portOfCall, ports);
  const depDate = formatDisplayDate(ship.dateOfDeparture);
  const dateBlocks = buildReeferMonitoringDateBlocks(
    ship.dateOfDeparture,
    layout.dayCount,
    layout.dayOffset,
  );
  const units = padReeferExportUnits(reeferExportOnboardUnits(library, exportContext?.units));

  drawTopHeader(doc, metrics, ship, year, depPortCode, depDate, layout);
  drawTableHeader(doc, metrics, dateBlocks, layout);
  drawDataRows(doc, metrics, units, ports, layout.lastCol);
  drawFooter(doc, metrics, layout.lastCol, library);

  return new Uint8Array(doc.output('arraybuffer') as ArrayBuffer);
}
