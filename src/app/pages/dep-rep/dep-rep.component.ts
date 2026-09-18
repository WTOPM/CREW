import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DatePickerComponent } from '../../components/date-picker/date-picker.component';
import { PortSelectComponent } from '../../components/port-select/port-select.component';
import {
  portCode,
  shipFieldUpdatedMessage,
} from '../../models/crew.models';
import {
  depRepMidDraftMetres,
  depRepSheetName,
  lookupDepRepLibraryDensity,
} from '../../models/dep-rep.models';
import {
  buildManifestClassWeightRows,
  type ManifestClassWeightRow,
} from '../../utils/dg-manifest-summary.util';
import {
  buildDepRepCellUpdates,
  readDepRepDensityTable,
  readDepRepSheetSnapshot,
} from '../../utils/dep-rep-excel.util';
import { normalizeShipMetresInput } from '../../services/airdraft-field-positions';
import { DepRepStore } from '../../services/dep-rep.store';
import { DgManifestStore } from '../../services/dg-manifest.store';
import { PdfDepRepService } from '../../services/pdf-dep-rep.service';
import { StorageService } from '../../services/storage.service';
import { ToastService } from '../../services/toast.service';

type DraftField = 'draftFore' | 'draftAft';

interface DepRepPathSegment {
  label: string;
  fullPath: string;
  openPath: string;
  isFile: boolean;
  isRoot: boolean;
}

@Component({
  selector: 'app-dep-rep',
  imports: [RouterLink, FormsModule, PortSelectComponent, DatePickerComponent],
  templateUrl: './dep-rep.component.html',
  styleUrl: './dep-rep.component.css',
})
export class DepRepComponent {
  private readonly storage = inject(StorageService);
  private readonly depRepStore = inject(DepRepStore);
  private readonly dg = inject(DgManifestStore);
  private readonly depRepPdf = inject(PdfDepRepService);
  private readonly toast = inject(ToastService);

  protected readonly hasElectronPicker = !!window.electronAPI?.pickExcelFile;
  protected readonly library = this.storage.depRepLibrary;
  protected readonly ship = this.storage.ship;
  protected readonly ports = this.storage.ports;
  protected readonly dgLibrary = this.storage.dgLibrary;
  protected readonly busy = signal(false);
  protected readonly pathDraft = linkedSignal(() => this.library().sourcePath);
  protected readonly sheetStatus = signal<string>('');
  protected readonly sheetStatusKind = signal<'ok' | 'missing' | ''>('');
  /** When set, dropdown shows this port instead of auto-POL. */
  private readonly densitySelectOverride = signal<string | null>(null);

  private metresSnapshot = '';
  private metresDraft = signal<{ field: DraftField; value: string } | null>(null);

  protected readonly pageContext = computed(() => this.dgLibrary().pageContext);

  protected readonly polCode = computed(() =>
    portCode(this.pageContext().portOfCall, this.ports()),
  );
  protected readonly podCode = computed(() =>
    portCode(this.pageContext().nextPortOfCall, this.ports()),
  );

  protected readonly sheetName = computed(() =>
    depRepSheetName(this.ship().voyageNumber, this.polCode()),
  );

  protected readonly midDraft = computed(() =>
    depRepMidDraftMetres(this.ship().draftFore, this.ship().draftAft),
  );

  protected readonly pathSegments = computed(() => parseDepRepPathSegments(this.pathDraft()));

  protected readonly densities = computed(() => this.library().densities ?? []);

  protected readonly polDensity = computed(() =>
    lookupDepRepLibraryDensity(this.densities(), this.polCode()),
  );

  protected readonly densitySelectPort = computed(() => {
    const list = this.densities();
    const override = this.densitySelectOverride();
    if (override && list.some((d) => d.port === override)) return override;
    const pol = this.polCode();
    if (pol && list.some((d) => d.port === pol)) return pol;
    return '';
  });

  protected readonly densityEditValue = linkedSignal(() => {
    const port = this.densitySelectPort();
    if (!port) return '';
    return this.densities().find((d) => d.port === port)?.density ?? '';
  });

