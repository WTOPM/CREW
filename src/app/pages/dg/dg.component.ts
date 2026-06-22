import { Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  dgManifestAllContainersDischarged,
  dgViewContainerTotalKg,
  dgViewOnboardClassSummaries,
  dgViewOnboardInventoryStats,
  formatDgManifestSourceName,
  formatDgWeightKgDisplay,
  formatDgWeightKgGrossDisplay,
  sortDgDocuments,
  type DgCargoLine,
  type DgManifestDocument,
  type DgManifestViewOptions,
  type DgActiveInventoryTab,
  type DgOnboardContainer,
  type DgOnboardContainerField,
} from '../../models/dg-manifest.models';
import type { DgManifestExportContext } from '../../models/dg-manifest-export.models';
import {
  buildDgContainerDisplayLines,
  planDgInventoryWeightDisplays,
  type DgCargoLineDisplay,
} from '../../utils/dg-cargo-merge.util';
import { DgManifestExcelService } from '../../services/dg-manifest-excel.service';
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
import { DgManifestStore } from '../../services/dg-manifest.store';
import { ToastService } from '../../services/toast.service';
import { commitDgDualWeightEdit } from '../../utils/dg-weight-tonnage.util';
import { formatDisplayDate } from '../../utils/date.util';
import { DatePickerComponent } from '../../components/date-picker/date-picker.component';
import { PortSelectComponent } from '../../components/port-select/port-select.component';
import { DgArchiveModalsComponent } from '../../components/dg-archive-modals/dg-archive-modals.component';
import { DgUnifeederInventoryComponent } from '../../components/dg-unifeeder-inventory/dg-unifeeder-inventory.component';
import { ContainerTypeTooltipDirective } from '../../directives/container-type-tooltip.directive';
import { DgClassTooltipDirective } from '../../directives/dg-class-tooltip.directive';

import {
  sortDgOnboardContainers,
  type DgInventorySortColumn,
  type DgInventorySortDirection,
} from '../../utils/dg-inventory-sort.util';
import { filterDgOnboardContainers } from '../../utils/dg-inventory-search.util';
import type { DgPageContext } from '../../utils/page-ship-context.util';
import { DgActIconComponent } from './dg-act-icon.component';
import { UnNumberTooltipDirective } from '../../directives/un-number-tooltip.directive';
import {
  cmaCargoAutofillFromUnNumber,
  unNumberHasDigits,
} from '../../utils/dg-un-number-autofill.util';
import { normalizeUnNumber } from '../../utils/dg-un-number.util';
import { dgFlashPointTone } from '../../utils/dg-flash-point-display.util';

type DgLineField = keyof Omit<DgCargoLine, 'id'>;
export type DgInventoryTab = DgActiveInventoryTab;

@Component({
  selector: 'app-dg',
  imports: [
    RouterLink,
    FormsModule,
    DgActIconComponent,
    PortSelectComponent,
    DatePickerComponent,
    ContainerTypeTooltipDirective,
    DgClassTooltipDirective,
    UnNumberTooltipDirective,
    DgArchiveModalsComponent,
    DgUnifeederInventoryComponent,
  ],
  templateUrl: './dg.component.html',
})
export class DgComponent {
  private readonly storage = inject(StorageService);
  private readonly dg = inject(DgManifestStore);
  private readonly importer = inject(DgManifestImportService);
  private readonly prestowImporter = inject(DgCmaPrestowImportService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly dgExcel = inject(DgManifestExcelService);
  private readonly dgPdf = inject(DgManifestPdfService);
  private readonly pageArchive = inject(DgPageArchiveService);
  private readonly toast = inject(ToastService);
  private readonly fileRef = viewChild<ElementRef<HTMLInputElement>>('pdfFile');

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

  protected readonly viewOptions = computed(
    (): DgManifestViewOptions => ({
      manifestMergeLines: this.library().manifestMergeLines,
      manifestUseGrossWeight: this.library().manifestUseGrossWeight,
      manifestRoundWeights: this.library().manifestRoundWeights,
    }),
  );

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
  protected readonly exportingExcel = signal(false);
  protected readonly exportingPdf = signal(false);
  protected readonly hoveredContainerId = signal<string | null>(null);
  protected readonly hoveredLineId = signal<string | null>(null);
  protected readonly inventorySortColumn = signal<DgInventorySortColumn | null>(null);
  protected readonly inventorySortDirection = signal<DgInventorySortDirection>('asc');
  protected readonly inventorySearch = signal('');
  protected readonly activeInventoryTab = computed(
    (): DgInventoryTab =>
      this.library().activeInventoryTab === 'unifeeder' ? 'unifeeder' : 'cmaCgm',
  );

  protected readonly unifeederLibrary = computed(() => this.library().unifeeder);

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

  protected toggleShowDischarged(checked: boolean): void {
    this.dg.updateDgManifestView({ showDischarged: checked });
  }

  protected setInventoryTab(tab: DgInventoryTab): void {
    this.dg.updateDgManifestView({ activeInventoryTab: tab });
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
      ? this.dg.transferCmaDgInventoryToUnifeeder()
      : this.dg.transferUnifeederDgInventoryToCma();
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
      this.dg.clearCmaDgInventory();
    } else {
      this.dg.clearUnifeederDgInventory();
    }
    this.toast.show(`${label} inventory cleared`, 'success');
  }

