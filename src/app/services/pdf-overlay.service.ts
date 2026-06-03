import { Injectable, inject } from '@angular/core';
import type { jsPDF } from 'jspdf';
import type { PDFDocument, PDFPage } from 'pdf-lib';
import { DocumentStampOptions } from '../models/document-overlay.models';
import { pocStampBoxPdfLib } from './port-of-call-coordinates';
import { ShipAssetsService } from './ship-assets.service';

export type PdfOverlayLayout = 'crewList' | 'portOfCall';

/** Bottom-right overlay on A4 (pdf-lib coords, origin bottom-left). */
const CREW_LIST_STAMP_BOX = { x: 392, y: 24, width: 158, height: 158 };

/** MDH page 2+ — stamp/signature rotated 180° to match attachment orientation. */
const MDH_ATTACHMENT_PAGE_ROTATION = 180;

@Injectable({ providedIn: 'root' })
export class PdfOverlayService {
  private readonly assets = inject(ShipAssetsService);

  async applyToJsPdf(
    doc: jsPDF,
    options: DocumentStampOptions,
    layout: PdfOverlayLayout = 'crewList',
  ): Promise<Uint8Array> {
    const raw = doc.output('arraybuffer') as ArrayBuffer;
    if (!options.useStamp && !options.useSignature) {
      return new Uint8Array(raw);
    }

    const { PDFDocument } = await import('pdf-lib');
    const pdf = await PDFDocument.load(raw);
    const pages = pdf.getPages();
    if (!pages.length) return new Uint8Array(raw);

    const pageSize = pages[0].getSize();
    const box =
      layout === 'portOfCall'
        ? pocStampBoxPdfLib(pageSize.width, pageSize.height)
        : CREW_LIST_STAMP_BOX;

    for (const page of pages) {
      await this.drawOverlayOnPage(pdf, page, options, box);
    }
    return pdf.save();
  }

  /** MDH: page 1 = form (upright); page 2+ = attachment (rotate overlay clockwise). */
  async applyMdhOverlay(bytes: Uint8Array, options: DocumentStampOptions): Promise<Uint8Array> {
    if (!options.useStamp && !options.useSignature) {
      return bytes;
    }

    const { PDFDocument } = await import('pdf-lib');
    const pdf = await PDFDocument.load(bytes);
    const pages = pdf.getPages();
    if (!pages.length) return bytes;

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const { width, height } = page.getSize();
      const box =
        i >= 1 ? this.topRightStampBox(width, height) : this.bottomRightStampBox(width, height);
      const rotation = i >= 1 ? MDH_ATTACHMENT_PAGE_ROTATION : 0;
      await this.drawOverlayOnPage(pdf, page, options, box, rotation);
    }
    return pdf.save();
  }

  async applyToPdfBytes(
    bytes: Uint8Array,
    options: DocumentStampOptions,
    pageIndex = 0,
  ): Promise<Uint8Array> {
    if (!options.useStamp && !options.useSignature) {
      return bytes;
    }

    const { PDFDocument } = await import('pdf-lib');
    const pdf = await PDFDocument.load(bytes);
    const pages = pdf.getPages();
    const page = pages[pageIndex] ?? pages[0];
    if (!page) return bytes;

    const { width, height } = page.getSize();
    const box = this.bottomRightStampBox(width, height);
    await this.drawOverlayOnPage(pdf, page, options, box, 0);
    return pdf.save();
  }

  private stampBoxScale(pageW: number, pageH: number): { sx: number; sy: number } {
    const refW = 595.28;
    const refH = 842;
    return { sx: pageW / refW, sy: pageH / refH };
  }

  /** Bottom-right corner of the sheet (pdf-lib origin bottom-left). */
  private bottomRightStampBox(pageW: number, pageH: number): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    const { sx, sy } = this.stampBoxScale(pageW, pageH);
    return {
      x: CREW_LIST_STAMP_BOX.x * sx,
      y: CREW_LIST_STAMP_BOX.y * sy,
      width: CREW_LIST_STAMP_BOX.width * sx,
      height: CREW_LIST_STAMP_BOX.height * sy,
    };
  }

  /** Top-right — same margins as bottom-right, mirrored vertically on the page. */
  private topRightStampBox(pageW: number, pageH: number): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    const { sx, sy } = this.stampBoxScale(pageW, pageH);
    const w = CREW_LIST_STAMP_BOX.width * sx;
    const h = CREW_LIST_STAMP_BOX.height * sy;
    const marginRight = (595.28 - CREW_LIST_STAMP_BOX.x - CREW_LIST_STAMP_BOX.width) * sx;
    const marginBottom = CREW_LIST_STAMP_BOX.y * sy;
    return {
      x: pageW - marginRight - w,
      y: pageH - marginBottom - h,
      width: w,
      height: h,
    };
  }

  private async drawOverlayOnPage(
    pdf: PDFDocument,
    page: PDFPage,
    options: DocumentStampOptions,
    box: { x: number; y: number; width: number; height: number },
    rotationDeg = 0,
  ): Promise<void> {
    if (options.useStamp) {
      const stampBytes = await this.assets.loadBytes('stamp');
      if (stampBytes?.length) {
        await this.drawAsset(pdf, page, stampBytes, box, rotationDeg);
        if (options.useSignature) {
          const sigBytes = await this.assets.loadBytes('signature');
          if (sigBytes?.length) {
            const sigW = box.width * 0.58;
            const sigH = box.height * 0.38;
            await this.drawAsset(
              pdf,
              page,
              sigBytes,
              {
                x: box.x + (box.width - sigW) / 2,
                y: box.y + box.height * 0.12,
                width: sigW,
                height: sigH,
              },
              rotationDeg,
            );
          }
        }
      }
    } else if (options.useSignature) {
      const sigBytes = await this.assets.loadBytes('signature');
      if (sigBytes?.length) {
        await this.drawAsset(pdf, page, sigBytes, box, rotationDeg);
      }
    }
  }

  private async drawAsset(
    pdf: PDFDocument,
    page: PDFPage,
    bytes: Uint8Array,
    box: { x: number; y: number; width: number; height: number },
    rotationDeg = 0,
  ): Promise<void> {
    const { PDFDocument, degrees } = await import('pdf-lib');
    const rotate = rotationDeg ? degrees(rotationDeg) : undefined;
    if (isPdfBytes(bytes)) {
      const src = await PDFDocument.load(bytes);
      const [embedded] = await pdf.embedPdf(src, [0]);
      const natural = embedded.scale(1);
      const scale = Math.min(box.width / natural.width, box.height / natural.height);
      const w = natural.width * scale;
      const h = natural.height * scale;
      const drawOpts = {
        x: box.x + (box.width - w) / 2,
        y: box.y + (box.height - h) / 2,
        width: w,
        height: h,
        ...(rotate ? { rotate } : {}),
      };
      page.drawPage(embedded, drawOpts);
      return;
    }

    let image;
    try {
      image = await pdf.embedPng(bytes);
    } catch {
      image = await pdf.embedJpg(bytes);
    }
    const scale = Math.min(box.width / image.width, box.height / image.height);
    const w = image.width * scale;
    const h = image.height * scale;
    page.drawImage(image, {
      x: box.x + (box.width - w) / 2,
      y: box.y + (box.height - h) / 2,
      width: w,
      height: h,
      ...(rotate ? { rotate } : {}),
    });
  }
}

function isPdfBytes(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}
