import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { PhoneDirectoryRow } from '../../models/phone.models';
import { PhoneStore } from '../../services/phone.store';
import { StorageService } from '../../services/storage.service';
import { ToastService } from '../../services/toast.service';
import { syncPhoneSurnamesFromCrew } from '../../utils/phone-crew-sync.util';
import {
  base64ToBytes,
  bytesToBase64,
  importPhoneDirectoryFromExcelBytes,
  writePhoneDirectoryToExcelBytes,
} from '../../utils/phone-excel.util';

interface PhonePathSegment {
  label: string;
  fullPath: string;
  openPath: string;
  isFile: boolean;
  isRoot: boolean;
}

@Component({
  selector: 'app-phone',
  imports: [RouterLink, FormsModule],
  templateUrl: './phone.component.html',
  styleUrl: './phone.component.css',
})
export class PhoneComponent {
  private readonly storage = inject(StorageService);
  private readonly phoneStore = inject(PhoneStore);
  private readonly toast = inject(ToastService);

  protected readonly hasElectronPicker = !!window.electronAPI?.pickExcelFile;
  protected readonly canWriteExcel = !!window.electronAPI?.writeFileBase64;
  protected readonly library = this.storage.phoneLibrary;
  protected readonly busy = signal(false);
  protected readonly dirty = signal(false);
  /** Manual cell edits only when checked. */
  protected readonly editingEnabled = signal(false);
  /** When on (default): Update pulls surnames only via Cabin match. */
  protected readonly cabinOnlySync = signal(true);
  /** Name cells pulled/changed on Update — cleared after Save to Excel. */
  protected readonly pulledNameRows = signal<ReadonlySet<number>>(new Set());
  protected readonly pathDraft = linkedSignal(() => this.library().sourcePath);

  protected readonly pathSegments = computed(() => parsePhonePathSegments(this.pathDraft()));
  protected readonly rowCount = computed(() => this.library().rows.length);
  protected readonly pulledCount = computed(() => this.pulledNameRows().size);

  protected rememberPath(): void {
    const p = this.pathDraft().trim();
    this.phoneStore.setSourcePath(p);
    this.toast.show(p ? 'Excel path saved' : 'Path cleared', 'success');
  }

  protected async onPathSegmentPress(seg: PhonePathSegment, event: MouseEvent): Promise<void> {
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
    if (!electron?.pickExcelFile) return;
    const path = await electron.pickExcelFile();
    if (!path) return;
    this.pathDraft.set(path);
    this.phoneStore.setSourcePath(path);
    await this.loadFromPath(path);
  }

  protected async onFileChosen(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.pathDraft.set(file.name);
    this.phoneStore.setSourcePath(file.name);
    await this.loadFromFile(file, file.name, file.name);
  }

  protected async uploadOrUpdate(): Promise<void> {
    const path = this.pathDraft().trim() || this.library().sourcePath.trim();
    if (!path) {
      this.toast.showError('Choose an Excel file or enter a path first');
      return;
    }
    if (window.electronAPI?.readFileBase64 && /[\\/]/.test(path)) {
      this.phoneStore.setSourcePath(path);
      await this.loadFromPath(path);
      return;
    }
    this.toast.showError('Use Browse to pick the Excel file (path reload needs the desktop app)');
  }

  protected onCellChange(
    excelRow: number,
    field: keyof Omit<PhoneDirectoryRow, 'excelRow'>,
    value: string,
  ): void {
    if (!this.editingEnabled()) return;
    this.phoneStore.updateRow(excelRow, { [field]: value });
    this.dirty.set(true);
    if (field === 'name') {
      // Manual edit drops the “pulled” highlight for that row.
      const next = new Set(this.pulledNameRows());
      next.delete(excelRow);
      this.pulledNameRows.set(next);
    }
  }

  protected isNamePulled(excelRow: number): boolean {
    return this.pulledNameRows().has(excelRow);
  }

  protected async saveToExcel(): Promise<void> {
    const api = window.electronAPI;
    const path = this.pathDraft().trim() || this.library().sourcePath.trim();
    if (!api?.readFileBase64 || !api.writeFileBase64 || !/[\\/]/.test(path)) {
      this.toast.showError('Save to Excel needs the desktop app and a full file path');
      return;
    }
    this.busy.set(true);
    try {
      const read = await api.readFileBase64(path);
      if (!read.ok || !read.base64) {
        this.toast.showError(read.error || 'Could not read Excel for save');
        return;
      }
      const nextBytes = await writePhoneDirectoryToExcelBytes(
        base64ToBytes(read.base64),
        this.library().rows,
        this.library().title,
      );
      const write = await api.writeFileBase64(path, bytesToBase64(nextBytes));
      if (!write.ok) {
        this.toast.showError(write.error || 'Could not write Excel');
        return;
      }
      this.dirty.set(false);
      this.pulledNameRows.set(new Set());
      this.toast.show('Saved to Excel', 'success');
    } catch (err) {
      this.toast.showError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      this.busy.set(false);
    }
  }

  protected clearData(): void {
    this.phoneStore.clearDirectory();
    this.dirty.set(false);
    this.pulledNameRows.set(new Set());
    this.editingEnabled.set(false);
    this.toast.show('Phone directory cleared', 'success');
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
      await this.applyImport(base64ToBytes(res.base64), path, path.split(/[/\\]/).pop() || 'phone.xlsx');
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
      const result = await importPhoneDirectoryFromExcelBytes(bytes);
      const synced = syncPhoneSurnamesFromCrew(result.rows, this.storage.allCrew(), {
        cabinOnly: this.cabinOnlySync(),
      });
      this.phoneStore.replaceFromImport({
        rows: synced.rows,
        sourcePath,
        sourceFileName: fileName,
        sheetName: result.sheetName,
        title: result.title,
      });
      this.dirty.set(synced.changedExcelRows.length > 0);
      this.pulledNameRows.set(new Set(synced.changedExcelRows));
      const pulled = synced.changedExcelRows.length;
      const msg =
        pulled > 0
          ? `Loaded ${result.rows.length} rows · ${pulled} surname(s) from crew`
          : `Loaded ${result.rows.length} rows`;
      this.toast.show(msg, 'success');
    } catch (err) {
      this.toast.showError(err instanceof Error ? err.message : 'Import failed');
    }
  }
}

function parsePhonePathSegments(raw: string): PhonePathSegment[] {
  const p = String(raw ?? '').trim();
  if (!p) return [];
  const sep = p.includes('\\') ? '\\' : '/';
  const segs: PhonePathSegment[] = [];

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
