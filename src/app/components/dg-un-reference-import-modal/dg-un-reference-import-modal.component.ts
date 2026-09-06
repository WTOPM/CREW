import { Component, computed, input, output, signal } from '@angular/core';
import {
  correctionCount,
  describeApplyOutcome,
  type DgUnReferenceImportReport,
} from '../../utils/dg-imdg-reference-diff.util';
import type { DgUnReferenceApplyMode } from '../../services/dg-un-reference.store';

interface ApplyOption {
  mode: DgUnReferenceApplyMode;
  title: string;
  hint: string;
  recommended: boolean;
}

interface ChangeRow {
  unNo: string;
  description: string;
  was: string;
  now: string;
}

interface ChangeGroup {
  key: string;
  title: string;
  total: number;
  rows: ChangeRow[];
}

/** A whole amendment can differ in hundreds of rows; show a readable slice per group. */
const CHANGE_LIST_CAP = 300;

@Component({
  selector: 'app-dg-un-reference-import-modal',
  templateUrl: './dg-un-reference-import-modal.component.html',
  styleUrl: './dg-un-reference-import-modal.component.css',
})
export class DgUnReferenceImportModalComponent {
  readonly report = input.required<DgUnReferenceImportReport>();

  readonly apply = output<DgUnReferenceApplyMode>();
  readonly cancel = output<void>();

  protected readonly mode = signal<DgUnReferenceApplyMode>('replace');
  protected readonly openGroup = signal<string | null>(null);

  protected readonly diff = computed(() => this.report().diff);
  protected readonly corrections = computed(() => correctionCount(this.diff()));
  protected readonly outcome = computed(() => describeApplyOutcome(this.diff(), this.mode()));

  protected readonly identical = computed(() => this.diff().unchanged);

  protected readonly options = computed<ApplyOption[]>(() => {
    const diff = this.diff();
    const replace = describeApplyOutcome(diff, 'replace');
    const merge = describeApplyOutcome(diff, 'merge');
    const addOnly = describeApplyOutcome(diff, 'addOnly');

    return [
      {
        mode: 'replace',
        title: 'Match the IMDG Code exactly',
        hint:
          `Adds ${replace.added}, corrects ${replace.corrected} and removes the ` +
          `${replace.removed} entries this edition no longer lists. ` +
          `Reference ends up with ${replace.resultTotal} UN numbers.`,
        recommended: true,
      },
      {
        mode: 'merge',
        title: 'Update, but keep the extra entries',
        hint:
          `Adds ${merge.added} and corrects ${merge.corrected}, but keeps the ` +
          `${merge.kept} entries missing from this PDF. ` +
          `Reference ends up with ${merge.resultTotal} UN numbers.`,
        recommended: false,
      },
      {
        mode: 'addOnly',
        title: 'Only add what is missing',
        hint:
          `Adds ${addOnly.added} new UN numbers and changes nothing that already exists. ` +
          `Reference ends up with ${addOnly.resultTotal} UN numbers.`,
        recommended: false,
      },
    ];
  });

  protected readonly changeGroups = computed<ChangeGroup[]>(() => {
    const diff = this.diff();
    const group = (key: string, title: string, rows: readonly ChangeRow[]): ChangeGroup => ({
      key,
      title,
      total: rows.length,
      rows: rows.slice(0, CHANGE_LIST_CAP),
    });

    return [
      group(
        'added',
        'New UN numbers in this PDF',
        diff.added.map((entry) => ({ ...entry, was: '—', now: 'new entry' })),
      ),
      group(
        'removed',
        'In the app but not in this PDF',
        diff.removed.map((entry) => ({ ...entry, was: 'kept in app', now: '—' })),
      ),
      group('fire', 'Fire schedule differs', diff.fireChanges),
      group('spillage', 'Spillage schedule differs', diff.spillageChanges),
      group('class', 'Class differs', diff.classChanges),
      group('pg', 'Packing group differs', diff.packingGroupChanges),
    ].filter((entry) => entry.total > 0);
  });

  protected pickMode(mode: DgUnReferenceApplyMode): void {
    this.mode.set(mode);
  }

  protected toggleGroup(key: string): void {
    this.openGroup.update((open) => (open === key ? null : key));
  }

  protected confirm(): void {
    this.apply.emit(this.mode());
  }
}
