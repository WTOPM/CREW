import { Injectable, inject } from '@angular/core';
import {
  AppData,
  CrewMember,
  filterActiveCrewList,
  formatCrewListName,
  formatPortCallPortName,
} from '../models/crew.models';
import { CREW_EFFECT_NIL_LABEL, normalizeCrewEffectForm } from '../models/crew-effect.models';
import { openPdfBlobPreview } from '../utils/pdf-blob.util';
import { crewEffectPdfFileName } from '../utils/pdf-filename.util';
import {
  CREW_EFFECT_COL,
  CREW_EFFECT_FIELDS,
  CREW_EFFECT_FONT,
  CREW_EFFECT_ROW_COUNT,
  crewEffectRowPdfLibY,
  type CrewEffectTextPlacement,
} from './crew-effect-field-positions';
import { PdfOverlayService } from './pdf-overlay.service';

const CREW_EFFECT_TEMPLATE_URL = '/crew-effect-empty.pdf';

/** IMO Crew's Effects Declaration (Crew Effect). */
@Injectable({ providedIn: 'root' })
export class PdfCrewEffectService {
  private readonly overlay = inject(PdfOverlayService);

  private templateBytes: Uint8Array | null = null;
  private loadedVersion = 0;
  private readonly templateVersion = 2;

  async openPreview(data: AppData): Promise<boolean> {
    let bytes = await this.build(data);
    bytes = await this.overlay.applyToPdfBytes(bytes, data.documentOverlay.crewEffect);
    return openPdfBlobPreview(bytes);
  }

  fileName(data: AppData): string {
    const { ship } = data;
    const voyageDate = ship.dateOfArrival || ship.dateOfDeparture;
    return crewEffectPdfFileName(ship.name, voyageDate);
  }

  async build(data: AppData): Promise<Uint8Array> {
    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
    const template = await this.loadTemplate();
    const doc = await PDFDocument.load(template);
    const page = doc.getPages()[0];
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const black = rgb(0, 0, 0);

    const draw = (text: string, placement: CrewEffectTextPlacement, useBold = false) => {
      const value = text.trim();
      if (!value) return;
      page.drawText(value, {
        x: placement.x,
        y: placement.y,
        size: placement.fontSize ?? CREW_EFFECT_FONT,
        font: useBold ? bold : font,
        color: black,
        ...(placement.maxWidth != null ? { maxWidth: placement.maxWidth } : {}),
      });
    };

    const form = normalizeCrewEffectForm(data.crewEffectForm);
    const { ship } = data;
    const crew = this.arrivalCrewInHomeOrder(data);
    draw(this.crewEffectPageLabel(crew.length), CREW_EFFECT_FIELDS.pageNo);
    draw(ship.name, CREW_EFFECT_FIELDS.shipName, true);
    draw(formatPortCallPortName(ship.nationality), CREW_EFFECT_FIELDS.nationality, true);

    this.drawCrewRows(draw, crew, form);

    return doc.save();
  }

  private drawCrewRows(
    draw: (text: string, placement: CrewEffectTextPlacement, useBold?: boolean) => void,
    crew: CrewMember[],
    form: ReturnType<typeof normalizeCrewEffectForm>,
  ): void {
    const others = form.others.trim();
    for (let i = 0; i < CREW_EFFECT_ROW_COUNT; i++) {
      const member = crew[i];
      const y = crewEffectRowPdfLibY(i);
      const fontSize = CREW_EFFECT_FONT;
      if (!member) continue;
      draw(String(i + 1), { x: CREW_EFFECT_COL.rowNo, y, fontSize });
      draw(formatCrewListName(member), {
        x: CREW_EFFECT_COL.name,
        y,
        fontSize,
        maxWidth: CREW_EFFECT_COL.nameMaxWidth,
      });
      draw(member.rank, {
        x: CREW_EFFECT_COL.rank,
        y,
        fontSize,
        maxWidth: CREW_EFFECT_COL.rankMaxWidth,
      });
      if (form.nilCigarettes) {
        draw(CREW_EFFECT_NIL_LABEL, {
          x: CREW_EFFECT_COL.cigarettes,
          y,
          fontSize,
          maxWidth: CREW_EFFECT_COL.effectsMaxWidth,
        });
      }
      if (form.nilSpirits) {
        draw(CREW_EFFECT_NIL_LABEL, {
          x: CREW_EFFECT_COL.spirits,
          y,
          fontSize,
          maxWidth: CREW_EFFECT_COL.effectsMaxWidth,
        });
      }
      if (form.nilWines) {
        draw(CREW_EFFECT_NIL_LABEL, {
          x: CREW_EFFECT_COL.wines,
          y,
          fontSize,
          maxWidth: CREW_EFFECT_COL.effectsMaxWidth,
        });
      }
      if (others) {
        draw(others, {
          x: CREW_EFFECT_COL.others,
          y,
          fontSize,
          maxWidth: CREW_EFFECT_COL.effectsMaxWidth,
        });
      }
    }
  }

  /** Page No. — always 1 while the PDF is a single page (up to CREW_EFFECT_ROW_COUNT crew). */
  private crewEffectPageLabel(_crewCount: number): string {
    return '1';
  }

  /** Same order as Arrival list on Home (no rank sort). */
  private arrivalCrewInHomeOrder(data: AppData): CrewMember[] {
    return filterActiveCrewList(data.crew, 'arrival').slice(0, CREW_EFFECT_ROW_COUNT);
  }

  private async loadTemplate(): Promise<Uint8Array> {
    if (this.templateBytes && this.loadedVersion === this.templateVersion) {
      return this.templateBytes;
    }
    const res = await fetch(`${CREW_EFFECT_TEMPLATE_URL}?v=${this.templateVersion}`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      throw new Error('Crew Effect template not found (public/crew-effect-empty.pdf)');
    }
    this.templateBytes = new Uint8Array(await res.arrayBuffer());
    this.loadedVersion = this.templateVersion;
    return this.templateBytes;
  }
}
