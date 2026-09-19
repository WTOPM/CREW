import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DatePickerComponent } from '../../components/date-picker/date-picker.component';
import { FuelDisplayModalsComponent } from '../../components/fuel-display-modals/fuel-display-modals.component';
import { FuelEventEditModalComponent } from '../../components/fuel-event-edit-modal/fuel-event-edit-modal.component';
import {
  FUEL_COLUMNS,
  FUEL_DEFAULT_VISIBLE_COLUMNS,
  FUEL_DEFAULT_VISIBLE_KINDS,
  FUEL_EVENT_KIND_LABELS,
  FUEL_LIMIT_OPTIONS,
  classifyFuelEvent,
  filterFuelEvents,
  formatFuelHoursHm,
  parseFuelHoursInput,
  recomputeFuelTotalMt,
  type FuelColumnDef,
  type FuelColumnId,
  type FuelDisplayEvent,
  type FuelEventKind,
  type FuelLogEvent,
} from '../../models/fuel.models';
import { ElectronLocalPrefsService } from '../../services/electron-local-prefs.service';
import { FuelStore } from '../../services/fuel.store';
import { SectionLockService } from '../../services/section-lock.service';
import { StorageService } from '../../services/storage.service';
import { ToastService } from '../../services/toast.service';
import {
  importFuelLogFromExcelBytes,
  writeFuelLogToExcelBytes,
} from '../../utils/fuel-excel-import.util';
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
  imports: [RouterLink, FormsModule, DatePickerComponent, FuelEventEditModalComponent, FuelDisplayModalsComponent],
  templateUrl: './fuel.component.html',
  styleUrl: './fuel.component.css',
})
export class FuelComponent {
  private readonly storage = inject(StorageService);
  private readonly fuelStore = inject(FuelStore);
  private readonly toast = inject(ToastService);
  private readonly localPrefs = inject(ElectronLocalPrefsService);
  private readonly sectionLock = inject(SectionLockService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly tableWrapRef = viewChild<ElementRef<HTMLElement>>('tableWrap');
  private readonly hDockRef = viewChild<ElementRef<HTMLElement>>('hDock');

  protected readonly hasElectronPicker = !!window.electronAPI?.pickExcelFile;
  protected readonly canWriteExcel = !!window.electronAPI?.writeFileBase64;
  protected readonly library = this.storage.fuelLibrary;
  protected readonly busy = signal(false);
  protected readonly dirty = signal(false);
  protected readonly editMode = signal(false);
  protected readonly showAddModal = signal(false);
  protected readonly showDisplaySaveModal = signal(false);
  protected readonly showDisplayLoadModal = signal(false);
  protected readonly eventsMenuOpen = signal(false);
  protected readonly columnsMenuOpen = signal(false);
  /** Viewport coords for fixed Events/Columns menus (avoids overflow clipping). */
  protected readonly menuAnchor = signal<{ top: number; left: number; width: number } | null>(null);
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

  protected readonly fuelUi = this.localPrefs.fuelUi;
  protected readonly hoursAsHm = computed(() => this.fuelUi().hoursAsHm);
  protected readonly viewOnly = computed(
    () => this.sectionLock.readOnly() || !!this.sectionLock.displacedBy(),
  );

  protected readonly visibleColumnDefs = computed(() => {
    const ids = new Set(this.fuelUi().visibleColumns);
    return FUEL_COLUMNS.filter((c) => ids.has(c.id));
  });

  protected readonly visibleEvents = computed(() => {
    const lib = this.library();
    return filterFuelEvents(lib.events, lib.view);
  });

  protected readonly matchCountBeforeLimit = computed(() => {
    const lib = this.library();
    return filterFuelEvents(lib.events, { ...lib.view, limitCount: 0 }).length;
  });

  protected readonly pathSegments = computed(() => parseFuelPathSegments(this.pathDraft()));

  protected readonly selectedKindsLabel = computed(() => {
    const n = this.library().view.visibleKinds.length;
    if (n === 0) return 'No events';
    if (n === ALL_KINDS.length) return 'All events';
    if (
      n === FUEL_DEFAULT_VISIBLE_KINDS.length &&
      FUEL_DEFAULT_VISIBLE_KINDS.every((k) => this.library().view.visibleKinds.includes(k))
    ) {
      return 'VPS events';
    }
    return `${n} event types`;
  });

  constructor() {
    void this.localPrefs.load().then(() => {
      const legacy = this.localPrefs.takeLegacyFuelDisplayPresets();
      if (legacy.length) this.fuelStore.importDisplayPresetsIfEmpty(legacy);
    });

    afterNextRender(() => this.bindHScrollObservers());

    effect(() => {
      // Remeasure when columns / rows change.
      this.visibleColumnDefs();
      this.visibleEvents();
      queueMicrotask(() => this.measureHScrollDock());
    });
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
    return this.library().view.visibleKinds.includes(kind);
  }

  protected toggleKind(kind: FuelEventKind): void {
    this.fuelStore.toggleKind(kind);
  }

  protected selectAllKinds(): void {
    this.fuelStore.setVisibleKinds([...ALL_KINDS]);
  }

  protected clearAllKinds(): void {
    this.fuelStore.setVisibleKinds([]);
  }

  protected columnOn(id: FuelColumnId): boolean {
    return this.fuelUi().visibleColumns.includes(id);
  }

  protected async toggleColumn(id: FuelColumnId): Promise<void> {
    const set = new Set(this.fuelUi().visibleColumns);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    const next = FUEL_COLUMNS.map((c) => c.id).filter((c) => set.has(c));
    await this.localPrefs.setFuelVisibleColumns(next.length ? next : [...FUEL_DEFAULT_VISIBLE_COLUMNS]);
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
    this.fuelStore.updateView({ search: value });
  }

  protected onDateFrom(value: string): void {
    this.fuelStore.updateView({ dateFrom: value });
  }

  protected onDateTo(value: string): void {
    this.fuelStore.updateView({ dateTo: value });
  }

  protected onLimitCount(value: string | number): void {
    const n = typeof value === 'number' ? value : Number(value);
    this.fuelStore.updateView({ limitCount: Number.isFinite(n) ? n : 20 });
  }

  protected async setHoursAsHm(enabled: boolean): Promise<void> {
    await this.localPrefs.setFuelHoursAsHm(enabled);
  }

  protected setEditMode(enabled: boolean): void {
    if (enabled && this.viewOnly()) {
      this.toast.showError('Someone else is editing FUEL — view only');
      return;
    }
    this.editMode.set(enabled);
  }

  protected openAddModal(): void {
    if (this.viewOnly()) {
      this.toast.showError('Someone else is editing FUEL — view only');
      return;
    }
    if (!this.editMode()) {
      this.toast.showError('Turn on Edit first');
      return;
    }
    this.showAddModal.set(true);
  }

  protected onAddSave(event: FuelLogEvent): void {
    this.fuelStore.upsertEvent(event);
    this.dirty.set(true);
    this.showAddModal.set(false);
    this.toast.show('Event added — Save to file when ready', 'success');
  }

  protected patchEvent(id: string, partial: Partial<FuelLogEvent>): void {
    if (!this.editMode() || this.viewOnly()) return;
    const current = this.library().events.find((e) => e.id === id);
    if (!current) return;
    let next = { ...current, ...partial };
    if (partial.rawEvent != null) next.kind = classifyFuelEvent(partial.rawEvent);
    if (partial.meMt !== undefined || partial.aeMt !== undefined) {
      next.totalMt = recomputeFuelTotalMt(next.meMt, next.aeMt);
    }
    this.fuelStore.updateEvent(id, next);
    this.dirty.set(true);
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
      const path = await electron.pickExcelFile();
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
    if (this.viewOnly()) {
      this.toast.showError('Someone else is editing FUEL — cannot save');
      return;
    }
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
      const nextBytes = await writeFuelLogToExcelBytes(base64ToBytes(res.base64), this.library().events);
      const write = await api.writeFileBase64(path, bytesToBase64(nextBytes));
      if (!write.ok) {
        this.toast.showError(write.error || 'Could not write Excel');
        return;
      }
      this.dirty.set(false);
      this.toast.show('Saved to Excel file', 'success');
    } catch (err) {
      this.toast.showError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      this.busy.set(false);
    }
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
        this.toast.showError(res.error || 'Could not read Excel');
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
      });
      this.dirty.set(false);
      this.editMode.set(false);
      const warn = result.warnings.length ? ` (${result.warnings.length} row warnings)` : '';
      this.toast.show(`Imported ${result.events.length} events${warn}`, 'success');
    } catch (err) {
      this.toast.showError(err instanceof Error ? err.message : 'Import failed');
    }
  }

  protected clearData(): void {
    if (this.viewOnly()) {
      this.toast.showError('Someone else is editing FUEL — cannot clear');
      return;
    }
    this.fuelStore.clearEvents();
    this.dirty.set(false);
    this.editMode.set(false);
    this.toast.show('Fuel events cleared', 'success');
  }

  protected cellText(e: FuelDisplayEvent, col: FuelColumnDef): string {
    if (col.id === 'kind') return this.kindLabels[e.kind];
    if (col.id === 'date') return this.formatDate(e.date);
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
    if (col.id === 'date') return e.date;
    if (!col.field) return '';
    const v = e[col.field];
    if (v == null) return '';
    if (col.type === 'hours' && this.hoursAsHm()) return formatFuelHoursHm(v as number);
    if (typeof v === 'number') return String(v);
    return String(v);
  }

  protected onEditCommit(e: FuelDisplayEvent, col: FuelColumnDef, raw: string): void {
    if (col.id === 'date') {
      this.onCellDate(e.id, raw);
      return;
    }
    if (col.id === 'time' || col.id === 'place' || col.id === 'rawEvent') {
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
