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
import { DocumentSettingsStore } from '../../services/document-settings.store';
import { CrewSignaturePreviewStore } from './crew-signature-preview.store';
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

type MarkerDragTarget = 'stamp' | 'signature' | 'crewTableSig';

@Component({
  selector: 'app-overlay-placement-picker',
  imports: [FormsModule, DecimalPipe, NgStyle, ClickOutsideDirective],
  templateUrl: './overlay-placement-picker.component.html',
  styleUrl: './overlay-placement-picker.component.css',
  providers: [CrewSignaturePreviewStore],
})
export class OverlayPlacementPickerComponent implements OnInit, OnDestroy {
  readonly documentId = input.required<DocumentOverlayId>();
  readonly appendPassengers = input(false);
  readonly close = output<void>();

  protected readonly rotations = OVERLAY_ROTATIONS;
  protected readonly resizeHandles = STAMP_RESIZE_HANDLES;

  private readonly storage = inject(StorageService);
  private readonly docSettings = inject(DocumentSettingsStore);
  private readonly previewSvc = inject(DocumentOverlayPreviewService);
  private readonly assets = inject(ShipAssetsService);
  private readonly sigPreview = inject(CrewSignaturePreviewStore);
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
  protected readonly crewTableRow = signal(0);
  protected readonly showAllCrewSigPreviews = signal(false);

  protected readonly crewTableSigPreviewUrl = computed(
    () => this.sigPreview.previewUrls().get(this.crewTableRow()) ?? null,
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
    return this.sigPreview.tightBox(raw, this.crewTableRow());
  });

  protected readonly crewSigGhostMarkers = computed(() => {
    if (!this.showAllCrewSigPreviews() || !this.showCrewTableSigMarker()) return [];
    const activeRow = this.crewTableRow();
    const previews = this.sigPreview.previewUrls();
    const markers: {
      rowIndex: number;
      previewUrl: string | null;
      style: Record<string, string>;
    }[] = [];
    for (const row of this.crewTableRowLabels()) {
      if (row.index === activeRow || !row.hasSignature) continue;
      const raw = this.resolveCrewTableSigRawBox(row.index);
      if (!raw) continue;
      const box = this.sigPreview.tightBox(raw, row.index);
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
    this.docSettings.updateDocumentOverlay(
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
    const delta =
      event.deltaY > 0
        ? -OverlayPlacementPickerComponent.WHEEL_ZOOM_STEP
        : OverlayPlacementPickerComponent.WHEEL_ZOOM_STEP;
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
    return (
      raw ??
      defaultStampBoxForDocument(this.documentId(), this.mdhAttachment() ? 'attachment' : 'form')
    );
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
    this.docSettings.updateDocumentOverlay(this.documentId(), patch, 'saved');
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
    this.initDragBoxForTarget(target);
    this.centerDragBoxUnderPointer(target, event);
    this.lastPointerClient = { x: event.clientX, y: event.clientY };
  }

  /** Place marker center under the pointer when a drag starts. */
  private centerDragBoxUnderPointer(target: MarkerDragTarget, event: PointerEvent): void {
    const canvas = this.pdfCanvas()?.nativeElement;
    const view = this.pageView;
    if (!canvas || !view) return;
    const ptr = clientToViewportCss(event.clientX, event.clientY, canvas, view);
    if (!ptr) return;
    const ptrPt = view.convertToPdfPoint(ptr.x, ptr.y);
    const box = this.dragBoxForTarget(target);
    if (!box) return;
    const { widthPt, heightPt } = this.pageSizePt();
    this.setDragBoxForTarget(
      target,
      clampStampBox(
        {
          x: ptrPt.x - box.width / 2,
          y: ptrPt.y - box.height / 2,
          width: box.width,
          height: box.height,
        },
        widthPt,
        heightPt,
      ),
    );
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
      this.docSettings.updateDocumentOverlay(
        this.crewEffectOverlayId(),
        { useCrewSignatures: false, crewSignatureByRow: {}, crewSignatureBase: undefined },
        'saved',
      );
    }

    const rot: OverlayRotation = this.mdhAttachment() ? (this.documentId() === 'mdh' ? 180 : 0) : 0;
    this.rotation.set(rot);
    this.persistRotation(rot);
    this.dragStampBoxPage.set(null);
    this.dragSignatureBoxPage.set(null);
    this.dragCrewTableSigBoxPage.set(null);
  }

  /** Guard + crew-row lookup, then delegate preview-URL loading to the sig-preview store. */
  private async loadCrewSigPreviewForRow(rowIndex: number): Promise<void> {
    if (!this.isCrewEffectDoc()) return;
    const member = this.crewEffectListRows()[rowIndex];
    if (!member?.hasSignature) return;
    await this.sigPreview.loadForRow(rowIndex, member.id);
  }

  private async loadAllCrewSigPreviews(): Promise<void> {
    const members = this.crewEffectListRows();
    await this.sigPreview.loadAll(
      this.crewTableRowLabels()
        .filter((row) => row.hasSignature)
        .map((row) => ({ rowIndex: row.index, crewId: members[row.index].id })),
    );
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

  private async loadCrewTableSigPreview(): Promise<void> {
    await this.loadCrewSigPreviewForRow(this.crewTableRow());
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
      this.signaturePreviewUrl.set(URL.createObjectURL(new Blob([signature.slice()])));
    }
  }

  private revokePreviewUrls(): void {
    const stamp = this.stampPreviewUrl();
    const sig = this.signaturePreviewUrl();
    if (stamp) URL.revokeObjectURL(stamp);
    if (sig) URL.revokeObjectURL(sig);
    this.stampPreviewUrl.set(null);
    this.signaturePreviewUrl.set(null);
    this.sigPreview.clear();
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
      OverlayPlacementPickerComponent.PDF_PROBE_FONT_PT * (view.width / view.pageWidthPt);
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
      this.docSettings.updateDocumentOverlay(this.documentId(), patch);
    }
  }

  private resizeLive(
    target: MarkerDragTarget,
    handle: StampResizeHandle,
    dx: number,
    dy: number,
  ): void {
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
    return this.sigPreview.tightBox(raw, this.crewTableRow());
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
    this.docSettings.updateDocumentOverlay(id, { crewSignatureByRow: byRow }, 'saved');
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
      this.docSettings.updateDocumentOverlay(
        this.documentId(),
        { overlayRotationAttachment: deg },
        'saved',
      );
    } else {
      this.docSettings.updateDocumentOverlay(this.documentId(), { overlayRotation: deg }, 'saved');
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
