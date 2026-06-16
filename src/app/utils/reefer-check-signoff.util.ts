import type { jsPDF } from 'jspdf';
import type ExcelJS from 'exceljs';

export const REEFER_MONITORING_SIGNER_SLOTS = 2;

export interface ReeferMonitoringSigner {
  rank: string;
  name: string;
}

export interface ReeferCheckSignoffSegment {
  text: string;
  bold?: boolean;
  underline?: boolean;
}

const PDF_FONT = 'helvetica';

export function emptyReeferMonitoringSigners(): ReeferMonitoringSigner[] {
  return Array.from({ length: REEFER_MONITORING_SIGNER_SLOTS }, () => ({
    rank: 'OS',
    name: '',
  }));
}

export function normalizeReeferMonitoringSigners(raw: unknown): ReeferMonitoringSigner[] {
  const arr = Array.isArray(raw) ? raw : [];
  const out: ReeferMonitoringSigner[] = [];
  for (let i = 0; i < REEFER_MONITORING_SIGNER_SLOTS; i++) {
    const item = arr[i] as Partial<ReeferMonitoringSigner> | undefined;
    out.push({
      rank: String(item?.rank ?? 'OS').trim() || 'OS',
      name: String(item?.name ?? '').trim(),
    });
  }
  return out;
}

/** Rich-text segments for "All reefers checked at … Signed by OS Name / …". */
export function reeferCheckSignoffSegments(
  time: string,
  signers: readonly ReeferMonitoringSigner[],
): ReeferCheckSignoffSegment[] {
  const filled = signers.filter((s) => s.name.trim()).slice(0, REEFER_MONITORING_SIGNER_SLOTS);
  const list =
    filled.length > 0
      ? filled
      : [
          { rank: 'OS', name: '' },
          { rank: 'OS', name: '' },
        ];

  const segments: ReeferCheckSignoffSegment[] = [
    { text: `All reefers checked at ${time}. Signed by ` },
  ];

  list.forEach((signer, index) => {
    if (index > 0) segments.push({ text: ' / ' });
    const rank = signer.rank.trim() || 'OS';
    segments.push({ text: `${rank} ` });
    const name = signer.name.trim() || '______';
    segments.push({
      text: name,
      bold: true,
      underline: name !== '______',
    });
  });

  return segments;
}

export function reeferCheckSignoffPlainText(segments: readonly ReeferCheckSignoffSegment[]): string {
  return segments.map((s) => s.text).join('');
}

export function reeferCheckSignoffExcelRichText(
  segments: readonly ReeferCheckSignoffSegment[],
  fontSize = 9,
): ExcelJS.CellRichTextValue {
  return {
    richText: segments.map((seg) => ({
      text: seg.text,
      font: {
        name: 'Arial',
        size: fontSize,
        bold: seg.bold === true,
        underline: seg.underline === true ? 'single' : undefined,
      },
    })),
  };
}

export function drawReeferCheckSignoffInPdf(
  doc: jsPDF,
  rect: { x: number; y: number; w: number; h: number },
  segments: readonly ReeferCheckSignoffSegment[],
  size: number,
  pad = 3,
): void {
  const plain = reeferCheckSignoffPlainText(segments).trim();
  if (!plain) return;

  const maxW = Math.max(4, rect.w - pad * 2);
  doc.setFontSize(size);
  const fullWidth = segments.reduce((sum, seg) => {
    doc.setFont(PDF_FONT, seg.bold ? 'bold' : 'normal');
    return sum + doc.getTextWidth(seg.text);
  }, 0);

  if (fullWidth <= maxW) {
    let x = rect.x + pad;
    const y = rect.y + rect.h / 2;
    for (const seg of segments) {
      doc.setFont(PDF_FONT, seg.bold ? 'bold' : 'normal');
      doc.setFontSize(size);
      const w = doc.getTextWidth(seg.text);
      const underline = Boolean(seg.underline && seg.text.trim() && seg.text !== '______');
      doc.text(seg.text, x, y, { baseline: 'middle' });
      if (underline) {
        doc.setLineWidth(0.45);
        doc.setDrawColor(0);
        const underlineY = y + size * 0.48;
        doc.line(x, underlineY, x + w, underlineY);
      }
      x += w;
    }
    return;
  }

  doc.setFont(PDF_FONT, 'normal');
  doc.setFontSize(size);
  const lines = doc.splitTextToSize(plain, maxW) as string[];
  const lineH = size * 1.15;
  const blockH = lines.length * lineH;
  let y = rect.y + Math.max(pad, (rect.h - blockH) / 2) + size * 0.35;
  for (const line of lines) {
    doc.text(line, rect.x + pad, y, { baseline: 'alphabetic' });
    y += lineH;
  }
}

/** "Sig.:" label plus one solid line — avoids underscore wrap in narrow PDF cells. */
export function drawReeferSigFieldInPdf(
  doc: jsPDF,
  rect: { x: number; y: number; w: number; h: number },
  size: number,
  pad = 2,
): void {
  doc.setFont(PDF_FONT, 'normal');
  doc.setFontSize(size);
  const label = 'Sig.:';
  const labelW = doc.getTextWidth(label);
  const y = rect.y + rect.h / 2;
  doc.text(label, rect.x + pad, y, { baseline: 'middle' });

  const lineStartX = rect.x + pad + labelW + 1;
  const lineEndX = rect.x + rect.w - pad;
  if (lineEndX <= lineStartX) return;

  doc.setLineWidth(0.45);
  doc.setDrawColor(0);
  doc.line(lineStartX, y + size * 0.42, lineEndX, y + size * 0.42);
}
