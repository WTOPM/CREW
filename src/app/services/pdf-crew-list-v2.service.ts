import { Injectable, inject } from '@angular/core';
import { AppData } from '../models/crew.models';
import { resolveCrewListStampOptions } from '../models/document-overlay.models';
import { PdfDeliveryService } from './pdf-delivery.service';
import { PdfOverlayService } from './pdf-overlay.service';
import {
  CREW_LIST_V2_TEMPLATE_URL,
  CREW_LIST_V2_TEMPLATE_VERSION,
} from './crew-list-v2-coordinates';
import { crewListV2PdfFileName } from '../utils/pdf-filename.util';

/** Crew List v2 — template PDF only (data fill to be added). */
@Injectable({ providedIn: 'root' })
export class PdfCrewListV2Service {
  private readonly overlay = inject(PdfOverlayService);
  private readonly delivery = inject(PdfDeliveryService);

  private templateBytes: Uint8Array | null = null;
  private loadedVersion = 0;

  async buildPreviewBytes(data: AppData): Promise<Uint8Array> {
    const bytes = await this.build(data);
    return this.overlay.applyToPdfBytes(bytes, resolveCrewListStampOptions(data.documentOverlay.crewList));
  }

  async openPreview(data: AppData): Promise<boolean> {
    const bytes = await this.buildPreviewBytes(data);
    return this.delivery.deliver(bytes, this.fileName(data));
  }

  fileName(data: AppData): string {
    const { ship, crewArr } = data;
    const voyageDate = crewArr.isArrival ? ship.dateOfArrival : ship.dateOfDeparture;
    return crewListV2PdfFileName(ship.name, ship.portOfCall, voyageDate, crewArr.isArrival);
  }

  /** Returns empty template page(s); crew/header fill will be added later. */
  async build(_data: AppData): Promise<Uint8Array> {
    const { PDFDocument } = await import('pdf-lib');
    const template = await this.loadTemplate();
    const doc = await PDFDocument.load(template);
    return doc.save();
  }

  private async loadTemplate(): Promise<Uint8Array> {
    if (this.templateBytes && this.loadedVersion === CREW_LIST_V2_TEMPLATE_VERSION) {
      return this.templateBytes;
    }
    const res = await fetch(
      `${CREW_LIST_V2_TEMPLATE_URL}?v=${CREW_LIST_V2_TEMPLATE_VERSION}`,
      { cache: 'no-store' },
    );
    if (!res.ok) {
      throw new Error('Crew List v2 template not found (public/crew-list-v2-empty.pdf)');
    }
    this.templateBytes = new Uint8Array(await res.arrayBuffer());
    this.loadedVersion = CREW_LIST_V2_TEMPLATE_VERSION;
    return this.templateBytes;
  }
}
