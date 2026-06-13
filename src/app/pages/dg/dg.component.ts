import { Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  dgManifestAllContainersDischarged,
  dgViewContainerTotalKg,
  dgViewOnboardClassSummaries,
  dgViewOnboardInventoryStats,
  formatDgWeightKgDisplay,
  sortDgDocuments,
  type DgCargoLine,
  type DgManifestDocument,
  type DgManifestViewOptions,
  type DgOnboardContainer,
  type DgOnboardContainerField,
} from '../../models/dg-manifest.models';
import type { DgManifestExportContext } from '../../models/dg-manifest-export.models';
import {
  buildDgContainerDisplayLines,
  planDgInventoryWeightDisplays,
  type DgCargoLineDisplay,
} from '../../utils/dg-cargo-merge.util';
import type { ShipInfo } from '../../models/crew.models';
import { DgManifestExcelService } from '../../services/dg-manifest-excel.service';
import { DgManifestPdfService } from '../../services/dg-manifest-pdf.service';
import { DgManifestImportService } from '../../services/dg-manifest-import.service';
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

import { DgActIconComponent } from './dg-act-icon.component';

type DgLineField = keyof Omit<DgCargoLine, 'id'>;

@Component({
  selector: 'app-dg',
  imports: [RouterLink, FormsModule, DgActIconComponent, PortSelectComponent, DatePickerComponent, ClickOutsideDirective, ContainerTypeTooltipDirective, DgClassTooltipDirective],
  templateUrl: './dg.component.html',
  styleUrl: './dg.component.css',
})
export class DgComponent {
  private readonly storage = inject(StorageService);
  private readonly importer = inject(DgManifestImportService);
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

  protected readonly visibleContainers = computed(() => {
    const lib = this.library();
    let list = lib.showDischarged
      ? [...lib.onboard]
      : lib.onboard.filter((c) => c.status === 'onboard');
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

  protected readonly stats = computed(() =>
    dgViewOnboardInventoryStats(
      this.library().onboard,
      this.library().showDischarged,
      this.viewOptions(),
      (container) => this.containerDisplayLines(container).length,
    ),
  );

  protected readonly classSummaries = computed(() =>
    dgViewOnboardClassSummaries(
      this.library().onboard,
      this.library().showDischarged,
      this.viewOptions(),
    ),
  );

  protected readonly dragOver = signal(false);
  protected readonly importing = signal(false);
  protected readonly exportingExcel = signal(false);
  protected readonly exportingPdf = signal(false);
  protected readonly hoveredContainerId = signal<string | null>(null);
  protected readonly hoveredLineId = signal<string | null>(null);
  protected readonly inventorySortColumn = signal<DgInventorySortColumn | null>(null);
  protected readonly inventorySortDirection = signal<DgInventorySortDirection>('asc');

  protected readonly dgArchive = this.pageArchive;
  protected readonly showArchiveSaveModal = signal(false);
  protected readonly showArchiveLoadModal = signal(false);
  protected archiveSaveLabel = '';

  protected toggleShowDischarged(checked: boolean): void {
    this.storage.updateDgManifestView({ showDischarged: checked });
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
      return formatDgWeightKgDisplay(Math.round(value)) || '0';
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

  protected onShipChange(field: keyof ShipInfo, value: string): void {
    this.storage.updateShip({ [field]: value });
  }

  protected setContainerGroupHover(containerId: string): void {
    this.hoveredContainerId.set(containerId);
    this.hoveredLineId.set(null);
  }

  protected setLineHover(containerId: string, lineId: string): void {
    this.hoveredContainerId.set(containerId);
    this.hoveredLineId.set(lineId);
  }

  protected onContainerGroupLeave(event: MouseEvent, containerId: string): void {
    const related = event.relatedTarget;
    if (related instanceof Element) {
      const relatedEl = related.closest('[data-container-id]');
      if (relatedEl?.getAttribute('data-container-id') === containerId) {
        return;
      }
    }
    if (this.hoveredContainerId() === containerId) {
      this.hoveredContainerId.set(null);
      this.hoveredLineId.set(null);
    }
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
    if (!this.hasExportData()) {
      this.toast.showError('No onboard DG data to export');
      return;
    }

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

  private hasExportData(): boolean {
    return this.visibleContainers().some(
      (c) =>
        c.lines.some(
          (l) => l.dgClass || l.unNo || l.weightKg || l.properShippingName,
        ) || c.containerNo,
    );
  }

  private buildExportContext(): DgManifestExportContext {
    return {
      containers: this.visibleContainers(),
      includeDischarged: this.library().showDischarged,
      mergeLines: this.library().manifestMergeLines,
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
