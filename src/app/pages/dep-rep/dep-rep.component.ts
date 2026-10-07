import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DatePickerComponent } from '../../components/date-picker/date-picker.component';
import { PortSelectComponent } from '../../components/port-select/port-select.component';
import { portCode } from '../../models/crew.models';
import {
  depRepMidDraftMetres,
  depRepSheetName,
  lookupDepRepLibraryDensity,
} from '../../models/dep-rep.models';
import {
  buildManifestClassWeightRows,
  type ManifestClassWeightRow,
} from '../../utils/dg-manifest-summary.util';
import { DG_IMDG_CLASSES } from '../../utils/dg-imdg-class.util';
import {
  buildDepRepCellUpdates,
  readDepRepLatestRefreshData,
  type DepRepSheetSnapshot,
} from '../../utils/dep-rep-excel.util';
import {
  airdraftHeightAboveWaterMetres,
  normalizeShipMetresInput,
  parseAirdraftMetres,
} from '../../services/airdraft-field-positions';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
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

interface DepRepDgEditRow {
  id: string;
  dgClass: string;
  weightKg: string;
}

/** One in-memory sheet tab (previous = update, new = create). */
interface DepRepTabWorkspace {
  /** Excel tab name to update; empty for a not-yet-written new sheet. */
  excelSheetName: string;
  voyage: string;
  portOfCall: string;
  nextPortOfCall: string;
  dateOfDeparture: string;
  draftAft: string;
  draftFore: string;
  totalCargo: string;
  dgRows: DepRepDgEditRow[];
  mode: 'update' | 'create';
}