  protected readonly classRows = computed((): ManifestClassWeightRow[] => {
    const lib = this.dgLibrary();
    const ufRows = lib.unifeeder.onboard.filter((r) => r.status === 'onboard');
    const cmaLines = lib.onboard
      .filter((c) => c.status === 'onboard')
      .flatMap((c) => c.lines);
    const fromUf = buildManifestClassWeightRows(
      ufRows,
      lib.unifeeder.useGrossWeight,
      lib.unifeeder.roundWeights,
    );
    const fromCma = buildManifestClassWeightRows(
      cmaLines,
      lib.manifestUseGrossWeight,
      lib.manifestRoundWeights,
    );
    if (!fromUf.length) return fromCma;
    if (!fromCma.length) return fromUf;
    const map = new Map<string, ManifestClassWeightRow>();
    for (const row of [...fromUf, ...fromCma]) {
      const key = row.dgClass.replace(',', '.').toLowerCase();
      const prev = map.get(key);
      if (!prev) map.set(key, { ...row });
      else map.set(key, { dgClass: prev.dgClass, totalKg: prev.totalKg + row.totalKg });
    }
    return [...map.values()].sort((a, b) => a.dgClass.localeCompare(b.dgClass));
  });

  protected onDensitySelect(port: string): void {
    const p = port.trim().toUpperCase();
    this.densitySelectOverride.set(p || null);
  }

  protected saveDensityEdit(): void {
    const port = this.densitySelectPort() || this.polCode();
    const dens = this.densityEditValue().trim();
    if (!port || !dens) return;
    this.depRepStore.upsertDensity(port, dens);
    this.densitySelectOverride.set(port);
  }

  protected addPolDensity(): void {
    const pol = this.polCode();
    if (!pol) {
      this.toast.showError('Set POL first');
      return;
    }
    const dens = this.densityEditValue().trim() || '1.025';
    this.depRepStore.upsertDensity(pol, dens);
    this.densitySelectOverride.set(pol);
    this.toast.show(`Density saved for ${pol}`, 'success');
  }

  protected removeSelectedDensity(): void {
    const port = this.densitySelectPort();
    if (!port) return;
    this.depRepStore.removeDensity(port);
    this.densitySelectOverride.set(null);
    this.toast.show(`Removed density for ${port}`, 'success');
  }

  protected async onPathSegmentPress(seg: DepRepPathSegment, event: MouseEvent): Promise<void> {
    if (event.button !== 0) return;
    event.preventDefault();
    const api = window.electronAPI;
    if (!api?.openDirectory) {
      this.toast.showError(
        seg.isFile ? 'Open file only works in the desktop app' : 'Open folder only works in the desktop app',
      );
      return;
    }
    const res = await api.openDirectory(seg.openPath);
    if (!res.ok) {
      this.toast.showError(res.error || (seg.isFile ? 'Could not open file' : 'Could not open folder'));
    }
  }

  protected async pickExcel(): Promise<void> {
    const path = await window.electronAPI?.pickExcelFile();
    if (!path) return;
    this.pathDraft.set(path);
    this.depRepStore.setSourcePath(path);
    this.toast.show('DEP REP path saved', 'success');
    void this.refreshFromSheet();
  }

  protected onFileChosen(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.pathDraft.set(file.name);
    this.depRepStore.setSourcePath(file.name);
    input.value = '';
    this.toast.show('Browser mode: use Electron to write DEP REP.xlsx', 'info');
  }

  protected onVoyageChange(value: string): void {
    this.storage.updateShip({ voyageNumber: value }, 'saved', shipFieldUpdatedMessage('voyageNumber'));
    this.sheetStatus.set('');
    this.sheetStatusKind.set('');
  }

  protected onPolChange(value: string): void {
    this.dg.updateDgPageContext({ portOfCall: value });
    this.storage.updateShip({ portOfCall: value }, 'saved', shipFieldUpdatedMessage('portOfCall'));
    this.sheetStatus.set('');
    this.sheetStatusKind.set('');
    this.densitySelectOverride.set(null);
  }

  protected onPodChange(value: string): void {
    this.dg.updateDgPageContext({ nextPortOfCall: value });
    this.storage.updateShip(
      { nextPortOfCall: value },
      'saved',
      shipFieldUpdatedMessage('nextPortOfCall'),
    );
  }

