// Owns the object-URL + aspect-ratio lifecycle for crew-signature preview images shown
// in the overlay placement picker (one entry per crew-table row). Component-scoped:
// provide it in the component so its object URLs are created/revoked per modal instance.

import { Injectable, inject, signal } from '@angular/core';
import { CrewSignatureService } from '../../services/crew-signature.service';
import { fittedAssetRectInBox, type PdfStampBox } from '../../utils/overlay-stamp-box.util';

@Injectable()
export class CrewSignaturePreviewStore {
  private readonly crewSignatures = inject(CrewSignatureService);

  /** rowIndex -> object URL of the loaded signature image. */
  readonly previewUrls = signal<Map<number, string>>(new Map());
  /** rowIndex -> natural width/height aspect ratio of the loaded image. */
  readonly aspectRatios = signal<Map<number, number>>(new Map());

  /** Load (once) the signature image for a crew row and create its preview URL. */
  async loadForRow(rowIndex: number, crewId: string): Promise<void> {
    if (this.previewUrls().has(rowIndex)) return;
    const bytes = await this.crewSignatures.loadBytes(crewId);
    if (!bytes?.length) return;
    const url = URL.createObjectURL(new Blob([bytes.slice()]));
    const next = new Map(this.previewUrls());
    next.set(rowIndex, url);
    this.previewUrls.set(next);
    this.measureAspectRatio(rowIndex, url);
  }

  async loadAll(rows: readonly { rowIndex: number; crewId: string }[]): Promise<void> {
    await Promise.all(rows.map((r) => this.loadForRow(r.rowIndex, r.crewId)));
  }

  /** Fit `box` to the loaded signature image's aspect ratio (if known). */
  tightBox(box: PdfStampBox, rowIndex: number): PdfStampBox {
    const aspect = this.aspectRatios().get(rowIndex);
    if (!aspect) return box;
    return fittedAssetRectInBox(box, aspect);
  }

  /** Revoke all object URLs and reset. Call on component destroy. */
  clear(): void {
    for (const url of this.previewUrls().values()) URL.revokeObjectURL(url);
    this.previewUrls.set(new Map());
    this.aspectRatios.set(new Map());
  }

  private measureAspectRatio(rowIndex: number, url: string): void {
    const img = new Image();
    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) return;
      const next = new Map(this.aspectRatios());
      next.set(rowIndex, img.naturalWidth / img.naturalHeight);
      this.aspectRatios.set(next);
    };
    img.src = url;
  }
}
