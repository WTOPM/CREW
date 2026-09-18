import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DatePickerComponent } from '../../components/date-picker/date-picker.component';
import {
  FUEL_COLUMN_TIPS,
  FUEL_DEFAULT_VISIBLE_KINDS,
  FUEL_EVENT_KIND_LABELS,
  FUEL_LIMIT_OPTIONS,
  filterFuelEvents,
  type FuelEventKind,
} from '../../models/fuel.models';
import { FuelStore } from '../../services/fuel.store';
import { StorageService } from '../../services/storage.service';
import { ToastService } from '../../services/toast.service';
import { importFuelLogFromExcelBytes } from '../../utils/fuel-excel-import.util';
import { formatDisplayDate } from '../../utils/date.util';

const ALL_KINDS = Object.keys(FUEL_EVENT_KIND_LABELS) as FuelEventKind[];

interface FuelPathSegment {
  label: string;
  /** Absolute path to this segment (file or folder). */
  fullPath: string;
  /** Path opened on click (folder or the Excel file itself). */
  openPath: string;
  isFile: boolean;
  isRoot: boolean;
}

@Component({
  selector: 'app-fuel',
  imports: [RouterLink, FormsModule, DatePickerComponent],
  templateUrl: './fuel.component.html',
  styleUrl: './fuel.component.css',
})
export class FuelComponent {
  private readonly storage = inject(StorageService);
  private readonly fuelStore = inject(FuelStore);
  private readonly toast = inject(ToastService);

  protected readonly hasElectronPicker = !!window.electronAPI?.pickExcelFile;
  protected readonly library = this.storage.fuelLibrary;
  protected readonly busy = signal(false);
  /** Re-syncs from persisted data after Ctrl+R / async init (fixes placeholder dots). */
  protected readonly pathDraft = linkedSignal(() => this.library().sourcePath);
  protected readonly kindLabels = FUEL_EVENT_KIND_LABELS;
  protected readonly allKinds = ALL_KINDS;
  protected readonly limitOptions = FUEL_LIMIT_OPTIONS;
  protected readonly colTips = FUEL_COLUMN_TIPS;

  protected readonly visibleEvents = computed(() => {
    const lib = this.library();
    return filterFuelEvents(lib.events, lib.view);
  });

  protected readonly matchCountBeforeLimit = computed(() => {
    const lib = this.library();
    return filterFuelEvents(lib.events, { ...lib.view, limitCount: 0 }).length;
  });

  protected readonly pathSegments = computed(() => parseFuelPathSegments(this.pathDraft()));

  protected kindOn(kind: FuelEventKind): boolean {
    return this.library().view.visibleKinds.includes(kind);
  }

  protected toggleKind(kind: FuelEventKind): void {
    this.fuelStore.toggleKind(kind);
  }

  protected setVpsPreset(): void {
    this.fuelStore.setVisibleKinds([...FUEL_DEFAULT_VISIBLE_KINDS]);
  }

  protected setAllKinds(): void {
    this.fuelStore.setVisibleKinds([...ALL_KINDS]);
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

  protected toggleNewestFirst(): void {
    this.fuelStore.updateView({ newestFirst: !this.library().view.newestFirst });
  }

  protected onLimitCount(value: string | number): void {
    const n = typeof value === 'number' ? value : Number(value);
    this.fuelStore.updateView({ limitCount: Number.isFinite(n) ? n : 20 });
  }

  protected rememberPath(): void {
    const p = this.pathDraft().trim();
    this.fuelStore.setSourcePath(p);
    this.toast.show(p ? 'Excel path saved' : 'Path cleared', 'success');
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
    // Browser fallback: hidden file input triggered from template
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
      const warn = result.warnings.length ? ` (${result.warnings.length} row warnings)` : '';
      this.toast.show(`Imported ${result.events.length} events${warn}`, 'success');
    } catch (err) {
      this.toast.showError(err instanceof Error ? err.message : 'Import failed');
    }
  }

  protected clearData(): void {
    this.fuelStore.clearEvents();
    this.toast.show('Fuel events cleared', 'success');
  }

  protected formatNum(v: number | null): string {
    if (v == null) return '—';
    // Match Excel Fuel Log display (1 decimal).
    return (Math.round(v * 10) / 10).toFixed(1);
  }

  protected formatKw(v: number | null): string {
    if (v == null) return '—';
    // Power is large; one decimal is enough (Excel CENG also uses 0.0).
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
