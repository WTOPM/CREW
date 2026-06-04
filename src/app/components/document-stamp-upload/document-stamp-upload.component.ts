import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  DocumentOverlayPrefs,
  ShipAssetKind,
} from '../../models/document-overlay.models';
import { ShipAssetsService } from '../../services/ship-assets.service';
import { StorageService } from '../../services/storage.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-document-stamp-upload',
  imports: [FormsModule],
  template: `
    <div class="stamp-upload">
      <p class="stamp-upload-hint">
        Upload ship stamp and captain signature once (PNG or PDF). Check Stamp/Signature below and click Set to apply
        to all documents (Crew list, PAX, Port of Call, MDH).
      </p>
      <div class="stamp-drop-grid">
        <div
          class="stamp-drop"
          [class.stamp-drop--active]="stampDrag()"
          (click)="pickAsset('stamp')"
          (dragover)="onDragOver($event, 'stamp')"
          (dragleave)="onDragLeave('stamp')"
          (drop)="onDrop($event, 'stamp')"
        >
          <span class="stamp-drop-title">Ship stamp</span>
          @if (meta().hasStamp) {
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
          [class.stamp-drop--active]="signatureDrag()"
          (click)="pickAsset('signature')"
          (dragover)="onDragOver($event, 'signature')"
          (dragleave)="onDragLeave('signature')"
          (drop)="onDrop($event, 'signature')"
        >
          <span class="stamp-drop-title">Captain signature</span>
          @if (meta().hasSignature) {
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
        <button type="button" class="btn btn-primary stamp-bulk-set" (click)="applyBulkToggles()">Set</button>
      </div>
    </div>
  `,
  styles: `
    .stamp-upload-hint {
      margin: 0 0 0.85rem;
      font-size: 0.82rem;
      color: var(--text-muted);
      line-height: 1.4;
    }

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
      gap: 0.25rem;
      transition:
        border-color 0.15s ease,
        background 0.15s ease;
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

    .stamp-drop-file {
      font-size: 0.8rem;
      color: #334155;
      word-break: break-all;
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
      min-width: 4.5rem;
      font-size: 0.88rem;
      padding: 0.4rem 1rem;
    }
  `,
})
export class DocumentStampUploadComponent implements OnInit {
  private readonly storage = inject(StorageService);
  private readonly assets = inject(ShipAssetsService);
  private readonly toast = inject(ToastService);

  protected readonly meta = this.storage.shipAssets;
  protected readonly stampDrag = signal(false);
  protected readonly signatureDrag = signal(false);

  protected bulkUseStamp = false;
  protected bulkUseSignature = false;

  ngOnInit(): void {
    this.syncBulkFromDocuments();
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
      this.toast.show(kind === 'stamp' ? 'Stamp saved' : 'Signature saved', 'success');
    } catch (err) {
      this.toast.showError(err instanceof Error ? err.message : 'Upload failed');
    }
  }

  protected async removeAsset(event: MouseEvent, kind: ShipAssetKind): Promise<void> {
    event.stopPropagation();
    await this.assets.remove(kind);
    this.toast.show(kind === 'stamp' ? 'Stamp removed' : 'Signature removed', 'success');
  }
}

function allDocumentsUse(
  overlay: DocumentOverlayPrefs,
  field: 'useStamp' | 'useSignature',
): boolean {
  return (
    overlay.crewList[field] &&
    overlay.pax[field] &&
    overlay.portOfCall[field] &&
    overlay.mdh[field]
  );
}