  protected onDepartureDateChange(value: string): void {
    this.dg.updateDgPageContext({ dateOfDeparture: value });
    this.storage.updateShip(
      { dateOfDeparture: value },
      'saved',
      shipFieldUpdatedMessage('dateOfDeparture'),
    );
  }

  protected onTotalCargoChange(value: string): void {
    this.depRepStore.setTotalCargo(value);
  }

  protected metresFieldValue(field: DraftField): string {
    const draft = this.metresDraft();
    if (draft?.field === field) return draft.value;
    return this.ship()[field] ?? '';
  }

  protected onMetresFocus(field: DraftField, event: FocusEvent): void {
    const input = event.target as HTMLInputElement;
    this.metresSnapshot = this.ship()[field] ?? '';
    this.metresDraft.set({ field, value: input.value });
    queueMicrotask(() => input.select());
  }

  protected onMetresInput(field: DraftField, event: Event): void {
    const input = event.target as HTMLInputElement;
    this.metresDraft.set({ field, value: input.value });
  }

  protected onMetresBlur(field: DraftField, event: Event): void {
    const input = event.target as HTMLInputElement;
    const normalized = normalizeShipMetresInput(input.value);
    if (normalized == null) {
      input.value = this.metresSnapshot;
      this.metresDraft.set(null);
      this.toast.showError('Enter a number in metres (e.g. 9.2)');
      return;
    }
    input.value = normalized;
    this.metresDraft.set(null);
    if (this.ship()[field] === normalized) return;
    this.storage.updateShip({ [field]: normalized }, 'saved', shipFieldUpdatedMessage(field));
  }

  protected async refreshFromSheet(): Promise<void> {
    const path = this.library().sourcePath.trim() || this.pathDraft().trim();
    if (!path) {
      this.toast.showError('Choose DEP REP.xlsx path first');
      return;
    }
    const name = this.sheetName();
    if (!name) {
      this.toast.showError('Set voyage and POL (port of call) first');
      return;
    }
    if (!window.electronAPI?.readFileBase64) {
      this.toast.showError('Refresh requires the desktop app');
      return;
    }

    this.busy.set(true);
    try {
      const read = await window.electronAPI.readFileBase64(path);
      if (!read.ok || !read.base64) {
        this.toast.showError(read.error ?? 'Could not read DEP REP.xlsx');
        return;
      }
      const bytes = Uint8Array.from(atob(read.base64), (c) => c.charCodeAt(0));
      await this.importDensitiesFromExcel(bytes);

      const snap = await readDepRepSheetSnapshot(bytes, name);
      if (!snap.exists) {
        this.sheetStatus.set(`No data — sheet "${name}" not found`);
        this.sheetStatusKind.set('missing');
        this.toast.show(`No data for sheet "${name}"`, 'info');
        return;
      }

      if (snap.totalCargo) this.depRepStore.setTotalCargo(snap.totalCargo);
      if (snap.podCode) {
        const podName =
          this.ports().find((p) => p.code.trim().toUpperCase() === snap.podCode)?.name ??
          snap.podCode;
        this.dg.updateDgPageContext({ nextPortOfCall: podName });
        this.storage.updateShip(
          { nextPortOfCall: podName },
          'saved',
          shipFieldUpdatedMessage('nextPortOfCall'),
        );
      }
      if (snap.departureDate) {
        this.dg.updateDgPageContext({ dateOfDeparture: snap.departureDate });
        this.storage.updateShip(
          { dateOfDeparture: snap.departureDate },
          'saved',
          shipFieldUpdatedMessage('dateOfDeparture'),
        );
      }
      const aft = normalizeShipMetresInput(snap.draftAft);
      const fore = normalizeShipMetresInput(snap.draftFore);
      const shipPatch: { draftAft?: string; draftFore?: string } = {};
      if (aft != null) shipPatch.draftAft = aft;
      if (fore != null) shipPatch.draftFore = fore;
      if (Object.keys(shipPatch).length) {
        this.storage.updateShip(shipPatch, 'saved', 'Drafts loaded from DEP REP sheet');
      }
      if (snap.density && this.polCode() && !this.polDensity()) {
        this.depRepStore.upsertDensity(this.polCode(), snap.density);
      }
      this.densitySelectOverride.set(null);

      this.sheetStatus.set(`Loaded from sheet "${snap.sheetName}"`);
      this.sheetStatusKind.set('ok');
      this.toast.show(`Loaded "${snap.sheetName}"`, 'success');
    } catch (e) {
      this.toast.showError(e instanceof Error ? e.message : 'Failed to refresh from sheet');
    } finally {
      this.busy.set(false);
    }
  }

