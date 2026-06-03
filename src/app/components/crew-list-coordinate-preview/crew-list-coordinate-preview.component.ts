import {
  afterNextRender,
  Component,
  ElementRef,
  OnDestroy,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CrewListTypeId } from '../../models/document-overlay.models';
import {
  CREW_LIST_FOOTER_BAND_SRC,
  CREW_LIST_MARGIN_BOTTOM_PT,
  CREW_LIST_MARGIN_LEFT_PT,
  CREW_LIST_MARGIN_RIGHT_PT,
  CREW_LIST_MARGIN_TOP_PT,
  CREW_LIST_SRC,
  CREW_LIST_TITLE_BAND_SRC,
} from '../../services/crew-list-coordinates';
import {
  CREW_LIST_PREVIEW_CSS_PX_PER_PT,
  CrewListPdfJsPageView,
  openCrewListPdfJsPage,
} from '../../utils/crew-list-pdfjs.util';
import { A4_HEIGHT_PT, A4_WIDTH_PT } from '../../utils/overlay-stamp-box.util';

@Component({
  selector: 'app-crew-list-coordinate-preview',
  template: `
    <div class="modal-backdrop coord-preview-backdrop" (click)="close.emit()">
      <div class="coord-preview-modal" (click)="$event.stopPropagation()">
        <header class="coord-preview-header">
          <h3>Crew list — coordinate preview</h3>
          <button type="button" class="btn btn-secondary" (click)="close.emit()">Close</button>
        </header>

        @if (loadError()) {
          <p class="coord-preview-error">{{ loadError() }}</p>
        } @else {
          <p class="coord-preview-hint">
            Move the cursor over the page. Coordinates are in
            <strong>pdf-lib</strong> points (origin bottom-left) — same as
            <code>crew-list-alger-coordinates.ts</code> for Type 2.
            @if (listType() !== 'type2Alger') {
              Type 1 is drawn with jsPDF (top-left); use the second line for layout source coords.
            }
            Click to copy.
          </p>
          <div class="coord-preview-readout" aria-live="polite">
            @if (coords()) {
              <span class="coord-preview-readout-main">
                x: {{ coords()!.x }}, y: {{ coords()!.y }}
              </span>
              @if (layoutCoords()) {
                <span class="coord-preview-readout-sub">
                  layout (top-left src): x: {{ layoutCoords()!.x }}, y: {{ layoutCoords()!.y }}
                </span>
              }
            } @else {
              <span class="coord-preview-readout-muted">—</span>
            }
          </div>
          <div class="coord-preview-scroll">
            @if (loading()) {
              <p class="coord-preview-loading">Loading PDF…</p>
            }
            <canvas
              #pdfCanvas
              class="coord-preview-canvas"
              [class.coord-preview-canvas--hidden]="loading()"
              (pointermove)="onPointerMove($event)"
              (pointerleave)="onPointerLeave()"
              (click)="onCanvasClick($event)"
            ></canvas>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    .coord-preview-backdrop {
      z-index: 130;
    }

    .coord-preview-modal {
      background: var(--surface);
      border-radius: 12px;
      padding: 1rem 1.25rem 1.25rem;
      max-width: min(96vw, 1200px);
      width: 100%;
      max-height: 94vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 50px rgb(0 0 0 / 22%);
    }

    .coord-preview-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      margin-bottom: 0.65rem;
    }

    .coord-preview-header h3 {
      margin: 0;
      font-size: 1.05rem;
    }

    .coord-preview-hint {
      margin: 0 0 0.5rem;
      font-size: 0.8rem;
      color: var(--text-muted);
      line-height: 1.45;
    }

    .coord-preview-hint code {
      font-size: 0.75rem;
    }

    .coord-preview-readout {
      margin: 0 0 0.65rem;
      padding: 0.45rem 0.65rem;
      background: #f1f5f9;
      border-radius: 6px;
      font-family: ui-monospace, 'Cascadia Code', monospace;
      font-size: 0.88rem;
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }

    .coord-preview-readout-main {
      font-weight: 600;
      color: #0f172a;
    }

    .coord-preview-readout-sub {
      font-size: 0.78rem;
      color: #64748b;
    }

    .coord-preview-readout-muted {
      color: #94a3b8;
    }

    .coord-preview-scroll {
      overflow: auto;
      flex: 1;
      min-height: 0;
      background: #e2e8f0;
      border-radius: 8px;
      padding: 0.75rem;
      display: flex;
      justify-content: center;
    }

    .coord-preview-canvas {
      display: block;
      cursor: crosshair;
      box-shadow: 0 2px 12px rgb(15 23 42 / 18%);
      touch-action: none;
    }

    .coord-preview-canvas--hidden {
      visibility: hidden;
      pointer-events: none;
    }

    .coord-preview-scroll .coord-preview-loading {
      margin: 2rem auto;
      text-align: center;
    }

    .coord-preview-loading,
    .coord-preview-error {
      margin: 1rem 0;
      font-size: 0.9rem;
    }

    .coord-preview-error {
      color: #b91c1c;
    }
  `,
})
export class CrewListCoordinatePreviewComponent implements OnDestroy {
  readonly pdfBytes = input.required<Uint8Array>();
  readonly listType = input.required<CrewListTypeId>();
  readonly close = output<void>();

