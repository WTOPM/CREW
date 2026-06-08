import { DecimalPipe, NgStyle } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  OnDestroy,
  OnInit,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ClickOutsideDirective } from '../../directives/click-outside.directive';
import {
  CREW_LIST_TYPE_LABELS,
  DOCUMENT_OVERLAY_LABELS,
  DocumentOverlayId,
  DocumentStampOptions,
  resolveCrewListStampOptions,
} from '../../models/document-overlay.models';
import {
  DocumentOverlayPreviewService,
  MdhOverlayPreviewPage,
} from '../../services/document-overlay-preview.service';
import { ShipAssetsService } from '../../services/ship-assets.service';
import { StorageService } from '../../services/storage.service';
import {
  clientToViewportCss,
  CREW_LIST_PREVIEW_CSS_PX_PER_PT,
  openPdfJsPageView,
  pdfJsScreenStepToPdf,
  type PdfJsPageView,
} from '../../utils/crew-list-pdfjs.util';
import {
  A4_HEIGHT_PT,
  A4_WIDTH_PT,
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
  resizeStampBox,
  scaleStampBoxToPage,
  stampBoxCenteredOn,
  stampBoxToRefCoordinates,
  STAMP_RESIZE_HANDLES,
  type StampResizeHandle,
} from '../../utils/overlay-stamp-box.util';

type PlacementMode = 'none' | 'stamp' | 'signature' | 'both';
type ResizeTarget = 'stamp' | 'signature';