  protected async exportPdf(): Promise<void> {
    const path = this.library().sourcePath.trim() || this.pathDraft().trim();
    if (!path) {
      this.toast.showError('Choose DEP REP.xlsx path first');
      return;
    }
    const name = this.sheetName();
    if (!name) {
      this.toast.showError('Set voyage and POL first');
      return;
    }
    this.busy.set(true);
    try {
      const ok = await this.depRepPdf.openFromExcel(path, name);
      if (ok) this.toast.show('DEP REP PDF opened (from Excel)', 'success');
      else this.toast.showError('Could not open PDF');
    } catch (e) {
      this.toast.showError(e instanceof Error ? e.message : 'PDF export failed');
    } finally {
      this.busy.set(false);
    }
  }

  protected async writeToExcel(): Promise<void> {
    const path = this.library().sourcePath.trim() || this.pathDraft().trim();
    if (!path) {
      this.toast.showError('Choose DEP REP.xlsx path first');
      return;
    }
    const name = this.sheetName();
    if (!name) {
      this.toast.showError('Set voyage and POL (port of call) first');
      return;
    }
    if (!this.polCode()) {
      this.toast.showError('POL needs a UN/LOCODE on the selected port');
      return;
    }

    this.busy.set(true);
    try {
      const electron = window.electronAPI;
      if (!electron?.writeDepRepSheet) {
        this.toast.showError('Writing DEP REP requires the desktop app with Excel');
        return;
      }
      const ship = this.ship();
      const updates = buildDepRepCellUpdates({
        sheetName: name,
        voyage: ship.voyageNumber,
        polCode: this.polCode(),
        podCode: this.podCode(),
        departureDate: this.pageContext().dateOfDeparture || ship.dateOfDeparture,
        draftAft: ship.draftAft,
        draftFore: ship.draftFore,
        totalCargo: this.library().totalCargo,
        waterDensity: this.polDensity(),
        classRows: this.classRows(),
        heightKeelToMastTop: ship.heightKeelToMastTop,
        mouldedDepth: ship.mouldedDepth,
      });
      const result = await electron.writeDepRepSheet(path, {
        sheetName: name,
        updates,
      });
      if (!result.ok) {
        this.toast.showError(result.error ?? 'Could not write DEP REP.xlsx');
        return;
      }
      const sheet = result.sheetName || name;
      this.depRepStore.markWritten(sheet);
      this.sheetStatus.set(
        result.created ? `Created sheet "${sheet}"` : `Updated sheet "${sheet}"`,
      );
      this.sheetStatusKind.set('ok');
      this.toast.show(
        result.created ? `Created sheet "${sheet}"` : `Updated sheet "${sheet}"`,
        'success',
      );
    } catch (e) {
      this.toast.showError(e instanceof Error ? e.message : 'Failed to write DEP REP');
    } finally {
      this.busy.set(false);
    }
  }

  /** Pull PORT/DENSITY from Excel K:L into the app list (missing ports only). */
  private async importDensitiesFromExcel(bytes: Uint8Array): Promise<void> {
    try {
      const table = await readDepRepDensityTable(bytes);
      if (!table.size) return;
      this.depRepStore.mergeDensities(
        [...table.entries()].map(([port, density]) => ({
          port,
          density: String(density),
        })),
      );
    } catch {
      /* ignore import failures */
    }
  }
}

function parseDepRepPathSegments(raw: string): DepRepPathSegment[] {
  const p = String(raw ?? '').trim();
  if (!p) return [];
  const sep = p.includes('\\') ? '\\' : '/';
  const segs: DepRepPathSegment[] = [];

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
    const part = parts[i]!;
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
