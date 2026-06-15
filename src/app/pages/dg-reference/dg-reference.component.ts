import { Component, computed, effect, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  MFAG_FIRE_SCHEDULE_REFS,
  MFAG_SPILLAGE_SCHEDULE_REFS,
} from '../../data/dg-mfag-reference';
import { DgClassTooltipDirective } from '../../directives/dg-class-tooltip.directive';
import {
  formatUnNumberMeta,
  getUnNumberClassLabels,
  getUnNumberClassCounts,
  getUnNumberReferenceRows,
  groupUnNumbersByClass,
  searchUnNumberRows,
  UN_NUMBER_REFERENCE_COUNT,
} from '../../utils/dg-un-number.util';

type RefSectionId = 'fire' | 'spillage' | 'un';

@Component({
  selector: 'app-dg-reference',
  imports: [RouterLink, FormsModule, DgClassTooltipDirective],
  templateUrl: './dg-reference.component.html',
  styleUrl: './dg-reference.component.css',
})
export class DgReferenceComponent {
  protected readonly fireSchedules = MFAG_FIRE_SCHEDULE_REFS;
  protected readonly spillageSchedules = MFAG_SPILLAGE_SCHEDULE_REFS;
  protected readonly unNumberCount = UN_NUMBER_REFERENCE_COUNT;
  protected readonly unClassLabels = getUnNumberClassLabels();
  protected readonly unClassCounts = getUnNumberClassCounts();
  protected readonly formatMeta = formatUnNumberMeta;

  protected readonly unSearch = signal('');
  protected readonly unClassFilter = signal<string | null>(null);
  protected readonly expandedSections = signal<ReadonlySet<RefSectionId>>(new Set());
  protected readonly expandedUnClasses = signal<ReadonlySet<string>>(new Set());

  private readonly allUnRows = getUnNumberReferenceRows();

  protected readonly filteredUnRows = computed(() =>
    searchUnNumberRows(this.allUnRows, this.unSearch(), this.unClassFilter()),
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
}
