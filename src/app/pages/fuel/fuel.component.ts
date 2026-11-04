import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  HostListener,
  inject,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AAndDPanelComponent } from '../../components/a-and-d-panel/a-and-d-panel.component';
import { DatePickerComponent } from '../../components/date-picker/date-picker.component';
import { FuelDisplayModalsComponent } from '../../components/fuel-display-modals/fuel-display-modals.component';
import {
  FUEL_COLUMNS,
  FUEL_DEFAULT_VISIBLE_COLUMNS,
  FUEL_DEFAULT_VISIBLE_KINDS,
  FUEL_EVENT_KIND_LABELS,
  FUEL_LIMIT_OPTIONS,
  classifyFuelEvent,
  filterFuelEvents,
  formatFuelHoursHm,
  formatFuelTimeDisplay,
  formatFuelUtcOffsetLabel,
  fuelTabLocalPrefsAsView,
  splitFuelClockTime,
  splitFuelHoursHm,
  shiftFuelDateTime,
  type FuelColumnDef,
  type FuelColumnId,
  type FuelDisplayEvent,
  type FuelEventKind,
  type FuelLogEvent,
} from '../../models/fuel.models';
import { ElectronLocalPrefsService } from '../../services/electron-local-prefs.service';
import { EtaStore } from '../../services/eta.store';
import { FuelStore } from '../../services/fuel.store';
import { StorageService } from '../../services/storage.service';
import { ToastService } from '../../services/toast.service';
import { importFuelLogFromExcelBytes } from '../../utils/fuel-excel-import.util';
import { formatDisplayDate } from '../../utils/date.util';

const ALL_KINDS = Object.keys(FUEL_EVENT_KIND_LABELS) as FuelEventKind[];

interface FuelColumnGroup {
  id: string;
  title: string;
  tone?: FuelColumnDef['tone'];
  columns: FuelColumnDef[];
}

/** Columns menu: grouped so 42 chips don’t feel like a wall. */
const FUEL_COLUMN_GROUPS: FuelColumnGroup[] = (() => {
  const byId = new Map(FUEL_COLUMNS.map((c) => [c.id, c]));
  const pick = (...ids: FuelColumnId[]): FuelColumnDef[] =>
    ids.map((id) => byId.get(id)!).filter(Boolean);

  return [
    {
      id: 'event',
      title: 'Event',
      columns: pick('date', 'time', 'place', 'kind', 'rawEvent', 'hrs'),
    },
    {
      id: 'fuel',
      title: 'Fuel & ROB',
      columns: pick(
        'fmMeAe',
        'totalM3',
        'totalMt',
        'meMt',
        'aeMt',
        'robRmd',
        'robB100',
        'bunkerRmdBio',
        'bunkerDma',
        'robDma',
        'dmaConsMt',
        'dmaConsM3',
        'boilerFm',
      ),
    },
    {
      id: 'me',
      title: 'Main engine',
      tone: 'me',
      columns: pick('meCounterRh', 'meShapoliRev', 'meShapoliKwh', 'meHours', 'meRpm', 'meKw'),
    },
    {
      id: 'ae1',
      title: 'AE 1',
      tone: 'ae1',
      columns: pick('ae1CounterRh', 'ae1KwAvg', 'ae1Hours', 'ae1Kw'),
    },
    {
      id: 'ae2',
      title: 'AE 2',
      tone: 'ae2',
      columns: pick('ae2CounterRh', 'ae2KwAvg', 'ae2Hours', 'ae2Kw'),
    },
    {
      id: 'ae3',
      title: 'AE 3',
      tone: 'ae3',
      columns: pick('ae3CounterRh', 'ae3KwAvg', 'ae3Hours', 'ae3Kw'),
    },
    {
      id: 'boiler',
      title: 'Boiler',
      tone: 'boiler',
      columns: pick('boilerCounterRh', 'boilerHours'),
    },
  ];
})();

interface FuelPathSegment {
  label: string;
  fullPath: string;
  openPath: string;
  isFile: boolean;
  isRoot: boolean;
}