  protected toggleManifestMergeLines(checked: boolean): void {
    this.dg.updateDgManifestView({ manifestMergeLines: checked });
  }

  protected setManifestWeightTonnage(gross: boolean): void {
    this.dg.updateDgManifestView({ manifestUseGrossWeight: gross });
  }

  protected toggleManifestRoundWeights(checked: boolean): void {
    this.dg.updateDgManifestView({ manifestRoundWeights: checked });
  }

  protected toggleInventorySort(column: DgInventorySortColumn): void {
    if (this.inventorySortColumn() === column) {
      this.inventorySortDirection.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.inventorySortColumn.set(column);
      this.inventorySortDirection.set('asc');
    }
  }

  protected removeManifest(id: string, event: Event): void {
    event.stopPropagation();
    this.dg.removeDgManifest(id);
  }

  protected containerTotalKg(container: DgOnboardContainer): number {
    return dgViewContainerTotalKg(container, this.viewOptions());
  }

  protected containerDisplayLines(container: DgOnboardContainer): DgCargoLineDisplay[] {
    return buildDgContainerDisplayLines(
      container,
      this.viewOptions(),
      this.inventoryWeightDisplays(),
    );
  }

  protected containerDisplayLineCount(container: DgOnboardContainer): number {
    const count = this.containerDisplayLines(container).length;
    return count || 1;
  }

  protected formatSummaryKg(value: number): string {
    const lib = this.library();
    if (lib.manifestRoundWeights) {
      return formatDgWeightKgGrossDisplay(value) || '0';
    }
    return formatDgWeightKgDisplay(value) || '0';
  }

  protected flashPointTone(value: string): 'negative' | 'positive' | 'neutral' {
    return dgFlashPointTone(value);
  }

  protected formatDate(value: string): string {
    return formatDisplayDate(value);
  }

  protected startArchiveSave(): void {
    this.showArchiveLoadModal.set(false);
    this.showArchiveSaveModal.set(true);
  }

  protected openArchiveLoad(): void {
    this.showArchiveSaveModal.set(false);
    this.showArchiveLoadModal.set(true);
  }

  protected resetArchiveView(): void {
    this.pageArchive.reset();
    this.toast.show('Back to live DG page', 'success');
  }

  protected async commitArchiveAsLive(): Promise<void> {
    const snap = this.pageArchive.loaded();
    if (!snap) return;

    const ok = await this.confirmDialog.confirm({
      title: 'Apply snapshot as live data',
      message:
        `Make the current DG page (from "${snap.label}", including any edits) your live data? ` +
        'The previous live inventory will be lost. This cannot be undone.',
      confirmLabel: 'Apply as live',
      variant: 'danger',
    });
    if (!ok) return;

    this.pageArchive.commitLoadedAsLive();
    this.toast.show('Snapshot is now live DG data', 'success');
  }

  protected manifestDisplayName(doc: DgManifestDocument): string {
    return formatDgManifestSourceName(doc.loadPort, doc.documentDate, doc.sourceName);
  }

  protected manifestLabel(doc: DgManifestDocument): string {
    const parts = [
      doc.voyageNumber ? `Voy ${doc.voyageNumber}` : '',
      doc.containerCount ? `${doc.containerCount} ctr` : '',
    ].filter(Boolean);
    return parts.join(' · ');
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
    this.dg.updateDgOnboardContainer(containerId, { [field]: value });
  }

