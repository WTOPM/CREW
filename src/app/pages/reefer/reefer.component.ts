import { Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  reeferManifestFullyDischarged,
  reeferOnboardInventoryStats,
  REEFER_MONITORING_NEXT_DAY_OPTIONS,
  type ReeferInventorySortColumn,
  type ReeferOnboardUnit,
} from '../../models/reefer.models';
import { REEFER_MONITORING_SIGNER_SLOTS } from '../../utils/reefer-check-signoff.util';
import { reeferVisibleOnboardUnits } from '../../utils/reefer-inventory-sort.util';
import { filterReeferOnboardUnits } from '../../utils/reefer-inventory-search.util';
import type { ReeferExportContext } from '../../models/reefer-export.models';
import type { ReeferPageContext } from '../../utils/page-ship-context.util';
import type { ReeferPageSnapshot } from '../../models/reefer-page-archive.models';
import { ReeferExcelService } from '../../services/reefer-excel.service';
import { ReeferImportService } from '../../services/reefer-import.service';
import { ReeferPageArchiveService } from '../../services/reefer-page-archive.service';
import { ReeferPdfService } from '../../services/reefer-pdf.service';
import { StorageService } from '../../services/storage.service';
import { ReeferStore } from '../../services/reefer.store';
import { ToastService } from '../../services/toast.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { formatDisplayDate } from '../../utils/date.util';
import { buildReeferContentHash, buildReeferPdfBytesHash } from '../../utils/reefer-fingerprint.util';
import { DatePickerComponent } from '../../components/date-picker/date-picker.component';
import { PortSelectComponent } from '../../components/port-select/port-select.component';
import { ClickOutsideDirective } from '../../directives/click-outside.directive';
import { DgActIconComponent } from '../dg/dg-act-icon.component';

type ReeferUnitField = keyof Omit<ReeferOnboardUnit, 'id' | 'sourceManifestId'>;

@Component({
  selector: 'app-reefer',
  imports: [
    RouterLink,
    FormsModule,
    PortSelectComponent,
    DatePickerComponent,
    ClickOutsideDirective,
    DgActIconComponent,
  ],
  templateUrl: './reefer.component.html',
  styleUrl: './reefer.component.css',
})
export class ReeferComponent {
  private readonly storage = inject(StorageService);
  private readonly reefer = inject(ReeferStore);
  private readonly importer = inject(ReeferImportService);
  private readonly reeferPdf = inject(ReeferPdfService);
  private readonly reeferExcel = inject(ReeferExcelService);
  private readonly pageArchive = inject(ReeferPageArchiveService);
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly fileRef = viewChild<ElementRef<HTMLInputElement>>('pdfFile');

  protected readonly ship = this.storage.ship;
  protected readonly ports = this.storage.ports;
  protected readonly library = this.storage.reeferLibrary;
  protected readonly reeferArchive = this.pageArchive;

  protected readonly importHistory = computed(() =>
    [...this.library().manifests].sort((a, b) => b.addedAt.localeCompare(a.addedAt)),
  );

  protected readonly visibleUnits = computed(() => {
    const units = reeferVisibleOnboardUnits(this.library());
    return filterReeferOnboardUnits(units, this.inventorySearch());
  });

  protected readonly stats = computed(() => {
    const lib = this.library();
    const baseList = lib.showDischarged
      ? lib.onboard
      : lib.onboard.filter((u) => u.status === 'onboard');
    const filtered = filterReeferOnboardUnits(baseList, this.inventorySearch());
    return reeferOnboardInventoryStats(filtered, true);
  });

  protected readonly dragOver = signal(false);
  protected readonly importing = signal(false);
  protected readonly exportingPdf = signal(false);
  protected readonly exportingExcel = signal(false);
  protected readonly inventorySearch = signal('');
  protected readonly showArchiveSaveModal = signal(false);
  protected readonly showArchiveLoadModal = signal(false);
  protected archiveSaveLabel = '';

  protected formatDate(value: string): string {
    return formatDisplayDate(value);
  }

  protected manifestFullyDischarged(manifestId: string): boolean {
    return reeferManifestFullyDischarged(manifestId, this.library().onboard);
  }

  protected readonly nextDayOptions = REEFER_MONITORING_NEXT_DAY_OPTIONS;
  protected readonly signerSlots = Array.from(
    { length: REEFER_MONITORING_SIGNER_SLOTS },
    (_, i) => i,
  );

  protected onMonitoringSignerChange(
    which: 'morning' | 'evening',
    index: number,
    field: 'rank' | 'name',
    value: string,
  ): void {
    this.reefer.updateReeferMonitoringSigner(which, index, field, value);
  }

  protected toggleShowDischarged(checked: boolean): void {
    this.reefer.updateReeferViewSettings({ showDischarged: checked });
  }