@Component({
  selector: 'app-overlay-placement-picker',
  imports: [FormsModule, DecimalPipe, NgStyle, ClickOutsideDirective],
  template: `
    <div class="modal-backdrop placement-backdrop">
      <div
        class="placement-modal"
        tabindex="0"
        #modalHost
        appClickOutside
        (appClickOutside)="close.emit()"
        (click)="$event.stopPropagation()"
        (keydown)="onKeydown($event)"
      >
        <h3>Stamp & signature — {{ docLabel() }}</h3>

        <div class="choice-chips">
          <label class="choice-chip">
            <input
              type="checkbox"
              [ngModel]="options().useStamp"
              (ngModelChange)="onToggle('useStamp', $event)"
            />
            <span>Stamp</span>
          </label>
          <label class="choice-chip">
            <input
              type="checkbox"
              [ngModel]="options().useSignature"
              (ngModelChange)="onToggle('useSignature', $event)"
            />
            <span>Signature</span>
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

        @if (loadError()) {
          <p class="placement-error">{{ loadError() }}</p>
        } @else {
          <div class="placement-readout" aria-live="polite">
            <span class="placement-readout-line placement-readout-line--cursor">
              Cursor: x {{ cursorPt()?.x ?? '—' }}, y {{ cursorPt()?.y ?? '—' }}
              @if (cursorFromTop() != null) {
                <span class="placement-readout-sub">(y from top: {{ cursorFromTop() | number: '1.0-1' }})</span>
              }
            </span>
            @if (stampBoxOnPage(); as stamp) {
              <span>
                Stamp: x {{ stamp.x | number: '1.0-1' }}, y {{ stamp.y | number: '1.0-1' }},
                {{ stamp.width | number: '1.0-1' }}×{{ stamp.height | number: '1.0-1' }} pt
              </span>
            }
            @if (signatureBoxOnPage(); as sig) {
              <span>
                Signature: x {{ sig.x | number: '1.0-1' }}, y {{ sig.y | number: '1.0-1' }},
                {{ sig.width | number: '1.0-1' }}×{{ sig.height | number: '1.0-1' }} pt
              </span>
            }
          </div>

          <div class="placement-zoom" role="group" aria-label="Preview zoom">
            <button type="button" class="placement-pill placement-pill--narrow" (click)="zoomOut()" aria-label="Zoom out">−</button>
            <span class="placement-zoom-label">{{ zoomPercent() }}%</span>
            <button type="button" class="placement-pill placement-pill--narrow" (click)="zoomIn()" aria-label="Zoom in">+</button>
            <button type="button" class="placement-pill" (click)="resetZoom()">100%</button>
          </div>

          <div
            class="placement-scroll"
            #placementScroll
            [class.placement-scroll--panning]="viewPanning()"
            [class.placement-scroll--probe]="coordProbeMode()"
            (wheel)="onPreviewWheel($event)"
            (pointermove)="onScrollPointerMove($event)"
            (pointerup)="onScrollPointerUp($event)"
            (pointercancel)="onScrollPointerUp($event)"
          >
            @if (loading()) {
              <p class="placement-loading">Loading document…</p>
            }
            <div class="placement-scroll-center" [class.placement-scroll-center--hidden]="loading()">
              <div
                class="placement-page-wrap"
                [style.width.px]="pageWrapWidth()"
                [style.height.px]="pageWrapHeight()"
              >
                <div
                  class="placement-page"
                  [style.width.px]="pageCssWidth()"
                  [style.height.px]="pageCssHeight()"
                  [style.transform]="pageScaleTransform()"
                >
                  <canvas #pdfCanvas class="placement-canvas"></canvas>
                  <div
                    class="placement-overlay"
                    #placementOverlay
                    [class.placement-overlay--probe]="coordProbeMode()"
                    [class.placement-overlay--panning]="viewPanning()"
                    [class.placement-overlay--draggable]="placementMode() !== 'none' && !resizing()"
                    [class.placement-overlay--dragging]="pointerDragging()"
                    [class.placement-overlay--resizing]="resizing()"
                    (pointerdown)="onOverlayPointerDown($event)"
                    (pointermove)="onOverlayPointerMove($event)"
                    (pointerup)="onOverlayPointerUp($event)"
                    (pointercancel)="onOverlayPointerUp($event)"
                    (pointerleave)="onOverlayPointerLeave()"
                  >
                    @if (pdfProbeMarkerStyle(); as probeStyle) {
                      <span class="placement-pdf-probe" [ngStyle]="probeStyle" aria-hidden="true"
                        >1</span
                      >
                    }
                <div
                  class="placement-marker placement-marker--stamp"
                  [class.placement-marker--on]="options().useStamp"
                  [class.placement-marker--active]="canMoveStamp()"
                  [class.placement-marker--resizable]="canResizeStamp()"
                  [ngStyle]="stampOverlayStyle()"
                >
                  @if (stampPreviewUrl()) {
                    <img [src]="stampPreviewUrl()" alt="" class="placement-marker-img" />
                  }
                  @if (canResizeStamp()) {
                    @for (h of resizeHandles; track h) {
                      <span
                        class="placement-handle placement-handle--stamp placement-handle--{{ h }}"
                        [attr.aria-label]="'Resize stamp ' + h"
                        (pointerdown)="onHandlePointerDown($event, 'stamp', h)"
                      ></span>
                    }
                  }
                </div>
                <div
                  class="placement-marker placement-marker--sig"
                  [class.placement-marker--on]="options().useSignature"
                  [class.placement-marker--active]="canMoveSignature()"
                  [class.placement-marker--resizable]="canResizeSignature()"
                  [ngStyle]="signatureOverlayStyle()"
                >
                  @if (signaturePreviewUrl()) {
                    <img [src]="signaturePreviewUrl()" alt="" class="placement-marker-img" />
                  }
                  @if (canResizeSignature()) {
                    @for (h of resizeHandles; track h) {
                      <span
                        class="placement-handle placement-handle--sig placement-handle--{{ h }}"
                        [attr.aria-label]="'Resize signature ' + h"
                        (pointerdown)="onHandlePointerDown($event, 'signature', h)"
                      ></span>
                    }
                  }
                </div>
              </div>
            </div>
            </div>
            </div>
          </div>
        }

        <p class="placement-coords">
          Base 96 dpi, preview {{ zoomPercent() }}% — {{ moveTargetLabel() }}, rotation {{ rotation() }}°.
          Values match pdf-lib <code>drawText</code> (x, y from bottom-left). y from top = page height − y.
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
      z-index: 130;
    }

    .placement-modal {
      background: var(--surface);
      border-radius: 12px;
      padding: 1.25rem 1.5rem;
      max-width: min(96vw, 1200px);
      width: 100%;
      max-height: 94vh;
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

    .choice-chips {
      margin-bottom: 0.65rem;
      padding-bottom: 0.65rem;
      border-bottom: 1px solid var(--border);
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

    .placement-readout {
      margin: 0 0 0.5rem;
      padding: 0.4rem 0.6rem;
      background: #f1f5f9;
      border-radius: 6px;
      font-family: ui-monospace, 'Cascadia Code', monospace;
      font-size: 0.78rem;
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      color: #334155;
    }

    .placement-readout-line--cursor {
      min-height: 1.15em;
      font-weight: 600;
    }

    .placement-readout-sub {
      font-weight: 500;
      color: var(--text-muted);
    }

    .placement-zoom {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      margin: 0 0 0.5rem;
    }

    .placement-zoom-label {
      min-width: 3rem;
      text-align: center;
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--text-muted);
      font-variant-numeric: tabular-nums;
    }

    .placement-scroll {
      overflow: auto;
      max-height: min(68vh, 820px);
      margin: 0 0 0.65rem;
      background: #e2e8f0;
      border-radius: 8px;
      padding: 0.75rem;
      min-height: 120px;
      overscroll-behavior: contain;
    }

    .placement-scroll--panning {
      cursor: grabbing;
      user-select: none;
    }

    .placement-scroll--probe,
    .placement-overlay--probe {
      cursor: none;
    }

    .placement-pdf-probe {
      position: absolute;
      z-index: 30;
      pointer-events: none;
      color: #dc2626;
      font-family: Helvetica, Arial, sans-serif;
      font-weight: normal;
      line-height: 1;
      text-shadow:
        0 0 2px #fff,
        0 0 2px #fff;
    }

    .placement-scroll-center {
      min-width: 100%;
      min-height: 100%;
      width: max-content;
      height: max-content;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      box-sizing: border-box;
    }

    .placement-scroll-center--hidden {
      visibility: hidden;
      position: absolute;
      pointer-events: none;
    }

    .placement-loading {
      margin: 2rem auto;
      font-size: 0.88rem;
      color: var(--text-muted);
    }

    .placement-page-wrap {
      flex-shrink: 0;
      position: relative;
      overflow: visible;
    }

    .placement-page-wrap--hidden {
      visibility: hidden;
      position: absolute;
      pointer-events: none;
    }

    .placement-page {
      position: relative;
      flex-shrink: 0;
      transform-origin: top left;
      overflow: visible;
    }

    .placement-page--hidden {
      visibility: hidden;
      position: absolute;
      pointer-events: none;
    }

    .placement-canvas {
      display: block;
      box-shadow: 0 2px 12px rgb(15 23 42 / 18%);
    }

    .placement-overlay {
      position: absolute;
      inset: 0;
      cursor: default;
      touch-action: none;
      user-select: none;
    }

    .placement-overlay--draggable {
      cursor: crosshair;
    }

    .placement-overlay--panning {
      cursor: grabbing;
    }

    .placement-overlay--dragging {
      cursor: grabbing;
    }

    .placement-overlay--resizing {
      cursor: default;
    }

    .placement-marker {
      position: absolute;
      pointer-events: none;
      box-sizing: border-box;
      transform-origin: center center;
      overflow: hidden;
      opacity: 0.35;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .placement-marker--on {
      opacity: 0.55;
    }

    .placement-marker--active {
      opacity: 1;
    }

    .placement-marker--stamp {
      border: 2px dashed #dc2626;
      background: rgb(220 38 38 / 6%);
    }

    .placement-marker--sig {
      border: 1px dashed #0369a1;
      background: rgb(3 105 161 / 8%);
    }

    .placement-marker-img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      pointer-events: none;
    }

    .placement-marker--resizable {
      pointer-events: none;
    }

    .placement-handle {
      position: absolute;
      pointer-events: auto;
      z-index: 3;
      box-sizing: border-box;
    }

    .placement-handle--stamp {
      background: #dc2626;
      border: 1px solid #fff;
    }

    .placement-handle--sig {
      background: #0369a1;
      border: 1px solid #fff;
    }

    .placement-handle--n,
    .placement-handle--s {
      left: 50%;
      width: 14px;
      height: 7px;
      margin-left: -7px;
      cursor: ns-resize;
    }

    .placement-handle--n {
      top: -4px;
    }

    .placement-handle--s {
      bottom: -4px;
    }

    .placement-handle--e,
    .placement-handle--w {
      top: 50%;
      width: 7px;
      height: 14px;
      margin-top: -7px;
      cursor: ew-resize;
    }

    .placement-handle--e {
      right: -4px;
    }

    .placement-handle--w {
      left: -4px;
    }

    .placement-handle--nw,
    .placement-handle--ne,
    .placement-handle--sw,
    .placement-handle--se {
      width: 9px;
      height: 9px;
    }

    .placement-handle--nw {
      top: -5px;
      left: -5px;
      cursor: nwse-resize;
    }

    .placement-handle--ne {
      top: -5px;
      right: -5px;
      cursor: nesw-resize;
    }

    .placement-handle--sw {
      bottom: -5px;
      left: -5px;
      cursor: nesw-resize;
    }

    .placement-handle--se {
      bottom: -5px;
      right: -5px;
      cursor: nwse-resize;
    }

    .placement-coords {
      margin: 0 0 1rem;
      font-size: 0.78rem;
      color: var(--text-muted);
    }

    .placement-error {
      color: #b91c1c;
      font-size: 0.88rem;
      margin: 0 0 1rem;
    }

    .placement-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 0.5rem;
    }
  `,
})
export class OverlayPlacementPickerComponent implements OnInit, OnDestroy {
  readonly documentId = input.required<DocumentOverlayId>();
  readonly close = output<void>();