@Component({
  selector: 'app-fuel',
  imports: [
    RouterLink,
    FormsModule,
    AAndDPanelComponent,
    DatePickerComponent,
    FuelDisplayModalsComponent,
  ],
  templateUrl: './fuel.component.html',
  styleUrl: './fuel.component.css',
})
export class FuelComponent {
  private readonly storage = inject(StorageService);
  private readonly fuelStore = inject(FuelStore);
  private readonly etaStore = inject(EtaStore);
  private readonly toast = inject(ToastService);
  private readonly localPrefs = inject(ElectronLocalPrefsService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly tableWrapRef = viewChild<ElementRef<HTMLElement>>('tableWrap');
  private readonly tableVRef = viewChild<ElementRef<HTMLElement>>('tableV');
  private readonly hDockRef = viewChild<ElementRef<HTMLElement>>('hDock');
  private tableWheelBound: HTMLElement | null = null;
  private tableWheelHandler: ((event: WheelEvent) => void) | null = null;

  protected readonly hasElectronPicker = !!window.electronAPI?.pickExcelFile;
  /** Ghost fill needs Electron always-on-top + opacity + click-through. */
  protected readonly canGhostFill = !!window.electronAPI?.setGhostFillMode;
  protected readonly library = this.storage.fuelLibrary;
  protected readonly busy = signal(false);
  /** A&D (Arrival & Departure) report tab — unrelated to fuel Excel. */
  protected readonly showAdTab = signal(false);
  /**
   * Ghost fill: window stays on top; after the drag moves a bit the window hides
   * so the OS text-drop can hit the app below (then showInactive on dragend).
   */
  protected readonly ghostFillMode = signal(false);
  private ghostDragArmed = false;
  private ghostDragHidden = false;
  private ghostDragOrigin: { x: number; y: number } | null = null;
  protected readonly showDisplaySaveModal = signal(false);
  protected readonly showDisplayLoadModal = signal(false);
  protected readonly showMasterSummaryModal = signal(false);
  protected readonly eventsMenuOpen = signal(false);
  protected readonly columnsMenuOpen = signal(false);
  /** Viewport coords for fixed Events/Columns menus (avoids overflow clipping). */
  protected readonly menuAnchor = signal<{ top: number; left: number; width: number } | null>(null);
  /** Long-press on column header to hide. */
  protected readonly colPressId = signal<FuelColumnId | null>(null);
  /** RMB long-press — highlight / hide this event only. */
  protected readonly kindPressId = signal<string | null>(null);
  /** LMB long-press — highlight all badges of this type. */
  protected readonly kindPressKind = signal<FuelEventKind | null>(null);
  protected readonly pathDraft = linkedSignal(() => this.library().sourcePath);
  protected readonly kindLabels = FUEL_EVENT_KIND_LABELS;
  protected readonly allKinds = ALL_KINDS;
  protected readonly allColumns = FUEL_COLUMNS;
  protected readonly columnGroups = FUEL_COLUMN_GROUPS;
  protected readonly limitOptions = FUEL_LIMIT_OPTIONS;

  /** Fixed H-scrollbar dock at the bottom of the screen. */
  protected readonly hScrollActive = signal(false);
  protected readonly hScrollWidth = signal(0);
  protected readonly hDockLeft = signal(0);
  protected readonly hDockWidth = signal(0);

  private hScrollSyncing = false;
  private hScrollRo: ResizeObserver | null = null;
  private colPressTimer: ReturnType<typeof setTimeout> | null = null;
  private kindPressTimer: ReturnType<typeof setTimeout> | null = null;
  private kindPressPointerId: number | null = null;

  protected readonly fuelUi = this.localPrefs.fuelUi;
  /** Events / columns / filters for the FUEL table (this PC only). */
  protected readonly tabUi = computed(() => this.fuelUi().tabs.view);
  protected readonly hoursAsHm = computed(() => this.fuelUi().hoursAsHm);
  protected readonly showUtc = computed(() => this.fuelUi().showUtc);
  /** Shared with ETA Ship Time (etaLibrary.shipUtcOffsetHours). */
  protected readonly utcOffsetHours = computed(
    () => this.storage.etaLibrary().shipUtcOffsetHours,
  );
  protected readonly utcOffsetLabel = computed(() => formatFuelUtcOffsetLabel(this.utcOffsetHours()));
  protected readonly utcOffsetMenuOpen = signal(false);
  protected readonly utcPressing = signal(false);
  private utcPressTimer: ReturnType<typeof setTimeout> | null = null;
  private utcLongPressHandled = false;

  /** Read-only Excel snapshot (last Upload / Update from file). */
  protected readonly activeEvents = computed(() => this.library().events);

  protected readonly visibleColumnDefs = computed(() => {
    const ids = new Set(this.tabUi().visibleColumns);
    return FUEL_COLUMNS.filter((c) => ids.has(c.id));
  });

  protected readonly visibleEvents = computed(() => {
    return filterFuelEvents(this.activeEvents(), fuelTabLocalPrefsAsView(this.tabUi()));
  });

  protected readonly matchCountBeforeLimit = computed(() => {
    return filterFuelEvents(this.activeEvents(), {
      ...fuelTabLocalPrefsAsView(this.tabUi()),
      limitCount: 0,
    }).length;
  });

  protected readonly pathSegments = computed(() => parseFuelPathSegments(this.pathDraft()));

  protected readonly selectedKindsLabel = computed(() => {
    const n = this.tabUi().visibleKinds.length;
    if (n === 0) return 'No events';
    if (n === ALL_KINDS.length) return 'All events';
    if (
      n === FUEL_DEFAULT_VISIBLE_KINDS.length &&
      FUEL_DEFAULT_VISIBLE_KINDS.every((k) => this.tabUi().visibleKinds.includes(k))
    ) {
      return 'VPS events';
    }
    return `${n} event types`;
  });

  /** Hidden row ids that still exist in the active event list. */
  private activeHiddenEventCount(): number {
    const hidden = this.tabUi().hiddenEventIds ?? [];
    if (!hidden.length) return 0;
    const ids = new Set(hidden);
    let n = 0;
    for (const e of this.activeEvents()) {
      if (ids.has(e.id)) n++;
    }
    return n;
  }

  /**
   * Toolbar chip value:
   * - ALL — every kind on, no rows hidden
   * - total event count (e.g. 12) — kinds all on but ≥1 row hidden
   * - kinds count — some event types turned off
   */
  protected readonly eventsChipSuffix = computed(() => {
    const kinds = this.tabUi().visibleKinds.length;
    if (kinds <= 0) return '0';
    if (kinds >= ALL_KINDS.length) {
      if (this.activeHiddenEventCount() > 0) return String(this.activeEvents().length);
      return 'ALL';
    }
    return String(kinds);
  });

  /** Toolbar chip: COLUMNS - ALL / COLUMNS - 42 */
  protected readonly columnsChipSuffix = computed(() => {
    const n = this.tabUi().visibleColumns.length;
    if (n >= FUEL_COLUMNS.length) return 'ALL';
    return String(n);
  });

  /**
   * Events chip color:
   * - all (green) — every kind on, no rows hidden
   * - partial (half green / half red) — every kind on, but ≥1 row hidden
   * - none (red) — at least one event type fully off (or none)
   */
  protected readonly eventsFilterTone = computed((): 'all' | 'partial' | 'none' => {
    const kinds = this.tabUi().visibleKinds.length;
    if (kinds <= 0) return 'none';
    if (kinds < ALL_KINDS.length) return 'none';
    if (this.activeHiddenEventCount() > 0) return 'partial';
    return 'all';
  });

  protected readonly columnsFilterTone = computed((): 'all' | 'partial' | 'none' => {
    const n = this.tabUi().visibleColumns.length;
    if (n <= 0) return 'none';
    if (n >= FUEL_COLUMNS.length) return 'all';
    return 'partial';
  });

  constructor() {
    void this.localPrefs.load().then(async () => {
      const legacy = this.localPrefs.takeLegacyFuelDisplayPresets();
      if (legacy.length) this.fuelStore.importDisplayPresetsIfEmpty(legacy);
      // One-time: seed View/Edit local prefs from former shared library.view.
      await this.localPrefs.ensureFuelTabsSeeded(this.library().view);
      // Mirror shared ETA Ship Time into local Fuel prefs (display uses ETA).
      const ship = this.storage.etaLibrary().shipUtcOffsetHours;
      if (this.fuelUi().utcOffsetHours !== ship) {
        await this.localPrefs.setFuelUi({ utcOffsetHours: ship });
      }
    });

    afterNextRender(() => {
      this.bindHScrollObservers();
      this.bindTableWheelContainment();
    });

    const stopGhostEnded = window.electronAPI?.onGhostFillModeEnded?.(() => {
      this.resetGhostDragState();
      this.ghostFillMode.set(false);
      this.toast.show('Ghost fill off (Esc)', 'success');
    });

    this.destroyRef.onDestroy(() => {
      this.clearColPressTimer();
      this.clearKindPressTimer();
      this.clearUtcPressTimer();
      this.unbindTableWheelContainment();
      stopGhostEnded?.();
      void this.disableGhostFillMode();
    });

    effect(() => {
      // Remeasure when columns / rows change.
      this.visibleColumnDefs();
      this.visibleEvents();
      queueMicrotask(() => {
        this.measureHScrollDock();
        this.bindTableWheelContainment();
      });
    });
  }

  /**
   * Cursor over the fuel grid: vertical wheel scrolls only `.fuel-table-v`.
   * Outside the grid: page scroll behaves normally.
   */
  private bindTableWheelContainment(): void {
    const wrap = this.tableWrapRef()?.nativeElement;
    if (!wrap) {
      this.unbindTableWheelContainment();
      return;
    }
    if (this.tableWheelBound === wrap && this.tableWheelHandler) return;

    this.unbindTableWheelContainment();
    const onWheel = (event: WheelEvent) => this.onTableRegionWheel(event);
    wrap.addEventListener('wheel', onWheel, { passive: false });
    this.tableWheelBound = wrap;
    this.tableWheelHandler = onWheel;
  }

  private unbindTableWheelContainment(): void {
    if (this.tableWheelBound && this.tableWheelHandler) {
      this.tableWheelBound.removeEventListener('wheel', this.tableWheelHandler);
    }
    this.tableWheelBound = null;
    this.tableWheelHandler = null;
  }

  private onTableRegionWheel(event: WheelEvent): void {
    // Horizontal / trackpad pinch — leave alone (H-scroll dock / browser zoom).
    if (event.ctrlKey) return;
    const v = this.tableVRef()?.nativeElement;
    if (!v) return;

    const dx = event.deltaX;
    const dy = event.deltaY;
    // Mostly horizontal gesture → let the wrap / dock handle it.
    if (Math.abs(dx) > Math.abs(dy)) return;

    event.preventDefault();
    event.stopPropagation();
    v.scrollTop += dy;
  }

  protected onTableHScroll(): void {
    if (this.hScrollSyncing) return;
    const wrap = this.tableWrapRef()?.nativeElement;
    const dock = this.hDockRef()?.nativeElement;
    if (!wrap || !dock) return;
    this.hScrollSyncing = true;
    dock.scrollLeft = wrap.scrollLeft;
    this.hScrollSyncing = false;
  }

  protected onDockHScroll(): void {
    if (this.hScrollSyncing) return;
    const wrap = this.tableWrapRef()?.nativeElement;
    const dock = this.hDockRef()?.nativeElement;
    if (!wrap || !dock) return;
    this.hScrollSyncing = true;
    wrap.scrollLeft = dock.scrollLeft;
    this.hScrollSyncing = false;
  }

  private bindHScrollObservers(): void {
    const onResize = () => this.measureHScrollDock();
    window.addEventListener('resize', onResize);
    this.destroyRef.onDestroy(() => {
      window.removeEventListener('resize', onResize);
      this.hScrollRo?.disconnect();
      this.hScrollRo = null;
    });
    this.measureHScrollDock();
  }

  private measureHScrollDock(): void {
    const wrap = this.tableWrapRef()?.nativeElement;
    if (!wrap) {
      this.hScrollActive.set(false);
      return;
    }

    if (!this.hScrollRo) {
      this.hScrollRo = new ResizeObserver(() => this.measureHScrollDock());
      this.hScrollRo.observe(wrap);
      const inner = wrap.querySelector('.fuel-table');
      if (inner) this.hScrollRo.observe(inner);
    }

    const rect = wrap.getBoundingClientRect();
    const scrollW = wrap.scrollWidth;
    const clientW = wrap.clientWidth;
    this.hDockLeft.set(Math.max(0, Math.round(rect.left)));
    this.hDockWidth.set(Math.max(0, Math.round(rect.width)));
    this.hScrollWidth.set(scrollW);
    this.hScrollActive.set(scrollW > clientW + 1);

    const dock = this.hDockRef()?.nativeElement;
    if (dock && !this.hScrollSyncing) {
      this.hScrollSyncing = true;
      dock.scrollLeft = wrap.scrollLeft;
      this.hScrollSyncing = false;
    }
  }

  protected kindOn(kind: FuelEventKind): boolean {
    return this.tabUi().visibleKinds.includes(kind);
  }

  /** True when at least one event of this type is hidden individually (RMB hold). */
  protected kindHasHiddenEvents(kind: FuelEventKind): boolean {
    const hidden = this.tabUi().hiddenEventIds ?? [];
    if (!hidden.length) return false;
    const ids = new Set(hidden);
    return this.activeEvents().some(
      (e) => ids.has(e.id) && classifyFuelEvent(e.rawEvent) === kind,
    );
  }

  protected toggleKind(kind: FuelEventKind): void {
    if (this.kindHasHiddenEvents(kind)) {
      void this.restoreHiddenEventsOfKind(kind);
      return;
    }
    void this.localPrefs.toggleKindOnActiveTab(kind);
  }

  protected selectAllKinds(): void {
    void this.localPrefs.updateActiveTabPrefs({
      visibleKinds: [...ALL_KINDS],
      hiddenEventIds: [],
    });
  }

  protected clearAllKinds(): void {
    void this.localPrefs.setVisibleKindsOnActiveTab([]);
  }

  private async restoreHiddenEventsOfKind(kind: FuelEventKind): Promise<void> {
    const kindIds = new Set(
      this.activeEvents()
        .filter((e) => classifyFuelEvent(e.rawEvent) === kind)
        .map((e) => e.id),
    );
    const nextHidden = (this.tabUi().hiddenEventIds ?? []).filter((id) => !kindIds.has(id));
    const kinds = this.tabUi().visibleKinds.includes(kind)
      ? this.tabUi().visibleKinds
      : [...this.tabUi().visibleKinds, kind];
    await this.localPrefs.updateActiveTabPrefs({
      hiddenEventIds: nextHidden,
      visibleKinds: kinds,
    });
    this.toast.show(`Restored “${this.kindLabels[kind]}” events`, 'success');
  }

  protected columnOn(id: FuelColumnId): boolean {
    return this.tabUi().visibleColumns.includes(id);
  }

  protected async toggleColumn(id: FuelColumnId): Promise<void> {
    const set = new Set(this.tabUi().visibleColumns);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    const next = FUEL_COLUMNS.map((c) => c.id).filter((c) => set.has(c));
    await this.localPrefs.setFuelVisibleColumns(next.length ? next : [...FUEL_DEFAULT_VISIBLE_COLUMNS]);
  }

  protected kindBadgePressing(eventId: string, kind: FuelEventKind): boolean {
    return this.kindPressId() === eventId || this.kindPressKind() === kind;
  }

  protected onColHeadPointerDown(col: FuelColumnDef, ev: PointerEvent): void {
    if (ev.button !== 0) return;
    this.clearKindPressTimer();
    this.kindPressId.set(null);
    this.kindPressKind.set(null);
    this.kindPressPointerId = null;
    this.clearColPressTimer();
    this.colPressId.set(col.id);
    this.colPressTimer = setTimeout(() => {
      this.colPressTimer = null;
      this.colPressId.set(null);
      void this.hideColumnByHold(col);
    }, 550);
  }

  protected onColHeadPointerUp(): void {
    this.clearColPressTimer();
    this.colPressId.set(null);
  }

  private clearColPressTimer(): void {
    if (this.colPressTimer != null) {
      clearTimeout(this.colPressTimer);
      this.colPressTimer = null;
    }
  }

  private async hideColumnByHold(col: FuelColumnDef): Promise<void> {
    const visible = this.tabUi().visibleColumns;
    if (visible.length <= 1) {
      this.toast.showError('Keep at least one column visible');
      return;
    }
    if (!visible.includes(col.id)) return;
    const next = visible.filter((id) => id !== col.id);
    await this.localPrefs.setFuelVisibleColumns(next);
    this.toast.show(`Hidden “${col.label}” — restore via Columns`, 'success');
  }

  protected onKindBadgePointerDown(eventId: string, kind: FuelEventKind, ev: PointerEvent): void {
    // LMB hold → hide ALL of this type; RMB hold → hide this event only.
    if (ev.button !== 0 && ev.button !== 2) return;
    // RMB: block context menu. LMB: do not preventDefault (same as column hold).
    if (ev.button === 2) ev.preventDefault();
    ev.stopPropagation();
    this.clearColPressTimer();
    this.colPressId.set(null);
    this.clearKindPressTimer();
    const hideAllOfKind = ev.button === 0;
    // LMB: pulse every badge of this type; RMB: only the current row.
    if (hideAllOfKind) {
      this.kindPressKind.set(kind);
      this.kindPressId.set(null);
    } else {
      this.kindPressId.set(eventId);
      this.kindPressKind.set(null);
    }
    this.kindPressPointerId = ev.pointerId;
    const target = ev.currentTarget;
    if (target instanceof HTMLElement) {
      try {
        target.setPointerCapture(ev.pointerId);
      } catch {
        /* ignore */
      }
    }
    this.kindPressTimer = setTimeout(() => {
      this.kindPressTimer = null;
      this.kindPressId.set(null);
      this.kindPressKind.set(null);
      this.kindPressPointerId = null;
      if (hideAllOfKind) this.hideKindByHold(kind);
      else this.hideEventByHold(eventId, kind);
    }, 550);
  }

  protected onKindBadgePointerUp(ev?: PointerEvent): void {
    if (
      ev &&
      this.kindPressPointerId != null &&
      ev.pointerId !== this.kindPressPointerId
    ) {
      return;
    }
    ev?.stopPropagation();
    if (ev && ev.currentTarget instanceof HTMLElement && this.kindPressPointerId != null) {
      try {
        ev.currentTarget.releasePointerCapture(this.kindPressPointerId);
      } catch {
        /* ignore */
      }
    }
    this.clearKindPressTimer();
    this.kindPressId.set(null);
    this.kindPressKind.set(null);
    this.kindPressPointerId = null;
  }

  private clearKindPressTimer(): void {
    if (this.kindPressTimer != null) {
      clearTimeout(this.kindPressTimer);
      this.kindPressTimer = null;
    }
  }

  /** LMB hold — hide every event of this type (Events filter), as before. */
  private hideKindByHold(kind: FuelEventKind): void {
    const visible = this.tabUi().visibleKinds;
    if (!visible.includes(kind)) return;
    if (visible.length <= 1) {
      this.toast.showError('Keep at least one event type visible');
      return;
    }
    // Drop per-event hides for this kind so Events chip is fully off, not half-filled.
    const kindIds = new Set(
      this.activeEvents()
        .filter((e) => classifyFuelEvent(e.rawEvent) === kind)
        .map((e) => e.id),
    );
    const nextHidden = (this.tabUi().hiddenEventIds ?? []).filter((id) => !kindIds.has(id));
    void this.localPrefs.updateActiveTabPrefs({
      visibleKinds: visible.filter((k) => k !== kind),
      hiddenEventIds: nextHidden,
    });
    this.toast.show(`Hidden “${this.kindLabels[kind]}” — restore via Events`, 'success');
  }

  /** RMB hold — hide only this row. */
  private hideEventByHold(eventId: string, kind: FuelEventKind): void {
    const hidden = this.tabUi().hiddenEventIds ?? [];
    if (hidden.includes(eventId)) return;
    const rows = this.visibleEvents();
    if (rows.length <= 1 && rows.some((e) => e.id === eventId)) {
      this.toast.showError('Keep at least one event visible');
      return;
    }
    void this.localPrefs.updateActiveTabPrefs({
      hiddenEventIds: [...hidden, eventId],
    });
    this.toast.show(
      `Hidden event — restore via Events → ${this.kindLabels[kind]}`,
      'success',
    );
  }

  protected async selectAllColumns(): Promise<void> {
    await this.localPrefs.setFuelVisibleColumns(FUEL_COLUMNS.map((c) => c.id));
  }

  protected toggleEventsMenu(ev: Event): void {
    ev.stopPropagation();
    const opening = !this.eventsMenuOpen();
    this.columnsMenuOpen.set(false);
    if (!opening) {
      this.closeMenus();
      return;
    }
    this.placeMenu(ev.currentTarget as HTMLElement, 360);
    this.eventsMenuOpen.set(true);
  }

  protected toggleColumnsMenu(ev: Event): void {
    ev.stopPropagation();
    const opening = !this.columnsMenuOpen();
    this.eventsMenuOpen.set(false);
    if (!opening) {
      this.closeMenus();
      return;
    }
    this.placeMenu(ev.currentTarget as HTMLElement, Math.min(520, window.innerWidth - 16));
    this.columnsMenuOpen.set(true);
  }

  private placeMenu(trigger: HTMLElement, preferredWidth: number): void {
    const r = trigger.getBoundingClientRect();
    const width = Math.max(240, Math.min(preferredWidth, window.innerWidth - 16));
    let left = r.left;
    if (left + width > window.innerWidth - 8) {
      left = window.innerWidth - 8 - width;
    }
    left = Math.max(8, left);
    const maxTop = window.innerHeight - 96;
    const top = Math.min(r.bottom + 6, Math.max(8, maxTop));
    this.menuAnchor.set({ top, left, width });
  }

  protected openDisplaySave(): void {
    this.showDisplayLoadModal.set(false);
    this.showDisplaySaveModal.set(true);
  }

  protected openDisplayLoad(): void {
    this.showDisplaySaveModal.set(false);
    this.showDisplayLoadModal.set(true);
  }

  /** True when From / To / Show / Search differ from defaults (Last 20, empty). */
  protected readonly filtersNonDefault = computed(() => {
    const t = this.tabUi();
    return (
      !!t.dateFrom.trim() ||
      !!t.dateTo.trim() ||
      !!t.search.trim() ||
      t.limitCount !== 20
    );
  });

  protected onSearch(value: string): void {
    void this.localPrefs.updateActiveTabPrefs({ search: value });
  }

  protected onDateFrom(value: string): void {
    void this.localPrefs.updateActiveTabPrefs({ dateFrom: value });
  }

  protected onDateTo(value: string): void {
    void this.localPrefs.updateActiveTabPrefs({ dateTo: value });
  }

  protected onLimitCount(value: string | number): void {
    const n = typeof value === 'number' ? value : Number(value);
    void this.localPrefs.updateActiveTabPrefs({ limitCount: Number.isFinite(n) ? n : 20 });
  }

  /** Reset From / To / Show (Last 20) / Search for the active tab (this PC). */
  protected clearFilters(): void {
    void this.localPrefs.updateActiveTabPrefs({
      dateFrom: '',
      dateTo: '',
      search: '',
      limitCount: 20,
    });
  }

  protected async setHoursAsHm(enabled: boolean): Promise<void> {
    await this.localPrefs.setFuelHoursAsHm(enabled);
  }

  protected onUtcPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    this.clearUtcPressTimer();
    this.utcLongPressHandled = false;
    this.utcPressing.set(true);
    this.utcPressTimer = setTimeout(() => {
      this.utcPressTimer = null;
      this.utcPressing.set(false);
      this.utcLongPressHandled = true;
      this.utcOffsetMenuOpen.set(true);
    }, 450);
  }

