import { Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  dgManifestAllContainersDischarged,
  dgViewContainerTotalKg,
  dgViewOnboardClassSummaries,
  dgViewOnboardInventoryStats,
  formatDgWeightKgDisplay,
  formatDgWeightKgGrossDisplay,
  commitDgWeightKgInput,
  parseDgWeightKg,
  sortDgDocuments,
  type DgCargoLine,
  type DgManifestDocument,
  type DgManifestViewOptions,
  type DgOnboardContainer,
  type DgOnboardContainerField,
} from '../../models/dg-manifest.models';
import type { DgManifestExportContext, DgUnifeederExportContext } from '../../models/dg-manifest-export.models';
import {
  buildDgContainerDisplayLines,
  planDgInventoryWeightDisplays,
  type DgCargoLineDisplay,
} from '../../utils/dg-cargo-merge.util';
import { DgManifestExcelService } from '../../services/dg-manifest-excel.service';
import { DgUnifeederExcelService } from '../../services/dg-unifeeder-excel.service';
import { DgUnifeederPdfService } from '../../services/dg-unifeeder-pdf.service';
import { DgManifestPdfService } from '../../services/dg-manifest-pdf.service';
import { DgManifestImportService } from '../../services/dg-manifest-import.service';
import { DgCmaPrestowImportService } from '../../services/dg-cma-prestow-import.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import {
  buildDgManifestContentHash,
  buildDgPdfBytesHash,
} from '../../utils/dg-manifest-fingerprint.util';
import { DgPageArchiveService } from '../../services/dg-page-archive.service';
import { StorageService } from '../../services/storage.service';
import { ToastService } from '../../services/toast.service';
import { formatDisplayDate } from '../../utils/date.util';
import { DatePickerComponent } from '../../components/date-picker/date-picker.component';
import { PortSelectComponent } from '../../components/port-select/port-select.component';
import { ClickOutsideDirective } from '../../directives/click-outside.directive';
import { ContainerTypeTooltipDirective } from '../../directives/container-type-tooltip.directive';
import { DgClassTooltipDirective } from '../../directives/dg-class-tooltip.directive';
import type { DgPageSnapshot } from '../../models/dg-page-archive.models';

import {
  sortDgOnboardContainers,
  type DgInventorySortColumn,
  type DgInventorySortDirection,
} from '../../utils/dg-inventory-sort.util';
import { filterDgOnboardContainers } from '../../utils/dg-inventory-search.util';
import { filterUnifeederOnboardRows } from '../../utils/dg-unifeeder-inventory-search.util';
import {
  buildUnifeederInventoryDisplayRows,
  groupUnifeederRawRowsByContainer,
  mergeUnifeederRowsInContainers,
  planUnifeederMergedWeightDisplays,
  type DgUnifeederContainerDisplayGroup,
  type DgUnifeederRowDisplay,
} from '../../utils/dg-unifeeder-merge.util';
import {
  sortUnifeederContainerGroups,
  sortUnifeederRows,
  type DgUnifeederSortColumn,
  type DgUnifeederSortDirection,
} from '../../utils/dg-unifeeder-inventory-sort.util';
import type { DgPageContext } from '../../utils/page-ship-context.util';
import {
  unifeederOnboardInventoryStats,
  type DgUnifeederManifestDocument,
  type DgUnifeederRow,
  type DgUnifeederRowField,
} from '../../models/dg-unifeeder.models';

import { DgUnifeederImportService } from '../../services/dg-unifeeder-import.service';
import { formatUnifeederImportValidationError } from '../../utils/dg-unifeeder-pdf-summary.util';
import {
  buildUnifeederContentHash,
  buildUnifeederPdfBytesHash,
} from '../../utils/dg-unifeeder-fingerprint.util';
import { unifeederManifestSummary } from '../../utils/dg-manifest-summary.util';
import { DgActIconComponent } from './dg-act-icon.component';
import { MfagScheduleTooltipDirective } from '../../directives/mfag-schedule-tooltip.directive';
import { PackingGroupTooltipDirective } from '../../directives/packing-group-tooltip.directive';
import { UnNumberTooltipDirective } from '../../directives/un-number-tooltip.directive';
import {
  mfagFirePageRefFromEmsCode,
  mfagSpillagePageRefFromEmsCode,
} from '../../utils/dg-mfag-schedule.util';

type DgLineField = keyof Omit<DgCargoLine, 'id'>;
export type DgInventoryTab = 'cmaCgm' | 'unifeeder';

