import { Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  formatDgManifestSourceName,
  formatDgWeightKgDisplay,
  formatDgWeightKgGrossDisplay,
  parseDgWeightKg,
} from '../../models/dg-manifest.models';
import type { DgUnifeederExportContext } from '../../models/dg-manifest-export.models';
import { StorageService } from '../../services/storage.service';
import { DgManifestStore } from '../../services/dg-manifest.store';
import { ToastService } from '../../services/toast.service';
import { commitDgDualWeightEdit } from '../../utils/dg-weight-tonnage.util';
import { formatDisplayDate } from '../../utils/date.util';
import { PortSelectComponent } from '../port-select/port-select.component';
import { DgActIconComponent } from '../../pages/dg/dg-act-icon.component';
import { ContainerTypeTooltipDirective } from '../../directives/container-type-tooltip.directive';
import { DgClassTooltipDirective } from '../../directives/dg-class-tooltip.directive';
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
import {
  unifeederOnboardInventoryStats,
  type DgUnifeederManifestDocument,
  type DgUnifeederRow,
  type DgUnifeederRowField,
} from '../../models/dg-unifeeder.models';
import { DgUnifeederImportService } from '../../services/dg-unifeeder-import.service';
import {
  formatUnifeederImportValidationError,
  formatUnifeederImportValidationOk,
  validateUnifeederOnboardAgainstPdfSummaries,
} from '../../utils/dg-unifeeder-pdf-summary.util';
import {
  buildUnifeederContentHash,
  buildUnifeederPdfBytesHash,
} from '../../utils/dg-unifeeder-fingerprint.util';
import { unifeederManifestSummary } from '../../utils/dg-manifest-summary.util';
import { DgUnifeederExcelService } from '../../services/dg-unifeeder-excel.service';
import { DgUnifeederPdfService } from '../../services/dg-unifeeder-pdf.service';
import { MfagScheduleTooltipDirective } from '../../directives/mfag-schedule-tooltip.directive';
import { PackingGroupTooltipDirective } from '../../directives/packing-group-tooltip.directive';
import { UnNumberTooltipDirective } from '../../directives/un-number-tooltip.directive';
import {
  mfagFirePageRefFromEmsCode,
  mfagSpillagePageRefFromEmsCode,
} from '../../utils/dg-mfag-schedule.util';
import {
  unifeederAutofillFromUnNumber,
  unNumberHasDigits,
} from '../../utils/dg-un-number-autofill.util';
import { normalizeUnNumber } from '../../utils/dg-un-number.util';
import { dgFlashPointTone } from '../../utils/dg-flash-point-display.util';

/**
 * The DP WORLD / UNIFEEDER inventory tab of the DG page: import history, onboard rows
 * grouped by container, inline editing, sorting, weight display, and PDF/Excel export.
 * Self-contained — reads/writes via StorageService + DgManifestStore; the parent DG page
 * just hosts it when the Unifeeder tab is active.
 */
@Component({
  selector: 'app-dg-unifeeder-inventory',
  imports: [
    FormsModule,
    PortSelectComponent,
    DgActIconComponent,
    ContainerTypeTooltipDirective,
    DgClassTooltipDirective,
    MfagScheduleTooltipDirective,
    UnNumberTooltipDirective,
    PackingGroupTooltipDirective,
  ],
  templateUrl: './dg-unifeeder-inventory.component.html',
})
export class DgUnifeederInventoryComponent {
  private readonly storage = inject(StorageService);
  private readonly dg = inject(DgManifestStore);
  private readonly unifeederImporter = inject(DgUnifeederImportService);
  private readonly unifeederExcel = inject(DgUnifeederExcelService);
  private readonly unifeederPdf = inject(DgUnifeederPdfService);
  private readonly toast = inject(ToastService);
  private readonly unifeederFileRef = viewChild<ElementRef<HTMLInputElement>>('unifeederExcelFile');

  protected readonly ports = this.storage.ports;
  protected readonly library = this.storage.dgLibrary;

  protected readonly unifeederLibrary = computed(() => this.library().unifeeder);

  protected readonly unifeederWeightOptions = computed(() => ({
    mergeLines: this.unifeederLibrary().mergeLines,
    useGrossWeight: this.unifeederLibrary().useGrossWeight,
    roundWeights: this.unifeederLibrary().roundWeights,
  }));