  protected onUtcPointerUp(): void {
    this.clearUtcPressTimer();
    this.utcPressing.set(false);
  }

  protected onUtcPointerCancel(): void {
    this.clearUtcPressTimer();
    this.utcPressing.set(false);
  }

  protected onUtcClick(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.utcLongPressHandled) {
      this.utcLongPressHandled = false;
      return;
    }
    if (this.utcOffsetMenuOpen()) {
      this.utcOffsetMenuOpen.set(false);
      return;
    }
    void this.localPrefs.setFuelUi({ showUtc: !this.showUtc() });
  }

  protected async nudgeUtcOffset(delta: number): Promise<void> {
    const next = this.utcOffsetHours() + delta;
    this.etaStore.setShipUtcOffsetHours(next);
    await this.localPrefs.setFuelUi({ utcOffsetHours: next });
  }

  private clearUtcPressTimer(): void {
    if (this.utcPressTimer != null) {
      clearTimeout(this.utcPressTimer);
      this.utcPressTimer = null;
    }
  }

  /** Date/time as currently shown (local or UTC). */
  private displayDateTime(e: Pick<FuelLogEvent, 'date' | 'time'>): { date: string; time: string } {
    if (!this.showUtc()) return { date: e.date, time: e.time };
    return shiftFuelDateTime(e.date, e.time, -this.utcOffsetHours());
  }

  /** FUEL table (Excel snapshot) — leaves the A&D report tab. */
  protected openFuelTab(): void {
    this.showAdTab.set(false);
    this.closeMenus();
  }

  protected openAdTab(): void {
    this.showAdTab.set(true);
    this.closeMenus();
    void this.disableGhostFillMode();
  }

  protected async toggleGhostFillMode(): Promise<void> {
    if (!this.canGhostFill) {
      this.toast.showError('Ghost fill only works in the desktop app');
      return;
    }
    const next = !this.ghostFillMode();
    if (!next) {
      await this.disableGhostFillMode();
      this.toast.show('Ghost fill off', 'success');
      return;
    }
    const res = await window.electronAPI!.setGhostFillMode!(true);
    if (!res.ok) {
      this.toast.showError('Could not enable ghost fill');
      return;
    }
    this.ghostFillMode.set(true);
    this.toast.show('Ghost fill on — drag a value (click-copy is off)', 'success');
  }

  private async disableGhostFillMode(): Promise<void> {
    this.resetGhostDragState();
    if (this.ghostFillMode()) {
      this.ghostFillMode.set(false);
    }
    const api = window.electronAPI;
    if (!api?.setGhostFillMode) return;
    try {
      await api.setGhostDragActive?.(false);
    } catch {
      /* ignore */
    }
    try {
      await api.setGhostFillMode(false);
    } catch {
      /* ignore */
    }
  }

  private resetGhostDragState(): void {
    this.ghostDragArmed = false;
    this.ghostDragHidden = false;
    this.ghostDragOrigin = null;
  }

  /** Start OS text drag (ghost mode). Click-copy is disabled while Ghost is on. */
  protected onGhostDragStart(event: DragEvent, value: string): void {
    if (!this.ghostFillMode()) {
      event.preventDefault();
      return;
    }
    const text = String(value ?? '').trim();
    if (!text || text === '—') {
      event.preventDefault();
      return;
    }
    const dt = event.dataTransfer;
    if (!dt) {
      event.preventDefault();
      return;
    }
    dt.setData('text/plain', text);
    dt.setData('text', text);
    dt.effectAllowed = 'copy';
    this.applyGhostDragImage(event, text);
    this.ghostDragArmed = true;
    this.ghostDragHidden = false;
    this.ghostDragOrigin = { x: event.screenX, y: event.screenY };
  }

  /**
   * After a small move, hide CREW so the drag can continue over the browser.
   * Hiding too early (or using click-through) aborts Chromium's drag.
   */
  protected onGhostDragMove(event: DragEvent): void {
    if (!this.ghostDragArmed || this.ghostDragHidden || !this.ghostFillMode()) return;
    const origin = this.ghostDragOrigin;
    if (!origin) return;
    const dx = event.screenX - origin.x;
    const dy = event.screenY - origin.y;
    if (dx * dx + dy * dy < 12 * 12) return;
    this.ghostDragHidden = true;
    void window.electronAPI?.setGhostDragActive?.(true);
  }

  protected onGhostDragEnd(): void {
    const wasHidden = this.ghostDragHidden;
    this.resetGhostDragState();
    if (wasHidden || window.electronAPI?.setGhostDragActive) {
      void window.electronAPI?.setGhostDragActive?.(false);
    }
  }

  private applyGhostDragImage(event: DragEvent, text: string): void {
    if (!event.dataTransfer) return;
    const chip = document.createElement('div');
    chip.textContent = text;
    chip.setAttribute('aria-hidden', 'true');
    Object.assign(chip.style, {
      position: 'fixed',
      top: '-1000px',
      left: '-1000px',
      zIndex: '99999',
      padding: '0.45rem 0.75rem',
      borderRadius: '10px',
      border: '2px solid #0ea5e9',
      background: 'rgba(15, 23, 42, 0.92)',
      color: '#f8fafc',
      font: '800 1.35rem/1 ui-monospace, Consolas, monospace',
      letterSpacing: '0.04em',
      boxShadow: '0 10px 28px rgba(15, 23, 42, 0.45)',
      pointerEvents: 'none',
      whiteSpace: 'nowrap',
    } as Partial<CSSStyleDeclaration>);
    document.body.appendChild(chip);
    const w = Math.max(chip.offsetWidth, 24);
    const h = Math.max(chip.offsetHeight, 24);
    event.dataTransfer.setDragImage(chip, Math.round(w / 2), Math.round(h / 2));
    queueMicrotask(() => chip.remove());
  }

  protected async onPathSegmentPress(seg: FuelPathSegment, event: MouseEvent): Promise<void> {
    if (event.button !== 0) return;
    event.preventDefault();
    const api = window.electronAPI;
    if (!api?.openDirectory) {
      this.toast.showError(seg.isFile ? 'Open file only works in the desktop app' : 'Open folder only works in the desktop app');
      return;
    }
    const res = await api.openDirectory(seg.openPath);
    if (!res.ok) {
      this.toast.showError(res.error || (seg.isFile ? 'Could not open file' : 'Could not open folder'));
    }
  }

  protected async pickExcel(): Promise<void> {
    const electron = window.electronAPI;
    if (electron?.pickExcelFile) {
      const current = this.pathDraft().trim() || this.library().sourcePath.trim();
      const path = await electron.pickExcelFile(current || undefined);
      if (!path) return;
      this.pathDraft.set(path);
      this.fuelStore.setSourcePath(path);
      await this.loadFromPath(path);
      return;
    }
  }

  protected async onFileChosen(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.pathDraft.set(file.name);
    this.fuelStore.setSourcePath(file.name);
    await this.loadFromFile(file, file.name, file.name);
  }

  protected async uploadOrUpdate(): Promise<void> {
    const path = this.pathDraft().trim() || this.library().sourcePath.trim();
    if (!path) {
      this.toast.showError('Choose an Excel file or enter a path first');
      return;
    }
    if (window.electronAPI?.readFileBase64 && /[\\/]/.test(path)) {
      this.fuelStore.setSourcePath(path);
      await this.loadFromPath(path);
      return;
    }
    this.toast.showError('Use Browse to pick the Excel file (path reload needs the desktop app)');
  }

  private async loadFromPath(path: string): Promise<void> {
    const api = window.electronAPI;
    if (!api?.readFileBase64) {
      this.toast.showError('File reload needs the desktop app');
      return;
    }
    this.busy.set(true);
    try {
      const res = await api.readFileBase64(path);
      if (!res.ok || !res.base64) {
        this.toast.showError(res.error || `Could not read Excel:\n${path}`);
        return;
      }
      await this.applyImport(base64ToBytes(res.base64), path, path.split(/[/\\]/).pop() || 'fuel.xlsx');
    } finally {
      this.busy.set(false);
    }
  }

  private async loadFromFile(file: File, sourcePath: string, fileName: string): Promise<void> {
    this.busy.set(true);
    try {
      const buf = await file.arrayBuffer();
      await this.applyImport(new Uint8Array(buf), sourcePath, fileName);
    } finally {
      this.busy.set(false);
    }
  }

  private async applyImport(
    bytes: Uint8Array,
    sourcePath: string,
    fileName: string,
  ): Promise<void> {
    try {
      const result = await importFuelLogFromExcelBytes(bytes);
      this.fuelStore.replaceFromImport({
        events: result.events,
        sourcePath,
        sourceFileName: fileName,
        sheetName: result.sheetName,
        masterSummary: result.masterSummary,
      });
      const warn = result.warnings.length ? ` (${result.warnings.length} warnings)` : '';
      this.toast.show(`Imported ${result.events.length} events${warn}`, 'success');
    } catch (err) {
      this.toast.showError(err instanceof Error ? err.message : 'Import failed');
    }
  }

  /** H:MM parts for red hours / blue minutes when Hours mode is on. */
  protected hoursHmParts(
    e: FuelDisplayEvent,
    col: FuelColumnDef,
  ): { sign: string; hours: string; minutes: string } | null {
    if (!this.hoursAsHm() || col.type !== 'hours') return null;
    return splitFuelHoursHm(this.cellText(e, col));
  }

  /** Clock HH:MM parts for separate copy (current display zone, no UTC suffix). */
  protected clockTimeParts(
    e: Pick<FuelLogEvent, 'date' | 'time'>,
  ): { hours: string; minutes: string; full: string } | null {
    return splitFuelClockTime(this.displayDateTime(e).time);
  }

  protected cellText(e: FuelDisplayEvent, col: FuelColumnDef): string {
    if (col.id === 'kind') return this.kindLabels[e.kind];
    if (col.id === 'date') {
      const { date } = this.displayDateTime(e);
      return this.formatDate(date);
    }
    if (col.id === 'time') {
      const { time } = this.displayDateTime(e);
      if (!time) return '—';
      return formatFuelTimeDisplay(time, this.showUtc());
    }
    if (!col.field) return '—';
    const v = e[col.field];
    if (v == null || v === '') return '—';
    if (col.type === 'hours') {
      return this.hoursAsHm() ? formatFuelHoursHm(v as number) : this.formatNum(v as number);
    }
    if (col.type === 'kw' || col.type === 'num') return this.formatNum(v as number);
    return String(v);
  }

  protected toneClass(col: FuelColumnDef): string {
    return col.tone ? `fuel-col--${col.tone}` : '';
  }

  protected formatNum(v: number | null): string {
    if (v == null) return '—';
    return (Math.round(v * 10) / 10).toFixed(1);
  }

  protected formatDate(iso: string): string {
    return formatDisplayDate(iso) || iso || '—';
  }

  protected async copyCell(value: string, event?: Event): Promise<void> {
    event?.stopPropagation();
    // Ghost mode is drag-only — LMB copy was aborting / fighting the drag.
    if (this.ghostFillMode()) return;
    const text = String(value ?? '').trim();
    if (!text || text === '—') return;
    try {
      await navigator.clipboard.writeText(text);
      this.toast.show(`Copied ${text}`, 'success');
    } catch {
      this.toast.showError('Could not copy');
    }
  }

  protected closeMenus(): void {
    this.eventsMenuOpen.set(false);
    this.columnsMenuOpen.set(false);
    this.menuAnchor.set(null);
    this.utcOffsetMenuOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.showMasterSummaryModal()) {
      this.showMasterSummaryModal.set(false);
    }
  }
}

