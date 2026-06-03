import { Injectable, inject } from '@angular/core';
import type { jsPDF } from 'jspdf';
import type { PDFDocument, PDFPage } from 'pdf-lib';
import { DocumentOverlayId, DocumentStampOptions } from '../models/document-overlay.models';
import {
  PdfStampBox,
  defaultStampBoxForDocument,
  pageDimensions,
  resolveOverlayRotation,
  resolveSignatureBoxRef,
  scaleStampBoxToPage,
} from '../utils/overlay-stamp-box.util';
import { ShipAssetsService } from './ship-assets.service';

export type PdfOverlayLayout = 'crewList' | 'portOfCall';

@Injectable({ providedIn: 'root' })
export class PdfOverlayService {
  private readonly assets = inject(ShipAssetsService);

  async applyToJsPdf(
    doc: jsPDF,
    options: DocumentStampOptions,
    layout: PdfOverlayLayout = 'crewList',
    documentId: DocumentOverlayId = 'crewList',
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
    const docId: DocumentOverlayId = layout === 'portOfCall' ? 'portOfCall' : documentId;
    const rotation = resolveOverlayRotation(options, false);

    for (const page of pages) {
      await this.drawOverlayOnPage(pdf, page, options, docId, false, rotation);
    }
    return pdf.save();
  }

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
      const attachment = i >= 1;
      const rotation = resolveOverlayRotation(options, attachment);
      await this.drawOverlayOnPage(pdf, page, options, 'mdh', attachment, rotation);
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

    const rotation =
      resolveOverlayRotation(options, false) + page.getRotation().angle;
    await this.drawOverlayOnPage(pdf, page, options, 'crewList', false, rotation);
    return pdf.save();
  }

  resolveStampBox(
    options: DocumentStampOptions,
    documentId: DocumentOverlayId,
    pageW: number,
    pageH: number,
    mdhAttachment = false,
  ): PdfStampBox {
    const { widthPt: refW, heightPt: refH } = pageDimensions();
    const ref = this.resolveStampBoxRef(options, documentId, mdhAttachment);
    return scaleStampBoxToPage(ref, pageW, pageH, refW, refH);
  }

  private async drawOverlayOnPage(
    pdf: PDFDocument,
    page: PDFPage,
    options: DocumentStampOptions,
    documentId: DocumentOverlayId,
    mdhAttachment: boolean,
    rotationDeg = 0,
  ): Promise<void> {
    const { width: pageW, height: pageH } = page.getSize();
    const { widthPt: refW, heightPt: refH } = pageDimensions();
    const stampRef = this.resolveStampBoxRef(options, documentId, mdhAttachment);
    const stampBox = scaleStampBoxToPage(stampRef, pageW, pageH, refW, refH);
    const sigRef = resolveSignatureBoxRef(options, stampRef, refH, mdhAttachment);
    const sigBox = scaleStampBoxToPage(sigRef, pageW, pageH, refW, refH);

    if (options.useStamp) {
      const stampBytes = await this.assets.loadBytes('stamp');
      if (stampBytes?.length) {
        await this.drawAsset(pdf, page, stampBytes, stampBox, rotationDeg);
      }
    }
    if (options.useSignature) {
      const sigBytes = await this.assets.loadBytes('signature');
      if (sigBytes?.length) {
        await this.drawAsset(pdf, page, sigBytes, sigBox, rotationDeg);
      }
    }
  }

  private resolveStampBoxRef(
    options: DocumentStampOptions,
    documentId: DocumentOverlayId,
    mdhAttachment: boolean,
  ): PdfStampBox {
    const custom = mdhAttachment ? options.stampBoxAttachment : options.stampBox;
    return custom ?? defaultStampBoxForDocument(documentId, mdhAttachment ? 'attachment' : 'form');
  }

  private async drawAsset(
    pdf: PDFDocument,
    page: PDFPage,
    bytes: Uint8Array,
    box: PdfStampBox,
    rotationDeg = 0,
  ): Promise<void> {
    const { PDFDocument, popGraphicsState, pushGraphicsState, rotateDegrees, translate } =
      await import('pdf-lib');

    if (isPdfBytes(bytes)) {
      const src = await PDFDocument.load(bytes);
      const [embedded] = await pdf.embedPdf(src, [0]);
      const natural = embedded.scale(1);
      const scale = Math.min(box.width / natural.width, box.height / natural.height);
      const w = natural.width * scale;
      const h = natural.height * scale;
      this.drawAssetAtCenter(page, rotationDeg, box, w, h, (x, y) => {
        page.drawPage(embedded, { x, y, width: w, height: h });
      }, pushGraphicsState, popGraphicsState, translate, rotateDegrees);
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
    this.drawAssetAtCenter(page, rotationDeg, box, w, h, (x, y) => {
      page.drawImage(image, { x, y, width: w, height: h });
    }, pushGraphicsState, popGraphicsState, translate, rotateDegrees);
  }

  /**
   * pdf-lib `rotate` pivots around the asset's bottom-left corner.
   * We rotate around the center of the placement box so the stamp stays in the corner.
   */
  private drawAssetAtCenter(
    page: PDFPage,
    rotationDeg: number,
    box: PdfStampBox,
    w: number,
    h: number,
    draw: (x: number, y: number) => void,
    pushGraphicsState: () => ReturnType<typeof import('pdf-lib').pushGraphicsState>,
    popGraphicsState: () => ReturnType<typeof import('pdf-lib').popGraphicsState>,
    translate: (x: number, y: number) => ReturnType<typeof import('pdf-lib').translate>,
    rotateDegrees: (angle: number) => ReturnType<typeof import('pdf-lib').rotateDegrees>,
  ): void {
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    if (!rotationDeg) {
      draw(cx - w / 2, cy - h / 2);
      return;
    }

    page.pushOperators(pushGraphicsState());
    page.pushOperators(translate(cx, cy));
    page.pushOperators(rotateDegrees(rotationDeg));
    draw(-w / 2, -h / 2);
    page.pushOperators(popGraphicsState());
  }
}

function isPdfBytes(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}