  protected readonly unifeederDragOver = signal(false);
  protected readonly unifeederImporting = signal(false);
  protected readonly exportingExcel = signal(false);
  protected readonly exportingPdf = signal(false);
  protected readonly hoveredUnifeederContainerKey = signal<string | null>(null);
  protected readonly hoveredUnifeederLineId = signal<string | null>(null);
  protected readonly unifeederInventorySearch = signal('');
  protected readonly unifeederSortColumn = signal<DgUnifeederSortColumn | null>(null);
  protected readonly unifeederSortDirection = signal<DgUnifeederSortDirection>('asc');

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
    const filtered = filterUnifeederOnboardRows(
      this.filteredUnifeederRows(),
      this.unifeederInventorySearch(),
    );
    const options = this.unifeederWeightOptions();
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
    const base = unifeederOnboardInventoryStats(
      filtered,
      true,
      lib.useGrossWeight,
      lib.roundWeights,
      lib.mergeLines,
    );
    return {
      ...base,
      rowCount: this.visibleUnifeederDisplayRows().length,
    };
  });

  protected readonly unifeederManifestSummary = computed(() =>
    unifeederManifestSummary(
      mergeUnifeederRowsInContainers(this.visibleUnifeederRows(), this.unifeederLibrary().mergeLines),
      this.unifeederLibrary().useGrossWeight,
      this.unifeederLibrary().roundWeights,
    ),
  );

  protected readonly unifeederImportHistory = computed(() =>
    [...this.unifeederLibrary().manifests].sort((a, b) => b.addedAt.localeCompare(a.addedAt)),
  );

  protected flashPointTone(value: string): 'negative' | 'positive' | 'neutral' {
    return dgFlashPointTone(value);
  }

  protected formatDate(value: string): string {
    return formatDisplayDate(value);
  }

  protected onUnNoEnter(event: KeyboardEvent): void {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    (event.target as HTMLInputElement | null)?.blur();
  }

  protected toggleUnifeederShowDischarged(checked: boolean): void {
    this.dg.updateUnifeederViewSettings({ showDischarged: checked });
  }

  protected setUnifeederWeightTonnage(gross: boolean): void {
    this.dg.updateUnifeederViewSettings({ useGrossWeight: gross });
    this.showUnifeederTonnageManifestCheck(gross);
  }

  protected toggleUnifeederRoundWeights(checked: boolean): void {
    this.dg.updateUnifeederViewSettings({ roundWeights: checked });
  }

  private showUnifeederTonnageManifestCheck(gross: boolean): void {
    const lib = this.unifeederLibrary();
    const rows = lib.onboard.filter((r) => r.status === 'onboard');
    const check = validateUnifeederOnboardAgainstPdfSummaries(rows, lib.manifests, gross);
    if (!lib.manifests.some((m) => (m.pdfImoGrossWeightKg ?? 0) > 0 || (m.pdfImoNetWeightKg ?? 0) > 0)) {
      return;
    }
    const error = formatUnifeederImportValidationError(check);
    if (error) {
      this.toast.showError(error);
      return;
    }
    const ok = formatUnifeederImportValidationOk(check, gross, check.pdfKg, check.importedKg);
    if (ok) {
      this.toast.show(ok, 'success');
    }
  }

  protected toggleUnifeederMergeLines(checked: boolean): void {
    this.dg.updateUnifeederViewSettings({ mergeLines: checked });
  }

  protected toggleUnifeederInventorySort(column: DgUnifeederSortColumn): void {
    if (this.unifeederSortColumn() === column) {
      this.unifeederSortDirection.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.unifeederSortColumn.set(column);
      this.unifeederSortDirection.set('asc');
    }
  }

  protected unifeederManifestDisplayName(doc: DgUnifeederManifestDocument): string {
    return formatDgManifestSourceName(doc.loadPort, doc.documentDate, doc.sourceName);
  }

  protected unifeederManifestMeta(doc: DgUnifeederManifestDocument): string {
    const rows = this.unifeederLibrary().onboard.filter((row) => row.sourceManifestId === doc.id);
    const rowCount = doc.rowCount || rows.length;
    const containerCount =
      doc.containerCount ||
      new Set(rows.map((row) => row.containerNo.trim()).filter(Boolean)).size;

    const parts: string[] = [];
    if (doc.voyageNumber?.trim()) parts.push(`Voy ${doc.voyageNumber.trim()}`);
    parts.push(`${rowCount} rows`);
    if (containerCount > 0) parts.push(`${containerCount} ctr`);
    return parts.join(' · ');
  }

  protected unifeederManifestFullyDischarged(manifestId: string): boolean {
    const rows = this.unifeederLibrary().onboard.filter((row) => row.sourceManifestId === manifestId);
    return rows.length > 0 && rows.every((row) => row.status === 'discharged');
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
    this.dg.updateUnifeederRow(rowId, patch);
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
    this.dg.addUnifeederRow();
  }

  protected addUnifeederCargoLine(group: DgUnifeederContainerDisplayGroup): void {
    this.dg.addUnifeederRow({
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
      this.dg.removeUnifeederRow(rowId);
    }
  }

  protected markUnifeederContainerDischarged(group: DgUnifeederContainerDisplayGroup): void {
    for (const rowId of this.unifeederContainerSourceRowIds(group)) {
      this.dg.setUnifeederRowStatus(rowId, 'discharged');
    }
  }

  protected restoreUnifeederContainer(group: DgUnifeederContainerDisplayGroup): void {
    for (const rowId of this.unifeederContainerSourceRowIds(group)) {
      this.dg.setUnifeederRowStatus(rowId, 'onboard');
    }
  }

  protected removeUnifeederRow(rowId: string): void {
    this.dg.removeUnifeederRow(rowId);
  }

  protected removeUnifeederDisplayRow(row: DgUnifeederRowDisplay): void {
    for (const id of row.sourceRowIds) {
      this.dg.removeUnifeederRow(id);
    }
  }

  protected markUnifeederDischarged(rowId: string): void {
    this.dg.setUnifeederRowStatus(rowId, 'discharged');
  }

  protected markUnifeederDisplayRowDischarged(row: DgUnifeederRowDisplay): void {
    for (const id of row.sourceRowIds) {
      this.dg.setUnifeederRowStatus(id, 'discharged');
    }
  }

  protected restoreUnifeederRow(rowId: string): void {
    this.dg.setUnifeederRowStatus(rowId, 'onboard');
  }

  protected restoreUnifeederDisplayRow(row: DgUnifeederRowDisplay): void {
    for (const id of row.sourceRowIds) {
      this.dg.setUnifeederRowStatus(id, 'onboard');
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
    this.dg.removeUnifeederManifest(id);
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
      const result = await this.unifeederImporter.importFromPdfBytes(bytes, this.storage.ports(), {
        useGrossWeight: this.unifeederLibrary().useGrossWeight,
      });
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
      const duplicate = this.dg.applyUnifeederImport(result, file.name, {
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
    if (this.unifeederLibrary().roundWeights) {
      return formatDgWeightKgGrossDisplay(value) || '0';
    }
    return formatDgWeightKgDisplay(value) || '0';
  }

  protected onUnifeederWeightBlur(row: DgUnifeederRowDisplay, raw: string): void {
    if (!row.editable) return;
    const lib = this.unifeederLibrary();
    const partial = commitDgDualWeightEdit(raw, lib.useGrossWeight, lib.roundWeights);
    this.dg.updateUnifeederRow(this.unifeederPrimaryRowId(row), partial);
  }

  protected unifeederWeightDisplay(row: DgUnifeederRowDisplay): string {
    return row.weightKgDisplay || row.weightKg;
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

  protected onUnifeederUnNoCommit(row: DgUnifeederRowDisplay, event: FocusEvent): void {
    if (!row.editable) return;

    const input = event.target as HTMLInputElement | null;
    if (!input) return;

    const raw = input.value;
    if (!unNumberHasDigits(raw)) return;

    const autofill = unifeederAutofillFromUnNumber(raw);
    const patch = autofill ?? { unNo: normalizeUnNumber(raw) };
    this.dg.updateUnifeederRow(this.unifeederPrimaryRowId(row), patch);
  }

  private buildUnifeederExportContext(): DgUnifeederExportContext {
    const lib = this.unifeederLibrary();
    return {
      rows: this.visibleUnifeederDisplayRows().map(
        ({ editable, sourceRowIds, weightKgDisplay, ...row }) => row,
      ),
      mergeLines: lib.mergeLines,
      grossTotalKg: lib.roundWeights,
      useGrossWeight: lib.useGrossWeight,
    };
  }
}
