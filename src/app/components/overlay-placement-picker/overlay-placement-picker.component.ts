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
  CrewEffectStampOptions,
  DOCUMENT_OVERLAY_LABELS,
  documentUsesSignature,
  documentUsesStamp,
  DocumentOverlayId,
  DocumentStampOptions,
  resolveCrewListStampOptions,
} from '../../models/document-overlay.models';
import { CrewMember, formatCrewListName } from '../../models/crew.models';
import { CrewSignatureService } from '../../services/crew-signature.service';
import {
  CREW_EFFECT_SIGNATURE_FORM_CONFIG,
  crewEffectSignatureBase,
  isCrewEffectOverlayId,
  resolveCrewSignatureBox,
  type CrewEffectOverlayId,
} from '../../utils/crew-effect-signature.util';
import { passengersToCrewRows } from '../../utils/passenger-pdf.util';
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
  fittedAssetRectInBox,
  normalizeOverlayRotation,
  nudgeStampBox,
  resizeStampBox,
  scaleStampBoxToPage,
  stampBoxCenteredOn,
  stampBoxToRefCoordinates,
  STAMP_RESIZE_HANDLES,
  type StampResizeHandle,
} from '../../utils/overlay-stamp-box.util';

type MarkerDragTarget = 'stamp' | 'signature' | 'crewTableSig';

