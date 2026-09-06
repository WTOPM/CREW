import { Component, computed, effect, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MFAG_FIRE_SCHEDULE_REFS, MFAG_SPILLAGE_SCHEDULE_REFS } from '../../data/dg-mfag-reference';
import { DgClassTooltipDirective } from '../../directives/dg-class-tooltip.directive';
import { DgUnReferenceImportModalComponent } from '../../components/dg-un-reference-import-modal/dg-un-reference-import-modal.component';
import {
  formatUnNumberMeta,
  getBundledUnNumberRows,
  getUnNumberClassCounts,
  getUnNumberClassLabels,
  groupUnNumbersByClass,
  searchUnNumberRows,
} from '../../utils/dg-un-number.util';
import { extractDgPdfTextItems } from '../../utils/dg-pdf-text.util';
import {
  collapseImdgRows,
  ImdgChapter32ParseError,
  IMDG_REFERENCE_MAX_FILE_BYTES,
  IMDG_REFERENCE_MAX_FILE_MB,
  parseImdgChapter32,
  type ImdgChapter32Entry,
} from '../../utils/dg-imdg-chapter32-pdf.util';
import {
  diffImdgReference,
  type DgUnReferenceImportReport,
} from '../../utils/dg-imdg-reference-diff.util';
import {
  DgUnReferenceStore,
  type DgUnReferenceApplyMode,
} from '../../services/dg-un-reference.store';
import { StorageService } from '../../services/storage.service';
import { ToastService } from '../../services/toast.service';

type RefSectionId = 'fire' | 'spillage' | 'un';
type SyncPhase = 'idle' | 'parsing' | 'error';

/** Text extraction dominates the run, so it owns most of the progress bar. */
const EXTRACT_PROGRESS_SHARE = 0.9;
const PROGRESS_REPAINT_EVERY = 5;

@Component({
  selector: 'app-dg-reference',
  imports: [RouterLink, FormsModule, DgClassTooltipDirective, DgUnReferenceImportModalComponent],
  templateUrl: './dg-reference.component.html',
  styleUrl: './dg-reference.component.css',
})
export class DgReferenceComponent {
  private readonly storage = inject(StorageService);
  private readonly unReference = inject(DgUnReferenceStore);
  private readonly toast = inject(ToastService);

  private readonly syncPdfInput = viewChild<ElementRef<HTMLInputElement>>('syncPdfInput');

  protected readonly fireSchedules = MFAG_FIRE_SCHEDULE_REFS;
  protected readonly spillageSchedules = MFAG_SPILLAGE_SCHEDULE_REFS;
  protected readonly formatMeta = formatUnNumberMeta;

  /** Reactive so the page refreshes the moment an imported IMDG list is applied. */
  private readonly allUnRows = computed(() => this.unReference.rows());
  protected readonly unNumberCount = computed(() => this.allUnRows().length);
  protected readonly unClassLabels = computed(() => getUnNumberClassLabels());
  protected readonly unClassCounts = computed(() => getUnNumberClassCounts(this.allUnRows()));

  protected readonly referenceLibrary = this.storage.dgUnReference;
  protected readonly bundledCount = getBundledUnNumberRows().length;

  protected readonly unSearch = signal('');
  protected readonly unClassFilter = signal<string | null>(null);
  protected readonly expandedSections = signal<ReadonlySet<RefSectionId>>(new Set());
  protected readonly expandedUnClasses = signal<ReadonlySet<string>>(new Set());

  protected readonly syncDragOver = signal(false);
  protected readonly syncPhase = signal<SyncPhase>('idle');
  protected readonly syncProgress = signal(0);
  protected readonly syncStage = signal('');
  protected readonly syncFiles = signal<readonly string[]>([]);
  protected readonly syncMessage = signal('');

  /** Parsed report awaiting the user's decision in the modal. */
  protected readonly importReport = signal<DgUnReferenceImportReport | null>(null);
  protected readonly confirmClear = signal(false);
  private pendingEntries: ReadonlyMap<string, ImdgChapter32Entry> | null = null;