  protected toggleMonitoringAddNextDays(checked: boolean): void {
    this.reefer.updateReeferViewSettings({ monitoringAddNextDays: checked });
  }

  protected onMonitoringNextDaysChange(value: string): void {
    this.reefer.updateReeferViewSettings({
      monitoringNextDays: Number(value) as (typeof REEFER_MONITORING_NEXT_DAY_OPTIONS)[number],
    });
  }

  protected toggleInventorySort(column: ReeferInventorySortColumn): void {
    const lib = this.library();
    if (lib.inventorySortColumn === column) {
      this.reefer.updateReeferViewSettings({
        inventorySortDirection: lib.inventorySortDirection === 'asc' ? 'desc' : 'asc',
      });
    } else {
      this.reefer.updateReeferViewSettings({
        inventorySortColumn: column,
        inventorySortDirection: 'asc',
      });
    }
  }

  protected onPageContextChange(field: keyof ReeferPageContext, value: string): void {
    this.reefer.updateReeferPageContext({ [field]: value });
  }

  private buildExportContext(): ReeferExportContext {
    return { units: this.visibleUnits() };
  }

  protected onUnitChange(unitId: string, field: ReeferUnitField, value: string): void {
    this.reefer.updateReeferUnit(unitId, { [field]: value });
  }

  protected addUnit(): void {
    this.reefer.addReeferUnit();
  }

  protected removeUnit(unitId: string): void {
    this.reefer.removeReeferUnit(unitId);
  }

  protected markDischarged(unitId: string): void {
    this.reefer.setReeferUnitStatus(unitId, 'discharged');
  }

  protected restoreOnboard(unitId: string): void {
    this.reefer.setReeferUnitStatus(unitId, 'onboard');
  }

  protected removeManifest(id: string, event: Event): void {
    event.stopPropagation();
    this.reefer.removeReeferManifest(id);
  }

  protected exportPdf(): void {
    if (this.exportingPdf()) return;
    this.exportingPdf.set(true);
    void this.reeferPdf.openMonitoringLog(this.buildExportContext()).then((ok) => {
      this.toast.show(ok ? 'Reefer log PDF opened' : 'Could not open PDF', ok ? 'success' : 'error');
    }).catch((err) => {
      this.toast.showError(err instanceof Error ? err.message : 'PDF export failed');
    }).finally(() => {
      this.exportingPdf.set(false);
    });
  }

  protected exportExcel(): void {
    if (this.exportingExcel()) return;
    this.exportingExcel.set(true);
    void this.reeferExcel.openMonitoringLog(this.buildExportContext()).then((ok) => {
      this.toast.show(ok ? 'Reefer log Excel opened' : 'Could not open Excel', ok ? 'success' : 'error');
    }).catch((err) => {
      this.toast.showError(err instanceof Error ? err.message : 'Excel export failed');
    }).finally(() => {
      this.exportingExcel.set(false);
    });
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

  protected pickArchiveSnapshot(entry: ReeferPageSnapshot): void {
    if (this.pageArchive.load(entry.id)) {
      this.showArchiveLoadModal.set(false);
      this.toast.show(`Page state loaded from archive: "${entry.label}"`, 'info');
    }
  }

  protected resetArchiveView(): void {
    this.pageArchive.reset();
    this.toast.show('Back to live reefer page', 'success');
  }

  protected async commitArchiveAsLive(): Promise<void> {
    const snap = this.pageArchive.loaded();
    if (!snap) return;

    const ok = await this.confirmDialog.confirm({
      title: 'Apply snapshot as live data',
      message:
        `Make the current reefer page (from "${snap.label}", including any edits) your live data? ` +
        'The previous live inventory will be lost. This cannot be undone.',
      confirmLabel: 'Apply as live',
      variant: 'danger',
    });
    if (!ok) return;

    this.pageArchive.commitLoadedAsLive();
    this.toast.show('Snapshot is now live reefer data', 'success');
  }

  protected deleteArchiveSnapshot(id: string, event: Event): void {
    event.stopPropagation();
    this.pageArchive.remove(id);
    this.toast.show('Snapshot deleted', 'success');
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
        buildReeferContentHash(result),
        buildReeferPdfBytesHash(bytes),
      ]);
      const duplicate = this.reefer.applyReeferImport(result, file.name, {
        contentFingerprint,
        pdfBytesFingerprint,
      });
      if (duplicate) {
        this.toast.showError(`This manifest was already imported (${duplicate.sourceName || 'existing entry'})`);
        return;
      }

      const count = result.rows.length;
      const total = this.storage.reeferLibrary().onboard.length;
      this.toast.show(`Added ${count} reefer unit(s) — ${total} total`, 'success');
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
