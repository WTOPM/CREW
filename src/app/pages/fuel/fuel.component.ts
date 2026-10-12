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
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DatePickerComponent } from '../../components/date-picker/date-picker.component';
import { FuelDisplayModalsComponent } from '../../components/fuel-display-modals/fuel-display-modals.component';
import { FuelDistanceForecastModalComponent } from '../../components/fuel-distance-forecast-modal/fuel-distance-forecast-modal.component';
import { FuelEtaVoyagePreviewModalComponent } from '../../components/fuel-eta-voyage-preview-modal/fuel-eta-voyage-preview-modal.component';
import { FuelEventEditModalComponent } from '../../components/fuel-event-edit-modal/fuel-event-edit-modal.component';
import { FuelUpdatedHandoffModalComponent } from '../../components/fuel-updated-handoff-modal/fuel-updated-handoff-modal.component';
import { RefChoiceSuggestComponent } from '../../components/ref-choice-suggest/ref-choice-suggest.component';
import { PlainTooltipDirective } from '../../directives/plain-tooltip.directive';
import {
  FUEL_COLUMNS,
  FUEL_DEFAULT_DENSITY,
  FUEL_DEFAULT_VISIBLE_COLUMNS,
  FUEL_DEFAULT_VISIBLE_KINDS,
  FUEL_EVENT_KIND_LABELS,
  FUEL_LIMIT_OPTIONS,
  FUEL_RAW_EVENT_OPTIONS,
  FUEL_ROB_TANK_LABELS,
  FUEL_ROB_TANK_TIPS,
  applyFuelEventAutoCalcs,
  cascadeAppAddedFuelRob,
  classifyFuelEvent,
  createEmptyFuelLogEvent,
  discoverFuelRobTanks,
  filterFuelEvents,
  findFuelEventBeforePrevious,
  findLatestFuelEvent,
  findPreviousFuelEvent,
  formatFuelHoursHm,
  formatFuelTimeDisplay,
  formatFuelUtcOffsetLabel,
  fuelEventReadyForWrite,
  fuelTabLocalPrefsAsView,
  splitFuelHoursHm,
  applyFuelConsumptionSideEffects,
  inheritFuelFieldsFromPrevious,
  normalizeFuelDensity,
  nudgeFuelDensity,
  parseFuelTimeDisplay,
  splitFuelTotalMtToMeAe,
  projectFuelRobForEvent,
  recomputeFuelCounterFromHours,
  recomputeFuelFmFromTotalM3,
  recomputeFuelHoursFromCounter,
  recomputeFuelTotalM3FromFm,
  recomputeFuelTotalMtFromM3,
  syncFuelBoilerDmaPeriod,
  resolveBunkerRobTank,
  resolveFuelDensity,
  resolveFuelRobTankAssignment,
  dateTimeFromFuelHrsEdit,
  fuelElapsedHours,
  parseFuelHoursInput,
  shiftFuelDateTime,
  createEmptyFuelCylinderRow,
  recomputeFuelCylinderChain,
  type FuelColumnDef,
  type FuelColumnId,
  type FuelCylinderRow,
  type FuelDisplayEvent,
  type FuelEventKind,
  type FuelInheritableField,
  type FuelLogEvent,
  type FuelPageTab,
  type FuelRobTankId,
  type FuelWriteStatus,
} from '../../models/fuel.models';

interface FuelDensityHud {
  eventId: string;
  density: number;
  x: number;
  y: number;
}

/** F-badge menu: pick which ROB tank ME / AE / Boiler consumption debits. */
type FuelRobTankMenuField = 'meRobTank' | 'aeRobTank' | 'boilerRobTank' | 'bunkerRobTank';

interface FuelRobTankMenu {
  eventId: string;
  field: FuelRobTankMenuField;
  selected: FuelRobTankId;
  x: number;
  y: number;
  /** Bunker RMD/BIO only offers RMD + B100. */
  mode: 'consume' | 'bunker';
}
import { ElectronLocalPrefsService } from '../../services/electron-local-prefs.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { FuelStore } from '../../services/fuel.store';
import { StorageService } from '../../services/storage.service';
import { ToastService } from '../../services/toast.service';
import {
  importFuelLogFromExcelBytes,
  writeFuelLogToExcelBytes,
} from '../../utils/fuel-excel-import.util';
import {
  importFuelCylinderFromExcelBytes,
  writeFuelCylinderToExcelBytes,
} from '../../utils/fuel-cylinder-excel.util';
import {
  buildEtaFuelVoyagePreview,
  etaFuelVoyagePreviewRowsToEvents,
  type EtaFuelVoyagePreview,
  type EtaFuelVoyagePreviewRow,
} from '../../utils/eta-to-fuel-voyage.util';
import {
  buildFuelDistanceLegsFromEtaPlan,
  createEmptyFuelDistanceLeg,
  foRobMtFromFuelEvent,
  type FuelDistanceForecastLeg,
} from '../../utils/fuel-distance-forecast.util';
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
      columns: pick('boilerCounterRh', 'boilerHours', 'boilerFmCeng', 'boilerConsM3', 'boilerConsMt'),
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
    DecimalPipe,
    DatePickerComponent,
    FuelEventEditModalComponent,
    FuelEtaVoyagePreviewModalComponent,
    FuelDistanceForecastModalComponent,
    FuelDisplayModalsComponent,
    FuelUpdatedHandoffModalComponent,
    RefChoiceSuggestComponent,
    PlainTooltipDirective,
  ],
  templateUrl: './fuel.component.html',
  styleUrl: './fuel.component.css',
})
export class FuelComponent {
  private readonly storage = inject(StorageService);
  private readonly fuelStore = inject(FuelStore);
  private readonly toast = inject(ToastService);
  private readonly localPrefs = inject(ElectronLocalPrefsService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly tableWrapRef = viewChild<ElementRef<HTMLElement>>('tableWrap');
  private readonly tableVRef = viewChild<ElementRef<HTMLElement>>('tableV');
  private readonly hDockRef = viewChild<ElementRef<HTMLElement>>('hDock');
  private tableWheelBound: HTMLElement | null = null;
  private tableWheelHandler: ((event: WheelEvent) => void) | null = null;

  protected readonly hasElectronPicker = !!window.electronAPI?.pickExcelFile;
  protected readonly canWriteExcel = !!window.electronAPI?.writeFileBase64;
  protected readonly library = this.storage.fuelLibrary;
  protected readonly busy = signal(false);
  /** View / Edit / CYL — local prefs (survives navigation + app restart). */
  protected readonly activeTab = computed((): FuelPageTab => {
    const t = this.localPrefs.fuelUi().activeTab;
    return t === 'edit' || t === 'cyl' ? t : 'view';
  });
  protected readonly showAddModal = signal(false);
  /** Stable seed for Add modal (new object only when opening — avoids draft reset). */
  protected readonly addModalSeed = signal<Partial<FuelLogEvent> | null>(null);
  /** ETA → Fuel Edit voyage preview (include/exclude + time tools). */
  protected readonly etaVoyagePreview = signal<EtaFuelVoyagePreview | null>(null);
  /** View-only FO distance / burn forecast (Excel Fuel-Distance Calc.). */
  protected readonly distanceForecast = signal<{
    legs: FuelDistanceForecastLeg[];
    startRobMt: number | null;
    planName: string;
  } | null>(null);
  /** Floating density editor on Total t (D click or right-click). */
  protected readonly densityHud = signal<FuelDensityHud | null>(null);
  /** Floating ROB-tank picker on ME / AE / Boiler t (F badge). */
  protected readonly robTankMenu = signal<FuelRobTankMenu | null>(null);
  protected readonly robTankLabels = FUEL_ROB_TANK_LABELS;
  protected readonly robTankTips = FUEL_ROB_TANK_TIPS;
  protected readonly robTankOptions = computed(() =>
    discoverFuelRobTanks(
      this.canEdit() ? this.library().editEvents : this.library().events,
    ),
  );
  /** eventId → fields still showing previous-row values (red until edited). */
  protected readonly pendingInheritedByEvent = signal<
    ReadonlyMap<string, ReadonlySet<FuelInheritableField>>
  >(new Map());
  protected readonly showDisplaySaveModal = signal(false);
  protected readonly showDisplayLoadModal = signal(false);
  protected readonly showMasterSummaryModal = signal(false);
  protected readonly showUpdatedHandoffModal = signal(false);
  protected readonly eventsMenuOpen = signal(false);
  protected readonly columnsMenuOpen = signal(false);
  /** Viewport coords for fixed Events/Columns menus (avoids overflow clipping). */
  protected readonly menuAnchor = signal<{ top: number; left: number; width: number } | null>(null);
  /** Long-press on column header to hide. */
  protected readonly colPressId = signal<FuelColumnId | null>(null);
  /** Long-press on Kind badge to hide that event type. */
  protected readonly kindPressId = signal<FuelEventKind | null>(null);
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

  protected readonly fuelUi = this.localPrefs.fuelUi;
  /** Events / columns / filters for the active tab (this PC only). */
  protected readonly tabUi = computed(() => {
    const ui = this.fuelUi();
    return ui.tabs[ui.activeTab === 'edit' ? 'edit' : 'view'];
  });
  protected readonly hoursAsHm = computed(() => this.fuelUi().hoursAsHm);
  protected readonly showUtc = computed(() => this.fuelUi().showUtc);
  protected readonly utcOffsetHours = computed(() => this.fuelUi().utcOffsetHours);
  protected readonly utcOffsetLabel = computed(() => formatFuelUtcOffsetLabel(this.utcOffsetHours()));
  protected readonly utcOffsetMenuOpen = signal(false);
  protected readonly utcPressing = signal(false);
  private utcPressTimer: ReturnType<typeof setTimeout> | null = null;
  private utcLongPressHandled = false;
  /** Fuel Log editing is only on the Edit tab. */
  protected readonly canEdit = computed(() => this.activeTab() === 'edit');
  /** Cyl. Oil editing on the CYL tab. */
  protected readonly canEditCyl = computed(() => this.activeTab() === 'cyl');

  /** Unsaved Edit draft (Fuel Log or CYL, depending on tab). */
  protected readonly dirty = computed(() =>
    this.activeTab() === 'cyl'
      ? this.library().fuelCylinder.editDirty
      : this.library().editDirty,
  );

  protected readonly cylLibrary = computed(() => this.library().fuelCylinder);
  protected readonly cylRows = computed(() => {
    const cyl = this.cylLibrary();
    return this.canEditCyl() ? cyl.editRows : cyl.rows;
  });
  protected readonly cylReadyCount = computed(
    () => this.cylLibrary().editRows.filter((r) => r.writeStatus === 'ready').length,
  );
  protected readonly cylHasReady = computed(() => this.cylReadyCount() > 0);

  /** Rows marked ready — only these go to Excel on Write. */
  protected readonly readyCount = computed(
    () => this.library().editEvents.filter((e) => e.writeStatus === 'ready').length,
  );

  protected readonly hasReadyToWrite = computed(() => this.readyCount() > 0);

  /** Unique Place values for the dropdown (Sea + View/Edit tables, first-seen). */
  protected readonly placeChoices = computed(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    const add = (raw: string) => {
      const v = String(raw ?? '').trim();
      if (!v) return;
      const key = v.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push(v);
    };
    add('Sea');
    const lib = this.library();
    for (const e of lib.editEvents) add(e.place);
    for (const e of lib.events) add(e.place);
    const port = lib.updatedHandoff.port;
    if (port) add(port);
    return out;
  });