function parseFuelPathSegments(raw: string): FuelPathSegment[] {
  const p = String(raw ?? '').trim();
  if (!p) return [];
  const sep = p.includes('\\') ? '\\' : '/';
  const segs: FuelPathSegment[] = [];

  let rest = p;
  let acc = '';

  if (/^[A-Za-z]:[\\/]?/.test(p)) {
    const root = p.slice(0, 2);
    acc = root + sep;
    segs.push({
      label: root,
      fullPath: acc,
      openPath: acc,
      isFile: false,
      isRoot: true,
    });
    rest = p.slice(2).replace(/^[\\/]+/, '');
  } else if (p.startsWith('\\\\') || p.startsWith('//')) {
    const bits = p.replace(/^[/\\]+/, '').split(/[/\\]/).filter(Boolean);
    if (bits.length >= 1) {
      acc = sep + sep + bits[0];
      segs.push({
        label: '\\\\' + bits[0],
        fullPath: acc,
        openPath: acc,
        isFile: false,
        isRoot: true,
      });
      rest = bits.slice(1).join(sep);
    } else {
      return [];
    }
  }

  const parts = rest.split(/[/\\]/).filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    acc = acc ? (acc.endsWith('\\') || acc.endsWith('/') ? acc + part : acc + sep + part) : part;
    const isLast = i === parts.length - 1;
    const isFile = isLast && /\.[A-Za-z0-9]+$/.test(part);
    segs.push({
      label: part,
      fullPath: acc,
      openPath: acc,
      isFile,
      isRoot: false,
    });
  }
  return segs;
}

function base64ToBytes(base64: string): Uint8Array {
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