@Component({
  selector: 'app-overlay-placement-picker',
  imports: [FormsModule, DecimalPipe, NgStyle, ClickOutsideDirective],
  template: `
    <div class="modal-backdrop placement-backdrop">
      <div
        class="placement-modal"
        [class.placement-modal--crew-effect]="isCrewEffectDoc() && !mdhAttachment()"
        tabindex="0"
        #modalHost
        appClickOutside
        (appClickOutside)="close.emit()"
        (click)="$event.stopPropagation()"
        (keydown)="onKeydown($event)"
      >
        <header class="placement-header">
          <h3>{{ modalTitle() }}</h3>
          @if (isCrewEffectDoc() && !mdhAttachment()) {
            <p class="placement-subtitle">
              Three independent layers — drag the frame you need on the preview.
            </p>
          }
        </header>

        @if (documentId() === 'mdh' || documentId() === 'shipStores03' || documentId() === 'crewEffect03') {
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
              Page 2
            </button>
          </div>
        }

        <section
          class="placement-toolbar"
          [class.placement-toolbar--crew-effect]="isCrewEffectDoc() && !mdhAttachment()"
        >
          <div class="placement-toolbar__primary">
            <div class="placement-toggles">
              <label class="placement-toggle placement-toggle--stamp">
                <input
                  type="checkbox"
                  [ngModel]="useStampChecked()"
                  (ngModelChange)="onToggle('useStamp', $event)"
                />
                <span class="placement-toggle__text">{{ isCrewEffectDoc() ? 'Ship stamp' : 'Stamp' }}</span>
              </label>
              <label class="placement-toggle placement-toggle--captain">
                <input
                  type="checkbox"
                  [ngModel]="useSignatureChecked()"
                  (ngModelChange)="onToggle('useSignature', $event)"
                />
                <span class="placement-toggle__text">{{ isCrewEffectDoc() ? 'Captain' : 'Signature' }}</span>
              </label>
              @if (isCrewEffectDoc() && !mdhAttachment()) {
                <label class="placement-toggle placement-toggle--crew">
                  <input
                    type="checkbox"
                    [ngModel]="useCrewTableSignatures()"
                    (ngModelChange)="onToggleCrewTableSig($event)"
                  />
                  <span class="placement-toggle__text">Crew</span>
                </label>
              }
            </div>

            @if (isCrewEffectDoc() && !mdhAttachment() && useCrewTableSignatures()) {
              <label class="placement-row-pick">
                <select [ngModel]="crewTableRow()" (ngModelChange)="onCrewTableRowChange($event)">
                  @for (row of crewTableRowLabels(); track row.index) {
                    <option [ngValue]="row.index">
                      {{ row.label }}{{ row.hasSignature ? '' : ' (no signature)' }}
                    </option>
                  }
                </select>
              </label>
              <label class="placement-crew-all">
                <input
                  type="checkbox"
                  [ngModel]="showAllCrewSigPreviews()"
                  (ngModelChange)="onToggleShowAllCrewSigs($event)"
                />
                <span>All signatures</span>
              </label>
            }
          </div>

          <div class="placement-toolbar__secondary">
            <div class="placement-tool-group">
              <span class="placement-tool-group__label">Rotation</span>
              <div class="placement-tool-group__controls" role="group" aria-label="Stamp rotation">
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
            </div>

            <div class="placement-tool-group placement-tool-group--zoom" role="group" aria-label="Preview zoom">
              <span class="placement-tool-group__label">Zoom</span>
              <div class="placement-tool-group__controls">
                <button type="button" class="placement-pill placement-pill--narrow" (click)="zoomOut()" aria-label="Zoom out">−</button>
                <span class="placement-zoom-label">{{ zoomPercent() }}%</span>
                <button type="button" class="placement-pill placement-pill--narrow" (click)="zoomIn()" aria-label="Zoom in">+</button>
                <button type="button" class="placement-pill placement-pill--fit" (click)="resetZoom()">Fit</button>
              </div>
            </div>
          </div>

          @if (isCrewEffectDoc() && !mdhAttachment()) {
            <p class="placement-toolbar__hint">
              Wheel to zoom · drag empty area to pan · All signatures shows other rows without frames
            </p>
          }
        </section>

        @if (!isCrewEffectDoc() || mdhAttachment()) {
          <p class="placement-hint">{{ placementHint() }}</p>
        }

        @if (loadError()) {
          <p class="placement-error">{{ loadError() }}</p>
        } @else {
          @if (isCrewEffectDoc() && !mdhAttachment()) {
            <div class="placement-metrics" aria-live="polite">
              <div class="placement-metric placement-metric--cursor">
                <span class="placement-metric__title">Cursor</span>
                <span class="placement-metric__value">
                  {{ cursorPt()?.x != null ? (cursorPt()!.x | number: '1.0-1') : '—' }},
                  {{ cursorPt()?.y != null ? (cursorPt()!.y | number: '1.0-1') : '—' }}
                </span>
              </div>
              @if (useStampChecked() && stampBoxOnPage(); as stamp) {
                <div class="placement-metric placement-metric--stamp">
                  <span class="placement-metric__title">Ship stamp</span>
                  <span class="placement-metric__value">
                    {{ stamp.x | number: '1.0-1' }}, {{ stamp.y | number: '1.0-1' }} ·
                    {{ stamp.width | number: '1.0-1' }}×{{ stamp.height | number: '1.0-1' }} pt
                  </span>
                </div>
              }
              @if (useSignatureChecked() && signatureBoxOnPage(); as sig) {
                <div class="placement-metric placement-metric--captain">
                  <span class="placement-metric__title">Captain</span>
                  <span class="placement-metric__value">
                    {{ sig.x | number: '1.0-1' }}, {{ sig.y | number: '1.0-1' }} ·
                    {{ sig.width | number: '1.0-1' }}×{{ sig.height | number: '1.0-1' }} pt
                  </span>
                </div>
              }
              @if (showCrewTableSigMarker() && crewTableSigBoxOnPage(); as crewSig) {
                <div class="placement-metric placement-metric--crew">
                  <span class="placement-metric__title">{{ crewTableRowMetricLabel() }}</span>
                  <span class="placement-metric__value">
                    {{ crewSig.x | number: '1.0-1' }}, {{ crewSig.y | number: '1.0-1' }} ·
                    {{ crewSig.width | number: '1.0-1' }}×{{ crewSig.height | number: '1.0-1' }} pt
                  </span>
                </div>
              }
            </div>
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
              <button type="button" class="placement-pill" (click)="resetZoom()">Fit</button>
            </div>
          }

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
                    [class.placement-overlay--draggable]="false"
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
                @if (useStampChecked()) {
                  <div
                    class="placement-marker placement-marker--stamp"
                    [class.placement-marker--active]="true"
                    [class.placement-marker--resizable]="true"
                    [ngStyle]="stampOverlayStyle()"
                    (pointerdown)="onMarkerPointerDown('stamp', $event)"
                  >
                    @if (stampPreviewUrl()) {
                      <img [src]="stampPreviewUrl()" alt="" class="placement-marker-img" />
                    }
                    @for (h of resizeHandles; track h) {
                      <span
                        class="placement-handle placement-handle--stamp placement-handle--{{ h }}"
                        [attr.aria-label]="'Resize stamp ' + h"
                        (pointerdown)="onHandlePointerDown($event, 'stamp', h)"
                      ></span>
                    }
                  </div>
                }
                @if (useSignatureChecked()) {
                  <div
                    class="placement-marker placement-marker--sig"
                    [class.placement-marker--active]="true"
                    [class.placement-marker--resizable]="true"
                    [ngStyle]="signatureOverlayStyle()"
                    (pointerdown)="onMarkerPointerDown('signature', $event)"
                  >
                    @if (signaturePreviewUrl()) {
                      <img [src]="signaturePreviewUrl()" alt="" class="placement-marker-img" />
                    }
                    @for (h of resizeHandles; track h) {
                      <span
                        class="placement-handle placement-handle--sig placement-handle--{{ h }}"
                        [attr.aria-label]="'Resize signature ' + h"
                        (pointerdown)="onHandlePointerDown($event, 'signature', h)"
                      ></span>
                    }
                  </div>
                }
                @if (showAllCrewSigPreviews()) {
                  @for (ghost of crewSigGhostMarkers(); track ghost.rowIndex) {
                    <div
                      class="placement-marker placement-marker--crew-sig-ghost"
                      [ngStyle]="ghost.style"
                      aria-hidden="true"
                    >
                      @if (ghost.previewUrl) {
                        <img [src]="ghost.previewUrl" alt="" class="placement-marker-img" />
                      }
                    </div>
                  }
                }
                @if (showCrewTableSigMarker()) {
                  <div
                    class="placement-marker placement-marker--crew-sig placement-marker--crew-sig-active"
                    [class.placement-marker--active]="true"
                    [class.placement-marker--resizable]="true"
                    [ngStyle]="crewTableSigOverlayStyle()"
                    (pointerdown)="onMarkerPointerDown('crewTableSig', $event)"
                  >
                    @if (crewTableSigPreviewUrl(); as previewUrl) {
                      <img [src]="previewUrl" alt="" class="placement-marker-img" />
                    }
                    @for (h of resizeHandles; track h) {
                      <span
                        class="placement-handle placement-handle--crew-sig placement-handle--{{ h }}"
                        [attr.aria-label]="'Resize crew signature ' + h"
                        (pointerdown)="onHandlePointerDown($event, 'crewTableSig', h)"
                      ></span>
                    }
                  </div>
                }
              </div>
            </div>
            </div>
            </div>
          </div>
        }

        @if (isCrewEffectDoc() && !mdhAttachment()) {
          <p class="placement-coords placement-coords--compact">
            Coordinates in pdf-lib points (bottom-left origin). Preview {{ zoomPercent() }}%, rotation {{ rotation() }}°.
          </p>
        } @else {
          <p class="placement-coords">
            Base 96 dpi, preview {{ zoomPercent() }}% — {{ moveTargetLabel() }}, rotation {{ rotation() }}°.
            Values match pdf-lib <code>drawText</code> (x, y from bottom-left). y from top = page height − y.
          </p>
        }

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

    .placement-header {
      margin-bottom: 0.85rem;
    }

    .placement-header h3 {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 650;
      letter-spacing: -0.01em;
    }

    .placement-subtitle {
      margin: 0.35rem 0 0;
      font-size: 0.84rem;
      color: var(--text-muted);
      line-height: 1.4;
    }

    .placement-toolbar {
      display: flex;
      flex-direction: column;
      gap: 0;
      margin-bottom: 0.85rem;
    }

    .placement-toolbar--crew-effect {
      padding: 0.65rem 0.85rem;
      background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
      border: 1px solid var(--border);
      border-radius: 10px;
      gap: 0;
    }

    .placement-toolbar__primary {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.45rem 0.65rem;
    }

    .placement-toolbar__secondary {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: 0.65rem 1.5rem;
      margin-top: 0.75rem;
      padding-top: 0.75rem;
      border-top: 1px solid rgb(148 163 184 / 22%);
    }

    .placement-toolbar__hint {
      margin: 0.65rem 0 0;
      padding-top: 0.55rem;
      border-top: 1px dashed rgb(148 163 184 / 35%);
      font-size: 0.76rem;
      color: var(--text-muted);
      line-height: 1.35;
    }

    .placement-toggles {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: stretch;
      border: 1px solid var(--border);
      border-radius: 6px;
      overflow: hidden;
      background: #fff;
    }

    .placement-toggle {
      display: inline-flex;
      align-items: center;
      margin: 0;
      padding: 0;
      border: none;
      border-radius: 0;
      background: transparent;
      cursor: pointer;
      user-select: none;
    }

    .placement-toggle + .placement-toggle {
      border-left: 1px solid var(--border);
    }

    .placement-toggle input {
      position: absolute;
      opacity: 0;
      width: 0;
      height: 0;
      margin: 0;
      pointer-events: none;
    }

    .placement-toggle__text {
      display: block;
      padding: 0.2rem 0.48rem;
      font-size: 0.74rem;
      font-weight: 500;
      line-height: 1.15;
      color: var(--text-muted);
      white-space: nowrap;
      transition:
        background 0.12s ease,
        color 0.12s ease;
    }

    .placement-toggle:hover .placement-toggle__text {
      background: #f1f5f9;
      color: var(--text);
    }

    .placement-toggle--stamp:has(input:checked) .placement-toggle__text {
      background: rgb(220 38 38 / 14%);
      color: #991b1b;
      font-weight: 600;
    }

    .placement-toggle--captain:has(input:checked) .placement-toggle__text {
      background: rgb(3 105 161 / 14%);
      color: #075985;
      font-weight: 600;
    }

    .placement-toggle--crew:has(input:checked) .placement-toggle__text {
      background: rgb(124 58 237 / 14%);
      color: #5b21b6;
      font-weight: 600;
    }

    .placement-toggle:has(input:focus-visible) .placement-toggle__text {
      outline: 2px solid var(--accent-soft);
      outline-offset: -2px;
    }

    .placement-row-pick {
      display: inline-flex;
      align-items: center;
      margin: 0;
      padding: 0;
      background: #fff;
      border: 1px solid rgb(124 58 237 / 40%);
      border-radius: 6px;
      font-size: 0.74rem;
      line-height: 1.15;
      overflow: hidden;
    }

    .placement-row-pick select {
      border: none;
      background: transparent;
      font: inherit;
      font-weight: 500;
      color: #4c1d95;
      padding: 0.2rem 0.45rem;
      max-width: 14rem;
      cursor: pointer;
      outline: none;
    }

    .placement-crew-all {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      margin: 0;
      font-size: 0.74rem;
      font-weight: 500;
      color: #5b21b6;
      cursor: pointer;
      user-select: none;
    }

    .placement-crew-all input {
      width: 0.85rem;
      height: 0.85rem;
      margin: 0;
      accent-color: #7c3aed;
    }

    .placement-tool-group {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .placement-tool-group__label {
      font-size: 0.68rem;
      font-weight: 650;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
    }

    .placement-tool-group__controls {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.3rem;
    }

    .placement-metrics {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      margin: 0 0 0.55rem;
    }

    .placement-metric {
      flex: 1 1 8.5rem;
      min-width: 0;
      padding: 0.38rem 0.55rem;
      border-radius: 8px;
      border: 1px solid;
      display: flex;
      flex-direction: column;
      gap: 0.12rem;
    }

    .placement-metric__title {
      font-size: 0.68rem;
      font-weight: 650;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .placement-metric__value {
      font-family: ui-monospace, 'Cascadia Code', monospace;
      font-size: 0.72rem;
      font-variant-numeric: tabular-nums;
      line-height: 1.35;
      color: #334155;
    }

    .placement-metric--stamp {
      border-color: rgb(220 38 38 / 32%);
      background: rgb(220 38 38 / 5%);
    }

    .placement-metric--stamp .placement-metric__title {
      color: #dc2626;
    }

    .placement-metric--captain {
      border-color: rgb(3 105 161 / 32%);
      background: rgb(3 105 161 / 5%);
    }

    .placement-metric--captain .placement-metric__title {
      color: #0369a1;
    }

    .placement-metric--crew {
      border-color: rgb(124 58 237 / 32%);
      background: rgb(124 58 237 / 5%);
    }

    .placement-metric--crew .placement-metric__title {
      color: #7c3aed;
    }

    .placement-metric--cursor {
      border-color: rgb(100 116 139 / 32%);
      background: rgb(100 116 139 / 6%);
      flex: 0 1 7.5rem;
    }

    .placement-metric--cursor .placement-metric__title {
      color: #64748b;
    }

    .placement-modal--crew-effect .placement-scroll {
      max-height: min(72vh, 860px);
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

    .placement-pill {
      padding: 0.22rem 0.42rem;
      border: 1px solid var(--border);
      border-radius: 5px;
      background: #fff;
      font: inherit;
      font-size: 0.72rem;
      cursor: pointer;
    }

    .placement-pill--narrow {
      min-width: 2.1rem;
      text-align: center;
      padding-left: 0.3rem;
      padding-right: 0.3rem;
    }

    .placement-pill--active {
      background: var(--accent-soft);
      border-color: var(--accent);
      color: var(--accent);
      font-weight: 600;
    }

    .placement-pill--fit {
      margin-left: 0.1rem;
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
      min-width: 2.6rem;
      text-align: center;
      font-size: 0.72rem;
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
      z-index: 5;
    }

    .placement-marker--stamp {
      border: 2px dashed #dc2626;
      background: rgb(220 38 38 / 6%);
    }

    .placement-marker--sig {
      border: 1px dashed #0369a1;
      background: rgb(3 105 161 / 8%);
    }

    .placement-marker--stamp,
    .placement-marker--sig {
      pointer-events: auto;
      opacity: 1;
      cursor: grab;
    }

    .placement-marker--stamp:active,
    .placement-marker--sig:active {
      cursor: grabbing;
    }

    .placement-marker--crew-sig-active {
      border: 2px dashed #7c3aed;
      background: rgb(124 58 237 / 8%);
      pointer-events: auto;
      opacity: 1;
      cursor: grab;
      display: block;
      overflow: visible;
    }

    .placement-marker--crew-sig-ghost {
      pointer-events: none;
      opacity: 0.42;
      z-index: 3;
      border: none;
      background: none;
      display: block;
      overflow: visible;
    }

    .placement-marker--crew-sig-active:active {
      cursor: grabbing;
    }

    .placement-marker--crew-sig-active .placement-marker-img,
    .placement-marker--crew-sig-ghost .placement-marker-img {
      width: 100%;
      height: 100%;
      object-fit: fill;
      display: block;
    }

    .placement-handle--crew-sig {
      background: #7c3aed;
      border: 1px solid #fff;
    }

    .placement-marker-img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      pointer-events: none;
    }

    .placement-marker--resizable {
      pointer-events: auto;
    }

    .placement-marker--resizable .placement-marker-img {
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

    .placement-coords--compact {
      margin: 0 0 0.85rem;
      padding: 0.45rem 0.65rem;
      background: #f8fafc;
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 0.74rem;
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
  readonly appendPassengers = input(false);
  readonly close = output<void>();

  protected readonly rotations = OVERLAY_ROTATIONS;
  protected readonly resizeHandles = STAMP_RESIZE_HANDLES;

  private readonly storage = inject(StorageService);
  private readonly previewSvc = inject(DocumentOverlayPreviewService);
  private readonly assets = inject(ShipAssetsService);
  private readonly crewSignatures = inject(CrewSignatureService);
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
    target: MarkerDragTarget;
    handle: StampResizeHandle;
  } | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly cursorPt = signal<{ x: number; y: number } | null>(null);
  protected readonly pdfProbeMarkerStyle = signal<Record<string, string> | null>(null);
  protected readonly stampPreviewUrl = signal<string | null>(null);
  protected readonly signaturePreviewUrl = signal<string | null>(null);
  protected readonly crewTableSigPreviewUrls = signal<Map<number, string>>(new Map());
  protected readonly crewTableSigAspectRatios = signal<Map<number, number>>(new Map());
  protected readonly crewTableRow = signal(0);
  protected readonly showAllCrewSigPreviews = signal(false);

  protected readonly crewTableSigPreviewUrl = computed(
    () => this.crewTableSigPreviewUrls().get(this.crewTableRow()) ?? null,
  );

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
    () => !this.markerDragging() && !this.viewPanning() && !this.resizing(),
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
  private readonly dragCrewTableSigBoxPage = signal<PdfStampBox | null>(null);
  private readonly markerDragging = signal<MarkerDragTarget | null>(null);
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
    void this.loadCrewTableSigPreview();
  }

  ngOnDestroy(): void {
    this.endResize(false);
    this.endPointerDrag(false);
    this.endMarkerDrag(false);
    this.pageView?.destroy();
    this.pageView = null;
    this.revokePreviewUrls();
  }

  protected readonly isCrewEffectDoc = computed(() => isCrewEffectOverlayId(this.documentId()));

  protected readonly crewEffectOverlayId = computed((): CrewEffectOverlayId => {
    const id = this.documentId();
    if (id === 'crewEffect02' || id === 'crewEffect03') return id;
    return 'crewEffect';
  });

  protected readonly crewEffectOptions = computed((): CrewEffectStampOptions => {
    const id = this.crewEffectOverlayId();
    return this.storage.documentOverlay()[id];
  });

  protected readonly crewEffectListRows = computed((): CrewMember[] => {
    const max = CREW_EFFECT_SIGNATURE_FORM_CONFIG[this.crewEffectOverlayId()].rowCount;
    const crew = this.storage.activeCrewArrival().slice(0, max);
    if (!this.appendPassengers()) return crew;
    const remaining = max - crew.length;
    if (remaining <= 0) return crew;
    const passengers = passengersToCrewRows(this.storage.activePassengersArrival()).slice(
      0,
      remaining,
    );
    return [...crew, ...passengers];
  });

  protected readonly useCrewTableSignatures = computed(
    () => this.isCrewEffectDoc() && !!this.crewEffectOptions().useCrewSignatures,
  );

  protected readonly crewTableRowLabels = computed(() =>
    this.crewEffectListRows().map((m, i) => ({
      index: i,
      label: `${i + 1} — ${formatCrewListName(m)}`,
      hasSignature: !!m.hasSignature,
    })),
  );

  protected readonly showCrewTableSigMarker = computed(
    () => this.useCrewTableSignatures() && !this.mdhAttachment(),
  );

  protected readonly crewTableSigBoxOnPage = computed((): PdfStampBox | null => {
    const drag = this.dragCrewTableSigBoxPage();
    const raw = drag ?? this.resolveCrewTableSigRawBox(this.crewTableRow());
    if (!raw || !this.showCrewTableSigMarker()) return null;
    return this.tightCrewTableSigBox(raw, this.crewTableRow());
  });

  protected readonly crewSigGhostMarkers = computed(() => {
    if (!this.showAllCrewSigPreviews() || !this.showCrewTableSigMarker()) return [];
    const activeRow = this.crewTableRow();
    const previews = this.crewTableSigPreviewUrls();
    const markers: { rowIndex: number; previewUrl: string | null; style: Record<string, string> }[] = [];
    for (const row of this.crewTableRowLabels()) {
      if (row.index === activeRow || !row.hasSignature) continue;
      const raw = this.resolveCrewTableSigRawBox(row.index);
      if (!raw) continue;
      const box = this.tightCrewTableSigBox(raw, row.index);
      markers.push({
        rowIndex: row.index,
        previewUrl: previews.get(row.index) ?? null,
        style: this.markerStyle(box),
      });
    }
    return markers;
  });

  protected readonly crewTableSigOverlayStyle = computed(() => {
    const box = this.dragCrewTableSigBoxPage() ?? this.crewTableSigBoxOnPage();
    if (!box) return { display: 'none' };
    return this.markerStyle(box);
  });

  protected crewTableRowMetricLabel(): string {
    const row = this.crewTableRowLabels().find((r) => r.index === this.crewTableRow());
    return row?.label ?? `${this.crewTableRow() + 1}`;
  }

  protected modalTitle(): string {
    if (this.isCrewEffectDoc()) {
      return `Stamp & signatures — ${this.docLabel()}`;
    }
    return `Stamp & signature — ${this.docLabel()}`;
  }

  protected onCrewTableRowChange(index: number): void {
    this.crewTableRow.set(index);
    void this.loadCrewSigPreviewForRow(index);
  }

  protected onToggleShowAllCrewSigs(checked: boolean): void {
    this.showAllCrewSigPreviews.set(checked);
    if (checked) {
      void this.loadAllCrewSigPreviews();
    }
  }

  protected onToggleCrewTableSig(value: boolean): void {
    this.storage.updateDocumentOverlay(
      this.crewEffectOverlayId(),
      { useCrewSignatures: value },
      'saved',
    );
  }

  protected readonly mdhAttachment = computed(() => {
    const id = this.documentId();
    return (
      (id === 'mdh' || id === 'shipStores03' || id === 'crewEffect03') &&
      this.mdhPage() === 'attachment'
    );
  });

  protected readonly multiPageDoc = computed(() => {
    const id = this.documentId();
    return id === 'mdh' || id === 'shipStores03' || id === 'crewEffect03';
  });

  protected useStampChecked = computed(() =>
    documentUsesStamp(this.options(), this.multiPageDoc() && this.mdhAttachment()),
  );

  protected useSignatureChecked = computed(() =>
    documentUsesSignature(this.options(), this.multiPageDoc() && this.mdhAttachment()),
  );

  protected markerRotateTransform = computed(() => `rotate(${this.rotation()}deg)`);

  protected placementHint = computed(() => {
    if (this.isCrewEffectDoc() && !this.mdhAttachment()) {
      return 'Each checkbox shows its own frame — drag only the frame you need. Purple = crew row from the list. Wheel zoom; drag empty area to pan.';
    }
    return 'Drag a visible frame to move it; drag edges/corners to resize. Wheel zoom; drag empty area to pan.';
  });

  protected moveTargetLabel = computed(() => {
    const target = this.markerDragging();
    if (target === 'stamp') return 'Moving ship stamp';
    if (target === 'signature') return 'Moving captain signature';
    if (target === 'crewTableSig') return 'Moving crew row signature';
    return 'Coordinates only';
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
    if (!this.viewPanning()) {
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
    const drag = this.dragStampBoxPage();
    if (drag) return clampStampBox(drag, widthPt, heightPt);
    const ref = this.stampBoxRef();
    return clampStampBox(scaleStampBoxToPage(ref, widthPt, heightPt), widthPt, heightPt);
  });

  protected signatureBoxOnPage = computed(() => {
    const { widthPt, heightPt } = this.pageSizePt();
    const drag = this.dragSignatureBoxPage();
    if (drag) return clampStampBox(drag, widthPt, heightPt);
    const ref = this.signatureBoxRef();
    const scaled = scaleStampBoxToPage(ref, widthPt, heightPt);
    return clampStampBox(scaled, widthPt, heightPt);
  });

  protected stampOverlayStyle = computed(() => this.markerStyle(this.stampBoxOnPage()));
  protected signatureOverlayStyle = computed(() => this.markerStyle(this.signatureBoxOnPage()));

  protected onToggle(field: 'useStamp' | 'useSignature', value: boolean): void {
    const attachment = this.multiPageDoc() && this.mdhAttachment();
    const patch: Partial<DocumentStampOptions> =
      field === 'useStamp'
        ? attachment
          ? { useStampAttachment: value }
          : { useStamp: value }
        : attachment
          ? { useSignatureAttachment: value }
          : { useSignature: value };
    this.storage.updateDocumentOverlay(this.documentId(), patch, 'saved');
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
    target: MarkerDragTarget,
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
    } else if (target === 'signature') {
      this.dragSignatureBoxPage.set(this.signatureBoxOnPage());
    } else {
      this.dragCrewTableSigBoxPage.set(this.crewTableSigBoxOnPage());
    }
  }

  protected onMarkerPointerDown(target: MarkerDragTarget, event: PointerEvent): void {
    if (event.button !== 0 || this.resizing()) return;
    event.stopPropagation();
    event.preventDefault();

    const overlay = this.placementOverlay()?.nativeElement;
    if (!overlay) return;
    overlay.setPointerCapture(event.pointerId);

    this.markerDragging.set(target);
    this.pointerDidMove = false;
    this.lastPointerClient = { x: event.clientX, y: event.clientY };
    this.initDragBoxForTarget(target);
  }

  private moveMarkerDrag(event: PointerEvent): void {
    const dragging = this.markerDragging();
    if (!dragging || !this.lastPointerClient || !this.pageView) return;
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
    const { widthPt, heightPt } = this.pageSizePt();
    const box = this.dragBoxForTarget(dragging) ?? this.boxOnPageForTarget(dragging);
    if (!box) return;
    this.setDragBoxForTarget(dragging, nudgeStampBox(box, dx, dy, widthPt, heightPt));
  }

  protected onOverlayPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    if (this.resizing()) return;
    this.startViewPan(event);
  }

  protected onOverlayPointerMove(event: PointerEvent): void {
    if (this.markerDragging()) {
      this.moveMarkerDrag(event);
      this.updateCursor(event);
      return;
    }

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
  }

  protected onOverlayPointerLeave(): void {
    this.clearCursorReadout();
  }

  protected onOverlayPointerUp(event: PointerEvent): void {
    if (this.viewPanning()) {
      this.onScrollPointerUp(event);
      return;
    }

    if (this.markerDragging()) {
      const el = this.placementOverlay()?.nativeElement;
      if (el?.hasPointerCapture(event.pointerId)) {
        el.releasePointerCapture(event.pointerId);
      }
      this.endMarkerDrag(this.pointerDidMove);
      return;
    }

    if (this.resizing()) {
      const el = this.placementOverlay()?.nativeElement;
      if (el?.hasPointerCapture(event.pointerId)) {
        el.releasePointerCapture(event.pointerId);
      }
      this.endResize(true);
    }
  }

  protected onKeydown(_event: KeyboardEvent): void {
    // Arrow-key nudge removed — drag each frame independently.
  }

  protected resetToDefault(): void {
    const stamp = defaultStampBoxForDocument(
      this.documentId(),
      this.mdhAttachment() ? 'attachment' : 'form',
    );
    const signature = defaultSignatureBoxFromStamp(stamp, A4_HEIGHT_PT);
    this.persistBoxes(stamp, signature);

    if (this.isCrewEffectDoc() && !this.mdhAttachment()) {
      this.storage.updateDocumentOverlay(
        this.crewEffectOverlayId(),
        { useCrewSignatures: false, crewSignatureByRow: {}, crewSignatureBase: undefined },
        'saved',
      );
    }

    const rot: OverlayRotation = this.mdhAttachment()
      ? this.documentId() === 'mdh'
        ? 180
        : 0
      : 0;
    this.rotation.set(rot);
    this.persistRotation(rot);
    this.dragStampBoxPage.set(null);
    this.dragSignatureBoxPage.set(null);
    this.dragCrewTableSigBoxPage.set(null);
  }

  private async loadCrewSigPreviewForRow(rowIndex: number): Promise<void> {
    if (!this.isCrewEffectDoc()) return;
    const rows = this.crewEffectListRows();
    const member = rows[rowIndex];
    if (!member?.hasSignature) return;

    const existing = this.crewTableSigPreviewUrls();
    if (existing.has(rowIndex)) return;

    const bytes = await this.crewSignatures.loadBytes(member.id);
    if (!bytes?.length) return;

    const url = URL.createObjectURL(new Blob([bytes.slice()]));
    const nextUrls = new Map(this.crewTableSigPreviewUrls());
    nextUrls.set(rowIndex, url);
    this.crewTableSigPreviewUrls.set(nextUrls);
    this.measureCrewSigAspectRatio(rowIndex, url);
  }

  private async loadAllCrewSigPreviews(): Promise<void> {
    const labels = this.crewTableRowLabels();
    await Promise.all(
      labels.filter((row) => row.hasSignature).map((row) => this.loadCrewSigPreviewForRow(row.index)),
    );
  }

  private measureCrewSigAspectRatio(rowIndex: number, url: string): void {
    const img = new Image();
    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) return;
      const next = new Map(this.crewTableSigAspectRatios());
      next.set(rowIndex, img.naturalWidth / img.naturalHeight);
      this.crewTableSigAspectRatios.set(next);
    };
    img.src = url;
  }

  private resolveCrewTableSigRawBox(rowIndex: number): PdfStampBox | null {
    const id = this.crewEffectOverlayId();
    const form = CREW_EFFECT_SIGNATURE_FORM_CONFIG[id];
    const opts = this.crewEffectOptions();
    const base = crewEffectSignatureBase(opts, id);
    const tweak = opts.crewSignatureByRow?.[String(rowIndex)];
    const { widthPt, heightPt } = this.pageSizePt();
    const box = resolveCrewSignatureBox(base, form.rowY(0), form.rowY(rowIndex), tweak);
    return clampStampBox(box, widthPt, heightPt);
  }

  private tightCrewTableSigBox(box: PdfStampBox, rowIndex: number): PdfStampBox {
    const aspect = this.crewTableSigAspectRatios().get(rowIndex);
    if (!aspect) return box;
    return fittedAssetRectInBox(box, aspect);
  }

  private async loadCrewTableSigPreview(): Promise<void> {
    await this.loadCrewSigPreviewForRow(this.crewTableRow());
  }

  private revokeCrewTableSigPreviewUrls(): void {
    for (const url of this.crewTableSigPreviewUrls().values()) {
      URL.revokeObjectURL(url);
    }
    this.crewTableSigPreviewUrls.set(new Map());
    this.crewTableSigAspectRatios.set(new Map());
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
    this.revokeCrewTableSigPreviewUrls();
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
    void persist;
    this.pointerDragging.set(false);
    this.lastPointerClient = null;
    this.dragStampBoxPage.set(null);
    this.dragSignatureBoxPage.set(null);
    this.pointerDidMove = false;
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

  private resizeLive(target: MarkerDragTarget, handle: StampResizeHandle, dx: number, dy: number): void {
    const { widthPt, heightPt } = this.pageSizePt();
    if (target === 'stamp') {
      const box = this.dragStampBoxPage() ?? this.stampBoxOnPage();
      this.dragStampBoxPage.set(resizeStampBox(box, handle, dx, dy, widthPt, heightPt));
      return;
    }
    if (target === 'signature') {
      const box = this.dragSignatureBoxPage() ?? this.signatureBoxOnPage();
      this.dragSignatureBoxPage.set(resizeStampBox(box, handle, dx, dy, widthPt, heightPt));
      return;
    }
    const box = this.dragCrewTableSigBoxPage() ?? this.crewTableSigBoxOnPage();
    if (box) {
      this.dragCrewTableSigBoxPage.set(resizeStampBox(box, handle, dx, dy, widthPt, heightPt));
    }
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
      } else if (target === 'crewTableSig' && this.dragCrewTableSigBoxPage()) {
        this.persistCrewTableSigBox(this.dragCrewTableSigBoxPage()!);
      }
    }
    this.resizing.set(false);
    this.activeResize.set(null);
    this.lastPointerClient = null;
    this.pointerDidMove = false;
    if (!persist) {
      this.dragStampBoxPage.set(null);
      this.dragSignatureBoxPage.set(null);
      this.dragCrewTableSigBoxPage.set(null);
    }
  }

  private endMarkerDrag(persist: boolean): void {
    const target = this.markerDragging();
    if (!target) return;
    if (persist) {
      const box = this.dragBoxForTarget(target);
      if (box) this.persistBoxForTarget(target, box);
    }
    this.markerDragging.set(null);
    this.lastPointerClient = null;
    this.dragStampBoxPage.set(null);
    this.dragSignatureBoxPage.set(null);
    this.dragCrewTableSigBoxPage.set(null);
    this.pointerDidMove = false;
  }

  private initDragBoxForTarget(target: MarkerDragTarget): void {
    const box = this.storedBoxOnPageForTarget(target);
    if (box) this.setDragBoxForTarget(target, { ...box });
  }

  private storedBoxOnPageForTarget(target: MarkerDragTarget): PdfStampBox | null {
    const { widthPt, heightPt } = this.pageSizePt();
    if (target === 'stamp') {
      const ref = this.stampBoxRef();
      return clampStampBox(scaleStampBoxToPage(ref, widthPt, heightPt), widthPt, heightPt);
    }
    if (target === 'signature') {
      const ref = this.signatureBoxRef();
      return clampStampBox(scaleStampBoxToPage(ref, widthPt, heightPt), widthPt, heightPt);
    }
    if (!this.showCrewTableSigMarker()) return null;
    const raw = this.resolveCrewTableSigRawBox(this.crewTableRow());
    if (!raw) return null;
    return this.tightCrewTableSigBox(raw, this.crewTableRow());
  }

  private dragBoxForTarget(target: MarkerDragTarget): PdfStampBox | null {
    if (target === 'stamp') return this.dragStampBoxPage();
    if (target === 'signature') return this.dragSignatureBoxPage();
    return this.dragCrewTableSigBoxPage();
  }

  private boxOnPageForTarget(target: MarkerDragTarget): PdfStampBox | null {
    if (target === 'stamp') return this.stampBoxOnPage();
    if (target === 'signature') return this.signatureBoxOnPage();
    return this.crewTableSigBoxOnPage();
  }

  private setDragBoxForTarget(target: MarkerDragTarget, box: PdfStampBox | null): void {
    if (target === 'stamp') this.dragStampBoxPage.set(box);
    else if (target === 'signature') this.dragSignatureBoxPage.set(box);
    else this.dragCrewTableSigBoxPage.set(box);
  }

  private persistBoxForTarget(target: MarkerDragTarget, boxOnPage: PdfStampBox): void {
    const { widthPt, heightPt } = this.pageSizePt();
    if (target === 'crewTableSig') {
      this.persistCrewTableSigBox(boxOnPage);
      return;
    }
    const ref = stampBoxToRefCoordinates(boxOnPage, widthPt, heightPt);
    if (target === 'stamp') {
      this.persistBoxes(ref, undefined);
    } else {
      this.persistBoxes(undefined, ref);
    }
  }

  private persistCrewTableSigBox(boxOnPage: PdfStampBox): void {
    const id = this.crewEffectOverlayId();
    const form = CREW_EFFECT_SIGNATURE_FORM_CONFIG[id];
    const opts = this.crewEffectOptions();
    const base = crewEffectSignatureBase(opts, id);
    const row = this.crewTableRow();
    const defaultBox = resolveCrewSignatureBox(base, form.rowY(0), form.rowY(row), {});
    const tweak = {
      offsetX: boxOnPage.x - defaultBox.x,
      offsetY: boxOnPage.y - defaultBox.y,
      width: boxOnPage.width,
      height: boxOnPage.height,
    };
    const byRow = { ...(opts.crewSignatureByRow ?? {}), [String(row)]: tweak };
    this.storage.updateDocumentOverlay(id, { crewSignatureByRow: byRow }, 'saved');
  }

  private syncRotationFromStorage(): void {
    const o = this.options();
    this.rotation.set(
      this.mdhAttachment()
        ? normalizeOverlayRotation(
            o.overlayRotationAttachment,
            this.documentId() === 'mdh' ? 180 : 0,
          )
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
