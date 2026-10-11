import {
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CdkConnectedOverlay, CdkOverlayOrigin, type ConnectedPosition } from '@angular/cdk/overlay';

/**
 * Free-text cell with optional reference choices / format suggestions.
 * - `options` + focus → list (or toggle when `toggleWhenSingle` and one option)
 * - `formatSuggest` → offer canonical text; Enter/Tab/click accepts, outside click cancels
 * Panel uses CDK overlay so it stays anchored inside scrollable tables.
 */
@Component({
  selector: 'app-ref-choice-suggest',
  imports: [FormsModule, CdkConnectedOverlay, CdkOverlayOrigin],
  templateUrl: './ref-choice-suggest.component.html',
  styleUrl: './ref-choice-suggest.component.css',
})
export class RefChoiceSuggestComponent {
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly value = input('');
  readonly options = input<string[]>([]);
  /** When set, panel shows this suggestion instead of `options` filtering. */
  readonly formatSuggest = input<((raw: string) => string | null) | null>(null);
  /**
   * How typed text filters `options`:
   * - includes (default) — substring match; empty hits fall back to full list
   * - prefix — starts-with; empty hits → empty list (panel closes)
   */
  readonly matchMode = input<'includes' | 'prefix'>('includes');
  /** One option only: click toggles value on/off (LQ / MP). */
  readonly toggleWhenSingle = input(false);
  readonly awaiting = input(false);
  readonly multiline = input(false);
  readonly inputClass = input('dg-cell-input dg-cell-input--mono');
  readonly title = input<string | null>(null);
  readonly readonly = input(false);
  /** Visual tone for the overlay list (host class alone won’t reach the CDK pane). */
  readonly listTone = input<'default' | 'fuel'>('default');
  readonly valueChange = output<string>();
  readonly commit = output<string>();

  private readonly filterInput = viewChild<ElementRef<HTMLInputElement | HTMLTextAreaElement>>(
    'filterInput',
  );
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  protected readonly open = signal(false);
  protected readonly draft = linkedSignal(() => this.value());
  /** Keyboard highlight in the open list. */
  protected readonly activeIndex = signal(0);
  protected readonly overlayWidth = signal(140);

  protected readonly overlayPositions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -4 },
  ];

  protected readonly filtered = computed(() => {
    const formatter = this.formatSuggest();
    if (formatter) {
      const suggestion = formatter(this.draft());
      return suggestion ? [suggestion] : [];
    }
    const opts = this.options();
    const q = this.draft().trim().toUpperCase();
    if (!q || q.includes('·OR·')) return opts;
    if (this.matchMode() === 'prefix') {
      return opts.filter((o) => o.toUpperCase().startsWith(q));
    }
    const hits = opts.filter((o) => o.toUpperCase().includes(q));
    return hits.length ? hits : opts;
  });

  protected readonly panelOpen = computed(() => this.open() && this.filtered().length > 0);

  private readonly isFormatMode = computed(() => !!this.formatSuggest());

  @HostListener('window:resize')
  protected onViewportChange(): void {
    if (this.panelOpen()) this.syncOverlayWidth();
  }

  protected onMouseDown(event: MouseEvent): void {
    if (this.readonly()) return;
    if (!this.toggleWhenSingle()) return;
    if (this.options().length !== 1) return;
    event.preventDefault();
    this.toggleSingleOption();
  }

  protected onFocus(): void {
    this.draft.set(this.value());
    if (this.readonly()) return;
    if (this.toggleWhenSingle() && this.options().length === 1) return;
    if (this.isFormatMode()) {
      if (this.filtered().length) this.openPanel();
      return;
    }
    if (!this.options().length) return;
    this.openPanel();
  }

  protected onBlur(): void {
    // Format suggestion is opt-in (Enter/Tab/click) — blur keeps typed draft.
    this.commit.emit(this.draft());
    this.closePanel();
  }

  protected onDraftChange(text: string): void {
    this.draft.set(text);
    this.valueChange.emit(text);
    this.activeIndex.set(0);
    if (this.isFormatMode()) {
      if (this.filtered().length) this.openPanel();
      else this.closePanel();
      return;
    }
    if (!this.options().length || !this.filtered().length) {
      this.closePanel();
      return;
    }
    this.openPanel();
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.closePanel();
      return;
    }

    if (
      this.toggleWhenSingle() &&
      this.options().length === 1 &&
      (event.key === 'Enter' || event.key === ' ')
    ) {
      event.preventDefault();
      this.toggleSingleOption();
      return;
    }

    const list = this.filtered();
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!list.length) return;
      event.preventDefault();
      if (!this.panelOpen()) {
        this.openPanel();
        this.activeIndex.set(0);
        return;
      }
      const n = list.length;
      const cur = this.activeIndex();
      const next = event.key === 'ArrowDown' ? (cur + 1 + n) % n : (cur - 1 + n) % n;
      this.activeIndex.set(next);
      queueMicrotask(() => this.scrollActiveIntoView());
      return;
    }

    if (!this.panelOpen() || !list.length) return;

    if (event.key === 'Enter') {
      event.preventDefault();
      const pick = list[this.activeIndex()] ?? list[0]!;
      this.acceptSuggestion(pick);
      return;
    }
    if (event.key === 'Tab') {
      const pick = list[this.activeIndex()] ?? list[0]!;
      this.acceptSuggestion(pick, { blur: false });
    }
  }

  private scrollActiveIntoView(): void {
    const panel = this.panel()?.nativeElement;
    if (!panel) return;
    const i = this.activeIndex();
    const el = panel.children[i] as HTMLElement | undefined;
    // Only scroll inside the list — never the page / table.
    if (!el) return;
    const parent = panel;
    const top = el.offsetTop;
    const bottom = top + el.offsetHeight;
    if (top < parent.scrollTop) parent.scrollTop = top;
    else if (bottom > parent.scrollTop + parent.clientHeight) {
      parent.scrollTop = bottom - parent.clientHeight;
    }
  }

  private toggleSingleOption(): void {
    const only = this.options()[0];
    if (!only) return;
    const cur = this.draft().trim().toUpperCase();
    const on = cur === only.toUpperCase() || cur === 'YES' || cur === 'Y';
    const next = on ? '' : only;
    this.draft.set(next);
    this.valueChange.emit(next);
    this.commit.emit(next);
    this.closePanel();
  }

  protected pick(option: string, event: Event): void {
    event.preventDefault();
    this.acceptSuggestion(option);
  }

  private acceptSuggestion(option: string, opts?: { blur?: boolean }): void {
    this.draft.set(option);
    this.valueChange.emit(option);
    this.commit.emit(option);
    this.closePanel();
    if (opts?.blur === false) return;
    queueMicrotask(() => this.filterInput()?.nativeElement.blur());
  }

  private openPanel(): void {
    this.syncOverlayWidth();
    this.open.set(true);
    this.activeIndex.set(0);
  }

  protected closePanel(): void {
    this.open.set(false);
  }

  protected onOverlayOutsideClick(): void {
    this.closePanel();
  }

  private syncOverlayWidth(): void {
    const el = this.filterInput()?.nativeElement ?? this.host.nativeElement;
    const w = el.getBoundingClientRect().width;
    this.overlayWidth.set(Math.max(w, this.multiline() ? 280 : 140));
  }
}