  /** Excel event labels: common picker options + values already in the Edit table. */
  protected readonly rawEventChoices = computed(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    const add = (raw: string) => {
      const v = String(raw ?? '').trim();
      if (!v) return;
      const key = v.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push(v);
    };
    for (const opt of FUEL_RAW_EVENT_OPTIONS) add(opt);
    for (const e of this.library().editEvents) add(e.rawEvent);
    return out;
  });

  /** Events for the active tab: View = Excel snapshot, Edit = draft. */
  protected readonly activeEvents = computed(() => {
    const lib = this.library();
    return this.activeTab() === 'edit' ? lib.editEvents : lib.events;
  });

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

  /** Toolbar chip: EVENTS - ALL / EVENTS - 11 / EVENTS - 0 */
  protected readonly eventsChipSuffix = computed(() => {
    const n = this.tabUi().visibleKinds.length;
    if (n >= ALL_KINDS.length) return 'ALL';
    return String(n);
  });

  /** Toolbar chip: COLUMNS - ALL / COLUMNS - 42 */
  protected readonly columnsChipSuffix = computed(() => {
    const n = this.tabUi().visibleColumns.length;
    if (n >= FUEL_COLUMNS.length) return 'ALL';
    return String(n);
  });

  /** Filter chip color: all = green, partial = yellow, none = red. */
  protected readonly eventsFilterTone = computed((): 'all' | 'partial' | 'none' => {
    const n = this.tabUi().visibleKinds.length;
    if (n <= 0) return 'none';
    if (n >= ALL_KINDS.length) return 'all';
    return 'partial';
  });

  protected readonly columnsFilterTone = computed((): 'all' | 'partial' | 'none' => {
    const n = this.tabUi().visibleColumns.length;
    if (n <= 0) return 'none';
    if (n >= FUEL_COLUMNS.length) return 'all';
    return 'partial';
  });

  /** Shared UPDATED chip (Excel-style View↔Edit handoff). */
  protected readonly updatedHandoff = computed(() => this.library().updatedHandoff);
  protected readonly updatedChipTone = computed((): 'idle' | 'need' | 'done' => {
    const s = this.updatedHandoff().status;
    if (s === 'needs_update') return 'need';
    if (s === 'done') return 'done';
    return 'idle';
  });
  protected readonly updatedChipLabel = computed(() => {
    const h = this.updatedHandoff();
    if (h.status === 'needs_update') return 'UPDATE · NEED';
    if (h.status === 'done') return 'UPDATED · OK';
    return 'UPDATED';
  });

  constructor() {
    void this.localPrefs.load().then(async () => {
      const legacy = this.localPrefs.takeLegacyFuelDisplayPresets();
      if (legacy.length) this.fuelStore.importDisplayPresetsIfEmpty(legacy);
      // One-time: seed View/Edit local prefs from former shared library.view.
      await this.localPrefs.ensureFuelTabsSeeded(this.library().view);
    });

    afterNextRender(() => {
      this.bindHScrollObservers();
      this.bindTableWheelContainment();
      // Dirty Edit may still have null Total m³/t from before the import fix.
      this.fuelStore.healEditPeriodTotals();
    });

    this.destroyRef.onDestroy(() => {
      this.clearColPressTimer();
      this.clearKindPressTimer();
      this.clearUtcPressTimer();
      this.unbindTableWheelContainment();
      this.closeDensityHud();
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

  protected toggleKind(kind: FuelEventKind): void {
    void this.localPrefs.toggleKindOnActiveTab(kind);
  }

  protected selectAllKinds(): void {
    void this.localPrefs.setVisibleKindsOnActiveTab([...ALL_KINDS]);
  }

  protected clearAllKinds(): void {
    void this.localPrefs.setVisibleKindsOnActiveTab([]);
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

  protected syncTitle(): string {
    if (!this.canWriteExcel) return 'Save to file needs the desktop app';
    if (this.hasReadyToWrite()) {
      return `Hover: Write saves ${this.readyCount()} ready row(s) to Excel · Discard restores last clean draft`;
    }
    if (!this.dirty()) return 'No unsaved edits — mark a row ready (✓) to Write';
    return 'Draft rows stay in the app until marked ready (✓) · Discard restores last clean draft';
  }

  protected async confirmWriteToFile(ev?: Event): Promise<void> {
    ev?.stopPropagation();
    if (this.busy() || !this.hasReadyToWrite() || !this.canWriteExcel) return;
    const n = this.readyCount();
    const ok = await this.confirmDialog.confirm({
      title: 'Write ready rows to Excel?',
      message:
        `Write ${n} ready row(s) into the Excel file on disk?\n\n` +
        'Draft rows (red date) stay in the app until you mark them ready. ' +
        'Existing Excel history is left untouched.',
      confirmLabel: 'Write',
      cancelLabel: 'Keep editing',
    });
    if (!ok) return;
    await this.saveToFile();
  }

  protected async confirmDiscardEdits(ev?: Event): Promise<void> {
    ev?.stopPropagation();
    if (this.busy() || !this.dirty()) return;
    const ok = await this.confirmDialog.confirm({
      title: 'Discard Edit draft?',
      message:
        'Revert the Edit tab to the last clean draft (after Write, or last sync from Excel while Edit was clean).\n\n' +
        'View tab / Excel file are not changed. Unsaved Edit changes will be lost.',
      confirmLabel: 'Discard',
      cancelLabel: 'Keep editing',
      variant: 'danger',
    });
    if (!ok) return;
    this.fuelStore.discardEditDraft();
    this.pendingInheritedByEvent.set(new Map());
    this.toast.show('Edit draft discarded', 'success');
  }

  protected onColHeadPointerDown(col: FuelColumnDef, ev: PointerEvent): void {
    if (ev.button !== 0) return;
    this.clearKindPressTimer();
    this.kindPressId.set(null);
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

  protected onKindBadgePointerDown(kind: FuelEventKind, ev: PointerEvent): void {
    if (ev.button !== 0) return;
    ev.preventDefault();
    ev.stopPropagation();
    this.clearColPressTimer();
    this.colPressId.set(null);
    this.clearKindPressTimer();
    this.kindPressId.set(kind);
    this.kindPressTimer = setTimeout(() => {
      this.kindPressTimer = null;
      this.kindPressId.set(null);
      this.hideKindByHold(kind);
    }, 550);
  }

  protected onKindBadgePointerUp(ev?: Event): void {
    ev?.stopPropagation();
    this.clearKindPressTimer();
    this.kindPressId.set(null);
  }

  private clearKindPressTimer(): void {
    if (this.kindPressTimer != null) {
      clearTimeout(this.kindPressTimer);
      this.kindPressTimer = null;
    }
  }

  private hideKindByHold(kind: FuelEventKind): void {
    const visible = this.tabUi().visibleKinds;
    if (!visible.includes(kind)) return;
    if (visible.length <= 1) {
      this.toast.showError('Keep at least one event type visible');
      return;
    }
    void this.localPrefs.setVisibleKindsOnActiveTab(visible.filter((k) => k !== kind));
    this.toast.show(`Hidden “${this.kindLabels[kind]}” — restore via Events`, 'success');
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

  /** Convert a value typed in the current display zone back to stored local. */
  private toStoredDateTime(date: string, time: string): { date: string; time: string } {
    if (!this.showUtc()) return { date, time };
    return shiftFuelDateTime(date, time, this.utcOffsetHours());
  }

  protected setActiveTab(tab: FuelPageTab): void {
    // Persist on this PC — stays after leave Fuel / close app. Draft is never discarded.
    if (tab === this.localPrefs.fuelUi().activeTab) {
      this.closeMenus();
      return;
    }
    void this.localPrefs.setFuelUi({ activeTab: tab });
    this.closeMenus();
  }

  protected openAddModal(): void {
    if (!this.canEdit()) {
      this.toast.showError('Switch to the Edit tab to add a row');
      return;
    }
    this.closeDensityHud();
    const editEvents = this.library().editEvents;
    const latest = findLatestFuelEvent(editEvents);
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    // Density is per-row (Excel H). Starter = last value YOU set on this PC, not previous event.
    this.addModalSeed.set({
      id: `fuel-new-${Date.now()}`,
      date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
      place: latest?.place ?? '',
      density: this.library().lastDensity ?? FUEL_DEFAULT_DENSITY,
    });
    this.showAddModal.set(true);
  }

  /**
   * Open ETA → Fuel Edit preview (gaps, duplicates, time tools) before committing rows.
   */
  protected addVoyageFromEta(): void {
    if (!this.canEdit()) {
      this.toast.showError('Switch to the Edit tab to add a voyage');
      return;
    }
    const etaLib = this.storage.etaLibrary();
    const preview = buildEtaFuelVoyagePreview(
      etaLib.draft,
      etaLib.shipUtcOffsetHours,
      this.library().editEvents,
    );
    if (!preview.rows.length) {
      this.toast.showError(
        preview.warnings[0] || 'No Fuel events — set Fuel labels on the ETA plan first',
      );
      return;
    }
    this.etaVoyagePreview.set(preview);
  }

  protected closeEtaVoyagePreview(): void {
    this.etaVoyagePreview.set(null);
  }

  /**
   * View: open FO distance forecast (nm/kn → hours × mt/h → Est. ROB).
   * Prefills legs from the ETA draft; start ROB from the latest View FO stock.
   */
  protected openDistanceForecast(): void {
    const etaLib = this.storage.etaLibrary();
    const plan = etaLib.draft;
    let legs = buildFuelDistanceLegsFromEtaPlan(plan);
    if (!legs.length) {
      legs = [createEmptyFuelDistanceLeg({ fromPort: plan.fromPort, toPort: plan.toPort })];
    }
    const latest = findLatestFuelEvent(this.library().events);
    this.distanceForecast.set({
      legs,
      startRobMt: foRobMtFromFuelEvent(latest),
      planName: (plan.name || '').trim() || 'ETA draft',
    });
  }

  protected closeDistanceForecast(): void {
    this.distanceForecast.set(null);
  }

  protected applyEtaVoyagePreview(rows: EtaFuelVoyagePreviewRow[]): void {
    const preview = this.etaVoyagePreview();
    this.etaVoyagePreview.set(null);
    const seeds = etaFuelVoyagePreviewRowsToEvents(
      rows,
      this.library().lastDensity ?? FUEL_DEFAULT_DENSITY,
    );
    if (!seeds.length) {
      this.toast.showError('No events selected to add');
      return;
    }
    let editEvents = [...this.library().editEvents];
    const pendingMap = new Map(this.pendingInheritedByEvent());
    let added = 0;
    for (const seed of seeds) {
      const prev = findPreviousFuelEvent(editEvents, seed.date, seed.time, seed.id);
      const { patch, inheritedFields } = inheritFuelFieldsFromPrevious(prev);
      const fill: Partial<FuelLogEvent> = {};
      const pending: FuelInheritableField[] = [];
      for (const field of inheritedFields) {
        if (field === 'meRobTank' || field === 'aeRobTank' || field === 'boilerRobTank') continue;
        const cur = seed[field];
        const empty = cur == null || (typeof cur === 'string' && !String(cur).trim());
        if (!empty) continue;
        (fill as Record<string, unknown>)[field] = patch[field];
        pending.push(field);
      }
      const before = findFuelEventBeforePrevious(editEvents, prev);
      const next = createEmptyFuelLogEvent(
        applyFuelEventAutoCalcs({ ...seed, ...fill }, prev, before, this.library().lastDensity),
      );
      editEvents = [...editEvents.filter((e) => e.id !== next.id), next];
      if (pending.length) pendingMap.set(next.id, new Set(pending));
      added++;
    }
    this.fuelStore.replaceEditEvents(cascadeAppAddedFuelRob(editEvents));
    this.pendingInheritedByEvent.set(pendingMap);
    const extra = preview?.warnings.length ? ` · ${preview.warnings[0]}` : '';
    this.toast.show(
      `Added ${added} draft row(s) from ETA — fill fuel, mark ✓, then Write${extra}`,
      'success',
    );
  }

  protected closeAddModal(): void {
    this.showAddModal.set(false);
    this.addModalSeed.set(null);
  }

  protected async confirmDeleteEvent(e: FuelDisplayEvent, ev?: Event): Promise<void> {
    ev?.stopPropagation();
    if (!this.canEdit()) return;
    const label = [e.date, e.time, e.place || e.rawEvent || this.kindLabels[e.kind]]
      .filter(Boolean)
      .join(' · ');
    const ok = await this.confirmDialog.confirm({
      title: 'Delete this row?',
      message:
        `Remove “${label}” from the fuel log?\n\n` +
        'It stays only in memory until you Write to Excel — then the matching Excel row is cleared too.',
      confirmLabel: 'Delete',
      cancelLabel: 'Keep',
      variant: 'danger',
    });
    if (!ok) return;
    this.fuelStore.removeEvent(e.id);
    if (this.pendingInheritedByEvent().has(e.id)) {
      const next = new Map(this.pendingInheritedByEvent());
      next.delete(e.id);
      this.pendingInheritedByEvent.set(next);
    }
    this.toast.show('Row deleted — Write to Excel when ready', 'success');
  }

  protected onAddSave(event: FuelLogEvent): void {
    // After Add modal: fill the new table row from the chronologically
    // previous event’s counters / place / ROB tanks (red until edited).
    const editEvents = this.library().editEvents;
    const prev = findPreviousFuelEvent(editEvents, event.date, event.time, event.id);
    const { patch, inheritedFields } = inheritFuelFieldsFromPrevious(prev);
    // Don’t overwrite fields the user already set in the modal (incl. ROB tanks).
    const fill: Partial<FuelLogEvent> = {};
    const pending: FuelInheritableField[] = [];
    for (const field of inheritedFields) {
      // Never replace Add-modal tank picks — they drive ROB debit.
      if (field === 'meRobTank' || field === 'aeRobTank' || field === 'boilerRobTank') {
        continue;
      }
      const cur = event[field];
      const empty =
        cur == null || (typeof cur === 'string' && !String(cur).trim());
      if (!empty) continue;
      (fill as Record<string, unknown>)[field] = patch[field];
      pending.push(field);
    }

    const before = findFuelEventBeforePrevious(editEvents, prev);
    const next = createEmptyFuelLogEvent(
      applyFuelEventAutoCalcs(
        { ...event, ...fill },
        prev,
        before,
        this.library().lastDensity,
      ),
    );

    // FM / Boiler FM advanced from consumption — not "same as previous" anymore.
    const pendingKept = pending.filter((field) => {
      if (field === 'fmMeAe') return next.fmMeAe == null || next.fmMeAe === prev?.fmMeAe;
      if (field === 'boilerFm') return next.boilerFm == null || next.boilerFm === prev?.boilerFm;
      return true;
    });

    // Re-project ROB on this + later app-added rows; Excel imports stay untouched.
    const merged = [...editEvents.filter((e) => e.id !== next.id), next];
    this.fuelStore.replaceEditEvents(cascadeAppAddedFuelRob(merged));
    if (next.density != null) this.fuelStore.setLastDensity(next.density);
    if (pendingKept.length) {
      const map = new Map(this.pendingInheritedByEvent());
      map.set(next.id, new Set(pendingKept));
      this.pendingInheritedByEvent.set(map);
    }
    this.closeAddModal();
    this.toast.show(
      'Event added as draft — click ✓ when finished, then Write (drafts stay if you close the app)',
      'success',
    );
  }

  protected isCellInherited(eventId: string, field: keyof FuelLogEvent | undefined): boolean {
    if (!field) return false;
    return this.pendingInheritedByEvent().get(eventId)?.has(field as FuelInheritableField) === true;
  }

  private clearInheritedFields(eventId: string, fields: readonly string[]): void {
    const cur = this.pendingInheritedByEvent().get(eventId);
    if (!cur?.size) return;
    let changed = false;
    const nextSet = new Set(cur);
    for (const f of fields) {
      if (nextSet.delete(f as FuelInheritableField)) changed = true;
    }
    if (!changed) return;
    const next = new Map(this.pendingInheritedByEvent());
    if (nextSet.size) next.set(eventId, nextSet);
    else next.delete(eventId);
    this.pendingInheritedByEvent.set(next);
  }

  protected patchEvent(id: string, partial: Partial<FuelLogEvent>): void {
    if (!this.canEdit()) return;
    const editEvents = this.library().editEvents;
    const current = editEvents.find((e) => e.id === id);
    if (!current) return;
    this.clearInheritedFields(id, Object.keys(partial));

    const consumptionPatch: Partial<Pick<FuelLogEvent, 'meMt' | 'aeMt' | 'boilerMt'>> = {};
    if (partial.meMt !== undefined) consumptionPatch.meMt = partial.meMt;
    if (partial.aeMt !== undefined) consumptionPatch.aeMt = partial.aeMt;
    if (partial.boilerMt !== undefined) consumptionPatch.boilerMt = partial.boilerMt;

    const date = partial.date ?? current.date;
    const time = partial.time ?? current.time;
    const prev = findPreviousFuelEvent(editEvents, date, time, current.id);

    let next: FuelLogEvent;
    if (Object.keys(consumptionPatch).length > 0) {
      const before = findFuelEventBeforePrevious(editEvents, prev);
      const { meMt: _me, aeMt: _ae, boilerMt: _boiler, ...rest } = partial;
      next = {
        ...applyFuelConsumptionSideEffects(current, prev, before, consumptionPatch),
        ...rest,
      };
    } else {
      next = { ...current, ...partial };
    }

    // Excel: Total m³ ↔ FM (both directions); Total t = ROUND(m³ × density, 1).
    // When Total t changes → ME/AE default split ~2:1.
    if (
      partial.fmMeAe !== undefined ||
      partial.density !== undefined ||
      partial.totalM3 !== undefined
    ) {
      if (partial.fmMeAe !== undefined && partial.totalM3 === undefined) {
        const m3 = recomputeFuelTotalM3FromFm(next.fmMeAe, prev?.fmMeAe);
        if (m3 != null) next = { ...next, totalM3: m3 };
        else if (partial.fmMeAe === null) next = { ...next, totalM3: null };
      } else if (partial.totalM3 !== undefined && partial.fmMeAe === undefined) {
        const fm = recomputeFuelFmFromTotalM3(prev?.fmMeAe, next.totalM3);
        if (fm != null) next = { ...next, fmMeAe: fm };
      }
      // Keep this row’s density; never pull another row’s factor from Excel.
      const density = resolveFuelDensity(next, null, this.library().lastDensity);
      next = { ...next, density };
      const total = recomputeFuelTotalMtFromM3(next.totalM3, density);
      if (total != null) {
        const split = splitFuelTotalMtToMeAe(total);
        next = { ...next, totalMt: total, meMt: split.meMt, aeMt: split.aeMt };
      } else if (partial.fmMeAe === null && partial.density === undefined) {
        next = { ...next, totalMt: null };
      }
    }

    // Boiler FM ↔ DMA m³ ↔ DMA/Boiler t (no density; t = m³ 1:1).
    if (
      partial.boilerFm !== undefined &&
      partial.dmaConsM3 === undefined &&
      partial.boilerMt === undefined
    ) {
      next = { ...next, ...syncFuelBoilerDmaPeriod(next, prev?.boilerFm, 'boilerFm') };
    } else if (partial.dmaConsM3 !== undefined && partial.boilerFm === undefined) {
      next = { ...next, ...syncFuelBoilerDmaPeriod(next, prev?.boilerFm, 'dmaConsM3') };
    } else if (
      partial.boilerMt !== undefined &&
      partial.boilerFm === undefined &&
      partial.dmaConsM3 === undefined
    ) {
      next = { ...next, ...syncFuelBoilerDmaPeriod(next, prev?.boilerFm, 'boilerMt') };
    }

    // ROB = previous − ME/AE/Boiler + bunker on F-picked tanks.
    // Must run after density/FM/m³ / boiler-DMA may have rewritten amounts.
    const shouldProjectRob =
      Object.keys(consumptionPatch).length > 0 ||
      partial.meRobTank !== undefined ||
      partial.aeRobTank !== undefined ||
      partial.boilerRobTank !== undefined ||
      partial.bunkerRobTank !== undefined ||
      partial.bunkerRmdBioMt !== undefined ||
      partial.bunkerDmaMt !== undefined ||
      partial.fmMeAe !== undefined ||
      partial.density !== undefined ||
      partial.totalM3 !== undefined ||
      partial.boilerFm !== undefined ||
      partial.dmaConsM3 !== undefined ||
      next.meMt !== current.meMt ||
      next.aeMt !== current.aeMt ||
      next.boilerMt !== current.boilerMt;
    if (shouldProjectRob) {
      const before = findFuelEventBeforePrevious(editEvents, prev);
      next = projectFuelRobForEvent(next, prev, before);
    }

    // Running-hours counters ↔ period hours (both directions).
    if (partial.meCounterRh !== undefined && partial.meHours === undefined) {
      const h = recomputeFuelHoursFromCounter(next.meCounterRh, prev?.meCounterRh);
      next = { ...next, meHours: h };
    } else if (partial.meHours !== undefined && partial.meCounterRh === undefined) {
      const c = recomputeFuelCounterFromHours(prev?.meCounterRh, next.meHours);
      if (c != null) next = { ...next, meCounterRh: c };
    }
    if (partial.ae1CounterRh !== undefined && partial.ae1Hours === undefined) {
      const h = recomputeFuelHoursFromCounter(next.ae1CounterRh, prev?.ae1CounterRh);
      next = { ...next, ae1Hours: h };
    } else if (partial.ae1Hours !== undefined && partial.ae1CounterRh === undefined) {
      const c = recomputeFuelCounterFromHours(prev?.ae1CounterRh, next.ae1Hours);
      if (c != null) next = { ...next, ae1CounterRh: c };
    }
    if (partial.ae2CounterRh !== undefined && partial.ae2Hours === undefined) {
      const h = recomputeFuelHoursFromCounter(next.ae2CounterRh, prev?.ae2CounterRh);
      next = { ...next, ae2Hours: h };
    } else if (partial.ae2Hours !== undefined && partial.ae2CounterRh === undefined) {
      const c = recomputeFuelCounterFromHours(prev?.ae2CounterRh, next.ae2Hours);
      if (c != null) next = { ...next, ae2CounterRh: c };
    }
    if (partial.ae3CounterRh !== undefined && partial.ae3Hours === undefined) {
      const h = recomputeFuelHoursFromCounter(next.ae3CounterRh, prev?.ae3CounterRh);
      next = { ...next, ae3Hours: h };
    } else if (partial.ae3Hours !== undefined && partial.ae3CounterRh === undefined) {
      const c = recomputeFuelCounterFromHours(prev?.ae3CounterRh, next.ae3Hours);
      if (c != null) next = { ...next, ae3CounterRh: c };
    }
    if (partial.boilerCounterRh !== undefined && partial.boilerHours === undefined) {
      const h = recomputeFuelHoursFromCounter(next.boilerCounterRh, prev?.boilerCounterRh);
      next = { ...next, boilerHours: h };
    } else if (partial.boilerHours !== undefined && partial.boilerCounterRh === undefined) {
      const c = recomputeFuelCounterFromHours(prev?.boilerCounterRh, next.boilerHours);
      if (c != null) next = { ...next, boilerCounterRh: c };
    }

    // Hrs edit moves the clock (±0.1 h = 6 min). Do not touch date/time if caller set them.
    if (
      partial.timeUsedHours !== undefined &&
      partial.date === undefined &&
      partial.time === undefined
    ) {
      const clock = dateTimeFromFuelHrsEdit(current, partial.timeUsedHours, prev);
      if (clock) next = { ...next, date: clock.date, time: clock.time };
    }

    // Time/date edit → Hrs = elapsed from the new chronological previous.
    if (
      (partial.date !== undefined || partial.time !== undefined) &&
      partial.timeUsedHours === undefined
    ) {
      const prevAfter = findPreviousFuelEvent(
        editEvents,
        next.date,
        next.time,
        current.id,
      );
      const hrs = prevAfter
        ? fuelElapsedHours(prevAfter.date, prevAfter.time, next.date, next.time)
        : null;
      next = { ...next, timeUsedHours: hrs };
    }

    if (partial.rawEvent != null) next.kind = classifyFuelEvent(partial.rawEvent);

    // Data edits demote synced/ready → draft (Write gate).
    const keys = Object.keys(partial).filter((k) => k !== 'writeStatus');
    if (keys.length > 0 && next.writeStatus !== 'draft') {
      next = { ...next, writeStatus: 'draft' };
    }

    // Keep ROB in sync for app-added rows; this row already projected above.
    const merged = editEvents.map((e) => (e.id === id ? next : e));
    const shouldCascadeRob =
      shouldProjectRob ||
      partial.date !== undefined ||
      partial.time !== undefined;
    this.fuelStore.replaceEditEvents(
      shouldCascadeRob ? cascadeAppAddedFuelRob(merged) : merged,
    );
  }

  /** Toggle draft ↔ ready (synced rows stay until edited). */
  protected toggleWriteReady(e: FuelLogEvent, ev?: Event): void {
    ev?.stopPropagation();
    if (!this.canEdit()) return;
    if (e.writeStatus === 'synced') {
      this.toast.show('Already in the Excel file — edit the row to change it', 'info');
      return;
    }
    if (e.writeStatus === 'ready') {
      this.fuelStore.updateEvent(e.id, { writeStatus: 'draft' });
      return;
    }
    if (!fuelEventReadyForWrite(e)) {
      this.toast.showError('Fill date, time, place and event before marking ready');
      return;
    }
    this.fuelStore.updateEvent(e.id, { writeStatus: 'ready' });
  }

  protected writeStatusTitle(status: FuelWriteStatus): string {
    if (status === 'synced') return 'In Excel file';
    if (status === 'ready') return 'Ready to Write — click to hold as draft';
    return 'Draft — click when finished to mark ready for Write';
  }

  protected onCellText(id: string, field: 'place' | 'rawEvent' | 'time', value: string): void {
    this.patchEvent(id, { [field]: value });
  }

  protected onCellDate(id: string, value: string): void {
    this.patchEvent(id, { date: value });
  }

  protected onCellNum(id: string, field: keyof FuelLogEvent, raw: string): void {
    const n = parseFuelHoursInput(raw);
    if (raw.trim() === '') {
      this.patchEvent(id, { [field]: null } as Partial<FuelLogEvent>);
      return;
    }
    if (n == null) return;
    this.patchEvent(id, { [field]: Math.round(n * 10) / 10 } as Partial<FuelLogEvent>);
  }

  /** ↑/↓ ±0.1 (nums) / cycle Place / nudge Time; Enter blurs. */
  protected onCellKeydown(e: FuelDisplayEvent, col: FuelColumnDef, event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      (event.target as HTMLInputElement).blur();
      return;
    }
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    const dir = event.key === 'ArrowUp' ? 1 : -1;

    // Time: ±6 min, Hrs recalculates via patchEvent reverse link.
    if (col.id === 'time' || col.type === 'time') {
      event.preventDefault();
      const shown = this.displayDateTime(e);
      const nudged = shiftFuelDateTime(shown.date, shown.time || '00:00', dir * 0.1);
      const stored = this.toStoredDateTime(nudged.date, nudged.time);
      this.patchEvent(e.id, { date: stored.date, time: stored.time });
      const input = event.target as HTMLInputElement;
      queueMicrotask(() => {
        const updated = this.library().editEvents.find((x) => x.id === e.id);
        if (!updated) return;
        input.value = this.displayDateTime(updated).time;
      });
      return;
    }

    if (!col.field || (col.type !== 'num' && col.type !== 'kw' && col.type !== 'hours')) return;
    event.preventDefault();
    const field = col.field;

    if (field === 'timeUsedHours') {
      // Step the stored event hours (not the rolled display sum) so Time moves ±6 min.
      const stored = this.library().editEvents.find((x) => x.id === e.id);
      const base =
        typeof stored?.timeUsedHours === 'number' && Number.isFinite(stored.timeUsedHours)
          ? stored.timeUsedHours
          : typeof e.timeUsedHours === 'number' && Number.isFinite(e.timeUsedHours)
            ? e.timeUsedHours
            : 0;
      const nextHrs = Math.max(0, Math.round((base + dir * 0.1) * 10) / 10);
      this.patchEvent(e.id, { timeUsedHours: nextHrs });
      const input = event.target as HTMLInputElement;
      queueMicrotask(() => {
        const updated = this.library().editEvents.find((x) => x.id === e.id);
        const hrs = updated?.timeUsedHours ?? nextHrs;
        input.value = this.hoursAsHm() ? formatFuelHoursHm(hrs) : String(hrs);
      });
      return;
    }

    const cur = e[field];
    const base = typeof cur === 'number' && Number.isFinite(cur) ? cur : 0;
    const next = Math.max(0, Math.round((base + dir * 0.1) * 10) / 10);
    this.patchEvent(e.id, { [field]: next } as Partial<FuelLogEvent>);
    const input = event.target as HTMLInputElement;
    queueMicrotask(() => {
      const updated = this.library().editEvents.find((x) => x.id === e.id);
      const shown =
        field === 'meMt' || field === 'aeMt'
          ? (updated?.[field] ?? next)
          : next;
      input.value =
        col.type === 'hours' && this.hoursAsHm() ? formatFuelHoursHm(shown) : String(shown);
    });
  }

  /** Live commit while typing when the value is complete/parseable. */
  protected onEditLive(e: FuelDisplayEvent, col: FuelColumnDef, event: Event): void {
    const input = event.target as HTMLInputElement;
    const raw = input.value;
    if (!this.canLiveCommit(col, raw)) return;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    this.onEditCommit(e, col, raw);
    queueMicrotask(() => {
      if (document.activeElement !== input) return;
      // Sync clamped / paired ME↔AE and time/hours display back into the focused cell.
      if (
        col.id === 'time' ||
        col.type === 'time' ||
        col.type === 'hours' ||
        col.id === 'meMt' ||
        col.id === 'aeMt' ||
        col.id === 'dmaConsMt' ||
        col.id === 'dmaConsM3' ||
        col.id === 'boilerFm'
      ) {
        const updated = this.library().editEvents.find((x) => x.id === e.id);
        if (updated) input.value = this.editValue({ ...e, ...updated }, col);
      }
      if (start != null) {
        const len = input.value.length;
        input.setSelectionRange(Math.min(start, len), Math.min(end ?? start, len));
      }
    });
  }

  protected onPlaceCommit(id: string, value: string): void {
    this.onCellText(id, 'place', value);
  }

  protected onRawEventCommit(id: string, value: string): void {
    this.onCellText(id, 'rawEvent', value);
  }

  private canLiveCommit(col: FuelColumnDef, raw: string): boolean {
    const s = String(raw ?? '').trim();
    if (!s) return false;
    if (col.type === 'time' || col.id === 'time') return parseFuelTimeDisplay(s) != null;
    if (col.type === 'hours' || col.type === 'num' || col.type === 'kw') {
      return parseFuelHoursInput(s) != null;
    }
    return true;
  }

  /** Derived columns (Excel formulas / side-effects) — yellow highlight; Tab skips them. */
  protected isAutoCalcCol(col: FuelColumnDef): boolean {
    return (
      col.id === 'totalM3' ||
      col.id === 'totalMt' ||
      col.id === 'dmaConsM3' ||
      col.id === 'robRmd' ||
      col.id === 'robB100' ||
      col.id === 'robDma' ||
      col.id === 'meHours' ||
      col.id === 'ae1Hours' ||
      col.id === 'ae2Hours' ||
      col.id === 'ae3Hours' ||
      col.id === 'boilerHours'
    );
  }

  /** ME/AE FM must increase vs previous — red when ≤ previous counter. */
  protected isFmInvalid(e: FuelDisplayEvent): boolean {
    if (e.fmMeAe == null || !Number.isFinite(e.fmMeAe)) return false;
    const prev = findPreviousFuelEvent(
      this.canEdit() ? this.library().editEvents : this.library().events,
      e.date,
      e.time,
      e.id,
    );
    if (prev?.fmMeAe == null || !Number.isFinite(prev.fmMeAe)) return false;
    return e.fmMeAe <= prev.fmMeAe;
  }

  /** Open density HUD from the D badge (LMB) or anywhere on Total t (RMB). */
  protected openDensityHud(e: FuelDisplayEvent, event: MouseEvent): void {
    if (!this.canEdit()) return;
    event.preventDefault();
    event.stopPropagation();
    this.closeRobTankMenu();
    this.hideFloatingTips();
    const density = resolveFuelDensity(e, null, this.library().lastDensity);
    this.densityHud.set({
      eventId: e.id,
      density,
      x: event.clientX,
      y: event.clientY,
    });
  }

  protected onTotalMtContextMenu(e: FuelDisplayEvent, event: MouseEvent): void {
    this.openDensityHud(e, event);
  }

  /** Column → ROB tank field for the F badge (ME / AE / Boiler t). */
  protected consumptionRobField(col: FuelColumnDef): FuelRobTankMenuField | null {
    if (col.id === 'meMt') return 'meRobTank';
    if (col.id === 'aeMt') return 'aeRobTank';
    if (col.id === 'dmaConsMt') return 'boilerRobTank';
    if (col.id === 'bunkerRmdBio') return 'bunkerRobTank';
    return null;
  }

  protected isConsumptionFuelCol(col: FuelColumnDef): boolean {
    return this.consumptionRobField(col) != null;
  }

  /** Resolved ROB tank for this consumption / bunker cell (explicit or inferred). */
  protected resolvedRobTank(e: FuelDisplayEvent, field: FuelRobTankMenuField): FuelRobTankId {
    const events = this.canEdit() ? this.library().editEvents : this.library().events;
    const prev = findPreviousFuelEvent(events, e.date, e.time, e.id);
    if (field === 'bunkerRobTank') {
      return resolveBunkerRobTank(e, prev);
    }
    const before = findFuelEventBeforePrevious(events, prev);
    const assignment = resolveFuelRobTankAssignment(e, prev, before);
    if (field === 'meRobTank') return assignment.me;
    if (field === 'aeRobTank') return assignment.ae;
    return assignment.boiler;
  }

  protected openRobTankMenu(e: FuelDisplayEvent, col: FuelColumnDef, event: MouseEvent): void {
    if (!this.canEdit()) return;
    const field = this.consumptionRobField(col);
    if (!field) return;
    event.preventDefault();
    event.stopPropagation();
    this.closeDensityHud();
    this.hideFloatingTips();
    this.robTankMenu.set({
      eventId: e.id,
      field,
      selected: this.resolvedRobTank(e, field),
      x: event.clientX,
      y: event.clientY,
      mode: field === 'bunkerRobTank' ? 'bunker' : 'consume',
    });
  }

  protected selectRobTank(tank: FuelRobTankId): void {
    const menu = this.robTankMenu();
    if (!menu) return;
    if (menu.mode === 'bunker' && tank !== 'rmd' && tank !== 'b100') return;
    this.patchEvent(menu.eventId, { [menu.field]: tank });
    this.closeRobTankMenu();
  }

  protected closeRobTankMenu(): void {
    this.robTankMenu.set(null);
  }

  protected robMenuOptions(menu: FuelRobTankMenu): FuelRobTankId[] {
    if (menu.mode === 'bunker') return ['rmd', 'b100'];
    return this.robTankOptions();
  }

  protected robBadgeTip(e: FuelDisplayEvent, col: FuelColumnDef): string {
    const field = this.consumptionRobField(col);
    if (!field) return 'ROB tank';
    const tank = this.resolvedRobTank(e, field);
    if (field === 'bunkerRobTank') {
      return `Into ROB ${FUEL_ROB_TANK_LABELS[tank]} — click to choose RMD or B100`;
    }
    return `From ROB ${FUEL_ROB_TANK_LABELS[tank]} — click to change`;
  }

  /** Density / ROB menus — close when clicking outside. */
  @HostListener('document:pointerdown', ['$event'])
  protected onFloatingMenusOutside(event: PointerEvent): void {
    const t = event.target;
    if (this.densityHud()) {
      if (!(t instanceof Element && t.closest('.fuel-density-hud'))) {
        this.commitDensityHud();
      }
    }
    if (this.robTankMenu()) {
      if (!(t instanceof Element && t.closest('.fuel-rob-menu, .fuel-rob-badge'))) {
        this.closeRobTankMenu();
      }
    }
  }

  /** ↑/↓ ±0.01 · Shift ↑/↓ ±0.1 (density HUD); Esc closes either floating menu. */
  @HostListener('document:keydown', ['$event'])
  protected onFloatingMenusKeydown(event: KeyboardEvent): void {
    if (this.robTankMenu()) {
      if (event.key === 'Escape') {
        event.preventDefault();
        this.closeRobTankMenu();
      }
      return;
    }
    if (!this.densityHud()) return;
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.nudgeDensityHud(1, event.shiftKey ? 0.1 : 0.01);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.nudgeDensityHud(-1, event.shiftKey ? 0.1 : 0.01);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeDensityHud();
    }
  }

  protected onDensityHudInput(raw: string): void {
    const hud = this.densityHud();
    if (!hud) return;
    const n = normalizeFuelDensity(raw);
    if (n == null) return;
    this.densityHud.set({ ...hud, density: n });
    this.applyDensity(hud.eventId, n, false);
  }

  /** Mouse wheel over Density HUD: ↑ +0.01 / ↓ −0.01 · Shift ±0.1 (same as arrows). */
  protected onDensityHudWheel(event: WheelEvent): void {
    if (!this.densityHud()) return;
    event.preventDefault();
    event.stopPropagation();
    const dir: 1 | -1 = event.deltaY < 0 ? 1 : -1;
    this.nudgeDensityHud(dir, event.shiftKey ? 0.1 : 0.01);
  }

  protected onDensityHudArrow(event: Event, dir: 1 | -1): void {
    const ke = event as KeyboardEvent;
    ke.preventDefault();
    ke.stopPropagation();
    this.nudgeDensityHud(dir, ke.shiftKey ? 0.1 : 0.01);
  }

  protected nudgeDensityHud(dir: 1 | -1, step: 0.01 | 0.1 = 0.01): void {
    const hud = this.densityHud();
    if (!hud) return;
    const next = nudgeFuelDensity(hud.density, dir, step);
    this.densityHud.set({ ...hud, density: next });
    this.applyDensity(hud.eventId, next, false);
  }

  protected commitDensityHud(): void {
    const hud = this.densityHud();
    if (!hud) return;
    this.applyDensity(hud.eventId, hud.density, true);
    this.closeDensityHud();
  }

  protected closeDensityHud(): void {
    this.densityHud.set(null);
  }

  /** Drop hover tips so the density HUD is not covered. */
  private hideFloatingTips(): void {
    document.querySelectorAll('.dg-hint-tooltip').forEach((el) => el.remove());
  }

  private applyDensity(eventId: string, density: number, persistLast: boolean): void {
    this.patchEvent(eventId, { density });
    if (persistLast) this.fuelStore.setLastDensity(density);
  }

  /** Hover tip only — what the field is / how it auto-updates (no keyboard chrome). */
  protected cellTip(col: FuelColumnDef): string {
    return col.tip.trim();
  }

  /** Tip on the Total t cell (replaces Shift+F3 noise on this readonly field). */
  protected densityCellTip(e: Pick<FuelLogEvent, 'density'>): string {
    const d = resolveFuelDensity(e, null, this.library().lastDensity);
    return `Density ${d} — Excel H = ROUND(m³ × density, 1). Click D or right-click (↑↓ ±0.01, Shift ±0.1).`;
  }

  /** Short tip on the D badge only. */
  protected densityBadgeTip(e: Pick<FuelLogEvent, 'density'>): string {
    const d = resolveFuelDensity(e, null, this.library().lastDensity);
    return `Density = ${d}`;
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

  protected async saveToFile(): Promise<void> {
    const path = this.pathDraft().trim() || this.library().sourcePath.trim();
    const api = window.electronAPI;
    if (!api?.readFileBase64 || !api.writeFileBase64 || !/[\\/]/.test(path)) {
      this.toast.showError('Save to file needs the desktop app and a full Excel path');
      return;
    }
    this.busy.set(true);
    try {
      const res = await api.readFileBase64(path);
      if (!res.ok || !res.base64) {
        this.toast.showError(res.error || 'Could not read Excel');
        return;
      }
      const ready = this.library().editEvents.filter((e) => e.writeStatus === 'ready');
      if (!ready.length) {
        this.toast.showError('No rows marked ready — click ✓ on a draft row first');
        return;
      }
      const result = await writeFuelLogToExcelBytes(base64ToBytes(res.base64), ready);
      const write = await api.writeFileBase64(path, bytesToBase64(result.bytes));
      if (!write.ok) {
        this.toast.showError(write.error || 'Could not write Excel');
        return;
      }
      this.fuelStore.markEditPartialWritten(result.written);
      this.pendingInheritedByEvent.set(new Map());
      const left = this.library().editEvents.filter((e) => e.writeStatus !== 'synced').length;
      this.toast.show(
        left
          ? `Wrote ${result.written.length} row(s) — ${left} draft(s) kept in app`
          : `Wrote ${result.written.length} row(s) to Excel`,
        'success',
      );
    } catch (err) {
      this.toast.showError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      this.busy.set(false);
    }
  }

  protected cylSyncTitle(): string {
    if (!this.canWriteExcel) return 'Save to file needs the desktop app';
    if (this.cylHasReady()) {
      return `Write ${this.cylReadyCount()} ready CYL row(s) to Cyl. Oil Consump.`;
    }
    if (!this.cylLibrary().editDirty) return 'No unsaved CYL edits';
    return 'Mark a CYL row ready (✓) to Write';
  }

  protected async confirmWriteCylinder(ev?: Event): Promise<void> {
    ev?.stopPropagation();
    if (this.busy() || !this.cylHasReady() || !this.canWriteExcel) return;
    const n = this.cylReadyCount();
    const ok = await this.confirmDialog.confirm({
      title: 'Write CYL rows to Excel?',
      message: `Write ${n} ready row(s) into sheet “Cyl. Oil Consump.”?\n\nFuel Log MASTER is not changed.`,
      confirmLabel: 'Write',
      cancelLabel: 'Keep editing',
    });
    if (!ok) return;
    await this.saveCylinderToFile();
  }

  protected async confirmDiscardCylinder(ev?: Event): Promise<void> {
    ev?.stopPropagation();
    if (this.busy() || !this.cylLibrary().editDirty) return;
    const ok = await this.confirmDialog.confirm({
      title: 'Discard CYL draft?',
      message: 'Revert Cyl. Oil draft to the last clean snapshot.\nExcel file is not changed.',
      confirmLabel: 'Discard',
      cancelLabel: 'Keep editing',
      variant: 'danger',
    });
    if (!ok) return;
    this.fuelStore.discardCylinderDraft();
    this.toast.show('CYL draft discarded', 'success');
  }

  protected async saveCylinderToFile(): Promise<void> {
    const path = this.pathDraft().trim() || this.library().sourcePath.trim();
    const api = window.electronAPI;
    if (!api?.readFileBase64 || !api.writeFileBase64 || !/[\\/]/.test(path)) {
      this.toast.showError('Save to file needs the desktop app and a full Excel path');
      return;
    }
    this.busy.set(true);
    try {
      const res = await api.readFileBase64(path);
      if (!res.ok || !res.base64) {
        this.toast.showError(res.error || 'Could not read Excel');
        return;
      }
      const ready = this.cylLibrary().editRows.filter((r) => r.writeStatus === 'ready');
      if (!ready.length) {
        this.toast.showError('No CYL rows marked ready');
        return;
      }
      const result = await writeFuelCylinderToExcelBytes(
        base64ToBytes(res.base64),
        ready,
        this.cylLibrary().fmToLitersFactor,
      );
      const write = await api.writeFileBase64(path, bytesToBase64(result.bytes));
      if (!write.ok) {
        this.toast.showError(write.error || 'Could not write Excel');
        return;
      }
      this.fuelStore.markCylinderPartialWritten(result.written);
      const left = this.cylLibrary().editRows.filter((r) => r.writeStatus !== 'synced').length;
      this.toast.show(
        left
          ? `Wrote ${result.written.length} CYL row(s) — ${left} draft(s) kept`
          : `Wrote ${result.written.length} CYL row(s) to Excel`,
        'success',
      );
    } catch (err) {
      this.toast.showError(err instanceof Error ? err.message : 'CYL save failed');
    } finally {
      this.busy.set(false);
    }
  }

  protected onCylFactor(raw: string): void {
    const n = Number(String(raw).replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) return;
    this.fuelStore.setCylinderFactor(n);
  }

  protected patchCylRow(
    row: FuelCylinderRow,
    partial: Partial<FuelCylinderRow>,
  ): void {
    if (!this.canEditCyl()) return;
    this.fuelStore.updateCylinderRow(row.id, {
      ...partial,
      writeStatus: row.writeStatus === 'synced' ? 'draft' : row.writeStatus,
    });
  }

  protected onCylNum(
    row: FuelCylinderRow,
    field: 'flowmeter' | 'litersUsed' | 'receiveLiters',
    raw: string,
  ): void {
    const t = String(raw).trim().replace(',', '.');
    if (!t) {
      this.patchCylRow(row, { [field]: null });
      return;
    }
    const n = Number(t);
    if (!Number.isFinite(n)) return;
    this.patchCylRow(row, { [field]: n });
  }

  protected addCylRow(): void {
    if (!this.canEditCyl()) return;
    const list = this.cylLibrary().editRows;
    const last = list[list.length - 1];
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const row = createEmptyFuelCylinderRow({
      id: `cyl-new-${Date.now()}`,
      sourceRow: 0,
      date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      time: '12:00',
      place: last?.place ?? 'Sea',
      flowmeter: last?.flowmeter ?? null,
      litersUsed: null,
      robLiters: last?.robLiters ?? null,
      writeStatus: 'draft',
    });
    this.fuelStore.replaceCylinderEditRows(
      recomputeFuelCylinderChain([...list, row], this.cylLibrary().fmToLitersFactor),
      true,
    );
  }

  protected removeCylRow(row: FuelCylinderRow): void {
    if (!this.canEditCyl()) return;
    this.fuelStore.removeCylinderRow(row.id);
  }

  protected toggleCylReady(row: FuelCylinderRow): void {
    if (!this.canEditCyl()) return;
    const next: FuelWriteStatus =
      row.writeStatus === 'synced'
        ? 'draft'
        : row.writeStatus === 'draft'
          ? 'ready'
          : 'draft';
    this.fuelStore.updateCylinderRow(row.id, { writeStatus: next });
  }

  protected cylStatusLabel(status: FuelWriteStatus): string {
    if (status === 'ready') return 'Ready';
    if (status === 'draft') return 'Draft';
    return 'Synced';
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
      const keptEdit = this.library().editDirty;
      const keptCyl = this.library().fuelCylinder.editDirty;
      const result = await importFuelLogFromExcelBytes(bytes);
      const cyl = await importFuelCylinderFromExcelBytes(bytes);
      this.fuelStore.replaceFromImport({
        events: result.events,
        sourcePath,
        sourceFileName: fileName,
        sheetName: result.sheetName,
        masterSummary: result.masterSummary,
        cylinderRows: cyl.rows,
        cylinderFactor: cyl.factor,
      });
      const warnParts = [
        ...result.warnings,
        ...cyl.warnings.filter((w) => !/not found/i.test(w)),
      ];
      const warn = warnParts.length ? ` (${warnParts.length} warnings)` : '';
      const cylBit = cyl.rows.length ? ` · CYL ${cyl.rows.length}` : '';
      if (keptEdit || keptCyl) {
        this.toast.show(
          `View updated (${result.events.length} events${cylBit})${warn}. Draft(s) kept.`,
          'success',
        );
      } else {
        this.toast.show(`Imported ${result.events.length} events${cylBit}${warn}`, 'success');
      }
    } catch (err) {
      this.toast.showError(err instanceof Error ? err.message : 'Import failed');
    }
  }

  protected clearData(): void {
    if (!this.canEdit()) {
      this.toast.showError('Switch to the Edit tab to clear');
      return;
    }
    this.fuelStore.clearEditEvents();
    this.pendingInheritedByEvent.set(new Map());
    this.toast.show('Edit draft cleared', 'success');
  }

  /** H:MM parts for red hours / blue minutes when Hours mode is on. */
  protected hoursHmParts(
    e: FuelDisplayEvent,
    col: FuelColumnDef,
  ): { sign: string; hours: string; minutes: string } | null {
    if (!this.hoursAsHm() || col.type !== 'hours') return null;
    return splitFuelHoursHm(this.cellText(e, col));
  }

  /** Clock HH:MM in the current display zone (no UTC suffix). */
  protected displayTimeOnly(e: Pick<FuelLogEvent, 'date' | 'time'>): string {
    return this.displayDateTime(e).time;
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

  protected editValue(e: FuelDisplayEvent, col: FuelColumnDef): string {
    if (col.id === 'date') return this.displayDateTime(e).date;
    if (col.id === 'time') return this.displayDateTime(e).time;
    if (!col.field) return '';
    const v = e[col.field];
    if (v == null) return '';
    if (col.type === 'hours' && this.hoursAsHm()) return formatFuelHoursHm(v as number);
    if (typeof v === 'number') return String(v);
    return String(v);
  }

  protected onEditCommit(e: FuelDisplayEvent, col: FuelColumnDef, raw: string): void {
    if (col.id === 'date') {
      const shown = this.displayDateTime(e);
      const stored = this.toStoredDateTime(raw, shown.time);
      this.patchEvent(e.id, { date: stored.date, time: stored.time });
      return;
    }
    if (col.id === 'time') {
      const parsed = parseFuelTimeDisplay(raw);
      if (parsed == null) return;
      const shown = this.displayDateTime(e);
      const stored = this.toStoredDateTime(shown.date, parsed);
      this.patchEvent(e.id, { date: stored.date, time: stored.time });
      return;
    }
    if (col.id === 'place' || col.id === 'rawEvent') {
      this.onCellText(e.id, col.id, raw);
      return;
    }
    if (col.field && (col.type === 'num' || col.type === 'kw' || col.type === 'hours')) {
      this.onCellNum(e.id, col.field, raw);
    }
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
    if (this.showUpdatedHandoffModal()) {
      this.showUpdatedHandoffModal.set(false);
      return;
    }
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

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}