  protected onPageContextChange(field: keyof DgPageContext, value: string): void {
    this.dg.updateDgPageContext({ [field]: value });
  }

  protected onCmaLineWeightBlur(containerId: string, lineId: string, raw: string): void {
    const lib = this.library();
    const partial = commitDgDualWeightEdit(
      raw,
      lib.manifestUseGrossWeight,
      lib.manifestRoundWeights,
    );
    this.dg.updateDgOnboardCargoLine(containerId, lineId, partial);
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

  protected onLineChange(
    containerId: string,
    lineId: string,
    field: DgLineField,
    value: string,
  ): void {
    this.dg.updateDgOnboardCargoLine(containerId, lineId, { [field]: value });
  }

  protected onUnNoEnter(event: KeyboardEvent): void {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    (event.target as HTMLInputElement | null)?.blur();
  }

  protected onCmaUnNoCommit(containerId: string, lineId: string, event: FocusEvent): void {
    const input = event.target as HTMLInputElement | null;
    if (!input) return;

    const raw = input.value;
    if (!unNumberHasDigits(raw)) return;

    const autofill = cmaCargoAutofillFromUnNumber(raw);
    const patch = autofill ?? { unNo: normalizeUnNumber(raw) };
    this.dg.updateDgOnboardCargoLine(containerId, lineId, patch);
  }

  protected addContainer(): void {
    this.dg.addDgOnboardContainer();
  }

  protected removeContainer(containerId: string): void {
    this.dg.removeDgOnboardContainer(containerId);
  }

  protected markDischarged(containerId: string): void {
    this.dg.setDgOnboardContainerStatus(containerId, 'discharged');
  }

  protected restoreOnboard(containerId: string): void {
    this.dg.setDgOnboardContainerStatus(containerId, 'onboard');
  }

  protected addLine(containerId: string): void {
    this.dg.addDgOnboardCargoLine(containerId);
  }

  protected removeLine(containerId: string, lineId: string): void {
    this.dg.removeDgOnboardCargoLine(containerId, lineId);
  }

  protected exportPdf(): void {
    if (this.exportingPdf()) return;

    this.exportingPdf.set(true);
    void this.dgPdf
      .openManifest(this.buildExportContext())
      .then((ok) => {
        if (ok) {
          this.toast.show('PDF manifest opened', 'success');
        } else {
          this.toast.showError('Could not open PDF');
        }
      })
      .catch((err) => {
        this.toast.showError(err instanceof Error ? err.message : 'PDF export failed');
      })
      .finally(() => {
        this.exportingPdf.set(false);
      });
  }

  protected exportExcel(): void {
    if (this.exportingExcel()) return;

    this.exportingExcel.set(true);
    void this.dgExcel
      .openManifest(this.buildExportContext())
      .then((ok) => {
        if (ok) {
          this.toast.show('Excel manifest opened', 'success');
        } else {
          this.toast.showError('Could not open Excel file');
        }
      })
      .catch((err) => {
        this.toast.showError(err instanceof Error ? err.message : 'Excel export failed');
      })
      .finally(() => {
        this.exportingExcel.set(false);
      });
  }

  private buildExportContext(): DgManifestExportContext {
    const lib = this.library();
    return {
      containers: this.visibleContainers(),
      includeDischarged: lib.showDischarged,
      mergeLines: lib.manifestMergeLines,
      grossTotalKg: lib.manifestRoundWeights,
      useGrossWeight: lib.manifestUseGrossWeight,
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
        const applied = this.dg.applyCmaPrestowPositions(prestowResult.positions);
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

      const result = await this.importer.importFromPdfBytes(bytes, this.storage.ports(), {
        useGrossWeight: this.library().manifestUseGrossWeight,
      });
      if (result.format === 'unknown' || !result.rows.length) {
        this.toast.showError(result.warnings[0] ?? 'Could not extract data from PDF');
        return;
      }

      const [contentFingerprint, pdfBytesFingerprint] = await Promise.all([
        buildDgManifestContentHash(result),
        buildDgPdfBytesHash(bytes),
      ]);
      const duplicate = this.dg.applyDgManifestImport(result, file.name, {
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
