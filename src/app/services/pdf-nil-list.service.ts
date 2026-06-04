import { Injectable, inject } from '@angular/core';
import {
  AppData,
  CrewMember,
  filterActiveCrewList,
  formatCrewListName,
  formatPortCallPortName,
} from '../models/crew.models';
import {
  NIL_LIST_PAGE_HEIGHT_PT,
  nilListCompactPhraseBaselineY,
  normalizeNilListForm,
} from '../models/nil-list.models';
import { openPdfBlobPreview } from '../utils/pdf-blob.util';
import { formatDisplayDate } from '../utils/date.util';
import { nilListPdfFileName } from '../utils/pdf-filename.util';
import {
  NIL_LIST_FIELDS,
  NIL_LIST_FONT_PHRASE,
  NIL_LIST_PHRASE_MAX_WIDTH,
  NIL_LIST_PHRASE_X,
  type NilListTextPlacement,
} from './nil-list-field-positions';
import { PdfOverlayService } from './pdf-overlay.service';

const NIL_LIST_TEMPLATE_URL = '/nil-list-empty.pdf';

@Injectable({ providedIn: 'root' })
export class PdfNilListService {
  private readonly overlay = inject(PdfOverlayService);

  private templateBytes: Uint8Array | null = null;
  private loadedVersion = 0;
  private readonly templateVersion = 1;

  async openPreview(data: AppData): Promise<boolean> {
    let bytes = await this.build(data);
    bytes = await this.overlay.applyToPdfBytes(bytes, data.documentOverlay.nilList);
    return openPdfBlobPreview(bytes);
  }

  fileName(data: AppData): string {
    const { ship } = data;
    const voyageDate = ship.dateOfArrival || ship.dateOfDeparture;
    return nilListPdfFileName(ship.name, voyageDate);
  }

  async build(data: AppData): Promise<Uint8Array> {
    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
    const template = await this.loadTemplate();
    const doc = await PDFDocument.load(template);
    const page = doc.getPages()[0];
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const black = rgb(0, 0, 0);

    const draw = (text: string, placement: NilListTextPlacement, useBold = false) => {
      const value = text.trim();
      if (!value) return;
      page.drawText(value, {
        x: placement.x,
        y: placement.y,
        size: placement.fontSize ?? NIL_LIST_FONT_PHRASE,
        font: useBold ? bold : font,
        color: black,
        ...(placement.maxWidth != null ? { maxWidth: placement.maxWidth } : {}),
      });
    };

    const form = normalizeNilListForm(data.nilListForm);
    const { ship } = data;
    const crewArrival = filterActiveCrewList(data.crew, 'arrival');
    const master = this.findMaster(crewArrival);

    draw(ship.name, NIL_LIST_FIELDS.vessel, true);
    draw(formatPortCallPortName(ship.portOfCall), NIL_LIST_FIELDS.port, true);
    draw(formatPortCallPortName(ship.homeport), NIL_LIST_FIELDS.portOfRegistry, true);
    draw(formatDisplayDate(ship.dateOfArrival), NIL_LIST_FIELDS.date, true);
    if (master) {
      draw(formatCrewListName(master), NIL_LIST_FIELDS.masterName, true);
    }

    let compactRow = 0;
    for (const phrase of form.phrases) {
      if (!phrase.enabled || !phrase.text.trim()) continue;
      const baselineY = nilListCompactPhraseBaselineY(compactRow);
      draw(phrase.text, {
        x: NIL_LIST_PHRASE_X,
        y: NIL_LIST_PAGE_HEIGHT_PT - baselineY,
        fontSize: NIL_LIST_FONT_PHRASE,
        maxWidth: NIL_LIST_PHRASE_MAX_WIDTH,
      });
      compactRow += 1;
    }

    return doc.save();
  }

  private findMaster(crew: CrewMember[]): CrewMember | undefined {
    const exact = crew.find((m) => m.rank.trim().toLowerCase() === 'master');
    if (exact) return exact;
    return crew.find((m) => m.rank.trim().toLowerCase().includes('master'));
  }

  private async loadTemplate(): Promise<Uint8Array> {
    if (this.templateBytes && this.loadedVersion === this.templateVersion) {
      return this.templateBytes;
    }
    const res = await fetch(`${NIL_LIST_TEMPLATE_URL}?v=${this.templateVersion}`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      throw new Error('NIL List template not found (public/nil-list-empty.pdf)');
    }
    this.templateBytes = new Uint8Array(await res.arrayBuffer());
    this.loadedVersion = this.templateVersion;
    return this.templateBytes;
  }
}