  protected readonly rotations = OVERLAY_ROTATIONS;
  protected readonly resizeHandles = STAMP_RESIZE_HANDLES;

  private readonly storage = inject(StorageService);
  private readonly previewSvc = inject(DocumentOverlayPreviewService);
  private readonly assets = inject(ShipAssetsService);
  private readonly modalHost = viewChild<ElementRef<HTMLElement>>('modalHost');
  private readonly pdfCanvas = viewChild<ElementRef<HTMLCanvasElement>>('pdfCanvas');
  private readonly placementOverlay = viewChild<ElementRef<HTMLElement>>('placementOverlay');
  private readonly placementScroll = viewChild<ElementRef<HTMLElement>>('placementScroll');

  protected readonly mdhPage = signal<MdhOverlayPreviewPage>('form');
  protected readonly rotation = signal<OverlayRotation>(0);
  protected readonly pointerDragging = signal(false);
  protected readonly viewPanning = signal(false);
  protected readonly resizing = signal(false);
  private readonly activeResize = signal<{
    target: ResizeTarget;
    handle: StampResizeHandle;
  } | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly cursorPt = signal<{ x: number; y: number } | null>(null);
  protected readonly pdfProbeMarkerStyle = signal<Record<string, string> | null>(null);
  protected readonly stampPreviewUrl = signal<string | null>(null);
  protected readonly signaturePreviewUrl = signal<string | null>(null);

  private readonly pageSizePt = signal({ widthPt: A4_WIDTH_PT, heightPt: A4_HEIGHT_PT });
  protected readonly pageCssWidth = signal(0);
  protected readonly pageCssHeight = signal(0);
  protected readonly previewZoom = signal(1);
  protected readonly zoomPercent = computed(() => Math.round(this.previewZoom() * 100));
  protected readonly cursorFromTop = computed(() => {
    const pt = this.cursorPt();
    if (!pt) return null;
    return this.pageSizePt().heightPt - pt.y;
  });
  protected readonly pageWrapWidth = computed(() => this.pageCssWidth() * this.previewZoom());
  protected readonly pageWrapHeight = computed(() => this.pageCssHeight() * this.previewZoom());
  protected readonly pageScaleTransform = computed(() => `scale(${this.previewZoom()})`);

