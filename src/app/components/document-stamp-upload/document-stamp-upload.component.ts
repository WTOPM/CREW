import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CREW_LIST_TYPE_IDS,
  DocumentOverlayPrefs,
  getCrewListVariantSettings,
  ShipAssetKind,
} from '../../models/document-overlay.models';
import { ShipAssetsService } from '../../services/ship-assets.service';
import { StorageService } from '../../services/storage.service';
import { ToastService } from '../../services/toast.service';
import {
  revokeShipAssetPreviewUrl,
  shipAssetPreviewUrl,
} from '../../utils/ship-asset-preview.util';

@Component({
  selector: 'app-document-stamp-upload',
  imports: [FormsModule],
  template: `
    <div class="stamp-upload">
      <div class="stamp-drop-grid">
        <div
          class="stamp-drop"
          [class.stamp-drop--has-preview]="meta().hasStamp && stampPreviewUrl()"
          [class.stamp-drop--active]="stampDrag()"
          (click)="pickAsset('stamp')"
          (dragover)="onDragOver($event, 'stamp')"
          (dragleave)="onDragLeave('stamp')"
          (drop)="onDrop($event, 'stamp')"
        >
          <span class="stamp-drop-title">Ship stamp</span>
          @if (meta().hasStamp) {
            @if (stampPreviewUrl()) {
              <img
                class="stamp-drop-preview"
                [src]="stampPreviewUrl()!"
                alt="Ship stamp preview"
              />
            }
            <span class="stamp-drop-file">{{ meta().stampFileName }}</span>
            <button type="button" class="btn-link warn stamp-remove" (click)="removeAsset($event, 'stamp')">
              Remove
            </button>
          } @else {
            <span class="stamp-drop-placeholder">Drop PNG/PDF or click to upload</span>
          }
        </div>

        <div
          class="stamp-drop stamp-drop--signature"
          [class.stamp-drop--has-preview]="meta().hasSignature && signaturePreviewUrl()"
          [class.stamp-drop--active]="signatureDrag()"
          (click)="pickAsset('signature')"
          (dragover)="onDragOver($event, 'signature')"
          (dragleave)="onDragLeave('signature')"
          (drop)="onDrop($event, 'signature')"
        >
          <span class="stamp-drop-title">Captain signature</span>
          @if (meta().hasSignature) {
            @if (signaturePreviewUrl()) {
              <img
                class="stamp-drop-preview"
                [src]="signaturePreviewUrl()!"
                alt="Captain signature preview"
              />
            }
            <span class="stamp-drop-file">{{ meta().signatureFileName }}</span>
            <button type="button" class="btn-link warn stamp-remove" (click)="removeAsset($event, 'signature')">
              Remove
            </button>
          } @else {
            <span class="stamp-drop-placeholder">Drop PNG/PDF or click to upload</span>
          }
        </div>
      </div>

      <div class="stamp-bulk">
        <div class="choice-chips">
          <label class="choice-chip">
            <input type="checkbox" [(ngModel)]="bulkUseStamp" />
            <span>Stamp</span>
          </label>
          <label class="choice-chip">
            <input type="checkbox" [(ngModel)]="bulkUseSignature" />
            <span>Signature</span>
          </label>
        </div>
        <button
          type="button"
          class="btn btn-primary stamp-bulk-set"
          (click)="applyBulkToggles()"
          title="Apply stamp and signature on/off to all documents"
        >
          SET default for all docs
        </button>
      </div>
    </div>
  `,
  styles: `
    .stamp-drop-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
    }

    @media (max-width: 640px) {
      .stamp-drop-grid {
        grid-template-columns: 1fr;
      }
    }

    .stamp-drop {
      min-height: 88px;
      padding: 0.65rem 0.75rem;
      border: 2px dashed #cbd5e1;
      border-radius: 10px;
      background: #f8fafc;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 0.35rem;
      transition:
        border-color 0.15s ease,
        background 0.15s ease;
    }

    .stamp-drop--has-preview {
      min-height: 150px;
    }

    .stamp-drop--signature {
      border-color: #bfdbfe;
      background: linear-gradient(180deg, #f0f9ff 0%, #f8fafc 100%);
    }

    .stamp-drop:hover,
    .stamp-drop--active {
      border-color: #3b82f6;
      background: #eff6ff;
    }

    .stamp-drop-title {
      font-size: 0.78rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #475569;
    }

    .stamp-drop-preview {
      display: block;
      width: 100%;
      max-height: 110px;
      object-fit: contain;
      object-position: center;
      margin: 0.15rem 0;
      pointer-events: none;
      user-select: none;
      background: #fff;
      border-radius: 4px;
    }

    .stamp-drop-file {
      font-size: 0.75rem;
      color: #64748b;
      word-break: break-all;
      text-align: center;
    }

    .stamp-drop-placeholder {
      font-size: 0.78rem;
      color: #64748b;
    }

    .stamp-remove {
      align-self: flex-start;
      font-size: 0.78rem;
    }

    .stamp-bulk {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 0.75rem 1rem;
      margin-top: 0.85rem;
      padding-top: 0.85rem;
      border-top: 1px solid var(--border);
    }

    .stamp-bulk-set {
      font-size: 0.82rem;
      padding: 0.4rem 0.85rem;
      white-space: nowrap;
    }
  `,
})
export class DocumentStampUploadComponent implements OnInit, OnDestroy {
  private readonly storage = inject(StorageService);
  private readonly assets = inject(ShipAssetsService);
  private readonly toast = inject(ToastService);

