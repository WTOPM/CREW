import { Component, computed, effect, ElementRef, HostListener, inject, signal, viewChild } from '@angular/core';
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
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { commitDgDualWeightEdit } from '../../utils/dg-weight-tonnage.util';
import { formatDisplayDate } from '../../utils/date.util';
import { PortSelectComponent } from '../port-select/port-select.component';
import { ContainerTypeSuggestComponent } from '../container-type-suggest/container-type-suggest.component';
import { DgActIconComponent } from '../../pages/dg/dg-act-icon.component';
import { ContainerTypeTooltipDirective } from '../../directives/container-type-tooltip.directive';
import { DgClassTooltipDirective } from '../../directives/dg-class-tooltip.directive';
import { filterUnifeederOnboardRows } from '../../utils/dg-unifeeder-inventory-search.util';
import {
  buildUnifeederInventoryDisplayRows,
  groupUnifeederRawRowsByContainer,
  mergeUnifeederRowsInContainers,
  pickUnifeederContainerHeaderField,
  planUnifeederMergedWeightDisplays,
  unifeederContainerKey,
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
import { DgUnifeederDagosImportService } from '../../services/dg-unifeeder-dagos-import.service';
import { DgManifestSourcePdfService } from '../../services/dg-manifest-source-pdf.service';
import {
  formatUnifeederImportValidationError,
  formatUnifeederImportValidationOk,
  validateUnifeederOnboardAgainstPdfSummaries,
} from '../../utils/dg-unifeeder-pdf-summary.util';
import {
  buildUnifeederContentHash,
  buildUnifeederPdfBytesHash,
} from '../../utils/dg-unifeeder-fingerprint.util';
import { electronLocalFilePath } from '../../utils/electron-local-file-path.util';
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
  resolveUnifeederUnAutofill,
  unifeederDescriptionChoices,
  unifeederNeedsDescriptionChoice,
  unifeederNeedsPackingGroupChoice,
  unifeederPackingGroupChoices,
  unNumberHasDigits,
} from '../../utils/dg-un-number-autofill.util';
import { normalizeUnNumber } from '../../utils/dg-un-number.util';
import { RefChoiceSuggestComponent } from '../ref-choice-suggest/ref-choice-suggest.component';
import { DgSheetSelectDirective } from '../../directives/dg-sheet-select.directive';
import { PlainTooltipDirective } from '../../directives/plain-tooltip.directive';
import {
  applyUnifeederReferenceValue,
  findIdenticalUnifeederReferenceMismatches,
  getUnifeederReferenceMismatch,
  unifeederRefCompareFieldLabel,
  type UnifeederRefCompareField,
  type UnifeederReferenceMismatch,
} from '../../utils/dg-unifeeder-reference-mismatch.util';
import {
  dgFlashPointTone,
  suggestUnifeederFlashPointFormat,
} from '../../utils/dg-flash-point-display.util';
import { preferManifestGoodsDescription } from '../../utils/dg-goods-description.util';
import { DgRowSelection } from '../../utils/dg-row-selection.util';
import {
  findUnifeederDagosNetMismatches,
  type UnifeederDagosNetMismatch,
} from '../../utils/dg-unifeeder-dagos-net.util';

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
    ContainerTypeSuggestComponent,
    RefChoiceSuggestComponent,
    DgActIconComponent,
    ContainerTypeTooltipDirective,
    DgClassTooltipDirective,
    MfagScheduleTooltipDirective,
    UnNumberTooltipDirective,
    PackingGroupTooltipDirective,
    DgSheetSelectDirective,
    PlainTooltipDirective,
  ],
  templateUrl: './dg-unifeeder-inventory.component.html',
})
export class DgUnifeederInventoryComponent {
  private readonly storage = inject(StorageService);
  private readonly dg = inject(DgManifestStore);
  private readonly unifeederImporter = inject(DgUnifeederImportService);
  private readonly dagosImporter = inject(DgUnifeederDagosImportService);
  private readonly unifeederExcel = inject(DgUnifeederExcelService);
  private readonly unifeederPdf = inject(DgUnifeederPdfService);
  private readonly sourcePdf = inject(DgManifestSourcePdfService);
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly unifeederFileRef = viewChild<ElementRef<HTMLInputElement>>('unifeederExcelFile');

  protected readonly ports = this.storage.ports;
  protected readonly library = this.storage.dgLibrary;

  protected readonly unifeederLibrary = computed(() => this.library().unifeeder);
  protected readonly inventoryCopyMode = computed(
    () => this.library().inventoryViewMode === 'copy',
  );

  protected setInventoryViewMode(mode: 'edit' | 'copy'): void {
    if (this.library().inventoryViewMode === mode) return;
    if (mode === 'copy') this.rowSelection.clear();
    this.dg.updateDgManifestView({ inventoryViewMode: mode });
  }

  /** Returns false (and toasts) when Copy mode blocks edits. */
  protected requireInventoryEdit(): boolean {
    if (!this.inventoryCopyMode()) return true;
    this.toast.show('Switch to Edit mode to change the inventory', 'info');
    return false;
  }

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

  /** rowId → Dagos net kg suggestion after Dagos import (cleared when resolved). */
  protected readonly dagosNetMismatches = signal<ReadonlyMap<string, UnifeederDagosNetMismatch>>(
    new Map(),
  );

  /**
   * While a cell is focused: keep that container visible (search must not hide it mid-edit)
   * and freeze list order (sort must not jump the row away on each Backspace).
   */
  protected readonly inventoryEditContainerKey = signal<string | null>(null);
  private readonly inventoryEditOrderFreeze = signal<string[] | null>(null);

  /** Multi-select by list No (container groups). */
  protected readonly rowSelection = new DgRowSelection();