  protected readonly coordProbeMode = computed(
    () => this.placementMode() === 'none' && !this.viewPanning(),
  );

  private static readonly ZOOM_MIN = 0.5;
  private static readonly ZOOM_MAX = 10;
  private static readonly ZOOM_STEP = 0.1;
  /** Mouse wheel zoom step (+/− 25% per notch). */
  private static readonly WHEEL_ZOOM_STEP = 0.25;
  /** Matches pdf-lib drawText probe (pt) — same as typical crew-list row font. */
  private static readonly PDF_PROBE_FONT_PT = 8;
  private static readonly PDF_PROBE_FONT_ASCENT = 0.72;

  private pageView: PdfJsPageView | null = null;
  private pdfBytes: Uint8Array | null = null;
  private renderStarted = false;

  private readonly dragStampBoxPage = signal<PdfStampBox | null>(null);
  private readonly dragSignatureBoxPage = signal<PdfStampBox | null>(null);
  private lastPointerClient: { x: number; y: number } | null = null;
  private lastPanClient: { x: number; y: number } | null = null;
  private pointerDidMove = false;

  constructor() {
    afterNextRender(() => {
      if (this.renderStarted) return;
      this.renderStarted = true;
      void this.loadDocumentPreview();
      queueMicrotask(() => this.modalHost()?.nativeElement.focus());
    });
  }

  ngOnInit(): void {
    this.syncRotationFromStorage();
    void this.loadAssetPreviews();
  }

  ngOnDestroy(): void {
    this.endResize(false);
    this.endPointerDrag(false);
    this.pageView?.destroy();
    this.pageView = null;
    this.revokePreviewUrls();
  }

  protected readonly mdhAttachment = computed(
    () => this.documentId() === 'mdh' && this.mdhPage() === 'attachment',
  );

  protected markerRotateTransform = computed(() => `rotate(${this.rotation()}deg)`);

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

  protected canResizeStamp = computed(
    () => this.options().useStamp && this.placementMode() !== 'none',
  );

  protected canResizeSignature = computed(
    () => this.options().useSignature && this.placementMode() !== 'none',
  );

  protected placementHint = computed(() => {
    switch (this.placementMode()) {
      case 'both':
        return 'Drag to move; drag edges/corners of a frame to resize. Arrow keys nudge position.';
      case 'stamp':
        return 'Drag to move the stamp; drag its edges/corners to resize (signature for reference).';
      case 'signature':
        return 'Drag to move the signature; drag its edges/corners to resize.';
      default:
        return 'Hover for pdf-lib coordinates. Red «1» marks exact drawText position for displayed x, y. Wheel to zoom (up to 1000%); drag LMB to pan when zoomed.';
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
        return 'Coordinates only';
    }
  });

  protected zoomIn(): void {
    this.applyZoom(this.previewZoom() + OverlayPlacementPickerComponent.ZOOM_STEP);
  }

  protected zoomOut(): void {
    this.applyZoom(this.previewZoom() - OverlayPlacementPickerComponent.ZOOM_STEP);
  }

  protected resetZoom(): void {
    this.applyZoom(1);
    const scroll = this.placementScroll()?.nativeElement;
    if (scroll) {
      scroll.scrollLeft = 0;
      scroll.scrollTop = 0;
    }
  }

  protected onPreviewWheel(event: WheelEvent): void {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -OverlayPlacementPickerComponent.WHEEL_ZOOM_STEP : OverlayPlacementPickerComponent.WHEEL_ZOOM_STEP;
    this.applyZoom(this.previewZoom() + delta, event.clientX, event.clientY);
  }

  protected onScrollPointerMove(event: PointerEvent): void {
    if (this.viewPanning()) {
      this.moveViewPan(event);
      return;
    }
    if (this.placementMode() === 'none') {
      this.updateCursor(event);
    }
  }

  protected onScrollPointerUp(event: PointerEvent): void {
    if (!this.viewPanning()) return;
    const scroll = this.placementScroll()?.nativeElement;
    if (scroll?.hasPointerCapture(event.pointerId)) {
      scroll.releasePointerCapture(event.pointerId);
    }
    this.endViewPan();
  }

  protected options(): DocumentStampOptions {
    const id = this.documentId();
    const overlay = this.storage.documentOverlay();
    if (id === 'crewList') {
      return resolveCrewListStampOptions(overlay.crewList);
    }
    return overlay[id];
  }

  protected docLabel(): string {
    const id = this.documentId();
    const base = DOCUMENT_OVERLAY_LABELS[id];
    if (id === 'crewList') {
      return `${base} — ${CREW_LIST_TYPE_LABELS[this.storage.documentOverlay().crewList.listType]}`;
    }
    return base;
  }

  protected stampBoxRef = computed(() => {
    const opts = this.options();
    const raw = this.mdhAttachment() ? opts.stampBoxAttachment : opts.stampBox;
    return raw ?? defaultStampBoxForDocument(this.documentId(), this.mdhAttachment() ? 'attachment' : 'form');
  });

  protected signatureBoxRef = computed(() => {
    const opts = this.options();
    const stamp = this.stampBoxRef();
    const raw = this.mdhAttachment() ? opts.signatureBoxAttachment : opts.signatureBox;
    return raw ?? defaultSignatureBoxFromStamp(stamp, A4_HEIGHT_PT);
  });