  protected readonly meta = this.storage.shipAssets;
  protected readonly stampDrag = signal(false);
  protected readonly signatureDrag = signal(false);
  protected readonly stampPreviewUrl = signal<string | null>(null);
  protected readonly signaturePreviewUrl = signal<string | null>(null);

  protected bulkUseStamp = false;
  protected bulkUseSignature = false;

  ngOnInit(): void {
    this.syncBulkFromDocuments();
    void this.refreshAllPreviews();
  }

  ngOnDestroy(): void {
    this.clearPreview('stamp');
    this.clearPreview('signature');
  }

  protected applyBulkToggles(): void {
    this.storage.applyStampTogglesToAllDocuments(this.bulkUseStamp, this.bulkUseSignature);
    const parts: string[] = [];
    parts.push(this.bulkUseStamp ? 'Stamp on' : 'Stamp off');
    parts.push(this.bulkUseSignature ? 'Signature on' : 'Signature off');
    this.toast.show(`All documents: ${parts.join('; ')}`, 'success');
  }

  private syncBulkFromDocuments(): void {
    const o = this.storage.documentOverlay();
    this.bulkUseStamp = allDocumentsUse(o, 'useStamp');
    this.bulkUseSignature = allDocumentsUse(o, 'useSignature');
  }

  protected async pickAsset(kind: ShipAssetKind): Promise<void> {
    try {
      await this.assets.pickAndSave(kind);
      await this.refreshPreview(kind);
      this.toast.show(kind === 'stamp' ? 'Stamp saved' : 'Signature saved', 'success');
    } catch (err) {
      this.toast.showError(err instanceof Error ? err.message : 'Upload failed');
    }
  }

  protected onDragOver(event: DragEvent, kind: ShipAssetKind): void {
    event.preventDefault();
    event.stopPropagation();
    if (kind === 'stamp') this.stampDrag.set(true);
    else this.signatureDrag.set(true);
  }

  protected onDragLeave(kind: ShipAssetKind): void {
    if (kind === 'stamp') this.stampDrag.set(false);
    else this.signatureDrag.set(false);
  }

  protected async onDrop(event: DragEvent, kind: ShipAssetKind): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    this.onDragLeave(kind);
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    try {
      await this.assets.saveFromFile(kind, file);
      await this.refreshPreview(kind);
      this.toast.show(kind === 'stamp' ? 'Stamp saved' : 'Signature saved', 'success');
    } catch (err) {
      this.toast.showError(err instanceof Error ? err.message : 'Upload failed');
    }
  }

  protected async removeAsset(event: MouseEvent, kind: ShipAssetKind): Promise<void> {
    event.stopPropagation();
    await this.assets.remove(kind);
    this.clearPreview(kind);
    this.toast.show(kind === 'stamp' ? 'Stamp removed' : 'Signature removed', 'success');
  }

  private async refreshAllPreviews(): Promise<void> {
    await Promise.all([this.refreshPreview('stamp'), this.refreshPreview('signature')]);
  }

  private async refreshPreview(kind: ShipAssetKind): Promise<void> {
    this.clearPreview(kind);
    const m = this.meta();
    const has = kind === 'stamp' ? m.hasStamp : m.hasSignature;
    const fileName = kind === 'stamp' ? m.stampFileName : m.signatureFileName;
    if (!has || !fileName.trim()) return;

    try {
      const bytes = await this.assets.loadBytes(kind);
      if (!bytes?.length) return;
      const url = await shipAssetPreviewUrl(bytes, fileName);
      this.previewSignal(kind).set(url);
    } catch {
      /* preview optional */
    }
  }

  private clearPreview(kind: ShipAssetKind): void {
    const url = this.previewSignal(kind)();
    revokeShipAssetPreviewUrl(url);
    this.previewSignal(kind).set(null);
  }

  private previewSignal(kind: ShipAssetKind) {
    return kind === 'stamp' ? this.stampPreviewUrl : this.signaturePreviewUrl;
  }
}

function allDocumentsUse(
  overlay: DocumentOverlayPrefs,
  field: 'useStamp' | 'useSignature',
): boolean {
  const crewAll = CREW_LIST_TYPE_IDS.every(
    (id) => getCrewListVariantSettings(overlay.crewList, id)[field],
  );
  return (
    crewAll &&
    overlay.pax[field] &&
    overlay.portOfCall[field] &&
    overlay.mdh[field] &&
    overlay.shipStores[field] &&
    overlay.crewEffect[field] &&
    overlay.nilList[field] &&
    overlay.shipMoney[field] &&
    overlay.cashAdvance[field] &&
    overlay.crewMoney[field] &&
    overlay.narcoticList[field] &&
    overlay.sso0108PortCalls[field]
  );
}
