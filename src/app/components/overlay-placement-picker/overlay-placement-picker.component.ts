import {
  AfterViewInit,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  OnDestroy,
  OnInit,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  DOCUMENT_OVERLAY_LABELS,
  DocumentOverlayId,
  DocumentStampOptions,
} from '../../models/document-overlay.models';
import { StorageService } from '../../services/storage.service';
import {
  OverlayRotation,
  OVERLAY_ROTATIONS,
  PdfStampBox,
  boxCenter,
  clampStampBox,
  defaultSignatureBoxFromStamp,
  defaultSignatureSize,
  defaultStampBoxForDocument,
  defaultStampSize,
  normalizeOverlayRotation,
  nudgeStampBox,
  A4_HEIGHT_PT,
  A4_WIDTH_PT,
  pageDimensions,
  previewClickToPdfPoint,
  stampBoxCenteredOn,
  stampBoxToPreviewPercents,
} from '../../utils/overlay-stamp-box.util';

type MdhPickerPage = 'form' | 'attachment';
type PlacementMode = 'none' | 'stamp' | 'signature' | 'both';

@Component({
  selector: 'app-overlay-placement-picker',
  imports: [FormsModule],
  template: `
    <div class="modal-backdrop placement-backdrop" (click)="close.emit()">
      <div
        class="placement-modal"
        tabindex="0"
        #modalHost
        (click)="$event.stopPropagation()"
        (keydown)="onKeydown($event)"
      >
        <h3>Stamp & signature — {{ docLabel() }}</h3>

        <div class="placement-toggles">
          <label class="placement-check">
            <input
              type="checkbox"
              [ngModel]="options().useStamp"
              (ngModelChange)="onToggle('useStamp', $event)"
            />
            Put stamp on {{ docLabel() }}
          </label>
          <label class="placement-check">
            <input
              type="checkbox"
              [ngModel]="options().useSignature"
              (ngModelChange)="onToggle('useSignature', $event)"
            />
            Put captain signature on {{ docLabel() }}
          </label>
        </div>

        @if (documentId() === 'mdh') {
          <div class="placement-mdh-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              class="placement-tab"
              [class.placement-tab--active]="mdhPage() === 'form'"
              (click)="setMdhPage('form')"
            >
              Page 1 (form)
            </button>
            <button
              type="button"
              role="tab"
              class="placement-tab"
              [class.placement-tab--active]="mdhPage() === 'attachment'"
              (click)="setMdhPage('attachment')"
            >
              Pages 2+ (attachment)
            </button>
          </div>
        }

        <div class="placement-rotation" role="group" aria-label="Stamp rotation">
          <span class="placement-toolbar-label">Stamp rotation</span>
          @for (deg of rotations; track deg) {
            <button
              type="button"
              class="placement-pill placement-pill--narrow"
              [class.placement-pill--active]="rotation() === deg"
              (click)="setRotation(deg)"
            >
              {{ deg }}°
            </button>
          }
        </div>

        <p class="placement-hint">{{ placementHint() }}</p>

        <div class="placement-stage" [style.aspect-ratio]="stageAspectRatio()">
          <div
            class="placement-sheet"
            [class.placement-sheet--draggable]="placementMode() !== 'none'"
            [class.placement-sheet--dragging]="pointerDragging()"
            #placementSheet
            (pointerdown)="onSheetPointerDown($event)"
            (pointermove)="onSheetPointerMove($event)"
            (pointerup)="onSheetPointerUp($event)"
            (pointercancel)="onSheetPointerUp($event)"
          >
            <div
              class="placement-marker placement-marker--stamp"
              [class.placement-marker--on]="options().useStamp"
              [class.placement-marker--active]="canMoveStamp()"
              [style.left]="stampMarkerStyle().left"
              [style.top]="stampMarkerStyle().top"
              [style.width]="stampMarkerStyle().width"
              [style.height]="stampMarkerStyle().height"
              [style.transform]="markerRotateTransform()"
            ></div>
            <div
              class="placement-marker placement-marker--sig"
              [class.placement-marker--on]="options().useSignature"
              [class.placement-marker--active]="canMoveSignature()"
              [style.left]="signatureMarkerStyle().left"
              [style.top]="signatureMarkerStyle().top"
              [style.width]="signatureMarkerStyle().width"
              [style.height]="signatureMarkerStyle().height"
              [style.transform]="markerRotateTransform()"
            ></div>
          </div>
        </div>

        <p class="placement-coords">
          Rotation {{ rotation() }}° — {{ moveTargetLabel() }}
        </p>

        <div class="placement-actions">
          <button type="button" class="btn btn-secondary" (click)="resetToDefault()">Reset to default</button>
          <button type="button" class="btn btn-primary" (click)="close.emit()">Done</button>
        </div>
      </div>
    </div>
  `,
  styles: `
    .placement-backdrop {
      z-index: 120;
    }

    .placement-modal {
      background: var(--surface);
      border-radius: 12px;
      padding: 1.25rem 1.5rem;
      max-width: 640px;
      width: 100%;
      max-height: 92vh;
      overflow-y: auto;
      box-shadow: 0 20px 50px rgb(0 0 0 / 20%);
      outline: none;
    }

    .placement-modal:focus-visible {
      box-shadow:
        0 20px 50px rgb(0 0 0 / 20%),
        0 0 0 2px var(--accent-soft);
    }

    .placement-modal h3 {
      margin: 0 0 0.75rem;
      font-size: 1.05rem;
    }

    .placement-toggles {
      display: flex;
      flex-direction: column;
      gap: 0.55rem;
      margin-bottom: 0.85rem;
      padding-bottom: 0.85rem;
      border-bottom: 1px solid var(--border);
    }

    .placement-check {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      font-size: 0.9rem;
      cursor: pointer;
    }

    .placement-mdh-tabs {
      display: flex;
      gap: 0.35rem;
      margin-bottom: 0.65rem;
    }

    .placement-tab {
      flex: 1;
      padding: 0.45rem 0.6rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: #f8fafc;
      font: inherit;
      font-size: 0.82rem;
      cursor: pointer;
    }

    .placement-tab--active {
      background: var(--accent-soft);
      border-color: var(--accent);
      color: var(--accent);
      font-weight: 600;
    }

    .placement-rotation {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.35rem;
      margin-bottom: 0.65rem;
    }

    .placement-toolbar-label {
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--text-muted);
      min-width: 4.5rem;
    }

    .placement-pill {
      padding: 0.32rem 0.6rem;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: #fff;
      font: inherit;
      font-size: 0.78rem;
      cursor: pointer;
    }

    .placement-pill--narrow {
      min-width: 2.6rem;
      text-align: center;
    }

    .placement-pill--active {
      background: var(--accent-soft);
      border-color: var(--accent);
      color: var(--accent);
      font-weight: 600;
    }

    .placement-hint {
      margin: 0 0 0.5rem;
      font-size: 0.82rem;
      color: var(--text-muted);
      line-height: 1.45;
    }

    .placement-stage {
      width: min(520px, 92vw);
      margin: 0 auto 0.65rem;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #e2e8f0;
      border-radius: 8px;
      box-sizing: border-box;
    }

    .placement-sheet {
      width: 50%;
      height: 50%;
      background: #fff;
      border: 1px solid #cbd5e1;
      box-shadow: 0 2px 10px rgb(15 23 42 / 12%);
      position: relative;
      cursor: default;
      touch-action: none;
      user-select: none;
    }

    .placement-sheet--draggable {
      cursor: grab;
    }

    .placement-sheet--dragging {
      cursor: grabbing;
    }

    .placement-marker {
      position: absolute;
      pointer-events: none;
      box-sizing: border-box;
      transform-origin: center center;
      opacity: 0.28;
    }

    .placement-marker--on {
      opacity: 0.5;
    }

    .placement-marker--active {
      opacity: 1;
    }

    .placement-marker--stamp {
      border: 2px dashed #dc2626;
      background: rgb(220 38 38 / 8%);
      border-radius: 2px;
    }

    .placement-marker--sig {
      border: 1px dashed #0369a1;
      background: rgb(3 105 161 / 10%);
      border-radius: 2px;
    }

    .placement-coords {
      margin: 0 0 1rem;
      text-align: center;
      font-size: 0.78rem;
      color: var(--text-muted);
    }

    .placement-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 0.5rem;
    }
  `,
})
export class OverlayPlacementPickerComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly documentId = input.required<DocumentOverlayId>();
  readonly close = output<void>();

  protected readonly rotations = OVERLAY_ROTATIONS;

  private readonly storage = inject(StorageService);
  private readonly modalHost = viewChild<ElementRef<HTMLElement>>('modalHost');
  private readonly placementSheet = viewChild<ElementRef<HTMLElement>>('placementSheet');

  protected readonly mdhPage = signal<MdhPickerPage>('form');
  protected readonly rotation = signal<OverlayRotation>(0);
  protected readonly pointerDragging = signal(false);

  /** Live positions while dragging (avoid storage write per pixel). */
  private readonly dragStampBox = signal<PdfStampBox | null>(null);
  private readonly dragSignatureBox = signal<PdfStampBox | null>(null);
  private lastPointerClient: { x: number; y: number } | null = null;
  private pointerDidMove = false;

  ngOnInit(): void {
    this.syncRotationFromStorage();
  }

  ngAfterViewInit(): void {
    queueMicrotask(() => this.modalHost()?.nativeElement.focus());
  }

  ngOnDestroy(): void {
    this.endPointerDrag(false);
  }

  protected readonly pageDims = computed(() => pageDimensions());
  protected readonly stageAspectRatio = computed(() => `${A4_WIDTH_PT} / ${A4_HEIGHT_PT}`);
  protected markerRotateTransform = computed(() => `rotate(${this.rotation()}deg)`);

  protected readonly mdhAttachment = computed(
    () => this.documentId() === 'mdh' && this.mdhPage() === 'attachment',
  );

  protected placementMode = computed((): PlacementMode => {
    const o = this.options();
    if (o.useStamp && o.useSignature) return 'both';
    if (o.useStamp) return 'stamp';
    if (o.useSignature) return 'signature';
    return 'none';
  });

  protected canMoveStamp = computed(() => {
    const m = this.placementMode();
    return this.options().useStamp && (m === 'stamp' || m === 'both');
  });

  protected canMoveSignature = computed(() => {
    const m = this.placementMode();
    return this.options().useSignature && (m === 'signature' || m === 'both');
  });

  protected placementHint = computed(() => {
    switch (this.placementMode()) {
      case 'both':
        return 'Both frames are visible. Drag on the page or use arrow keys to move stamp and signature together (checked items).';
      case 'stamp':
        return 'Both frames are visible. Drag or use arrow keys to move the stamp (signature preview only).';
      case 'signature':
        return 'Both frames are visible. Drag or use arrow keys to move the signature (stamp preview only).';
      default:
        return 'Both frames are visible for preview. Enable stamp and/or signature to move them.';
    }
  });

  protected moveTargetLabel = computed(() => {
    switch (this.placementMode()) {
      case 'both':
        return 'Moving stamp + signature';
      case 'stamp':
        return 'Moving stamp';
      case 'signature':
        return 'Moving signature';
      default:
        return 'Nothing selected';
    }
  });

  protected options(): DocumentStampOptions {
    return this.storage.documentOverlay()[this.documentId()];
  }

  protected docLabel(): string {
    return DOCUMENT_OVERLAY_LABELS[this.documentId()];
  }

  protected stampBoxStored = computed(() => {
    const opts = this.options();
    const { widthPt, heightPt } = this.pageDims();
    const raw = this.mdhAttachment() ? opts.stampBoxAttachment : opts.stampBox;
    const box =
      raw ?? defaultStampBoxForDocument(this.documentId(), this.mdhAttachment() ? 'attachment' : 'form');
    return clampStampBox(box, widthPt, heightPt);
  });

  protected signatureBoxStored = computed(() => {
    const opts = this.options();
    const { widthPt, heightPt } = this.pageDims();
    const stamp = this.stampBoxStored();
    const raw = this.mdhAttachment() ? opts.signatureBoxAttachment : opts.signatureBox;
    const box = raw ?? defaultSignatureBoxFromStamp(stamp, heightPt);
    return clampStampBox(box, widthPt, heightPt);
  });

  protected displayStampBox = computed(
    () => this.dragStampBox() ?? this.stampBoxStored(),
  );

  protected displaySignatureBox = computed(
    () => this.dragSignatureBox() ?? this.signatureBoxStored(),
  );

  protected stampMarkerStyle = computed(() => {
    const { widthPt, heightPt } = this.pageDims();
    return stampBoxToPreviewPercents(this.displayStampBox(), widthPt, heightPt);
  });

  protected signatureMarkerStyle = computed(() => {
    const { widthPt, heightPt } = this.pageDims();
    return stampBoxToPreviewPercents(this.displaySignatureBox(), widthPt, heightPt);
  });

  protected onToggle(field: 'useStamp' | 'useSignature', value: boolean): void {
    this.storage.updateDocumentOverlay(this.documentId(), { [field]: value });
  }

  protected setMdhPage(page: MdhPickerPage): void {
    this.mdhPage.set(page);
    this.syncRotationFromStorage();
  }

  protected setRotation(deg: OverlayRotation): void {
    this.rotation.set(deg);
    this.persistRotation(deg);
  }

  protected onSheetPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    const mode = this.placementMode();
    if (mode === 'none') return;

    const el = this.placementSheet()?.nativeElement;
    if (!el) return;

    event.preventDefault();
    el.setPointerCapture(event.pointerId);
    this.pointerDragging.set(true);
    this.pointerDidMove = false;
    this.lastPointerClient = { x: event.clientX, y: event.clientY };
    this.dragStampBox.set(this.stampBoxStored());
    this.dragSignatureBox.set(this.signatureBoxStored());
  }

  protected onSheetPointerMove(event: PointerEvent): void {
    if (!this.pointerDragging() || !this.lastPointerClient) return;

    const dxPx = event.clientX - this.lastPointerClient.x;
    const dyPx = event.clientY - this.lastPointerClient.y;
    if (dxPx === 0 && dyPx === 0) return;

    this.pointerDidMove = true;
    this.lastPointerClient = { x: event.clientX, y: event.clientY };

    const step = this.nudgeStepPdf();
    this.nudgeLive(this.placementMode(), dxPx * step.dx, -dyPx * step.dy);
  }

  protected onSheetPointerUp(event: PointerEvent): void {
    if (!this.pointerDragging()) return;

    const mode = this.placementMode();
    const el = this.placementSheet()?.nativeElement;
    if (el?.hasPointerCapture(event.pointerId)) {
      el.releasePointerCapture(event.pointerId);
    }

    if (!this.pointerDidMove && mode !== 'none' && el) {
      const rect = el.getBoundingClientRect();
      const { widthPt, heightPt } = this.pageDims();
      const { x, y } = previewClickToPdfPoint(
        event.clientX - rect.left,
        event.clientY - rect.top,
        rect.width,
        rect.height,
        widthPt,
        heightPt,
      );
      this.placeAt(mode, x, y);
      this.endPointerDrag(false);
      return;
    }

    this.endPointerDrag(true);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const mode = this.placementMode();
    if (mode === 'none') return;

    let dx = 0;
    let dy = 0;
    switch (event.key) {
      case 'ArrowLeft':
        dx = -1;
        break;
      case 'ArrowRight':
        dx = 1;
        break;
      case 'ArrowUp':
        dy = 1;
        break;
      case 'ArrowDown':
        dy = -1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const step = this.nudgeStepPdf();
    this.nudgeBy(mode, dx * step.dx, dy * step.dy, true);
  }

  protected resetToDefault(): void {
    const { widthPt, heightPt } = pageDimensions();
    const stamp = clampStampBox(
      defaultStampBoxForDocument(this.documentId(), this.mdhAttachment() ? 'attachment' : 'form'),
      widthPt,
      heightPt,
    );
    const signature = clampStampBox(defaultSignatureBoxFromStamp(stamp, heightPt), widthPt, heightPt);
    this.persistBoxes(stamp, signature);

    const rot: OverlayRotation = this.mdhAttachment() ? 180 : 0;
    this.rotation.set(rot);
    this.persistRotation(rot);
  }

  private endPointerDrag(persist: boolean): void {
    if (persist) {
      const mode = this.placementMode();
      if (mode === 'stamp') {
        this.persistBoxes(this.dragStampBox() ?? undefined, undefined);
      } else if (mode === 'signature') {
        this.persistBoxes(undefined, this.dragSignatureBox() ?? undefined);
      } else if (mode === 'both') {
        this.persistBoxes(this.dragStampBox() ?? undefined, this.dragSignatureBox() ?? undefined);
      }
    }
    this.pointerDragging.set(false);
    this.lastPointerClient = null;
    this.dragStampBox.set(null);
    this.dragSignatureBox.set(null);
    this.pointerDidMove = false;
  }

  private placeAt(mode: PlacementMode, pdfX: number, pdfY: number): void {
    const { widthPt, heightPt } = this.pageDims();
    const stamp = this.stampBoxStored();
    const signature = this.signatureBoxStored();

    if (mode === 'stamp') {
      const size = defaultStampSize(widthPt, heightPt);
      this.persistBoxes(stampBoxCenteredOn(pdfX, pdfY, size, widthPt, heightPt), undefined);
      return;
    }

    if (mode === 'signature') {
      const size = defaultSignatureSize(widthPt, heightPt);
      this.persistBoxes(undefined, stampBoxCenteredOn(pdfX, pdfY, size, widthPt, heightPt));
      return;
    }

    const stampCenter = boxCenter(stamp);
    const dx = pdfX - stampCenter.x;
    const dy = pdfY - stampCenter.y;
    this.persistBoxes(
      nudgeStampBox(stamp, dx, dy, widthPt, heightPt),
      nudgeStampBox(signature, dx, dy, widthPt, heightPt),
    );
  }

  /** Smooth drag: update in-memory boxes only. */
  private nudgeLive(mode: PlacementMode, dx: number, dy: number): void {
    const { widthPt, heightPt } = this.pageDims();
    let stamp = this.dragStampBox() ?? this.stampBoxStored();
    let signature = this.dragSignatureBox() ?? this.signatureBoxStored();

    if (mode === 'stamp' && this.canMoveStamp()) {
      stamp = nudgeStampBox(stamp, dx, dy, widthPt, heightPt);
      this.dragStampBox.set(stamp);
      return;
    }
    if (mode === 'signature' && this.canMoveSignature()) {
      signature = nudgeStampBox(signature, dx, dy, widthPt, heightPt);
      this.dragSignatureBox.set(signature);
      return;
    }
    if (mode === 'both') {
      if (this.canMoveStamp()) {
        stamp = nudgeStampBox(stamp, dx, dy, widthPt, heightPt);
        this.dragStampBox.set(stamp);
      }
      if (this.canMoveSignature()) {
        signature = nudgeStampBox(signature, dx, dy, widthPt, heightPt);
        this.dragSignatureBox.set(signature);
      }
    }
  }

  private nudgeBy(mode: PlacementMode, dx: number, dy: number, persist = true): void {
    const { widthPt, heightPt } = this.pageDims();
    const stamp = this.stampBoxStored();
    const signature = this.signatureBoxStored();

    if (mode === 'stamp' && this.canMoveStamp()) {
      const next = nudgeStampBox(stamp, dx, dy, widthPt, heightPt);
      if (persist) this.persistBoxes(next, undefined);
      return;
    }
    if (mode === 'signature' && this.canMoveSignature()) {
      const next = nudgeStampBox(signature, dx, dy, widthPt, heightPt);
      if (persist) this.persistBoxes(undefined, next);
      return;
    }
    if (mode === 'both') {
      const nextStamp = this.canMoveStamp()
        ? nudgeStampBox(stamp, dx, dy, widthPt, heightPt)
        : stamp;
      const nextSig = this.canMoveSignature()
        ? nudgeStampBox(signature, dx, dy, widthPt, heightPt)
        : signature;
      if (persist) this.persistBoxes(nextStamp, nextSig);
    }
  }

  /** One screen pixel on the miniature sheet → PDF points. */
  private nudgeStepPdf(): { dx: number; dy: number } {
    const el = this.placementSheet()?.nativeElement;
    const { widthPt, heightPt } = this.pageDims();
    if (!el) {
      return { dx: 1, dy: 1 };
    }
    const rect = el.getBoundingClientRect();
    return {
      dx: widthPt / Math.max(1, rect.width),
      dy: heightPt / Math.max(1, rect.height),
    };
  }

  private persistBoxes(stamp?: PdfStampBox, signature?: PdfStampBox): void {
    const patch: Partial<DocumentStampOptions> = {};
    if (stamp) {
      if (this.mdhAttachment()) {
        patch.stampBoxAttachment = stamp;
      } else {
        patch.stampBox = stamp;
      }
    }
    if (signature) {
      if (this.mdhAttachment()) {
        patch.signatureBoxAttachment = signature;
      } else {
        patch.signatureBox = signature;
      }
    }
    if (Object.keys(patch).length) {
      this.storage.updateDocumentOverlay(this.documentId(), patch);
    }
  }

  private syncRotationFromStorage(): void {
    const o = this.options();
    this.rotation.set(
      this.mdhAttachment()
        ? normalizeOverlayRotation(o.overlayRotationAttachment, 180)
        : normalizeOverlayRotation(o.overlayRotation, 0),
    );
  }

  private persistRotation(deg: OverlayRotation): void {
    if (this.mdhAttachment()) {
      this.storage.updateDocumentOverlay(this.documentId(), { overlayRotationAttachment: deg });
    } else {
      this.storage.updateDocumentOverlay(this.documentId(), { overlayRotation: deg });
    }
  }
}