  protected stampBoxOnPage = computed(() => {
    const { widthPt, heightPt } = this.pageSizePt();
    const ref = this.dragStampBoxPage() ?? this.stampBoxRef();
    return clampStampBox(scaleStampBoxToPage(ref, widthPt, heightPt), widthPt, heightPt);
  });

  protected signatureBoxOnPage = computed(() => {
    const { widthPt, heightPt } = this.pageSizePt();
    const stampRef = this.stampBoxRef();
    const ref = this.dragSignatureBoxPage() ?? this.signatureBoxRef();
    const scaled = scaleStampBoxToPage(ref, widthPt, heightPt);
    return clampStampBox(scaled, widthPt, heightPt);
  });

  protected stampOverlayStyle = computed(() => this.markerStyle(this.stampBoxOnPage()));
  protected signatureOverlayStyle = computed(() => this.markerStyle(this.signatureBoxOnPage()));

  protected onToggle(field: 'useStamp' | 'useSignature', value: boolean): void {
    this.storage.updateDocumentOverlay(this.documentId(), { [field]: value }, 'saved');
  }

  protected async setMdhPage(page: MdhOverlayPreviewPage): Promise<void> {
    if (this.mdhPage() === page) return;
    this.mdhPage.set(page);
    this.syncRotationFromStorage();
    await this.rerenderPdfPage();
  }

  protected setRotation(deg: OverlayRotation): void {
    this.rotation.set(deg);
    this.persistRotation(deg);
  }

  protected onHandlePointerDown(
    event: PointerEvent,
    target: ResizeTarget,
    handle: StampResizeHandle,
  ): void {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();

    const overlay = this.placementOverlay()?.nativeElement;
    if (!overlay) return;
    overlay.setPointerCapture(event.pointerId);

    this.activeResize.set({ target, handle });
    this.resizing.set(true);
    this.pointerDidMove = false;
    this.lastPointerClient = { x: event.clientX, y: event.clientY };

    if (target === 'stamp') {
      this.dragStampBoxPage.set(this.stampBoxOnPage());
    } else {
      this.dragSignatureBoxPage.set(this.signatureBoxOnPage());
    }
  }

  protected onOverlayPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    if (this.resizing()) return;
    const mode = this.placementMode();
    if (mode === 'none') {
      this.startViewPan(event);
      return;
    }

    const el = this.placementOverlay()?.nativeElement;
    if (!el || !this.pageView) return;