  constructor() {
    effect(() => {
      this.rowSelection.setOrderedIds(
        this.visibleUnifeederContainerGroups().map((g) => g.key),
      );
    });
    effect(() => {
      if (this.inventoryCopyMode()) this.rowSelection.clear();
    });
  }

  @HostListener('document:keydown.escape')
  protected onEscapeClearSelection(): void {
    this.rowSelection.clear();
  }

  @HostListener('focusin', ['$event'])
  protected onInventoryFocusIn(event: FocusEvent): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
    if (target.readOnly || target.disabled) return;
    const key = target
      .closest('[data-uf-container-key]')
      ?.getAttribute('data-uf-container-key');
    if (!key) return;
    if (!this.inventoryEditOrderFreeze()) {
      this.inventoryEditOrderFreeze.set(
        this.visibleUnifeederContainerGroups().map((g) => g.key),
      );
    }
    this.inventoryEditContainerKey.set(key);
  }

  @HostListener('focusout', ['$event'])
  protected onInventoryFocusOut(_event: FocusEvent): void {
    queueMicrotask(() => {
      const active = document.activeElement;
      if (active instanceof HTMLElement) {
        const key = active
          .closest('[data-uf-container-key]')
          ?.getAttribute('data-uf-container-key');
        if (key) {
          this.inventoryEditContainerKey.set(key);
          return;
        }
      }
      this.inventoryEditContainerKey.set(null);
      this.inventoryEditOrderFreeze.set(null);
    });
  }

  @HostListener('document:pointerup')
  @HostListener('document:pointercancel')
  protected onDocumentPointerEnd(): void {
    this.rowSelection.endDragGlobal();
  }

  protected readonly filteredUnifeederRows = computed(() => {
    const lib = this.unifeederLibrary();
    return lib.showDischarged
      ? [...lib.onboard]
      : lib.onboard.filter((r) => r.status === 'onboard');
  });

  private resolveUnifeederSortColumn(): import('../../utils/dg-unifeeder-inventory-sort.util').DgUnifeederSortColumn | null {
    const column = this.unifeederSortColumn();
    if (!column) return null;
    if (!this.unifeederLibrary().showByTerminals) return column;
    if (column === 'loadPort') return 'loadTerminal';
    if (column === 'dischargePort') return 'dischargeTerminal';
    return column;
  }

  protected readonly visibleUnifeederRows = computed(() => {
    let list = filterUnifeederOnboardRows(
      this.filteredUnifeederRows(),
      this.unifeederInventorySearch(),
    );
    const column = this.resolveUnifeederSortColumn();
    if (column) {
      list = sortUnifeederRows(list, column, this.unifeederSortDirection());
    }
    return list;
  });

  protected readonly visibleUnifeederContainerGroups = computed(
    (): DgUnifeederContainerDisplayGroup[] => {
      const baseRows = this.filteredUnifeederRows();
      let filtered = filterUnifeederOnboardRows(baseRows, this.unifeederInventorySearch());
      const editKey = this.inventoryEditContainerKey();
      if (editKey) {
        const have = new Set(filtered.map((r) => r.id));
        const pinned = baseRows.filter(
          (r) => unifeederContainerKey(r) === editKey && !have.has(r.id),
        );
        if (pinned.length) filtered = [...filtered, ...pinned];
      }
      const options = this.unifeederWeightOptions();
      let rawGroups = groupUnifeederRawRowsByContainer(filtered);
      const freeze = this.inventoryEditOrderFreeze();
      const column = this.resolveUnifeederSortColumn();
      if (freeze?.length) {
        const rank = new Map(freeze.map((key, i) => [key, i]));
        rawGroups = [...rawGroups].sort((a, b) => {
          const ai = rank.get(a.key);
          const bi = rank.get(b.key);
          if (ai == null && bi == null) return 0;
          if (ai == null) return 1;
          if (bi == null) return -1;
          return ai - bi;
        });
      } else if (column) {
        rawGroups = sortUnifeederContainerGroups(rawGroups, column, this.unifeederSortDirection());
      }
      const weightPlan = planUnifeederMergedWeightDisplays(filtered, options);

      return rawGroups.map((group) => {
        const first = group.rows[0];
        return {
          key: group.key,
          trackId: first?.id ?? group.key,
          size: pickUnifeederContainerHeaderField(group.rows, 'size') || (first?.size ?? ''),
          stow: pickUnifeederContainerHeaderField(group.rows, 'stow') || (first?.stow ?? ''),
          containerNo: first?.containerNo ?? '',
          loadPort:
            pickUnifeederContainerHeaderField(group.rows, 'loadPort') || (first?.loadPort ?? ''),
          dischargePort:
            pickUnifeederContainerHeaderField(group.rows, 'dischargePort') ||
            (first?.dischargePort ?? ''),
          loadTerminal: first?.loadTerminal ?? '',
          dischargeTerminal: first?.dischargeTerminal ?? '',
          status: first?.status ?? 'onboard',
          lines: buildUnifeederInventoryDisplayRows(group.rows, options, weightPlan),
        };
      });
    },
  );

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
    // Count discharged containers from full onboard (not hidden by showDischarged).
    const dischargedKeys = new Set<string>();
    for (const row of lib.onboard) {
      if (row.status !== 'discharged') continue;
      const key = row.containerNo.trim().toUpperCase() || row.id;
      dischargedKeys.add(key);
    }
    return {
      ...base,
      rowCount: this.visibleUnifeederDisplayRows().length,
      dischargedContainerCount: dischargedKeys.size,
    };
  });

  protected readonly unifeederManifestSummary = computed(() =>
    unifeederManifestSummary(
      mergeUnifeederRowsInContainers(
        this.visibleUnifeederRows(),
        this.unifeederLibrary().mergeLines,
      ),
      this.unifeederLibrary().useGrossWeight,
      this.unifeederLibrary().roundWeights,
    ),
  );

  protected readonly unifeederImportHistory = computed(() =>
    [...this.unifeederLibrary().manifests].sort((a, b) => b.addedAt.localeCompare(a.addedAt)),
  );

  protected readonly flashPointFormatSuggest = suggestUnifeederFlashPointFormat;
  protected readonly lqChoices: string[] = ['LQ'];
  protected readonly mpChoices: string[] = ['MP'];

  protected flashPointTone(value: string): 'negative' | 'positive' | 'neutral' {
    return dgFlashPointTone(value);
  }

  protected formatDate(value: string): string {
    return formatDisplayDate(value);
  }

  /** Enter leaves any inventory cell and commits via blur handlers. */
  @HostListener('keydown', ['$event'])
  protected onInventoryCellEnter(event: KeyboardEvent): void {
    if (event.key !== 'Enter') return;
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.readOnly || target.disabled) return;
    event.preventDefault();
    target.blur();
  }

  protected toggleUnifeederShowDischarged(checked: boolean): void {
    this.dg.updateUnifeederViewSettings({ showDischarged: checked });
  }

  protected toggleUnifeederShowByTerminals(checked: boolean): void {
    this.dg.updateUnifeederViewSettings({ showByTerminals: checked });
  }

  protected setUnifeederSizeColumnMode(mode: 'type' | 'size'): void {
    this.dg.updateUnifeederViewSettings({ sizeColumnMode: mode });
  }

  protected toggleUnifeederSizeColumnMode(): void {
    const next = this.unifeederLibrary().sizeColumnMode === 'size' ? 'type' : 'size';
    this.setUnifeederSizeColumnMode(next);
  }

  protected setUnifeederWeightTonnage(gross: boolean): void {
    this.dg.updateUnifeederViewSettings({ useGrossWeight: gross });
    void this.showUnifeederTonnageManifestCheck(gross);
  }

  protected toggleUnifeederRoundWeights(checked: boolean): void {
    this.dg.updateUnifeederViewSettings({ roundWeights: checked });
  }

  private async showUnifeederTonnageManifestCheck(gross: boolean): Promise<void> {
    const lib = this.unifeederLibrary();
    if (!lib.manifests.length) {
      this.toast.showError('No imported DP WORLD manifests — drop a PDF first.');
      return;
    }
    const hasPdfTotals = lib.manifests.some(
      (m) => (m.pdfImoGrossWeightKg ?? 0) > 0 || (m.pdfImoNetWeightKg ?? 0) > 0,
    );
    if (!hasPdfTotals) {
      // Common after copying a DG save to another PC: cargo rows are there, Grand Totals aren’t.
      const ok = await this.confirmDialog.confirm({
        title: 'PDF totals missing',
        message:
          'This save has no Grand Total weights from the source PDF, so GROSS/NET cannot be checked against the manifesto.\n\n' +
          'Locate the original DP WORLD PDF to restore those totals (inventory rows stay as they are).',
        confirmLabel: 'Locate PDF…',
        cancelLabel: 'Cancel',
      });
      if (ok) {
        const target = lib.manifests[0];
        if (target) await this.relinkUnifeederManifestPdf(target);
      }
      return;
    }
    const rows = lib.onboard.filter((r) => r.status === 'onboard');
    const check = validateUnifeederOnboardAgainstPdfSummaries(rows, lib.manifests, gross);
    const error = formatUnifeederImportValidationError(check);
    if (error) {
      this.toast.showError(error);
      return;
    }
    const okMsg = formatUnifeederImportValidationOk(check, gross, check.pdfKg, check.importedKg);
    if (okMsg) {
      this.toast.show(okMsg, 'success');
    }
  }

  protected toggleUnifeederMergeLines(checked: boolean): void {
    this.dg.updateUnifeederViewSettings({ mergeLines: checked });
  }

  protected toggleUnifeederInventorySort(column: DgUnifeederSortColumn): void {
    if (this.inventoryCopyMode()) return;
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
      doc.containerCount || new Set(rows.map((row) => row.containerNo.trim()).filter(Boolean)).size;

    const parts: string[] = [];
    if (doc.voyageNumber?.trim()) parts.push(`Voy ${doc.voyageNumber.trim()}`);
    if (containerCount > 0) parts.push(`${containerCount} containers`);
    parts.push(`${rowCount} lines`);
    return parts.join(' · ');
  }

  protected unifeederManifestFullyDischarged(manifestId: string): boolean {
    const rows = this.unifeederLibrary().onboard.filter(
      (row) => row.sourceManifestId === manifestId,
    );
    return rows.length > 0 && rows.every((row) => row.status === 'discharged');
  }

  protected onUnifeederRowChange(rowId: string, field: DgUnifeederRowField, value: string): void {
    const current = this.unifeederLibrary().onboard.find((r) => r.id === rowId);
    const prev = String(current?.[field] ?? '').trim();
    const nextVal = String(value ?? '').trim();
    const changed = prev !== nextVal;

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

    // Packing group / description choose the IMDG list variant — fill empty
    // EmS / class gaps only. Skip when blur re-commits the same value (e.g. opening
    // the MANIFEST vs DG Reference dialog steals focus and must not rewrite the row).
    if (changed && (field === 'packingGroup' || field === 'goodsDescription')) {
      this.rematchUnifeederRowFromReference(rowId, field === 'packingGroup');
    }
  }

  private rematchUnifeederRowFromReference(rowId: string, clearKeepOnPgChange: boolean): void {
    const current = this.unifeederLibrary().onboard.find((r) => r.id === rowId);
    if (!current || !unNumberHasDigits(current.unNo)) return;

    const resolved = resolveUnifeederUnAutofill(current.unNo, {
      packingGroup: current.packingGroup,
      description: current.goodsDescription,
      dgClass: current.dgClass,
    });
    if (resolved.kind === 'none' || resolved.kind === 'needs-packing-group') {
      if (clearKeepOnPgChange) {
        this.dg.updateUnifeederRow(rowId, { referenceKeepManifest: undefined });
      }
      return;
    }

    const next = resolved.patch;
    const keep = (manifest: string, ref: string | undefined): string => {
      const fromManifest = String(manifest ?? '').trim();
      if (fromManifest) return fromManifest;
      return String(ref ?? '').trim();
    };
    const dgClass = keep(current.dgClass, next.dgClass);
    const packingGroup = keep(current.packingGroup, next.packingGroup);
    const subRisk = keep(current.subRisk, next.subRisk);
    const fire = keep(current.fire, next.fire);
    const spillage = keep(current.spillage, next.spillage);
    const goodsDescription = preferManifestGoodsDescription(
      current.goodsDescription,
      next.goodsDescription,
    );

    this.dg.updateUnifeederRow(rowId, {
      dgClass,
      goodsDescription,
      packingGroup,
      subRisk,
      fire,
      spillage,
      fireSchedule: mfagFirePageRefFromEmsCode(fire) || current.fireSchedule,
      spillageSchedule: mfagSpillagePageRefFromEmsCode(spillage) || current.spillageSchedule,
      ...(clearKeepOnPgChange ? { referenceKeepManifest: undefined } : {}),
    });
  }

  protected unifeederNeedsPackingGroup(line: DgUnifeederRowDisplay): boolean {
    return unifeederNeedsPackingGroupChoice(line);
  }

  protected unifeederPackingGroupOptions(line: DgUnifeederRowDisplay): string[] {
    return unifeederPackingGroupChoices(line.unNo);
  }

  protected unifeederNeedsDescription(line: DgUnifeederRowDisplay): boolean {
    return unifeederNeedsDescriptionChoice(line);
  }

  protected unifeederDescriptionOptions(line: DgUnifeederRowDisplay): string[] {
    return unifeederDescriptionChoices(line.unNo, line.packingGroup);
  }

  protected unifeederAwaitPgTitle(line: DgUnifeederRowDisplay): string {
    if (!this.unifeederNeedsPackingGroup(line)) return '';
    const opts = this.unifeederPackingGroupOptions(line);
    return opts.length
      ? `Choose packing group from DG Reference: ${opts.join(' / ')}`
      : 'Choose packing group from DG Reference';
  }

  protected unifeederAwaitDescTitle(line: DgUnifeederRowDisplay): string {
    if (!this.unifeederNeedsDescription(line)) return '';
    return 'Choose proper shipping name — several DG Reference variants match this UN/PG';
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
    if (!this.requireInventoryEdit()) return;
    this.dg.addUnifeederRow();
  }

  protected addUnifeederCargoLine(group: DgUnifeederContainerDisplayGroup): void {
    if (!this.requireInventoryEdit()) return;
    this.dg.addUnifeederRow({
      size: group.size,
      stow: group.stow,
      containerNo: group.containerNo,
      loadPort: group.loadPort,
      dischargePort: group.dischargePort,
      loadTerminal: group.loadTerminal,
      dischargeTerminal: group.dischargeTerminal,
      status: group.status,
    });
  }

  protected addLineToSelectedUnifeederContainer(): void {
    if (!this.requireInventoryEdit()) return;
    const key = this.rowSelection.soleSelectedId();
    if (!key) return;
    const group = this.visibleUnifeederContainerGroups().find((g) => g.key === key);
    if (!group) return;
    this.addUnifeederCargoLine(group);
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

  /** POL/POD port pick — also clears terminal so docs stay on the chosen port. */
  protected onUnifeederPolPodPortChange(
    group: DgUnifeederContainerDisplayGroup,
    which: 'load' | 'discharge',
    portName: string,
  ): void {
    if (which === 'load') {
      this.onUnifeederContainerChange(group, 'loadPort', portName);
      this.onUnifeederContainerChange(group, 'loadTerminal', '');
    } else {
      this.onUnifeederContainerChange(group, 'dischargePort', portName);
      this.onUnifeederContainerChange(group, 'dischargeTerminal', '');
    }
  }

  protected removeUnifeederContainer(group: DgUnifeederContainerDisplayGroup): void {
    if (!this.requireInventoryEdit()) return;
    for (const rowId of this.unifeederContainerSourceRowIds(group)) {
      this.dg.removeUnifeederRow(rowId);
    }
  }

  protected markUnifeederContainerDischarged(group: DgUnifeederContainerDisplayGroup): void {
    if (!this.requireInventoryEdit()) return;
    for (const rowId of this.unifeederContainerSourceRowIds(group)) {
      this.dg.setUnifeederRowStatus(rowId, 'discharged');
    }
  }

  protected restoreUnifeederContainer(group: DgUnifeederContainerDisplayGroup): void {
    if (!this.requireInventoryEdit()) return;
    for (const rowId of this.unifeederContainerSourceRowIds(group)) {
      this.dg.setUnifeederRowStatus(rowId, 'onboard');
    }
  }

  protected dischargeSelectedUnifeederContainers(): void {
    if (!this.requireInventoryEdit()) return;
    const keys = new Set(this.rowSelection.selectedIds());
    if (keys.size === 0) return;
    for (const group of this.visibleUnifeederContainerGroups()) {
      if (!keys.has(group.key)) continue;
      for (const rowId of this.unifeederContainerSourceRowIds(group)) {
        this.dg.setUnifeederRowStatus(rowId, 'discharged');
      }
    }
  }

  protected removeSelectedUnifeederContainers(): void {
    if (!this.requireInventoryEdit()) return;
    const keys = new Set(this.rowSelection.selectedIds());
    if (keys.size === 0) return;
    for (const group of this.visibleUnifeederContainerGroups()) {
      if (!keys.has(group.key)) continue;
      for (const rowId of this.unifeederContainerSourceRowIds(group)) {
        this.dg.removeUnifeederRow(rowId);
      }
    }
    this.rowSelection.clear();
  }

  protected removeUnifeederRow(rowId: string): void {
    if (!this.requireInventoryEdit()) return;
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
    void this.unifeederPdf
      .openDgList(this.buildUnifeederExportContext())
      .then((ok) => {
        if (ok) {
          this.toast.show('DG list PDF opened', 'success');
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

  protected exportUnifeederExcel(): void {
    if (this.exportingExcel()) return;

    this.exportingExcel.set(true);
    void this.unifeederExcel
      .openDgList(this.buildUnifeederExportContext())
      .then((ok) => {
        if (ok) {
          this.toast.show('DG list Excel opened', 'success');
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

  protected removeUnifeederManifest(id: string, event: Event): void {
    event.stopPropagation();
    if (!this.requireInventoryEdit()) return;
    this.dg.removeUnifeederManifest(id);
  }

  /** Open the stored source PDF (or prompt to relocate if missing). */
  protected async openUnifeederManifestSourcePdf(doc: DgUnifeederManifestDocument): Promise<void> {
    const result = await this.sourcePdf.openOrRelink(doc.sourcePdfPath ?? '', {
      label: this.unifeederManifestDisplayName(doc),
    });
    if (!result) return;
    if (result.relocated) {
      await this.relinkUnifeederManifestPdf(doc, result.path);
    }
  }

  /**
   * Point a manifest at a PDF on this PC and refresh Grand Total weights for GROSS/NET checks.
   */
  private async relinkUnifeederManifestPdf(
    doc: DgUnifeederManifestDocument,
    knownPath?: string,
  ): Promise<void> {
    const electron = window.electronAPI;
    const path =
      knownPath?.trim() ||
      (await this.sourcePdf.pickPdfPath(doc.sourcePdfPath ?? undefined));
    if (!path) return;
    if (!electron?.readFileBase64) {
      this.dg.patchUnifeederManifestSourcePdf(doc.id, { sourcePdfPath: path });
      this.toast.show('Source PDF path updated', 'success');
      return;
    }
    try {
      const read = await electron.readFileBase64(path);
      if (!read.ok || !read.base64) {
        this.toast.showError(read.error || 'Could not read PDF');
        return;
      }
      const binary = atob(read.base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const parsed = await this.unifeederImporter.importFromPdfBytes(bytes, this.storage.ports(), {
        useGrossWeight: this.unifeederLibrary().useGrossWeight,
      });
      const pdfBytesFingerprint = await buildUnifeederPdfBytesHash(bytes);
      this.dg.patchUnifeederManifestSourcePdf(doc.id, {
        sourcePdfPath: path,
        pdfImoNetWeightKg: parsed.summary?.totalImoNetWeightKg ?? 0,
        pdfImoGrossWeightKg: parsed.summary?.totalImoGrossWeightKg ?? 0,
        pdfBytesFingerprint,
      });
      const net = parsed.summary?.totalImoNetWeightKg ?? 0;
      const gross = parsed.summary?.totalImoGrossWeightKg ?? 0;
      if (net > 0 || gross > 0) {
        this.toast.show(
          `PDF linked — Grand Total net ${Math.round(net)} / gross ${Math.round(gross)} kg`,
          'success',
        );
      } else {
        this.toast.show('PDF path saved (no Grand Total found in file)', 'info');
      }
    } catch (err) {
      this.dg.patchUnifeederManifestSourcePdf(doc.id, { sourcePdfPath: path });
      this.toast.showError(
        err instanceof Error ? err.message : 'Could not refresh PDF totals — path saved only',
      );
    }
  }

  protected pickUnifeederExcel(): void {
    if (!this.requireInventoryEdit()) return;
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
    if (this.inventoryCopyMode()) return;
    this.unifeederDragOver.set(true);
  }

  protected onUnifeederDragLeave(): void {
    this.unifeederDragOver.set(false);
  }

  protected onUnifeederDrop(event: DragEvent): void {
    event.preventDefault();
    this.unifeederDragOver.set(false);
    if (!this.requireInventoryEdit()) return;
    const file = event.dataTransfer?.files?.[0];
    if (file) void this.importUnifeederFile(file);
  }

  private async importUnifeederFile(file: File): Promise<void> {
    if (!this.requireInventoryEdit()) return;
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

      const dagosResult = await this.dagosImporter.importFromPdfBytes(bytes);
      if (dagosResult.format === 'unifeeder-dagos') {
        if (!dagosResult.positions.length) {
          this.toast.showError(
            dagosResult.warnings[0] ?? 'No container positions found in Dagos on Board PDF.',
          );
          return;
        }
        // Dagos Net W. is the onboard source of truth for net — switch display to NET.
        if (this.unifeederLibrary().useGrossWeight) {
          this.dg.updateUnifeederViewSettings({ useGrossWeight: false });
        }
        const applied = this.dg.applyUnifeederDagosPositions(dagosResult.positions);
        if (applied.checked === 0 && applied.discharged === 0) {
          this.toast.showError('No matching onboard containers found for Dagos positions');
        } else if (applied.checked > 0) {
          this.toast.show(
            [
              `Checked ${applied.checked}`,
              `corrected ${applied.replaced}`,
              `left as-is ${applied.unchanged}`,
            ].join(' · '),
            applied.replaced > 0 ? 'success' : 'info',
          );
        }
        if (applied.discharged > 0) {
          if (!this.unifeederLibrary().showDischarged) {
            this.dg.updateUnifeederViewSettings({ showDischarged: true });
          }
          this.rowSelection.selectIds(applied.dischargedContainers);
          this.toast.show(
            `${applied.discharged} container(s) in manifesto but not in Dagos — marked not onboard (not loaded yet, or already left)`,
            'warning',
          );
        } else {
          this.rowSelection.clear();
        }
        if (applied.unmatched.length) {
          this.toast.show(
            `${applied.unmatched.length} container(s) in Dagos not found onboard`,
            'info',
          );
        }
        await this.reconcileUnifeederDagosNetWeights(dagosResult.lines);
        return;
      }

      const result = await this.unifeederImporter.importFromPdfBytes(bytes, this.storage.ports(), {
        useGrossWeight: this.unifeederLibrary().useGrossWeight,
      });
      if (result.format === 'unknown' || !result.rows.length) {
        this.toast.showError(result.warnings[0] ?? 'Could not extract data from PDF');
        return;
      }
      if (!result.rows.some((row) => row.containerNo.trim())) {
        this.toast.showError(
          'No containers found in PDF (missing container numbers in cargo rows).',
        );
        return;
      }

      const [contentFingerprint, pdfBytesFingerprint] = await Promise.all([
        buildUnifeederContentHash(result),
        buildUnifeederPdfBytesHash(bytes),
      ]);
      const sourcePdfPath = electronLocalFilePath(file);
      const duplicate = this.dg.applyUnifeederImport(
        result,
        file.name,
        {
          contentFingerprint,
          pdfBytesFingerprint,
        },
        sourcePdfPath,
      );
      if (duplicate) {
        this.toast.showError(
          `This manifest was already imported (${duplicate.sourceName || 'existing entry'})`,
        );
        return;
      }

      const containers = new Set(result.rows.map((r) => r.containerNo).filter(Boolean)).size;
      const rows = this.storage
        .dgLibrary()
        .unifeeder.onboard.filter((r) => r.status === 'onboard').length;
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

  protected dagosNetMismatchFor(row: DgUnifeederRowDisplay): UnifeederDagosNetMismatch | null {
    const map = this.dagosNetMismatches();
    for (const id of row.sourceRowIds) {
      const hit = map.get(id);
      if (hit) return hit;
    }
    return null;
  }

  protected async onDagosNetMismatchClick(
    event: MouseEvent,
    row: DgUnifeederRowDisplay,
  ): Promise<void> {
    const mismatch = this.dagosNetMismatchFor(row);
    if (!mismatch) return;
    event.preventDefault();
    event.stopPropagation();
    await this.promptDagosNetMismatch(mismatch);
  }

  private async reconcileUnifeederDagosNetWeights(
    lines: Parameters<typeof findUnifeederDagosNetMismatches>[1],
  ): Promise<void> {
    const mismatches = findUnifeederDagosNetMismatches(this.unifeederLibrary().onboard, lines);
    if (!mismatches.length) {
      this.dagosNetMismatches.set(new Map());
      return;
    }
    const map = new Map(mismatches.map((m) => [m.rowId, m]));
    this.dagosNetMismatches.set(map);

    const result = await this.confirmDialog.confirm({
      title: 'Net weight differs from Dagos',
      message:
        `${mismatches.length} line(s) have a different Net W. than Dagos on Board.\n\n` +
        `Display switched to NET. Highlighted weight cells can be fixed one-by-one, or apply all now.`,
      comparison: {
        leftLabel: 'PROGRAM (example)',
        leftValue: `${mismatches[0].containerNo} UN${mismatches[0].unNo || '—'} · ${mismatches[0].programNetKg}`,
        rightLabel: 'DAGOS',
        rightValue: mismatches[0].dagosNetKg,
      },
      cancelLabel: 'Keep all PROGRAM',
      confirmLabel: 'Use all DAGOS',
      altLabel: 'Review one-by-one',
      dismissOnBackdrop: false,
      dismissOnEscape: false,
    });

    if (result === false) {
      this.dagosNetMismatches.set(new Map());
      this.toast.show(`Kept PROGRAM net on ${mismatches.length} line(s)`, 'success');
      return;
    }
    if (result === true) {
      this.applyDagosNetMismatches(mismatches);
      this.dagosNetMismatches.set(new Map());
      this.toast.show(`Updated ${mismatches.length} net weight(s) from Dagos`, 'success');
      return;
    }
    // Review one-by-one — leave highlights; first prompt opens immediately.
    if (result === 'alt' && mismatches[0]) {
      this.toast.show(`${mismatches.length} net weight(s) highlighted — click a cell to choose`, 'info');
      await this.promptDagosNetMismatch(mismatches[0]);
    }
  }

  private async promptDagosNetMismatch(mismatch: UnifeederDagosNetMismatch): Promise<void> {
    const remaining = [...this.dagosNetMismatches().values()];
    const multi = remaining.length > 1;
    const result = await this.confirmDialog.confirm({
      title: 'Net weight — PROGRAM vs Dagos',
      message: multi
        ? `${remaining.length} differences left. Choose for this line or all remaining.`
        : 'Choose which net weight to keep.',
      comparison: {
        leftLabel: 'PROGRAM',
        leftValue: `${mismatch.containerNo} UN${mismatch.unNo || '—'} · ${mismatch.programNetKg}`,
        rightLabel: 'DAGOS',
        rightValue: mismatch.dagosNetKg,
      },
      cancelLabel: 'Keep PROGRAM',
      confirmLabel: 'Use DAGOS',
      alt2Label: multi ? `Keep all PROGRAM (${remaining.length})` : undefined,
      altLabel: multi ? `Use all DAGOS (${remaining.length})` : undefined,
      dismissOnBackdrop: false,
      dismissOnEscape: false,
    });

    if (result === false) {
      this.clearDagosNetMismatch(mismatch.rowId);
      this.toast.show('Kept PROGRAM net', 'success');
      return;
    }
    if (result === 'alt2') {
      this.dagosNetMismatches.set(new Map());
      this.toast.show(`Kept PROGRAM net on ${remaining.length} line(s)`, 'success');
      return;
    }
    if (result === 'alt') {
      this.applyDagosNetMismatches(remaining);
      this.dagosNetMismatches.set(new Map());
      this.toast.show(`Updated ${remaining.length} net weight(s) from Dagos`, 'success');
      return;
    }
    if (result !== true) return;
    this.applyDagosNetMismatches([mismatch]);
    this.clearDagosNetMismatch(mismatch.rowId);
    this.toast.show('Updated net weight from Dagos', 'success');
  }

  private applyDagosNetMismatches(mismatches: readonly UnifeederDagosNetMismatch[]): void {
    const round = this.unifeederLibrary().roundWeights;
    this.dg.updateUnifeederRows(
      mismatches.map((m) => ({
        id: m.rowId,
        partial: commitDgDualWeightEdit(m.dagosNetKg, false, round),
      })),
    );
  }

  private clearDagosNetMismatch(rowId: string): void {
    const next = new Map(this.dagosNetMismatches());
    next.delete(rowId);
    this.dagosNetMismatches.set(next);
  }

  protected stripWeightParts(value: number): { whole: string; fraction: string } {
    const formatted = this.formatUnifeederWeight(value);
    const dot = formatted.indexOf('.');
    if (dot < 0) return { whole: formatted, fraction: '' };
    return { whole: formatted.slice(0, dot), fraction: formatted.slice(dot) };
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
    return (
      this.hoveredUnifeederContainerKey() === containerKey && this.hoveredUnifeederLineId() === null
    );
  }

  protected isUnifeederCargoLineHovered(containerKey: string, lineId: string): boolean {
    return (
      this.hoveredUnifeederContainerKey() === containerKey &&
      this.hoveredUnifeederLineId() === lineId
    );
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

    const primaryId = this.unifeederPrimaryRowId(row);
    const current = this.unifeederLibrary().onboard.find((r) => r.id === primaryId);
    if (!current) return;

    const unChanged = normalizeUnNumber(raw) !== normalizeUnNumber(current.unNo);
    // Fresh UN entry: do not reuse a stale packing group from another UN.
    const pgHint = unChanged ? '' : current.packingGroup;
    const descHint = unChanged ? '' : current.goodsDescription;
    const resolved = resolveUnifeederUnAutofill(raw, {
      packingGroup: pgHint,
      description: descHint,
      dgClass: unChanged ? '' : current.dgClass,
    });

    if (resolved.kind === 'none') {
      this.dg.updateUnifeederRow(primaryId, {
        unNo: normalizeUnNumber(raw),
        ...(unChanged ? { referenceKeepManifest: undefined } : {}),
      });
      return;
    }

    if (resolved.kind === 'needs-packing-group') {
      this.dg.updateUnifeederRow(primaryId, {
        unNo: resolved.unNo,
        packingGroup: '',
        goodsDescription: '',
        dgClass: '',
        subRisk: '',
        fire: '',
        spillage: '',
        fireSchedule: '',
        spillageSchedule: '',
        referenceKeepManifest: undefined,
      });
      return;
    }

    const next = resolved.patch;
    this.dg.updateUnifeederRow(primaryId, {
      unNo: next.unNo ?? normalizeUnNumber(raw),
      dgClass: next.dgClass ?? '',
      goodsDescription: next.goodsDescription ?? '',
      packingGroup: next.packingGroup ?? pgHint,
      subRisk: next.subRisk ?? '',
      fire: next.fire ?? '',
      spillage: next.spillage ?? '',
      fireSchedule: mfagFirePageRefFromEmsCode(next.fire ?? '') || '',
      spillageSchedule: mfagSpillagePageRefFromEmsCode(next.spillage ?? '') || '',
      ...(unChanged ? { referenceKeepManifest: undefined } : {}),
    });
  }

  protected hasUnifeederRefMismatch(
    row: DgUnifeederRowDisplay,
    field: UnifeederRefCompareField,
  ): boolean {
    return !!this.resolveUnifeederRefMismatch(row, field);
  }

  protected unifeederRefMismatchTitle(
    row: DgUnifeederRowDisplay,
    field: UnifeederRefCompareField,
  ): string {
    const mismatch = this.resolveUnifeederRefMismatch(row, field);
    if (!mismatch) return '';
    const label = unifeederRefCompareFieldLabel(field);
    return `${label}: MANIFEST “${mismatch.currentValue}” ≠ DG Reference “${mismatch.referenceValue}” — click to review`;
  }

  protected async onUnifeederRefMismatchClick(
    event: MouseEvent,
    row: DgUnifeederRowDisplay,
    field: UnifeederRefCompareField,
  ): Promise<void> {
    const mismatch = this.resolveUnifeederRefMismatch(row, field);
    if (!mismatch) return;

    event.preventDefault();
    event.stopPropagation();

    const identical = findIdenticalUnifeederReferenceMismatches(
      this.unifeederLibrary().onboard,
      mismatch,
    );
    const label = unifeederRefCompareFieldLabel(field);
    const multi = identical.length > 1;
    const result = await this.confirmDialog.confirm({
      title: `${label} differs from DG Reference`,
      message: multi
        ? `Same difference on ${identical.length} lines. Choose MANIFEST or DG Reference for this row or for all.`
        : 'Choose which value to keep for this field.',
      comparison: {
        leftLabel: 'MANIFEST',
        leftValue: mismatch.currentValue,
        rightLabel: 'DG REFERENCE',
        rightValue: mismatch.referenceValue,
      },
      cancelLabel: 'Keep MANIFEST',
      confirmLabel: 'Use DG Reference',
      alt2Label: multi ? `Fix all MANIFEST (${identical.length})` : undefined,
      altLabel: multi ? `Fix all Reference (${identical.length})` : undefined,
      // Must pick a button — backdrop/Escape must not silently rewrite the row.
      dismissOnBackdrop: false,
      dismissOnEscape: false,
    });

    if (result === false) {
      this.dismissUnifeederRefMismatch(row, mismatch);
      this.toast.show(`Kept MANIFEST ${label.toLowerCase()}`, 'success');
      return;
    }
    if (result === 'alt2') {
      this.dismissUnifeederRefMismatchRows(identical, mismatch);
      this.toast.show(
        `Kept MANIFEST ${label.toLowerCase()} on ${identical.length} lines`,
        'success',
      );
      return;
    }
    if (result === 'alt') {
      this.applyUnifeederRefMismatch(identical, mismatch);
      this.toast.show(
        `Updated ${identical.length} ${label.toLowerCase()} values from DG Reference`,
        'success',
      );
      return;
    }
    if (result !== true) return;
    this.applyUnifeederRefMismatch(
      this.sourceRowsForDisplay(row).filter((r) => !!getUnifeederReferenceMismatch(r, field)),
      mismatch,
    );
    this.toast.show(`Updated ${label.toLowerCase()} from DG Reference`, 'success');
  }

  private resolveUnifeederRefMismatch(
    row: DgUnifeederRowDisplay,
    field: UnifeederRefCompareField,
  ): UnifeederReferenceMismatch | null {
    for (const source of this.sourceRowsForDisplay(row)) {
      const mismatch = getUnifeederReferenceMismatch(source, field);
      if (mismatch) return mismatch;
    }
    return getUnifeederReferenceMismatch(row, field);
  }

  private sourceRowsForDisplay(row: DgUnifeederRowDisplay): DgUnifeederRow[] {
    const byId = new Map(this.unifeederLibrary().onboard.map((r) => [r.id, r]));
    return row.sourceRowIds.map((id) => byId.get(id)).filter((r): r is DgUnifeederRow => !!r);
  }

  private dismissUnifeederRefMismatch(
    row: DgUnifeederRowDisplay,
    mismatch: UnifeederReferenceMismatch,
  ): void {
    const targets = this.sourceRowsForDisplay(row).filter(
      (r) => !!getUnifeederReferenceMismatch(r, mismatch.field),
    );
    this.dismissUnifeederRefMismatchRows(targets, mismatch);
  }

  private dismissUnifeederRefMismatchRows(
    rows: readonly DgUnifeederRow[],
    mismatch: UnifeederReferenceMismatch,
  ): void {
    if (!rows.length) return;
    // Re-assert manifesto text (blur/rematch must not leave a reference value) and
    // remember the declined suggestion so the highlight stays off.
    this.dg.updateUnifeederRows(
      rows.map((r) => ({
        id: r.id,
        partial: {
          [mismatch.field]: mismatch.currentValue,
          referenceKeepManifest: {
            ...r.referenceKeepManifest,
            [mismatch.field]: mismatch.referenceValue,
          },
        },
      })),
    );
  }

  private applyUnifeederRefMismatch(
    rows: readonly DgUnifeederRow[],
    mismatch: UnifeederReferenceMismatch,
  ): void {
    if (!rows.length) return;
    const applied = applyUnifeederReferenceValue(mismatch.field, mismatch.referenceValue);
    this.dg.updateUnifeederRows(
      rows.map((r) => {
        const keep = { ...(r.referenceKeepManifest ?? {}) };
        delete keep[mismatch.field];
        const patch: Partial<Omit<DgUnifeederRow, 'id' | 'sourceManifestId'>> = {
          [mismatch.field]: applied,
          referenceKeepManifest: Object.keys(keep).length ? keep : undefined,
        };
        if (mismatch.field === 'fire') {
          const pageRef = mfagFirePageRefFromEmsCode(applied);
          if (pageRef) patch.fireSchedule = pageRef;
        }
        if (mismatch.field === 'spillage') {
          const pageRef = mfagSpillagePageRefFromEmsCode(applied);
          if (pageRef) patch.spillageSchedule = pageRef;
        }
        return { id: r.id, partial: patch };
      }),
    );
    // After adopting a reference PG / PSN, fill only empty EmS / class gaps.
    if (mismatch.field === 'packingGroup' || mismatch.field === 'goodsDescription') {
      for (const r of rows) {
        this.rematchUnifeederRowFromReference(r.id, false);
      }
    }
  }

  private buildUnifeederExportContext(): DgUnifeederExportContext {
    const lib = this.unifeederLibrary();
    const byId = new Map(this.filteredUnifeederRows().map((row) => [row.id, row]));
    const ordered: DgUnifeederRow[] = [];
    const seen = new Set<string>();
    for (const group of this.visibleUnifeederContainerGroups()) {
      for (const line of group.lines) {
        for (const id of line.sourceRowIds) {
          if (seen.has(id)) continue;
          const row = byId.get(id);
          if (!row) continue;
          seen.add(id);
          ordered.push(row);
        }
      }
    }
    return {
      rows: ordered.length ? ordered : this.visibleUnifeederRows(),
      mergeLines: lib.mergeLines,
      grossTotalKg: lib.roundWeights,
      useGrossWeight: lib.useGrossWeight,
      showByTerminals: lib.showByTerminals === true,
    };
  }
}