type DepRepSheetTabId = 'previous' | 'new';

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
  private readonly confirmDialog = inject(ConfirmDialogService);

  protected readonly hasElectronPicker = !!window.electronAPI?.pickExcelFile;
  protected readonly library = this.storage.depRepLibrary;
  protected readonly ship = this.storage.ship;
  protected readonly ports = this.storage.ports;
  protected readonly dgLibrary = this.storage.dgLibrary;
  protected readonly busy = signal(false);
  protected readonly busyLabel = signal('');
  protected readonly pathDraft = linkedSignal(() => this.library().sourcePath);
  protected readonly sheetStatus = signal<string>('');
  protected readonly sheetStatusKind = signal<'ok' | 'missing' | 'draft' | ''>('');
  /** When set, dropdown shows this port instead of auto-POL. */
  private readonly densitySelectOverride = signal<string | null>(null);

  /**
   * After "+" a create-tab exists until Write succeeds (then it becomes previous).
   * While it exists, "+" stays hidden.
   */
  protected readonly newTab = signal<DepRepTabWorkspace | null>(null);
  /** Last loaded / written sheet — Write updates this Excel tab. */
  protected readonly previousTab = signal<DepRepTabWorkspace | null>(null);
  protected readonly activeSheetTab = signal<DepRepSheetTabId>('previous');

  protected readonly pendingNewSheet = computed(() => this.newTab() != null);
  /** @deprecated alias kept for template class bindings */
  protected readonly loadedSheetName = computed(
    () => this.previousTab()?.excelSheetName ?? '',
  );

  /** Editable DG class/weight rows (manual and/or filled from DG inventory). */
  protected readonly dgEditRows = signal<DepRepDgEditRow[]>([]);
  protected readonly dgClassOptions = DG_IMDG_CLASSES.map((c) => c.code);

  /**
   * Voyage/drafts overlay for DEP REP tabs (New + Previous).
   * Settings.voyageNumber is never written from this page — only read when "+" seeds a new sheet.
   */
  private readonly localShipFields = signal<{
    voyageNumber: string;
    draftAft: string;
    draftFore: string;
  } | null>(null);

  private metresSnapshot = '';
  private metresDraft = signal<{ field: DraftField; value: string } | null>(null);
  private dgRowSeq = 0;

  protected readonly pageContext = computed(() => this.dgLibrary().pageContext);

  protected readonly polCode = computed(() =>
    portCode(this.pageContext().portOfCall, this.ports()),
  );
  protected readonly podCode = computed(() =>
    portCode(this.pageContext().nextPortOfCall, this.ports()),
  );

  protected readonly voyageValue = computed(
    () => this.localShipFields()?.voyageNumber ?? this.ship().voyageNumber ?? '',
  );

  protected readonly sheetName = computed(() =>
    depRepSheetName(this.voyageValue(), this.polCode()),
  );

  protected readonly newTabLabel = computed(() => {
    if (this.activeSheetTab() === 'new') return this.sheetName() || 'New sheet';
    const stored = this.newTab();
    if (!stored) return 'New sheet';
    return depRepSheetName(stored.voyage, portCode(stored.portOfCall, this.ports())) || 'New sheet';
  });

  protected readonly previousTabLabel = computed(
    () => this.previousTab()?.excelSheetName || this.library().lastWrittenSheet || 'Previous',
  );

  protected readonly writeActionLabel = computed(() =>
    this.activeSheetTab() === 'new' && this.newTab() ? 'Create sheet' : 'Update sheet',
  );

  /** Empty / missing value — drives red translucent field styling. */
  protected isBlank(value: string | null | undefined): boolean {
    return !String(value ?? '').trim();
  }

  protected readonly midDraft = computed(() => {
    const local = this.localShipFields();
    const fore = local?.draftFore ?? this.ship().draftFore;
    const aft = local?.draftAft ?? this.ship().draftAft;
    return depRepMidDraftMetres(fore, aft);
  });

  /** Same as Excel H14: keel–mast − AFT (B8). */
  protected readonly airdraftPreview = computed(() => {
    const local = this.localShipFields();
    const aft = local?.draftAft ?? this.ship().draftAft;
    const n = airdraftHeightAboveWaterMetres(this.ship().heightKeelToMastTop, aft);
    return n == null ? '' : (Math.round(n * 100) / 100).toFixed(2);
  });

  /** Same as Excel C18: moulded depth − MID (C8). */
  protected readonly freeboardPreview = computed(() => {
    const depth = parseAirdraftMetres(this.ship().mouldedDepth);
    const mid = parseAirdraftMetres(this.midDraft());
    if (depth == null || mid == null) return '';
    return (Math.round((depth - mid) * 100) / 100).toFixed(2);
  });

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

  /** Inventory totals from the DG page (CMA + Unifeeder onboard). */
  protected readonly inventoryClassRows = computed((): ManifestClassWeightRow[] => {
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

  /** Rows sent to Excel write. */
  protected readonly classRowsForWrite = computed((): ManifestClassWeightRow[] => {
    const out: ManifestClassWeightRow[] = [];
    for (const row of this.dgEditRows()) {
      const dgClass = row.dgClass.trim();
      if (!dgClass) continue;
      const n = Number(String(row.weightKg ?? '').trim().replace(',', '.'));
      if (!Number.isFinite(n) || n < 0) continue;
      out.push({ dgClass, totalKg: Math.round(n * 10) / 10 });
    }
    return out;
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

  /** Start a new empty sheet tab on the left; keep previous tab for updates. */
  protected startNewSheet(): void {
    if (this.newTab()) return;
    // Freeze current form as the previous (update) tab.
    const prev = this.captureWorkspace(
      this.previousTab()?.excelSheetName || this.sheetName() || this.library().lastWrittenSheet,
      'update',
    );
    this.previousTab.set(prev);

    // Voyage + drafts come from Settings; ports/cargo/DG start empty for the new call.
    const ship = this.ship();
    const seeded: DepRepTabWorkspace = {
      excelSheetName: '',
      voyage: String(ship.voyageNumber ?? '').trim(),
      portOfCall: '',
      nextPortOfCall: '',
      dateOfDeparture: '',
      draftAft: String(ship.draftAft ?? '').trim(),
      draftFore: String(ship.draftFore ?? '').trim(),
      totalCargo: '',
      dgRows: [],
      mode: 'create',
    };
    this.newTab.set(seeded);
    this.activeSheetTab.set('new');
    this.restoreWorkspace(seeded);
    this.sheetStatus.set('New sheet — voyage/drafts from Settings. Fill the rest, then Create.');
    this.sheetStatusKind.set('draft');
    this.toast.show('New sheet — voyage taken from Settings', 'info');
  }

  /** Switch between create (left) and update (right) tabs without losing edits. */
  protected selectSheetTab(tab: DepRepSheetTabId): void {
    if (this.activeSheetTab() === tab) return;
    if (tab === 'new' && !this.newTab()) return;
    if (tab === 'previous' && !this.previousTab()) return;

    this.persistActiveTabEdits();
    this.activeSheetTab.set(tab);
    const ws = tab === 'new' ? this.newTab() : this.previousTab();
    if (ws) this.restoreWorkspace(ws);

    if (tab === 'new') {
      this.sheetStatus.set('New sheet — Write will create a new Excel tab');
      this.sheetStatusKind.set('draft');
    } else {
      const name = this.previousTab()?.excelSheetName || 'previous';
      this.sheetStatus.set(`Editing "${name}" — Write will update this Excel tab`);
      this.sheetStatusKind.set('ok');
    }
  }

  /**
   * Close a sheet tab.
   * New (draft): discard and focus Previous.
   * Previous / Sheet: delete that Excel worksheet, then refresh the new latest sheet.
   */
  protected async closeSheetTab(which: DepRepSheetTabId, event?: Event): Promise<void> {
    event?.stopPropagation();
    event?.preventDefault();
    if (this.busy()) return;

    if (which === 'new') {
      if (!this.newTab()) return;
      this.newTab.set(null);
      this.activeSheetTab.set('previous');
      const prev = this.previousTab();
      if (prev) {
        this.restoreWorkspace(prev);
        this.sheetStatus.set(
          `Editing "${prev.excelSheetName || 'previous'}" — Write will update this Excel tab`,
        );
        this.sheetStatusKind.set('ok');
      } else {
        this.localShipFields.set(null);
        this.sheetStatus.set('');
        this.sheetStatusKind.set('');
      }
      this.toast.show('New sheet discarded', 'info');
      return;
    }

    const sheetToDelete =
      this.previousTab()?.excelSheetName?.trim() ||
      this.library().lastWrittenSheet?.trim() ||
      this.sheetName()?.trim() ||
      '';
    if (!sheetToDelete) {
      this.toast.showError('No sheet to delete');
      return;
    }

    const path = this.library().sourcePath.trim() || this.pathDraft().trim();
    if (!path) {
      this.toast.showError('Choose DEP REP.xlsx path first');
      return;
    }
    if (!window.electronAPI?.deleteDepRepSheet) {
      this.toast.showError('Deleting a sheet requires the desktop app');
      return;
    }

    const ok = await this.confirmDialog.confirm({
      title: 'Delete Excel sheet?',
      message: `Delete sheet "${sheetToDelete}" from DEP REP.xlsx? The next latest sheet will load.`,
      confirmLabel: 'Delete sheet',
      cancelLabel: 'Cancel',
      variant: 'danger',
    });
    if (!ok) return;

    this.beginBusy(`Deleting "${sheetToDelete}"…`);
    let deletedOk = false;
    let latestName = '';
    try {
      const result = await window.electronAPI.deleteDepRepSheet(path, sheetToDelete);
      if (!result.ok) {
        this.toast.showError(result.error ?? 'Could not delete sheet');
        return;
      }
      deletedOk = true;
      latestName = result.latestSheetName || '';
      this.newTab.set(null);
      this.toast.show(`Deleted "${sheetToDelete}"`, 'success');
    } catch (e) {
      this.toast.showError(e instanceof Error ? e.message : 'Failed to delete sheet');
      return;
    } finally {
      this.endBusy();
    }

    if (deletedOk) {
      await this.refreshFromSheet();
      if (latestName) this.depRepStore.markWritten(latestName);
    }
  }

  protected addDgRow(): void {
    this.dgRowSeq += 1;
    this.dgEditRows.update((rows) => [
      ...rows,
      { id: `dg-${this.dgRowSeq}`, dgClass: '', weightKg: '' },
    ]);
  }

  protected removeDgRow(id: string): void {
    this.dgEditRows.update((rows) => rows.filter((r) => r.id !== id));
  }

  protected onDgClassChange(id: string, dgClass: string): void {
    this.dgEditRows.update((rows) =>
      rows.map((r) => (r.id === id ? { ...r, dgClass } : r)),
    );
  }

  protected onDgWeightChange(id: string, weightKg: string): void {
    this.dgEditRows.update((rows) =>
      rows.map((r) => (r.id === id ? { ...r, weightKg } : r)),
    );
  }

  /** Replace editable DG rows with totals from the DG inventory page. */
  protected fillDgFromInventory(): void {
    const inv = this.inventoryClassRows();
    if (!inv.length) {
      this.toast.showError('No onboard DG on the DG page');
      return;
    }
    this.dgEditRows.set(
      inv.map((row, i) => ({
        id: `inv-${Date.now()}-${i}`,
        dgClass: row.dgClass,
        weightKg: String(row.totalKg),
      })),
    );
    this.toast.show(`Loaded ${inv.length} class(es) from DG inventory`, 'success');
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
    const current = this.pathDraft().trim() || this.library().sourcePath.trim();
    const path = await window.electronAPI?.pickExcelFile(current || undefined);
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
    const local = this.localShipFields();
    if (local) {
      this.localShipFields.set({ ...local, voyageNumber: value });
      return;
    }
    // Never write Settings from DEP REP — keep an overlay so Refresh / Previous stay local.
    const ship = this.ship();
    this.localShipFields.set({
      voyageNumber: value,
      draftAft: String(ship.draftAft ?? '').trim(),
      draftFore: String(ship.draftFore ?? '').trim(),
    });
  }

  protected onPolChange(value: string): void {
    this.dg.updateDgPageContext({ portOfCall: value });
    this.densitySelectOverride.set(null);
  }

  protected onPodChange(value: string): void {
    this.dg.updateDgPageContext({ nextPortOfCall: value });
  }

  protected onDepartureDateChange(value: string): void {
    this.dg.updateDgPageContext({ dateOfDeparture: value });
  }

  protected onTotalCargoChange(value: string): void {
    this.depRepStore.setTotalCargo(value);
  }

  protected metresFieldValue(field: DraftField): string {
    const draft = this.metresDraft();
    if (draft?.field === field) return draft.value;
    const local = this.localShipFields();
    if (local) return local[field] ?? '';
    return this.ship()[field] ?? '';
  }

  protected onMetresFocus(field: DraftField, event: FocusEvent): void {
    const input = event.target as HTMLInputElement;
    this.metresSnapshot = this.metresFieldValue(field);
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
      // Allow clearing the field on the create tab (empty string).
      if (String(input.value ?? '').trim() === '') {
        this.metresDraft.set(null);
        const local = this.localShipFields();
        if (local) {
          this.localShipFields.set({ ...local, [field]: '' });
          return;
        }
      }
      input.value = this.metresSnapshot;
      this.metresDraft.set(null);
      this.toast.showError('Enter a number in metres (e.g. 9.2)');
      return;
    }
    input.value = normalized;
    this.metresDraft.set(null);
    const local = this.localShipFields();
    if (local) {
      this.localShipFields.set({ ...local, [field]: normalized });
      return;
    }
    const ship = this.ship();
    this.localShipFields.set({
      voyageNumber: String(ship.voyageNumber ?? '').trim(),
      draftAft: field === 'draftAft' ? normalized : String(ship.draftAft ?? '').trim(),
      draftFore: field === 'draftFore' ? normalized : String(ship.draftFore ?? '').trim(),
    });
  }

  /** Enter leaves the field and triggers blur (apply). */
  protected onFieldEnter(event: Event): void {
    const ke = event as KeyboardEvent;
    if (ke.key !== 'Enter') return;
    ke.preventDefault();
    (ke.target as HTMLElement)?.blur();
  }

  /** Load the latest (leftmost) sheet from DEP REP.xlsx into the form. */
  protected async refreshFromSheet(): Promise<void> {
    const path = this.library().sourcePath.trim() || this.pathDraft().trim();
    if (!path) {
      this.toast.showError('Choose DEP REP.xlsx path first');
      return;
    }
    if (!window.electronAPI?.readFileBase64) {
      this.toast.showError('Refresh requires the desktop app');
      return;
    }

    this.beginBusy('Loading latest sheet…');
    try {
      const read = await window.electronAPI.readFileBase64(path);
      if (!read.ok || !read.base64) {
        this.toast.showError(read.error ?? 'Could not read DEP REP.xlsx');
        return;
      }
      const bytes = Uint8Array.from(atob(read.base64), (c) => c.charCodeAt(0));
      // One pass, first sheet only (SheetJS) — skips other tabs / drawings.
      const { snapshot: snap, densities } = readDepRepLatestRefreshData(bytes);
      if (densities.size) {
        this.depRepStore.mergeDensities(
          [...densities.entries()].map(([port, density]) => ({
            port,
            density: String(density),
          })),
        );
      }
      if (!snap.exists) {
        this.sheetStatus.set('No sheets in workbook');
        this.sheetStatusKind.set('missing');
        this.toast.show('Workbook has no sheets', 'info');
        return;
      }

      this.applySnapshot(snap);
      this.newTab.set(null);
      this.activeSheetTab.set('previous');
      this.previousTab.set(this.captureWorkspace(snap.sheetName, 'update'));
      this.sheetStatus.set(`Loaded latest sheet "${snap.sheetName}"`);
      this.sheetStatusKind.set('ok');
      this.toast.show(`Loaded "${snap.sheetName}"`, 'success');
    } catch (e) {
      this.toast.showError(e instanceof Error ? e.message : 'Failed to refresh from sheet');
    } finally {
      this.endBusy();
    }
  }

  protected async exportPdf(): Promise<void> {
    const path = this.library().sourcePath.trim() || this.pathDraft().trim();
    if (!path) {
      this.toast.showError('Choose DEP REP.xlsx path first');
      return;
    }
    const name =
      this.activeSheetTab() === 'previous'
        ? this.previousTab()?.excelSheetName || this.sheetName()
        : this.sheetName();
    if (!name) {
      this.toast.showError('Set voyage and POL first');
      return;
    }
    this.beginBusy('Creating PDF from Excel…');
    try {
      const ok = await this.depRepPdf.openFromExcel(path, name);
      if (ok) this.toast.show('DEP REP PDF opened (from Excel)', 'success');
      else this.toast.showError('Could not open PDF');
    } catch (e) {
      this.toast.showError(e instanceof Error ? e.message : 'PDF export failed');
    } finally {
      this.endBusy();
    }
  }

  protected async writeToExcel(): Promise<void> {
    const path = this.library().sourcePath.trim() || this.pathDraft().trim();
    if (!path) {
      this.toast.showError('Choose DEP REP.xlsx path first');
      return;
    }

    const creating = this.activeSheetTab() === 'new' && !!this.newTab();
    // Update keeps the original Excel tab name; create uses voyage + POL.
    const name = creating
      ? this.sheetName()
      : this.previousTab()?.excelSheetName || this.sheetName();
    if (!name) {
      this.toast.showError('Set voyage and POL (port of call) first');
      return;
    }
    if (!this.polCode()) {
      this.toast.showError('POL needs a UN/LOCODE on the selected port');
      return;
    }

    this.beginBusy(creating ? 'Creating sheet…' : 'Updating sheet…');
    try {
      const electron = window.electronAPI;
      if (!electron?.writeDepRepSheet) {
        this.toast.showError('Writing DEP REP requires the desktop app with Excel');
        return;
      }
      const ship = this.ship();
      const local = this.localShipFields();
      const updates = buildDepRepCellUpdates({
        sheetName: name,
        voyage: local?.voyageNumber ?? ship.voyageNumber,
        polCode: this.polCode(),
        podCode: this.podCode(),
        departureDate: this.pageContext().dateOfDeparture || ship.dateOfDeparture,
        draftAft: local?.draftAft ?? ship.draftAft,
        draftFore: local?.draftFore ?? ship.draftFore,
        totalCargo: this.library().totalCargo,
        waterDensity: this.polDensity(),
        classRows: this.classRowsForWrite(),
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

      if (creating) {
        // Becomes Previous; Settings voyage stays as set in Settings (for next "+").
        const created = this.captureWorkspace(sheet, 'update');
        this.previousTab.set(created);
        this.newTab.set(null);
        this.activeSheetTab.set('previous');
        this.localShipFields.set({
          voyageNumber: created.voyage,
          draftAft: created.draftAft,
          draftFore: created.draftFore,
        });
        this.sheetStatus.set(`Created sheet "${sheet}" — it is now the previous tab`);
        this.sheetStatusKind.set('ok');
        this.toast.show(`Created "${sheet}" — now the previous tab`, 'success');
      } else {
        this.previousTab.set(this.captureWorkspace(sheet, 'update'));
        this.sheetStatus.set(`Updated sheet "${sheet}"`);
        this.sheetStatusKind.set('ok');
        this.toast.show(`Updated sheet "${sheet}"`, 'success');
      }
    } catch (e) {
      this.toast.showError(e instanceof Error ? e.message : 'Failed to write DEP REP');
    } finally {
      this.endBusy();
    }
  }

  private captureWorkspace(
    excelSheetName: string,
    mode: 'update' | 'create',
  ): DepRepTabWorkspace {
    const ctx = this.pageContext();
    const local = this.localShipFields();
    const ship = this.ship();
    return {
      excelSheetName: excelSheetName.trim(),
      voyage: local?.voyageNumber ?? ship.voyageNumber ?? '',
      portOfCall: ctx.portOfCall ?? '',
      nextPortOfCall: ctx.nextPortOfCall ?? '',
      dateOfDeparture: ctx.dateOfDeparture || ship.dateOfDeparture || '',
      draftAft: local?.draftAft ?? ship.draftAft ?? '',
      draftFore: local?.draftFore ?? ship.draftFore ?? '',
      totalCargo: this.library().totalCargo ?? '',
      dgRows: this.dgEditRows().map((r) => ({ ...r })),
      mode,
    };
  }

  private restoreWorkspace(ws: DepRepTabWorkspace): void {
    this.metresDraft.set(null);
    // Always local — Settings.voyageNumber stays for "+" seeding.
    this.localShipFields.set({
      voyageNumber: ws.voyage,
      draftAft: ws.draftAft,
      draftFore: ws.draftFore,
    });
    this.dg.updateDgPageContext({
      portOfCall: ws.portOfCall,
      nextPortOfCall: ws.nextPortOfCall,
      dateOfDeparture: ws.dateOfDeparture,
    });
    this.depRepStore.setTotalCargo(ws.totalCargo);
    this.dgEditRows.set(ws.dgRows.map((r) => ({ ...r })));
    this.densitySelectOverride.set(null);
  }

  private persistActiveTabEdits(): void {
    const tab = this.activeSheetTab();
    if (tab === 'new' && this.newTab()) {
      this.newTab.set(this.captureWorkspace('', 'create'));
    } else if (tab === 'previous' && this.previousTab()) {
      const excel = this.previousTab()!.excelSheetName;
      this.previousTab.set(this.captureWorkspace(excel, 'update'));
    }
  }

  private applySnapshot(snap: DepRepSheetSnapshot): void {
    // Refresh fills the Previous tab only — do not overwrite Settings voyage/drafts.
    const aft = normalizeShipMetresInput(snap.draftAft);
    const fore = normalizeShipMetresInput(snap.draftFore);
    this.localShipFields.set({
      voyageNumber: snap.voyage || '',
      draftAft: aft ?? String(snap.draftAft ?? '').trim(),
      draftFore: fore ?? String(snap.draftFore ?? '').trim(),
    });

    if (snap.polCode) {
      const polName =
        this.ports().find((p) => p.code.trim().toUpperCase() === snap.polCode)?.name ??
        snap.polCode;
      this.dg.updateDgPageContext({ portOfCall: polName });
    } else {
      this.dg.updateDgPageContext({ portOfCall: '' });
    }
    if (snap.podCode) {
      const podName =
        this.ports().find((p) => p.code.trim().toUpperCase() === snap.podCode)?.name ??
        snap.podCode;
      this.dg.updateDgPageContext({ nextPortOfCall: podName });
    } else {
      this.dg.updateDgPageContext({ nextPortOfCall: '' });
    }
    if (snap.departureDate) {
      this.dg.updateDgPageContext({ dateOfDeparture: snap.departureDate });
    } else {
      this.dg.updateDgPageContext({ dateOfDeparture: '' });
    }
    this.depRepStore.setTotalCargo(snap.totalCargo || '');

    if (snap.density && snap.polCode && !lookupDepRepLibraryDensity(this.densities(), snap.polCode)) {
      this.depRepStore.upsertDensity(snap.polCode, snap.density);
    }
    this.densitySelectOverride.set(null);

    if (snap.classRows.length) {
      this.dgEditRows.set(
        snap.classRows.map((row, i) => ({
          id: `sheet-${i}`,
          dgClass: row.dgClass,
          weightKg: String(row.totalKg),
        })),
      );
    } else {
      this.dgEditRows.set([]);
    }
  }

  private beginBusy(label: string): void {
    this.busyLabel.set(label);
    this.busy.set(true);
  }

  private endBusy(): void {
    this.busy.set(false);
    this.busyLabel.set('');
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