    event.preventDefault();
    el.setPointerCapture(event.pointerId);
    this.pointerDragging.set(true);
    this.pointerDidMove = false;
    this.lastPointerClient = { x: event.clientX, y: event.clientY };
    this.dragStampBoxPage.set(this.stampBoxOnPage());
    this.dragSignatureBoxPage.set(this.signatureBoxOnPage());
  }

  protected onOverlayPointerMove(event: PointerEvent): void {
    if (this.viewPanning()) {
      this.moveViewPan(event);
      this.updateCursor(event);
      return;
    }

    this.updateCursor(event);
    if (!this.lastPointerClient || !this.pageView) return;

    const canvas = this.pdfCanvas()?.nativeElement;
    if (!canvas) return;

    const { dx, dy } = this.pointerDeltaPdf(
      canvas,
      event.clientX,
      event.clientY,
      this.lastPointerClient.x,
      this.lastPointerClient.y,
    );
    if (dx === 0 && dy === 0) return;

    this.pointerDidMove = true;
    this.lastPointerClient = { x: event.clientX, y: event.clientY };

    const resize = this.activeResize();
    if (resize && this.resizing()) {
      this.resizeLive(resize.target, resize.handle, dx, dy);
      return;
    }

    if (!this.pointerDragging()) return;
    this.nudgeLive(this.placementMode(), dx, dy);
  }

  protected onOverlayPointerLeave(): void {
    this.clearCursorReadout();
  }

  protected onOverlayPointerUp(event: PointerEvent): void {
    if (this.viewPanning()) {
      this.onScrollPointerUp(event);
      return;
    }

    if (this.resizing()) {
      const el = this.placementOverlay()?.nativeElement;
      if (el?.hasPointerCapture(event.pointerId)) {
        el.releasePointerCapture(event.pointerId);
      }
      this.endResize(true);
      return;
    }

    if (!this.pointerDragging()) return;

    const mode = this.placementMode();
    const el = this.placementOverlay()?.nativeElement;
    if (el?.hasPointerCapture(event.pointerId)) {
      el.releasePointerCapture(event.pointerId);
    }

    if (!this.pointerDidMove && mode !== 'none' && el && this.pageView) {
      const css = this.clientToPageCss(event.clientX, event.clientY);
      if (!css) return;
      const pt = this.pageView.convertToPdfPoint(css.x, css.y);
      this.placeAt(mode, pt.x, pt.y);
      this.endPointerDrag(false);
      return;
    }

    this.endPointerDrag(true);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const mode = this.placementMode();
    if (mode === 'none') return;

    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowDown':
        break;
      default:
        return;
    }

    event.preventDefault();
    const canvas = this.pdfCanvas()?.nativeElement;
    const view = this.pageView;
    if (!canvas || !view) return;

    const stepPx = 8;
    let screenDx = 0;
    let screenDy = 0;
    switch (event.key) {
      case 'ArrowLeft':
        screenDx = -stepPx;
        break;
      case 'ArrowRight':
        screenDx = stepPx;
        break;
      case 'ArrowUp':
        screenDy = -stepPx;
        break;
      case 'ArrowDown':
        screenDy = stepPx;
        break;
      default:
        return;
    }
    const { dx: pdfDx, dy: pdfDy } = pdfJsScreenStepToPdf(view, canvas, screenDx, screenDy);
    this.nudgeBy(mode, pdfDx, pdfDy, true);
  }

  protected resetToDefault(): void {
    const stamp = defaultStampBoxForDocument(
      this.documentId(),
      this.mdhAttachment() ? 'attachment' : 'form',
    );
    const signature = defaultSignatureBoxFromStamp(stamp, A4_HEIGHT_PT);
    this.persistBoxes(stamp, signature);

    const rot: OverlayRotation = this.mdhAttachment() ? 180 : 0;
    this.rotation.set(rot);
    this.persistRotation(rot);
    this.dragStampBoxPage.set(null);
    this.dragSignatureBoxPage.set(null);
  }

  private markerStyle(box: PdfStampBox): Record<string, string> {
    const view = this.pageView;
    if (!view) return { display: 'none' };
    const r = view.boxToViewportCss(box);
    return {
      left: `${r.left}px`,
      top: `${r.top}px`,
      width: `${r.width}px`,
      height: `${r.height}px`,
      transform: this.markerRotateTransform(),
    };
  }

  private async loadDocumentPreview(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      this.pdfBytes = await this.previewSvc.build(this.documentId());
      await this.rerenderPdfPage();
    } catch (err) {
      this.loadError.set(err instanceof Error ? err.message : 'Failed to load document');
      this.loading.set(false);
    }
  }

  private async rerenderPdfPage(): Promise<void> {
    const canvas = this.pdfCanvas()?.nativeElement;
    if (!canvas || !this.pdfBytes) return;

    this.pageView?.destroy();
    this.pageView = null;
    this.loading.set(true);

    try {
      const pageNum = this.previewSvc.pdfJsPageNumber(this.documentId(), this.mdhPage());
      this.pageView = await openPdfJsPageView(
        this.pdfBytes,
        CREW_LIST_PREVIEW_CSS_PX_PER_PT,
        pageNum,
      );
      this.pageSizePt.set({
        widthPt: this.pageView.pageWidthPt,
        heightPt: this.pageView.pageHeightPt,
      });
      this.pageCssWidth.set(this.pageView.width);
      this.pageCssHeight.set(this.pageView.height);
      await this.pageView.render(canvas);
      this.dragStampBoxPage.set(null);
      this.dragSignatureBoxPage.set(null);
      this.loading.set(false);
    } catch (err) {
      this.loadError.set(err instanceof Error ? err.message : 'Failed to render page');
      this.loading.set(false);
    }
  }

  private async loadAssetPreviews(): Promise<void> {
    this.revokePreviewUrls();
    const stamp = await this.assets.loadBytes('stamp');
    const signature = await this.assets.loadBytes('signature');
    if (stamp?.length) {
      this.stampPreviewUrl.set(URL.createObjectURL(new Blob([stamp.slice()])));
    }
    if (signature?.length) {
      this.signaturePreviewUrl.set(
        URL.createObjectURL(new Blob([signature.slice()])),
      );
    }
  }

  private revokePreviewUrls(): void {
    const stamp = this.stampPreviewUrl();
    const sig = this.signaturePreviewUrl();
    if (stamp) URL.revokeObjectURL(stamp);
    if (sig) URL.revokeObjectURL(sig);
    this.stampPreviewUrl.set(null);
    this.signaturePreviewUrl.set(null);
  }

  private updateCursor(event: PointerEvent | { clientX: number; clientY: number }): void {
    const view = this.pageView;
    if (!view) return;
    const css = this.clientToPageCss(event.clientX, event.clientY);
    if (!css) {
      this.clearCursorReadout();
      return;
    }
    const pt = view.convertToPdfPoint(css.x, css.y);
    this.cursorPt.set(pt);
    this.updatePdfProbeMarker(pt);
  }

  private updatePdfProbeMarker(pt: { x: number; y: number } | null): void {
    const view = this.pageView;
    if (!pt || !view || !this.coordProbeMode()) {
      this.pdfProbeMarkerStyle.set(null);
      return;
    }
    const css = view.convertToViewportCss(pt.x, pt.y);
    const fontPx =
      OverlayPlacementPickerComponent.PDF_PROBE_FONT_PT *
      (view.width / view.pageWidthPt);
    const ascentPx = fontPx * OverlayPlacementPickerComponent.PDF_PROBE_FONT_ASCENT;
    this.pdfProbeMarkerStyle.set({
      left: `${css.x}px`,
      top: `${css.y - ascentPx}px`,
      fontSize: `${fontPx}px`,
    });
  }

  private clearCursorReadout(): void {
    this.cursorPt.set(null);
    this.pdfProbeMarkerStyle.set(null);
  }

  private clientToPageCss(clientX: number, clientY: number): { x: number; y: number } | null {
    const canvas = this.pdfCanvas()?.nativeElement;
    const view = this.pageView;
    if (!canvas || !view) return null;
    return clientToViewportCss(clientX, clientY, canvas, view);
  }

  private pointerDeltaPdf(
    canvas: HTMLCanvasElement,
    clientX: number,
    clientY: number,
    prevClientX: number,
    prevClientY: number,
  ): { dx: number; dy: number } {
    const view = this.pageView;
    if (!view) return { dx: 0, dy: 0 };
    const cur = clientToViewportCss(clientX, clientY, canvas, view);
    const prev = clientToViewportCss(prevClientX, prevClientY, canvas, view);
    if (!cur || !prev) return { dx: 0, dy: 0 };
    const curPt = view.convertToPdfPoint(cur.x, cur.y);
    const prevPt = view.convertToPdfPoint(prev.x, prev.y);
    return { dx: curPt.x - prevPt.x, dy: curPt.y - prevPt.y };
  }

  private startViewPan(event: PointerEvent): void {
    const scroll = this.placementScroll()?.nativeElement;
    if (!scroll) return;
    event.preventDefault();
    scroll.setPointerCapture(event.pointerId);
    this.viewPanning.set(true);
    this.lastPanClient = { x: event.clientX, y: event.clientY };
  }

  private moveViewPan(event: PointerEvent): void {
    const scroll = this.placementScroll()?.nativeElement;
    if (!scroll || !this.lastPanClient) return;
    const dx = event.clientX - this.lastPanClient.x;
    const dy = event.clientY - this.lastPanClient.y;
    scroll.scrollLeft -= dx;
    scroll.scrollTop -= dy;
    this.lastPanClient = { x: event.clientX, y: event.clientY };
  }

  private endViewPan(): void {
    this.viewPanning.set(false);
    this.lastPanClient = null;
  }

  private endPointerDrag(persist: boolean): void {
    if (persist) {
      const mode = this.placementMode();
      const { widthPt, heightPt } = this.pageSizePt();
      if (mode === 'stamp' && this.dragStampBoxPage()) {
        this.persistBoxes(
          stampBoxToRefCoordinates(this.dragStampBoxPage()!, widthPt, heightPt),
          undefined,
        );
      } else if (mode === 'signature' && this.dragSignatureBoxPage()) {
        this.persistBoxes(
          undefined,
          stampBoxToRefCoordinates(this.dragSignatureBoxPage()!, widthPt, heightPt),
        );
      } else if (mode === 'both') {
        this.persistBoxes(
          this.dragStampBoxPage()
            ? stampBoxToRefCoordinates(this.dragStampBoxPage()!, widthPt, heightPt)
            : undefined,
          this.dragSignatureBoxPage()
            ? stampBoxToRefCoordinates(this.dragSignatureBoxPage()!, widthPt, heightPt)
            : undefined,
        );
      }
    }
    this.pointerDragging.set(false);
    this.lastPointerClient = null;
    this.dragStampBoxPage.set(null);
    this.dragSignatureBoxPage.set(null);
    this.pointerDidMove = false;
  }

  private placeAt(mode: PlacementMode, pdfX: number, pdfY: number): void {
    const { widthPt, heightPt } = this.pageSizePt();
    const stamp = this.stampBoxOnPage();
    const signature = this.signatureBoxOnPage();

    if (mode === 'stamp') {
      const size = defaultStampSize(widthPt, heightPt);
      const onPage = stampBoxCenteredOn(pdfX, pdfY, size, widthPt, heightPt);
      this.persistBoxes(stampBoxToRefCoordinates(onPage, widthPt, heightPt), undefined);
      return;
    }

    if (mode === 'signature') {
      const size = defaultSignatureSize(widthPt, heightPt);
      const onPage = stampBoxCenteredOn(pdfX, pdfY, size, widthPt, heightPt);
      this.persistBoxes(undefined, stampBoxToRefCoordinates(onPage, widthPt, heightPt));
      return;
    }

    const stampCenter = boxCenter(stamp);
    const dx = pdfX - stampCenter.x;
    const dy = pdfY - stampCenter.y;
    this.persistBoxes(
      stampBoxToRefCoordinates(nudgeStampBox(stamp, dx, dy, widthPt, heightPt), widthPt, heightPt),
      stampBoxToRefCoordinates(
        nudgeStampBox(signature, dx, dy, widthPt, heightPt),
        widthPt,
        heightPt,
      ),
    );
  }

  private resizeLive(target: ResizeTarget, handle: StampResizeHandle, dx: number, dy: number): void {
    const { widthPt, heightPt } = this.pageSizePt();
    if (target === 'stamp') {
      const box = this.dragStampBoxPage() ?? this.stampBoxOnPage();
      this.dragStampBoxPage.set(resizeStampBox(box, handle, dx, dy, widthPt, heightPt));
      return;
    }
    const box = this.dragSignatureBoxPage() ?? this.signatureBoxOnPage();
    this.dragSignatureBoxPage.set(resizeStampBox(box, handle, dx, dy, widthPt, heightPt));
  }

  private endResize(persist: boolean): void {
    if (persist && this.pointerDidMove) {
      const { widthPt, heightPt } = this.pageSizePt();
      const target = this.activeResize()?.target;
      if (target === 'stamp' && this.dragStampBoxPage()) {
        this.persistBoxes(
          stampBoxToRefCoordinates(this.dragStampBoxPage()!, widthPt, heightPt),
          undefined,
        );
      } else if (target === 'signature' && this.dragSignatureBoxPage()) {
        this.persistBoxes(
          undefined,
          stampBoxToRefCoordinates(this.dragSignatureBoxPage()!, widthPt, heightPt),
        );
      }
    }
    this.resizing.set(false);
    this.activeResize.set(null);
    this.lastPointerClient = null;
    this.pointerDidMove = false;
    if (!persist) {
      this.dragStampBoxPage.set(null);
      this.dragSignatureBoxPage.set(null);
    }
  }

  private nudgeLive(mode: PlacementMode, dx: number, dy: number): void {
    const { widthPt, heightPt } = this.pageSizePt();
    let stamp = this.dragStampBoxPage() ?? this.stampBoxOnPage();
    let signature = this.dragSignatureBoxPage() ?? this.signatureBoxOnPage();

    if (mode === 'stamp' && this.canMoveStamp()) {
      this.dragStampBoxPage.set(nudgeStampBox(stamp, dx, dy, widthPt, heightPt));
      return;
    }
    if (mode === 'signature' && this.canMoveSignature()) {
      this.dragSignatureBoxPage.set(nudgeStampBox(signature, dx, dy, widthPt, heightPt));
      return;
    }
    if (mode === 'both') {
      if (this.canMoveStamp()) {
        this.dragStampBoxPage.set(nudgeStampBox(stamp, dx, dy, widthPt, heightPt));
      }
      if (this.canMoveSignature()) {
        this.dragSignatureBoxPage.set(nudgeStampBox(signature, dx, dy, widthPt, heightPt));
      }
    }
  }

  private nudgeBy(mode: PlacementMode, dx: number, dy: number, persist = true): void {
    const { widthPt, heightPt } = this.pageSizePt();
    const stamp = this.stampBoxOnPage();
    const signature = this.signatureBoxOnPage();

    if (mode === 'stamp' && this.canMoveStamp()) {
      const onPage = nudgeStampBox(stamp, dx, dy, widthPt, heightPt);
      if (persist) {
        this.persistBoxes(stampBoxToRefCoordinates(onPage, widthPt, heightPt), undefined);
      }
      return;
    }
    if (mode === 'signature' && this.canMoveSignature()) {
      const onPage = nudgeStampBox(signature, dx, dy, widthPt, heightPt);
      if (persist) {
        this.persistBoxes(undefined, stampBoxToRefCoordinates(onPage, widthPt, heightPt));
      }
      return;
    }
    if (mode === 'both') {
      const nextStamp = this.canMoveStamp()
        ? nudgeStampBox(stamp, dx, dy, widthPt, heightPt)
        : stamp;
      const nextSig = this.canMoveSignature()
        ? nudgeStampBox(signature, dx, dy, widthPt, heightPt)
        : signature;
      if (persist) {
        this.persistBoxes(
          stampBoxToRefCoordinates(nextStamp, widthPt, heightPt),
          stampBoxToRefCoordinates(nextSig, widthPt, heightPt),
        );
      }
    }
  }

  private persistBoxes(stampRef?: PdfStampBox, signatureRef?: PdfStampBox): void {
    const patch: Partial<DocumentStampOptions> = {};
    if (stampRef) {
      if (this.mdhAttachment()) {
        patch.stampBoxAttachment = stampRef;
      } else {
        patch.stampBox = stampRef;
      }
    }
    if (signatureRef) {
      if (this.mdhAttachment()) {
        patch.signatureBoxAttachment = signatureRef;
      } else {
        patch.signatureBox = signatureRef;
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
      this.storage.updateDocumentOverlay(
        this.documentId(),
        { overlayRotationAttachment: deg },
        'saved',
      );
    } else {
      this.storage.updateDocumentOverlay(this.documentId(), { overlayRotation: deg }, 'saved');
    }
  }

  private applyZoom(next: number, anchorClientX?: number, anchorClientY?: number): void {
    const clamped = Math.min(
      OverlayPlacementPickerComponent.ZOOM_MAX,
      Math.max(OverlayPlacementPickerComponent.ZOOM_MIN, Math.round(next * 100) / 100),
    );
    const oldZoom = this.previewZoom();
    if (clamped === oldZoom) return;

    const scroll = this.placementScroll()?.nativeElement;
    if (scroll && anchorClientX != null && anchorClientY != null) {
      const rect = scroll.getBoundingClientRect();
      const px = anchorClientX - rect.left + scroll.scrollLeft;
      const py = anchorClientY - rect.top + scroll.scrollTop;
      const ratio = clamped / oldZoom;
      this.previewZoom.set(clamped);
      scroll.scrollLeft = px * ratio - (anchorClientX - rect.left);
      scroll.scrollTop = py * ratio - (anchorClientY - rect.top);
      this.clampScroll();
      return;
    }

    this.previewZoom.set(clamped);
    this.clampScroll();
  }

  private clampScroll(): void {
    const scroll = this.placementScroll()?.nativeElement;
    if (!scroll) return;
    const maxLeft = Math.max(0, scroll.scrollWidth - scroll.clientWidth);
    const maxTop = Math.max(0, scroll.scrollHeight - scroll.clientHeight);
    scroll.scrollLeft = Math.min(maxLeft, Math.max(0, scroll.scrollLeft));
    scroll.scrollTop = Math.min(maxTop, Math.max(0, scroll.scrollTop));
  }
}
