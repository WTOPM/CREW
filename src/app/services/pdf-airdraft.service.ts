import { Injectable, inject } from '@angular/core';
import {
  AppData,
  CrewMember,
  filterActiveCrewListFromData,
  formatPortCallPortName,
} from '../models/crew.models';
import { PdfDeliveryService } from './pdf-delivery.service';
import { PdfOverlayService } from './pdf-overlay.service';
import { airdraftPdfFileName } from '../utils/pdf-filename.util';
import { arrivalVoyageDate } from '../utils/voyage-date.util';
import { formatDisplayDate } from '../utils/date.util';
import {
  AIRDRAFT_FIELDS,
  AIRDRAFT_FONT_SIZE,
  AIRDRAFT_TEMPLATE_VERSION,
  airdraftHeightAboveWaterMetres,
  formatAirdraftMetres,
  parseAirdraftMetres,
  type AirdraftTextPlacement,
} from './airdraft-field-positions';

const AIRDRAFT_TEMPLATE_URL = '/airdraft-empty.pdf';

/**
 * Airdraft (Erklärung) — landscape template fill.
 * Lives under the MDH menu next to Maritime Declaration of Health / Crew Vaccine.
 */
@Injectable({ providedIn: 'root' })
export class PdfAirdraftService {
  private readonly overlay = inject(PdfOverlayService);
  private readonly delivery = inject(PdfDeliveryService);

  private templateBytes: Uint8Array | null = null;
  private loadedVersion = 0;

  async buildFinalBytes(data: AppData): Promise<Uint8Array> {
    const bytes = await this.build(data);
    return this.overlay.applyToPdfBytes(bytes, data.documentOverlay.airdraft);
  }

  async openPreview(data: AppData): Promise<boolean> {
    const bytes = await this.buildFinalBytes(data);
    return this.delivery.deliver(bytes, this.fileName(data));
  }

  fileName(data: AppData): string {
    const { ship } = data;
    return airdraftPdfFileName(ship.name, ship.portOfCall, arrivalVoyageDate(ship));
  }

  async build(data: AppData): Promise<Uint8Array> {
    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
    const template = await this.loadTemplate();
    const doc = await PDFDocument.load(template);
    const pages = doc.getPages();
    if (!pages.length) {
      throw new Error('Airdraft template has no pages');
    }
    const page = pages[0];
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const black = rgb(0, 0, 0);

    const draw = (text: string, placement: AirdraftTextPlacement, useBold = false) => {
      const value = text.trim();
      if (!value) return;
      const size = placement.fontSize ?? AIRDRAFT_FONT_SIZE;
      const f = useBold ? bold : font;
      let line = value;
      if (placement.maxWidth != null) {
        line = this.truncateToWidth(f, line, size, placement.maxWidth);
      }
      page.drawText(line, {
        x: placement.x,
        y: placement.y,
        size,
        font: f,
        color: black,
      });
    };

    const { ship } = data;
    const list = data.crewArr.isArrival ? 'arrival' : 'departure';
    const master = this.findMaster(filterActiveCrewListFromData(data, list));

    draw(this.formatShipName(ship.name), AIRDRAFT_FIELDS.shipName, true);
    draw(formatDisplayDate(arrivalVoyageDate(ship)), AIRDRAFT_FIELDS.date);
    if (master) {
      draw(this.formatMasterName(master), AIRDRAFT_FIELDS.masterName);
    }

    const draft = parseAirdraftMetres(ship.maximumPresentDraft);
    if (draft != null) {
      draw(formatAirdraftMetres(draft), AIRDRAFT_FIELDS.presentDraft);
    }
    const aboveWater = airdraftHeightAboveWaterMetres(
      ship.heightKeelToMastTop,
      ship.maximumPresentDraft,
    );
    if (aboveWater != null) {
      draw(formatAirdraftMetres(aboveWater), AIRDRAFT_FIELDS.heightAboveWater);
    }

    return new Uint8Array(await doc.save());
  }

  /** Prefixed like the filled original: "M / V JUDITH". */
  private formatShipName(name: string): string {
    const vessel = formatPortCallPortName(name);
    if (!vessel) return '';
    if (/^m\s*\/\s*v\b/i.test(vessel)) return vessel;
    return `M / V ${vessel}`;
  }

  private findMaster(crew: CrewMember[]): CrewMember | undefined {
    const exact = crew.find((m) => m.rank.trim().toLowerCase() === 'master');
    if (exact) return exact;
    return crew.find((m) => m.rank.trim().toLowerCase().includes('master'));
  }

  /** Uppercase family + given — matches filled original (e.g. PORVATKIN VOLODYMYR). */
  private formatMasterName(member: Pick<CrewMember, 'familyName' | 'givenNames'>): string {
    const parts = [member.familyName?.trim(), member.givenNames?.trim()].filter(Boolean);
    return parts.join(' ').toUpperCase();
  }

  private truncateToWidth(
    font: { widthOfTextAtSize: (text: string, size: number) => number },
    text: string,
    size: number,
    maxWidth: number,
  ): string {
    if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
    let trimmed = text;
    while (trimmed.length > 1 && font.widthOfTextAtSize(`${trimmed}…`, size) > maxWidth) {
      trimmed = trimmed.slice(0, -1);
    }
    return trimmed.length < text.length ? `${trimmed}…` : trimmed;
  }

  private async loadTemplate(): Promise<Uint8Array> {
    if (this.templateBytes && this.loadedVersion === AIRDRAFT_TEMPLATE_VERSION) {
      return this.templateBytes;
    }
    const res = await fetch(`${AIRDRAFT_TEMPLATE_URL}?v=${AIRDRAFT_TEMPLATE_VERSION}`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      throw new Error('Airdraft template not found (public/airdraft-empty.pdf)');
    }
    this.templateBytes = new Uint8Array(await res.arrayBuffer());
    this.loadedVersion = AIRDRAFT_TEMPLATE_VERSION;
    return this.templateBytes;
  }
}