  private readonly pdfCanvas = viewChild<ElementRef<HTMLCanvasElement>>('pdfCanvas');

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly coords = signal<{ x: number; y: number } | null>(null);
  protected readonly layoutCoords = signal<{ x: number; y: number } | null>(null);

  private pageView: CrewListPdfJsPageView | null = null;
  private renderStarted = false;

  constructor() {
    afterNextRender(() => {
      if (this.renderStarted) return;
      this.renderStarted = true;
      void this.renderPdf();
    });
  }

  ngOnDestroy(): void {
    this.pageView?.destroy();
    this.pageView = null;
  }

  protected onPointerMove(event: PointerEvent): void {
    this.updateCoordsFromEvent(event);
  }

  protected onPointerLeave(): void {
    this.coords.set(null);
    this.layoutCoords.set(null);
  }

  protected onCanvasClick(event: PointerEvent): void {
    const pt = this.updateCoordsFromEvent(event);
    if (!pt) return;
    const text = `x: ${pt.x}, y: ${pt.y}`;
    void navigator.clipboard?.writeText(text).catch(() => {});
  }

  private updateCoordsFromEvent(event: PointerEvent): { x: number; y: number } | null {
    const view = this.pageView;
    const canvas = this.pdfCanvas()?.nativeElement;
    if (!view || !canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const cssX = event.clientX - rect.left;
    const cssY = event.clientY - rect.top;
    if (cssX < 0 || cssY < 0 || cssX > rect.width || cssY > rect.height) {
      this.coords.set(null);
      this.layoutCoords.set(null);
      return null;
    }

    const pt = view.convertToPdfPoint(cssX, cssY);
    this.coords.set(pt);

    if (this.listType() !== 'type2Alger') {
      this.layoutCoords.set(pdfLibToCrewListLayoutSrc(pt.x, pt.y));
    } else {
      this.layoutCoords.set(null);
    }

    return pt;
  }

  private async renderPdf(): Promise<void> {
    const canvas = this.pdfCanvas()?.nativeElement;
    if (!canvas) {
      this.loadError.set('Canvas not ready');
      this.loading.set(false);
      return;
    }

    try {
      this.pageView = await openCrewListPdfJsPage(this.pdfBytes());
      await this.pageView.render(canvas);
      this.loading.set(false);
    } catch (err) {
      this.loadError.set(err instanceof Error ? err.message : 'Failed to render PDF');
      this.loading.set(false);
    }
  }
}

/** Inverse of createCoordScale for Type 1 layout (top-left source space). */
function pdfLibToCrewListLayoutSrc(pdfX: number, pdfLibY: number): { x: number; y: number } {
  const jspdfY = A4_HEIGHT_PT - pdfLibY;
  const srcW = CREW_LIST_SRC.maxX - CREW_LIST_SRC.minX;
  const srcH =
    CREW_LIST_SRC.maxY -
    CREW_LIST_SRC.minY +
    CREW_LIST_TITLE_BAND_SRC +
    CREW_LIST_FOOTER_BAND_SRC;
  const usableW = A4_WIDTH_PT - CREW_LIST_MARGIN_LEFT_PT - CREW_LIST_MARGIN_RIGHT_PT;
  const usableH = A4_HEIGHT_PT - CREW_LIST_MARGIN_TOP_PT - CREW_LIST_MARGIN_BOTTOM_PT;
  const s = Math.min(usableW / srcW, usableH / srcH);

  const srcX = CREW_LIST_SRC.minX + (pdfX - CREW_LIST_MARGIN_LEFT_PT) / s;
  const srcY =
    CREW_LIST_SRC.minY -
    CREW_LIST_TITLE_BAND_SRC +
    (jspdfY - CREW_LIST_MARGIN_TOP_PT) / s;

  return { x: Math.round(srcX), y: Math.round(srcY) };
}