@Component({
  selector: 'app-dg',
  imports: [RouterLink, FormsModule, DgActIconComponent, PortSelectComponent, DatePickerComponent, ClickOutsideDirective, ContainerTypeTooltipDirective, DgClassTooltipDirective, MfagScheduleTooltipDirective, UnNumberTooltipDirective, PackingGroupTooltipDirective],
  templateUrl: './dg.component.html',
  styleUrl: './dg.component.css',
})
export class DgComponent {
  private readonly storage = inject(StorageService);
  private readonly importer = inject(DgManifestImportService);
  private readonly prestowImporter = inject(DgCmaPrestowImportService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly unifeederImporter = inject(DgUnifeederImportService);
  private readonly dgExcel = inject(DgManifestExcelService);
  private readonly unifeederExcel = inject(DgUnifeederExcelService);
  private readonly unifeederPdf = inject(DgUnifeederPdfService);
  private readonly dgPdf = inject(DgManifestPdfService);
  private readonly pageArchive = inject(DgPageArchiveService);
  private readonly toast = inject(ToastService);
  private readonly fileRef = viewChild<ElementRef<HTMLInputElement>>('pdfFile');
  private readonly unifeederFileRef = viewChild<ElementRef<HTMLInputElement>>('unifeederExcelFile');

  protected readonly ship = this.storage.ship;
  protected readonly ports = this.storage.ports;
  protected readonly library = this.storage.dgLibrary;

  protected readonly importHistory = computed(() =>
    sortDgDocuments(this.library().manifests, 'added'),
  );

  protected readonly filteredOnboardContainers = computed(() => {
    const lib = this.library();
    return lib.showDischarged
      ? [...lib.onboard]
      : lib.onboard.filter((c) => c.status === 'onboard');
  });

  protected readonly visibleContainers = computed(() => {
    let list = filterDgOnboardContainers(this.filteredOnboardContainers(), this.inventorySearch());
    const column = this.inventorySortColumn();
    if (column) {
      list = sortDgOnboardContainers(list, column, this.inventorySortDirection());
    }
    return list;
  });

  protected readonly viewOptions = computed((): DgManifestViewOptions => ({
    manifestMergeLines: this.library().manifestMergeLines,
    manifestGrossTotalKg: this.library().manifestGrossTotalKg,
  }));

  protected readonly inventoryWeightDisplays = computed(() =>
    planDgInventoryWeightDisplays(this.visibleContainers(), this.viewOptions()),
  );

  protected readonly stats = computed(() => {
    const filtered = filterDgOnboardContainers(
      this.filteredOnboardContainers(),
      this.inventorySearch(),
    );
    return dgViewOnboardInventoryStats(
      filtered,
      true,
      this.viewOptions(),
      (container) => this.containerDisplayLines(container).length,
    );
  });

  protected readonly dragOver = signal(false);
  protected readonly importing = signal(false);
  protected readonly unifeederDragOver = signal(false);
  protected readonly unifeederImporting = signal(false);
  protected readonly exportingExcel = signal(false);
  protected readonly exportingPdf = signal(false);
  protected readonly hoveredContainerId = signal<string | null>(null);
  protected readonly hoveredLineId = signal<string | null>(null);
  protected readonly hoveredUnifeederContainerKey = signal<string | null>(null);
  protected readonly hoveredUnifeederLineId = signal<string | null>(null);
  protected readonly inventorySortColumn = signal<DgInventorySortColumn | null>(null);
  protected readonly inventorySortDirection = signal<DgInventorySortDirection>('asc');
  protected readonly inventorySearch = signal('');
  protected readonly activeInventoryTab = signal<DgInventoryTab>('cmaCgm');
  protected readonly unifeederInventorySearch = signal('');
  protected readonly unifeederSortColumn = signal<DgUnifeederSortColumn | null>(null);
  protected readonly unifeederSortDirection = signal<DgUnifeederSortDirection>('asc');

  protected readonly unifeederLibrary = computed(() => this.library().unifeeder);

  protected readonly filteredUnifeederRows = computed(() => {
    const lib = this.unifeederLibrary();
    return lib.showDischarged
      ? [...lib.onboard]
      : lib.onboard.filter((r) => r.status === 'onboard');
  });

  protected readonly visibleUnifeederRows = computed(() => {
    let list = filterUnifeederOnboardRows(this.filteredUnifeederRows(), this.unifeederInventorySearch());
    const column = this.unifeederSortColumn();
    if (column) {
      list = sortUnifeederRows(list, column, this.unifeederSortDirection());
    }
    return list;
  });

  protected readonly visibleUnifeederContainerGroups = computed((): DgUnifeederContainerDisplayGroup[] => {
    const lib = this.unifeederLibrary();
    const filtered = filterUnifeederOnboardRows(
      this.filteredUnifeederRows(),
      this.unifeederInventorySearch(),
    );
    const options = { mergeLines: lib.mergeLines, grossTotalKg: lib.grossTotalKg };
    let rawGroups = groupUnifeederRawRowsByContainer(filtered);
    const column = this.unifeederSortColumn();
    if (column) {
      rawGroups = sortUnifeederContainerGroups(rawGroups, column, this.unifeederSortDirection());
    }
    const weightPlan = planUnifeederMergedWeightDisplays(filtered, options);

    return rawGroups.map((group) => {
      const first = group.rows[0];
      return {
        key: group.key,
        size: first?.size ?? '',
        stow: first?.stow ?? '',
        containerNo: first?.containerNo ?? '',
        loadPort: first?.loadPort ?? '',
        dischargePort: first?.dischargePort ?? '',
        status: first?.status ?? 'onboard',
        lines: buildUnifeederInventoryDisplayRows(group.rows, options, weightPlan),
      };
    });
  });

  protected readonly visibleUnifeederDisplayRows = computed(() =>
    this.visibleUnifeederContainerGroups().flatMap((group) => group.lines),
  );

  protected readonly unifeederStats = computed(() => {
    const lib = this.unifeederLibrary();
    const filtered = filterUnifeederOnboardRows(
      this.filteredUnifeederRows(),
      this.unifeederInventorySearch(),
    );
    const base = unifeederOnboardInventoryStats(filtered, true, lib.grossTotalKg);
    return {
      ...base,
      rowCount: this.visibleUnifeederDisplayRows().length,
    };
  });

  protected readonly unifeederManifestSummary = computed(() =>
    unifeederManifestSummary(
      mergeUnifeederRowsInContainers(this.visibleUnifeederRows(), this.unifeederLibrary().mergeLines),
      this.unifeederLibrary().grossTotalKg,
    ),
  );

  protected readonly classSummaries = computed(() =>
    dgViewOnboardClassSummaries(
      this.library().onboard,
      this.library().showDischarged,
      this.viewOptions(),
    ),
  );

  protected readonly unifeederImportHistory = computed(() =>
    [...this.unifeederLibrary().manifests].sort((a, b) => b.addedAt.localeCompare(a.addedAt)),
  );

  protected readonly dgArchive = this.pageArchive;
  protected readonly showArchiveSaveModal = signal(false);
  protected readonly showArchiveLoadModal = signal(false);
  protected archiveSaveLabel = '';

  protected toggleShowDischarged(checked: boolean): void {
    this.storage.updateDgManifestView({ showDischarged: checked });
  }

  protected toggleUnifeederShowDischarged(checked: boolean): void {
    this.storage.updateUnifeederViewSettings({ showDischarged: checked });
  }

  protected toggleUnifeederGrossTotalKg(checked: boolean): void {
    this.storage.updateUnifeederViewSettings({ grossTotalKg: checked });
  }

  protected toggleUnifeederMergeLines(checked: boolean): void {
    this.storage.updateUnifeederViewSettings({ mergeLines: checked });
  }

  protected setInventoryTab(tab: DgInventoryTab): void {
    this.activeInventoryTab.set(tab);
  }

  protected dgTransferButtonTitle(): string {
    return this.activeInventoryTab() === 'cmaCgm'
      ? 'Replace DP WORLD list with CMA CGM data'
      : 'Replace CMA CGM list with DP WORLD data';
  }

  protected async transferDgInventoryToOpposite(): Promise<void> {
    const fromCma = this.activeInventoryTab() === 'cmaCgm';
    const sourceCount = fromCma
      ? this.library().onboard.length
      : this.unifeederLibrary().onboard.length;
    if (sourceCount === 0) {
      this.toast.showError(
        fromCma ? 'No CMA CGM containers to transfer' : 'No DP WORLD rows to transfer',
      );
      return;
    }

    const sourceLabel = fromCma ? 'CMA CGM' : 'DP WORLD';
    const targetLabel = fromCma ? 'DP WORLD' : 'CMA CGM';
    const ok = await this.confirmDialog.confirm({
      title: 'Transfer inventory',
      message: `Replace the ${targetLabel} inventory with data from ${sourceLabel}? The ${targetLabel} list and import history will be cleared.`,
      confirmLabel: 'Transfer',
      variant: 'danger',
    });
    if (!ok) return;

    const count = fromCma
      ? this.storage.transferCmaDgInventoryToUnifeeder()
      : this.storage.transferUnifeederDgInventoryToCma();
    this.setInventoryTab(fromCma ? 'unifeeder' : 'cmaCgm');
    this.toast.show(`Transferred ${count} item(s) to ${targetLabel}`, 'success');
  }

  protected dgClearButtonTitle(): string {
    return this.activeInventoryTab() === 'cmaCgm'
      ? 'Clear all CMA CGM inventory and import history'
      : 'Clear all DP WORLD inventory and import history';
  }

  protected async clearActiveDgInventory(): Promise<void> {
    const fromCma = this.activeInventoryTab() === 'cmaCgm';
    const onboardCount = fromCma
      ? this.library().onboard.length
      : this.unifeederLibrary().onboard.length;
    const manifestCount = fromCma
      ? this.importHistory().length
      : this.unifeederImportHistory().length;
    if (onboardCount === 0 && manifestCount === 0) {
      this.toast.showError(
        fromCma ? 'CMA CGM inventory is already empty' : 'DP WORLD inventory is already empty',
      );
      return;
    }

    const label = fromCma ? 'CMA CGM' : 'DP WORLD';
    const ok = await this.confirmDialog.confirm({
      title: `Clear ${label} inventory`,
      message: `Clear all ${label} containers/rows and import history? This cannot be undone.`,
      confirmLabel: 'Clear all',
      variant: 'danger',
    });
    if (!ok) return;

    if (fromCma) {
      this.storage.clearCmaDgInventory();
    } else {
      this.storage.clearUnifeederDgInventory();
    }
    this.toast.show(`${label} inventory cleared`, 'success');
  }

  protected toggleManifestMergeLines(checked: boolean): void {
    this.storage.updateDgManifestView({ manifestMergeLines: checked });
  }

  protected toggleManifestGrossTotalKg(checked: boolean): void {
    this.storage.updateDgManifestView({ manifestGrossTotalKg: checked });
  }

  protected toggleInventorySort(column: DgInventorySortColumn): void {
    if (this.inventorySortColumn() === column) {
      this.inventorySortDirection.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.inventorySortColumn.set(column);
      this.inventorySortDirection.set('asc');
    }
  }

  protected toggleUnifeederInventorySort(column: DgUnifeederSortColumn): void {
    if (this.unifeederSortColumn() === column) {
      this.unifeederSortDirection.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.unifeederSortColumn.set(column);
      this.unifeederSortDirection.set('asc');
    }
  }

  protected removeManifest(id: string, event: Event): void {
    event.stopPropagation();
    this.storage.removeDgManifest(id);
  }

  protected containerTotalKg(container: DgOnboardContainer): number {
    return dgViewContainerTotalKg(container, this.viewOptions());
  }

  protected containerDisplayLines(container: DgOnboardContainer): DgCargoLineDisplay[] {
    return buildDgContainerDisplayLines(container, this.viewOptions(), this.inventoryWeightDisplays());
  }

  protected containerDisplayLineCount(container: DgOnboardContainer): number {
    const count = this.containerDisplayLines(container).length;
    return count || 1;
  }

  protected formatSummaryKg(value: number): string {
    const lib = this.library();
    if (lib.manifestGrossTotalKg) {
      return formatDgWeightKgGrossDisplay(value) || '0';
    }
    return formatDgWeightKgDisplay(value) || '0';
  }

  protected formatDate(value: string): string {
    return formatDisplayDate(value);
  }

  protected startArchiveSave(): void {
    this.showArchiveLoadModal.set(false);
    this.archiveSaveLabel = this.pageArchive.defaultSaveLabel();
    this.showArchiveSaveModal.set(true);
  }

  protected cancelArchiveSave(): void {
    this.showArchiveSaveModal.set(false);
    this.archiveSaveLabel = '';
  }

  protected confirmArchiveSave(): void {
    const entry = this.pageArchive.save(this.archiveSaveLabel);
    if (!entry) {
      this.toast.showError('Enter a name for the snapshot');
      return;
    }
    this.showArchiveSaveModal.set(false);
    this.archiveSaveLabel = '';
    this.toast.show(`Saved "${entry.label}"`, 'success');
  }

  protected openArchiveLoad(): void {
    this.showArchiveSaveModal.set(false);
    this.showArchiveLoadModal.set(true);
  }

  protected closeArchiveLoad(): void {
    this.showArchiveLoadModal.set(false);
  }

  protected pickArchiveSnapshot(entry: DgPageSnapshot): void {
    if (this.pageArchive.load(entry.id)) {
      this.showArchiveLoadModal.set(false);
      this.toast.show(`Page state loaded from archive: "${entry.label}"`, 'info');
    }
  }

  protected resetArchiveView(): void {
    this.pageArchive.reset();
    this.toast.show('Back to live DG page', 'success');
  }

  protected deleteArchiveSnapshot(entry: DgPageSnapshot, event: MouseEvent): void {
    event.stopPropagation();
    const wasLoaded = this.pageArchive.loaded()?.id === entry.id;
    this.pageArchive.remove(entry.id);
    if (wasLoaded) {
      this.toast.show(`Deleted "${entry.label}" — back to live page`, 'success');
    } else {
      this.toast.show(`Deleted "${entry.label}"`, 'success');
    }
  }

  protected formatArchiveSavedAt(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${months[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm}`;
  }

  protected manifestLabel(doc: DgManifestDocument): string {
    const parts = [
      doc.voyageNumber ? `Voy ${doc.voyageNumber}` : '',
      doc.documentDate ? this.formatDate(doc.documentDate) : '',
      doc.loadPort ? `Load ${doc.loadPort}` : '',
    ].filter(Boolean);
    return parts.join(' · ');
  }

  protected unifeederManifestMeta(doc: DgUnifeederManifestDocument): string {
    const rows = this.unifeederLibrary().onboard.filter((row) => row.sourceManifestId === doc.id);
    const loadPort =
      doc.loadPort.trim() ||
      rows.map((row) => row.loadPort.trim()).find(Boolean) ||
      '';
    const dischargePort =
      doc.dischargePort.trim() ||
      rows.map((row) => row.dischargePort.trim()).find(Boolean) ||
      '';
    const rowCount = doc.rowCount || rows.length;
    const containerCount =
      doc.containerCount ||
      new Set(rows.map((row) => row.containerNo.trim()).filter(Boolean)).size;

    const parts: string[] = [];
    if (loadPort && dischargePort) parts.push(`${loadPort} → ${dischargePort}`);
    else if (loadPort) parts.push(`Load ${loadPort}`);
    else if (dischargePort) parts.push(`Disch ${dischargePort}`);
    if (doc.voyageNumber?.trim()) parts.push(`Voy ${doc.voyageNumber.trim()}`);
    if (doc.documentDate?.trim()) parts.push(this.formatDate(doc.documentDate));
    parts.push(`${rowCount} rows`);
    if (containerCount > 0) parts.push(`${containerCount} ctr`);
    return parts.join(' · ');
  }

  protected unifeederManifestFullyDischarged(manifestId: string): boolean {
    const rows = this.unifeederLibrary().onboard.filter((row) => row.sourceManifestId === manifestId);
    return rows.length > 0 && rows.every((row) => row.status === 'discharged');
  }

  protected manifestFullyDischarged(manifestId: string): boolean {
    return dgManifestAllContainersDischarged(manifestId, this.library().onboard);
  }

  protected manifestDischargedTooltip(manifestId: string): string {
    return this.manifestFullyDischarged(manifestId)
      ? 'All containers from this manifest are discharged'
      : '';
  }

  protected onContainerChange(
    containerId: string,
    field: DgOnboardContainerField,
    value: string,
  ): void {
    this.storage.updateDgOnboardContainer(containerId, { [field]: value });
  }

  protected onPageContextChange(field: keyof DgPageContext, value: string): void {
    this.storage.updateDgPageContext({ [field]: value });
  }

  protected onUnifeederRowChange(rowId: string, field: DgUnifeederRowField, value: string): void {
    const patch: Partial<Omit<DgUnifeederRow, 'id' | 'sourceManifestId'>> = { [field]: value };
    if (field === 'fire') {
      const pageRef = mfagFirePageRefFromEmsCode(value);
      if (pageRef) patch.fireSchedule = pageRef;
    }
    if (field === 'spillage') {
      const pageRef = mfagSpillagePageRefFromEmsCode(value);
      if (pageRef) patch.spillageSchedule = pageRef;
    }
    this.storage.updateUnifeederRow(rowId, patch);
  }

  protected unifeederPrimaryRowId(row: DgUnifeederRowDisplay): string {
    return row.sourceRowIds[0];
  }

  protected onUnifeederDisplayRowChange(
    row: DgUnifeederRowDisplay,
    field: DgUnifeederRowField,
    value: string,
  ): void {
    if (!row.editable) return;
    this.onUnifeederRowChange(this.unifeederPrimaryRowId(row), field, value);
  }

  protected addUnifeederRow(): void {
    this.storage.addUnifeederRow();
  }

  protected addUnifeederCargoLine(group: DgUnifeederContainerDisplayGroup): void {
    this.storage.addUnifeederRow({
      size: group.size,
      stow: group.stow,
      containerNo: group.containerNo,
      loadPort: group.loadPort,
      dischargePort: group.dischargePort,
      status: group.status,
    });
  }

  protected unifeederContainerLineCount(group: DgUnifeederContainerDisplayGroup): number {
    return group.lines.length || 1;
  }

  protected unifeederContainerTotalKg(group: DgUnifeederContainerDisplayGroup): number {
    return group.lines.reduce(
      (sum, line) => sum + parseDgWeightKg(line.weightKgDisplay || line.weightKg),
      0,
    );
  }

  protected unifeederContainerSourceRowIds(group: DgUnifeederContainerDisplayGroup): string[] {
    const ids = new Set<string>();
    for (const line of group.lines) {
      for (const id of line.sourceRowIds) ids.add(id);
    }
    return [...ids];
  }

  protected onUnifeederContainerChange(
    group: DgUnifeederContainerDisplayGroup,
    field: DgUnifeederRowField,
    value: string,
  ): void {
    for (const rowId of this.unifeederContainerSourceRowIds(group)) {
      this.onUnifeederRowChange(rowId, field, value);
    }
  }

  protected removeUnifeederContainer(group: DgUnifeederContainerDisplayGroup): void {
    for (const rowId of this.unifeederContainerSourceRowIds(group)) {
      this.storage.removeUnifeederRow(rowId);
    }
  }

  protected markUnifeederContainerDischarged(group: DgUnifeederContainerDisplayGroup): void {
    for (const rowId of this.unifeederContainerSourceRowIds(group)) {
      this.storage.setUnifeederRowStatus(rowId, 'discharged');
    }
  }

  protected restoreUnifeederContainer(group: DgUnifeederContainerDisplayGroup): void {
    for (const rowId of this.unifeederContainerSourceRowIds(group)) {
      this.storage.setUnifeederRowStatus(rowId, 'onboard');
    }
  }

  protected removeUnifeederRow(rowId: string): void {
    this.storage.removeUnifeederRow(rowId);
  }

  protected removeUnifeederDisplayRow(row: DgUnifeederRowDisplay): void {
    for (const id of row.sourceRowIds) {
      this.storage.removeUnifeederRow(id);
    }
  }

  protected markUnifeederDischarged(rowId: string): void {
    this.storage.setUnifeederRowStatus(rowId, 'discharged');
  }

  protected markUnifeederDisplayRowDischarged(row: DgUnifeederRowDisplay): void {
    for (const id of row.sourceRowIds) {
      this.storage.setUnifeederRowStatus(id, 'discharged');
    }
  }

  protected restoreUnifeederRow(rowId: string): void {
    this.storage.setUnifeederRowStatus(rowId, 'onboard');
  }

  protected restoreUnifeederDisplayRow(row: DgUnifeederRowDisplay): void {
    for (const id of row.sourceRowIds) {
      this.storage.setUnifeederRowStatus(id, 'onboard');
    }
  }

  protected exportUnifeederPdf(): void {
    if (this.exportingPdf()) return;

    this.exportingPdf.set(true);
    void this.unifeederPdf.openDgList(this.buildUnifeederExportContext()).then((ok) => {
      if (ok) {
        this.toast.show('DG list PDF opened', 'success');
      } else {
        this.toast.showError('Could not open PDF');
      }
    }).catch((err) => {
      this.toast.showError(err instanceof Error ? err.message : 'PDF export failed');
    }).finally(() => {
      this.exportingPdf.set(false);
    });
  }

  protected exportUnifeederExcel(): void {
    if (this.exportingExcel()) return;

    this.exportingExcel.set(true);
    void this.unifeederExcel.openDgList(this.buildUnifeederExportContext()).then((ok) => {
      if (ok) {
        this.toast.show('DG list Excel opened', 'success');
      } else {
        this.toast.showError('Could not open Excel file');
      }
    }).catch((err) => {
      this.toast.showError(err instanceof Error ? err.message : 'Excel export failed');
    }).finally(() => {
      this.exportingExcel.set(false);
    });
  }

  protected removeUnifeederManifest(id: string, event: Event): void {
    event.stopPropagation();
    this.storage.removeUnifeederManifest(id);
  }

  protected pickUnifeederExcel(): void {
    this.unifeederFileRef()?.nativeElement.click();
  }

  protected onUnifeederExcelInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) void this.importUnifeederFile(file);
    input.value = '';
  }

  protected onUnifeederDragOver(event: DragEvent): void {
    event.preventDefault();
    this.unifeederDragOver.set(true);
  }

  protected onUnifeederDragLeave(): void {
    this.unifeederDragOver.set(false);
  }

  protected onUnifeederDrop(event: DragEvent): void {
    event.preventDefault();
    this.unifeederDragOver.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) void this.importUnifeederFile(file);
  }

  private async importUnifeederFile(file: File): Promise<void> {
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    const isExcel =
      /\.xlsx$/i.test(file.name) ||
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (!isPdf && !isExcel) {
      this.toast.showError('Drop a DP WORLD PDF or Excel file');
      return;
    }
    if (isExcel) {
      this.toast.show('DP WORLD Excel import — coming soon', 'info');
      return;
    }

    this.unifeederImporting.set(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const result = await this.unifeederImporter.importFromPdfBytes(bytes, this.storage.ports());
      if (result.format === 'unknown' || !result.rows.length) {
        this.toast.showError(result.warnings[0] ?? 'Could not extract data from PDF');
        return;
      }
      if (!result.rows.some((row) => row.containerNo.trim())) {
        this.toast.showError('No containers found in PDF (missing container numbers in cargo rows).');
        return;
      }

      const [contentFingerprint, pdfBytesFingerprint] = await Promise.all([
        buildUnifeederContentHash(result),
        buildUnifeederPdfBytesHash(bytes),
      ]);
      const duplicate = this.storage.applyUnifeederImport(result, file.name, {
        contentFingerprint,
        pdfBytesFingerprint,
      });
      if (duplicate) {
        this.toast.showError(
          `This manifest was already imported (${duplicate.sourceName || 'existing entry'})`,
        );
        return;
      }

      const containers = new Set(result.rows.map((r) => r.containerNo).filter(Boolean)).size;
      const rows = this.storage.dgLibrary().unifeeder.onboard.filter((r) => r.status === 'onboard').length;
      const pol = result.header.portOfDeparture || '—';
      const pod = result.header.portOfArrival || '—';
      this.toast.show(
        `Imported ${result.rows.length} row(s), ${containers} container(s) — ${rows} onboard (${pol} → ${pod})`,
        'success',
      );
      const validationError = result.validation
        ? formatUnifeederImportValidationError(result.validation)
        : '';
      if (validationError) {
        this.toast.showError(validationError);
      }
      if (result.warnings.length) {
        this.toast.show(result.warnings.slice(0, 2).join(' '), 'info');
      }
    } catch (err) {
      this.toast.showError(err instanceof Error ? err.message : 'Failed to read PDF');
    } finally {
      this.unifeederImporting.set(false);
    }
  }

  protected formatUnifeederWeight(value: number): string {
    if (!Number.isFinite(value) || value === 0) return '0';
    if (this.unifeederLibrary().grossTotalKg) {
      return formatDgWeightKgGrossDisplay(value) || '0';
    }
    return formatDgWeightKgDisplay(value) || '0';
  }

  protected onCmaLineWeightBlur(containerId: string, lineId: string, raw: string): void {
    const normalized = commitDgWeightKgInput(raw, this.library().manifestGrossTotalKg);
    this.storage.updateDgOnboardCargoLine(containerId, lineId, { weightKg: normalized });
  }

  protected onUnifeederWeightBlur(row: DgUnifeederRowDisplay, raw: string): void {
    if (!row.editable) return;
    const normalized = commitDgWeightKgInput(raw, this.unifeederLibrary().grossTotalKg);
    this.storage.updateUnifeederRow(this.unifeederPrimaryRowId(row), { weightKg: normalized });
  }

  protected unifeederWeightDisplay(row: DgUnifeederRowDisplay): string {
    return row.weightKgDisplay || row.weightKg;
  }

  protected setContainerGroupHover(containerId: string): void {
    this.hoveredContainerId.set(containerId);
    this.hoveredLineId.set(null);
  }

  protected setLineHover(containerId: string, lineId: string): void {
    this.hoveredContainerId.set(containerId);
    this.hoveredLineId.set(lineId);
  }

  protected isContainerGroupActive(containerId: string): boolean {
    return this.hoveredContainerId() === containerId;
  }

  protected isContainerGroupFocus(containerId: string): boolean {
    return this.hoveredContainerId() === containerId && this.hoveredLineId() === null;
  }

  protected isCargoLineHovered(containerId: string, lineId: string): boolean {
    return this.hoveredContainerId() === containerId && this.hoveredLineId() === lineId;
  }

  protected onContainerGroupLeave(event: MouseEvent, containerId: string): void {
    const related = event.relatedTarget;
    if (related instanceof Element && this.isWithinContainerGroup(related, containerId)) {
      return;
    }
    if (this.hoveredContainerId() === containerId) {
      this.hoveredContainerId.set(null);
      this.hoveredLineId.set(null);
    }
  }

  private isWithinContainerGroup(element: Element, containerId: string): boolean {
    const groupEl = element.closest('[data-container-id]');
    return groupEl?.getAttribute('data-container-id') === containerId;
  }

  protected setUnifeederContainerGroupHover(containerKey: string): void {
    this.hoveredUnifeederContainerKey.set(containerKey);
    this.hoveredUnifeederLineId.set(null);
  }

  protected setUnifeederLineHover(containerKey: string, lineId: string): void {
    this.hoveredUnifeederContainerKey.set(containerKey);
    this.hoveredUnifeederLineId.set(lineId);
  }

  protected isUnifeederGroupActive(containerKey: string): boolean {
    return this.hoveredUnifeederContainerKey() === containerKey;
  }

  protected isUnifeederGroupFocus(containerKey: string): boolean {
    return this.hoveredUnifeederContainerKey() === containerKey && this.hoveredUnifeederLineId() === null;
  }

  protected isUnifeederCargoLineHovered(containerKey: string, lineId: string): boolean {
    return this.hoveredUnifeederContainerKey() === containerKey && this.hoveredUnifeederLineId() === lineId;
  }

  protected onUnifeederContainerGroupLeave(event: MouseEvent, containerKey: string): void {
    const related = event.relatedTarget;
    if (related instanceof Element && this.isWithinUnifeederContainerGroup(related, containerKey)) {
      return;
    }
    if (this.hoveredUnifeederContainerKey() === containerKey) {
      this.hoveredUnifeederContainerKey.set(null);
      this.hoveredUnifeederLineId.set(null);
    }
  }

  private isWithinUnifeederContainerGroup(element: Element, containerKey: string): boolean {
    const groupEl = element.closest('[data-uf-container-key]');
    return groupEl?.getAttribute('data-uf-container-key') === containerKey;
  }

  protected onLineChange(
    containerId: string,
    lineId: string,
    field: DgLineField,
    value: string,
  ): void {
    this.storage.updateDgOnboardCargoLine(containerId, lineId, { [field]: value });
  }

  protected addContainer(): void {
    this.storage.addDgOnboardContainer();
  }

  protected removeContainer(containerId: string): void {
    this.storage.removeDgOnboardContainer(containerId);
  }

  protected markDischarged(containerId: string): void {
    this.storage.setDgOnboardContainerStatus(containerId, 'discharged');
  }

  protected restoreOnboard(containerId: string): void {
    this.storage.setDgOnboardContainerStatus(containerId, 'onboard');
  }

  protected addLine(containerId: string): void {
    this.storage.addDgOnboardCargoLine(containerId);
  }

  protected removeLine(containerId: string, lineId: string): void {
    this.storage.removeDgOnboardCargoLine(containerId, lineId);
  }

  protected exportPdf(): void {
    if (this.exportingPdf()) return;

    this.exportingPdf.set(true);
    void this.dgPdf.openManifest(this.buildExportContext()).then((ok) => {
      if (ok) {
        this.toast.show('PDF manifest opened', 'success');
      } else {
        this.toast.showError('Could not open PDF');
      }
    }).catch((err) => {
      this.toast.showError(err instanceof Error ? err.message : 'PDF export failed');
    }).finally(() => {
      this.exportingPdf.set(false);
    });
  }

  protected exportExcel(): void {
    if (this.exportingExcel()) return;

    this.exportingExcel.set(true);
    void this.dgExcel.openManifest(this.buildExportContext()).then((ok) => {
      if (ok) {
        this.toast.show('Excel manifest opened', 'success');
      } else {
        this.toast.showError('Could not open Excel file');
      }
    }).catch((err) => {
      this.toast.showError(err instanceof Error ? err.message : 'Excel export failed');
    }).finally(() => {
      this.exportingExcel.set(false);
    });
  }

  private buildExportContext(): DgManifestExportContext {
    const lib = this.library();
    return {
      containers: this.visibleContainers(),
      includeDischarged: lib.showDischarged,
      mergeLines: lib.manifestMergeLines,
      grossTotalKg: lib.manifestGrossTotalKg,
    };
  }

  private buildUnifeederExportContext(): DgUnifeederExportContext {
    const lib = this.unifeederLibrary();
    return {
      rows: this.visibleUnifeederDisplayRows().map(
        ({ editable, sourceRowIds, weightKgDisplay, ...row }) => row,
      ),
      mergeLines: lib.mergeLines,
      grossTotalKg: lib.grossTotalKg,
    };
  }

  protected pickPdf(): void {
    this.fileRef()?.nativeElement.click();
  }

  protected onPdfInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) void this.importPdfFile(file);
    input.value = '';
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(true);
  }

  protected onDragLeave(): void {
    this.dragOver.set(false);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) void this.importPdfFile(file);
  }

  private async importPdfFile(file: File): Promise<void> {
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    if (!isPdf) {
      this.toast.showError('Please choose a PDF file');
      return;
    }

    this.importing.set(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const prestowResult = await this.prestowImporter.importFromPdfBytes(bytes);
      if (prestowResult.format === 'cma-prestow') {
        const applied = this.storage.applyCmaPrestowPositions(prestowResult.positions);
        const parts: string[] = [];
        if (applied.dgUpdated > 0) parts.push(`${applied.dgUpdated} DG`);
        if (applied.reeferUpdated > 0) parts.push(`${applied.reeferUpdated} reefer`);
        if (!parts.length) {
          this.toast.showError('No matching onboard containers found for prestow positions');
        } else {
          this.toast.show(`Updated positions: ${parts.join(', ')}`, 'success');
        }
        if (applied.unmatched.length) {
          this.toast.show(
            `${applied.unmatched.length} container(s) in PDF not found onboard`,
            'info',
          );
        }
        return;
      }

      const result = await this.importer.importFromPdfBytes(bytes, this.storage.ports());
      if (result.format === 'unknown' || !result.rows.length) {
        this.toast.showError(result.warnings[0] ?? 'Could not extract data from PDF');
        return;
      }

      const [contentFingerprint, pdfBytesFingerprint] = await Promise.all([
        buildDgManifestContentHash(result),
        buildDgPdfBytesHash(bytes),
      ]);
      const duplicate = this.storage.applyDgManifestImport(result, file.name, {
        contentFingerprint,
        pdfBytesFingerprint,
      });
      if (duplicate) {
        this.toast.showError(
          `This manifest was already imported (${duplicate.sourceName || 'existing entry'})`,
        );
        return;
      }

      const containers = new Set(result.rows.map((r) => r.containerNo).filter(Boolean)).size;
      const onboard = this.storage.dgLibrary().onboard.filter((c) => c.status === 'onboard').length;
      const note = `Added ${containers || 1} container(s) — ${onboard} onboard total`;
      this.toast.show(note, 'success');
      if (result.warnings.length) {
        this.toast.show(result.warnings.join(' '), 'info');
      }
    } catch (err) {
      this.toast.showError(err instanceof Error ? err.message : 'Failed to read PDF');
    } finally {
      this.importing.set(false);
    }
  }
}