  private syncRunId = 0;

  protected readonly filteredUnRows = computed(() =>
    searchUnNumberRows(this.allUnRows(), this.unSearch(), this.unClassFilter()),
  );

  protected readonly unGroups = computed(() => groupUnNumbersByClass(this.filteredUnRows()));

  protected readonly unResultCount = computed(() => this.filteredUnRows().length);

  constructor() {
    effect(() => {
      const query = this.unSearch().trim();
      const filter = this.unClassFilter();
      const groups = this.unGroups();
      if ((query || filter) && groups.length > 0) {
        this.expandedUnClasses.set(new Set(groups.map((group) => group.dgClass)));
        this.expandedSections.update((sections) => {
          if (sections.has('un')) return sections;
          const next = new Set(sections);
          next.add('un');
          return next;
        });
      }
    });
  }

  protected isSectionOpen(id: RefSectionId): boolean {
    return this.expandedSections().has(id);
  }

  protected toggleSection(id: RefSectionId): void {
    this.expandedSections.update((sections) => {
      const next = new Set(sections);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  protected isUnClassOpen(dgClass: string): boolean {
    return this.expandedUnClasses().has(dgClass);
  }

  protected toggleUnClass(dgClass: string): void {
    this.expandedUnClasses.update((classes) => {
      const next = new Set(classes);
      if (next.has(dgClass)) next.delete(dgClass);
      else next.add(dgClass);
      return next;
    });
  }

  protected expandAllUnClasses(): void {
    this.expandedUnClasses.set(new Set(this.unGroups().map((group) => group.dgClass)));
  }

  protected collapseAllUnClasses(): void {
    this.expandedUnClasses.set(new Set());
  }

  protected setUnClassFilter(dgClass: string | null): void {
    this.unClassFilter.set(dgClass);
  }

  protected clearUnFilters(): void {
    this.unSearch.set('');
    this.unClassFilter.set(null);
  }

  protected pickSyncPdf(): void {
    if (this.syncPhase() === 'parsing' || this.importReport()) return;
    this.syncPdfInput()?.nativeElement.click();
  }

  protected onSyncDragOver(event: DragEvent): void {
    event.preventDefault();
    if (this.syncPhase() === 'parsing' || this.importReport()) return;
    this.syncDragOver.set(true);
  }

  protected onSyncDragLeave(): void {
    this.syncDragOver.set(false);
  }

  protected onSyncDrop(event: DragEvent): void {
    event.preventDefault();
    this.syncDragOver.set(false);
    if (this.syncPhase() === 'parsing' || this.importReport()) return;
    const files = Array.from(event.dataTransfer?.files ?? []);
    void this.beginSyncFromFiles(files);
  }

  protected onSyncFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    void this.beginSyncFromFiles(files);
  }

  protected clearSyncStatus(): void {
    this.syncPhase.set('idle');
    this.syncProgress.set(0);
    this.syncStage.set('');
    this.syncFiles.set([]);
    this.syncMessage.set('');
  }

  private failSync(message: string, fileNames: readonly string[] = []): void {
    this.syncPhase.set('error');
    this.syncProgress.set(0);
    this.syncStage.set('');
    this.syncFiles.set(fileNames);
    this.syncMessage.set(message);
  }

  /** Abort an in-flight read without wiping a finished report the user is still reviewing. */
  private cancelInFlightSync(): void {
    this.syncRunId += 1;
  }

  /** Modal confirmed — fold the parsed list into the reference the chosen way. */
  protected onImportApply(mode: DgUnReferenceApplyMode): void {
    const report = this.importReport();
    const entries = this.pendingEntries;
    if (!report || !entries) return;
    this.unReference.applyImport(entries, mode, {
      fileName: report.fileName,
      amendment: report.amendment,
    });
    this.closeImportReport();
  }

  protected closeImportReport(): void {
    this.importReport.set(null);
    this.pendingEntries = null;
    this.clearSyncStatus();
  }

  protected onImportCancel(): void {
    this.cancelInFlightSync();
    this.closeImportReport();
    this.toast.showCancelled('UN reference left unchanged');
  }

  protected askClearReference(): void {
    this.confirmClear.set(true);
  }

  protected cancelClearReference(): void {
    this.confirmClear.set(false);
  }

  protected clearReference(): void {
    this.confirmClear.set(false);
    this.unReference.clearAllEntries();
  }

  protected restoreBundledReference(): void {
    this.confirmClear.set(false);
    this.unReference.restoreBundled();
  }

  /**
   * Read a dropped IMDG PDF and parse the Chapter 3.2 Dangerous Goods List.
   * Nothing is saved here — the diff is handed to the modal so the user decides.
   */
  private async beginSyncFromFiles(files: readonly File[]): Promise<void> {
    const pdfs = files.filter(
      (file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'),
    );
    if (!pdfs.length) {
      this.failSync('Drop a PDF file (the IMDG Code chapter 3.2 Dangerous Goods List).');
      return;
    }
    if (pdfs.length > 1) {
      this.failSync(
        'Drop one PDF at a time.',
        pdfs.map((file) => file.name),
      );
      return;
    }

    const file = pdfs[0];
    if (file.size > IMDG_REFERENCE_MAX_FILE_BYTES) {
      this.failSync(
        `“${file.name}” is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is ` +
          `${IMDG_REFERENCE_MAX_FILE_MB} MB. Drop only the chapter 3.2 extract, not the full Code.`,
        [file.name],
      );
      return;
    }

    const runId = ++this.syncRunId;
    this.syncPhase.set('parsing');
    this.syncProgress.set(0);
    this.syncStage.set('Reading pages');
    this.syncFiles.set([file.name]);
    this.syncMessage.set('');
    this.importReport.set(null);
    this.pendingEntries = null;

    try {
      let buffer: ArrayBuffer;
      try {
        buffer = await file.arrayBuffer();
      } catch (readError) {
        const detail = readError instanceof Error ? readError.message : 'file read failed';
        this.failSync(`Could not read “${file.name}” (${detail}). Try dropping the file again.`, [
          file.name,
        ]);
        return;
      }
      if (runId !== this.syncRunId) return;

      const bytes = new Uint8Array(buffer);
      const items = await extractDgPdfTextItems(bytes, async (page, total) => {
        if (runId !== this.syncRunId) return;
        this.syncProgress.set(Math.round((page / total) * 100 * EXTRACT_PROGRESS_SHARE));
        this.syncStage.set(`Reading page ${page} of ${total}`);
        // Let the progress bar repaint; a 170-page Code otherwise blocks the frame.
        if (page % PROGRESS_REPAINT_EVERY === 0) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      });
      if (runId !== this.syncRunId) return;

      this.syncStage.set('Matching Dangerous Goods List');
      const parsed = parseImdgChapter32(items);
      const entries = collapseImdgRows(parsed.rows);
      if (runId !== this.syncRunId) return;

      this.syncProgress.set(100);
      this.syncStage.set('');
      this.pendingEntries = entries;
      this.importReport.set({
        fileName: file.name,
        amendment: parsed.amendment,
        tablePages: parsed.tablePages.length,
        skippedLeadingPages: parsed.skippedLeadingPages,
        totalPages: parsed.totalPages,
        rowCount: parsed.rows.length,
        diff: diffImdgReference(entries, this.allUnRows()),
      });
      this.syncPhase.set('idle');
    } catch (error) {
      if (runId !== this.syncRunId) return;
      if (error instanceof ImdgChapter32ParseError) {
        this.failSync(error.message, [file.name]);
        return;
      }
      const detail = error instanceof Error ? error.message : 'unknown error';
      this.failSync(
        `Could not read this PDF (${detail}). Make sure it has a text layer, then try again.`,
        [file.name],
      );
    }
  }
}
