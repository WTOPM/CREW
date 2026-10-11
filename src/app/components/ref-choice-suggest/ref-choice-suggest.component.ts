import {
  Component,
  computed,
  DestroyRef,
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

interface PanelPos {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

/**
 * Free-text cell with optional reference choices / format suggestions.
 * - `options` + focus → list (or toggle when `toggleWhenSingle` and one option)
 * - `formatSuggest` → offer canonical text; Enter/Tab/click accepts, outside click cancels
 */
@Component({
  selector: 'app-ref-choice-suggest',
  imports: [FormsModule],
  templateUrl: './ref-choice-suggest.component.html',
  styleUrl: './ref-choice-suggest.component.css',
})
export class RefChoiceSuggestComponent {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);

  readonly value = input('');
  readonly options = input<string[]>([]);
  /** When set, panel shows this suggestion instead of `options` filtering. */
  readonly formatSuggest = input<((raw: string) => string | null) | null>(null);
  /** One option only: click toggles value on/off (LQ / MP). */
  readonly toggleWhenSingle = input(false);
  readonly awaiting = input(false);
  readonly multiline = input(false);
  readonly inputClass = input('dg-cell-input dg-cell-input--mono');
  readonly title = input<string | null>(null);
  readonly readonly = input(false);
  readonly valueChange = output<string>();
  readonly commit = output<string>();

  private readonly filterInput = viewChild<ElementRef<HTMLInputElement | HTMLTextAreaElement>>(
    'filterInput',
  );
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  /** Kept so we can detach from `document.body` after `@if` clears viewChild. */
  private panelEl: HTMLElement | null = null;

  protected readonly open = signal(false);
  protected readonly draft = linkedSignal(() => this.value());
  protected readonly panelPos = signal<PanelPos>({ top: 0, left: 0, width: 0, maxHeight: 220 });

  protected readonly filtered = computed(() => {
    const formatter = this.formatSuggest();
    if (formatter) {
      const suggestion = formatter(this.draft());
      return suggestion ? [suggestion] : [];
    }
    const opts = this.options();
    const q = this.draft().trim().toUpperCase();
    if (!q || q.includes('·OR·')) return opts;
    const hits = opts.filter((o) => o.toUpperCase().includes(q));
    return hits.length ? hits : opts;
  });

  private readonly isFormatMode = computed(() => !!this.formatSuggest());

  constructor() {
    const onScroll = (): void => {
      if (this.open()) this.repositionPanel();
    };
    document.addEventListener('scroll', onScroll, true);
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('scroll', onScroll, true);
      this.detachPanelFromBody();
    });
  }

  @HostListener('document:mousedown', ['$event'])
  protected onDocMouseDown(event: MouseEvent): void {
    if (!this.open()) return;
    const t = event.target as Node | null;
    if (t && this.host.nativeElement.contains(t)) return;
    if (t && this.panel()?.nativeElement.contains(t)) return;
    // Outside click: dismiss suggestion without applying (format mode keeps typed draft).
    this.closePanel();
  }

  @HostListener('window:resize')
  protected onViewportChange(): void {
    if (this.open()) this.repositionPanel();
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
    if (this.isFormatMode()) {
      if (this.filtered().length) {
        if (!this.open()) this.openPanel();
        else this.repositionPanel();
      } else {
        this.closePanel();
      }
      return;
    }
    if (!this.options().length) {
      this.closePanel();
      return;
    }
    if (!this.open()) this.openPanel();
    else this.repositionPanel();
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

    if (!this.open() || !this.filtered().length) return;

    if (event.key === 'Enter') {
      event.preventDefault();
      this.acceptSuggestion(this.filtered()[0]!);
      return;
    }
    if (event.key === 'Tab') {
      // Apply suggestion, then let focus move to the next control.
      this.acceptSuggestion(this.filtered()[0]!, { blur: false });
    }
  }

  private toggleSingleOption(): void {
    const only = this.options()[0];
    if (!only) return;
    const cur = this.draft().trim().toUpperCase();
    const on =
      cur === only.toUpperCase() || cur === 'YES' || cur === 'Y';
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
    this.open.set(true);
    queueMicrotask(() => {
      this.attachPanelToBody();
      this.repositionPanel();
      // Second pass uses measured panel height (avoids “flies up” with min maxHeight).
      requestAnimationFrame(() => this.repositionPanel());
    });
  }

  private closePanel(): void {
    this.detachPanelFromBody();
    this.open.set(false);
  }

  private attachPanelToBody(): void {
    const el = this.panel()?.nativeElement;
    if (!el) return;
    this.panelEl = el;
    if (el.parentElement !== document.body) {
      document.body.appendChild(el);
    }
  }

  private detachPanelFromBody(): void {
    const el = this.panel()?.nativeElement ?? this.panelEl;
    if (el?.isConnected && el.parentElement === document.body) {
      el.remove();
    }
    this.panelEl = null;
  }

  private estimatedPanelHeight(): number {
    const measured = this.panelEl?.offsetHeight || this.panel()?.nativeElement?.offsetHeight || 0;
    if (measured > 0) return measured;
    // One compact option ≈ 36px + padding; keep small so bottom rows open below.
    return Math.min(240, Math.max(36, this.filtered().length * 36 + 8));
  }

  private repositionPanel(): void {
    const btn = this.filterInput()?.nativeElement;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const gap = 4;
    const preferBelow = window.innerHeight - rect.bottom - gap;
    const preferAbove = rect.top - gap;
    const maxH = 240;
    const contentH = this.estimatedPanelHeight();
    // Flip upward only when the real panel would not fit below.
    const openUp = preferBelow < contentH && preferAbove > preferBelow;
    const available = openUp ? preferAbove : preferBelow;
    const maxHeight = Math.min(maxH, Math.max(contentH, available));
    const placedH = Math.min(contentH, maxHeight);
    const top = openUp ? Math.max(8, rect.top - gap - placedH) : rect.bottom + gap;
    const width = Math.max(rect.width, this.multiline() ? 280 : 140);
    this.panelPos.set({ top, left: rect.left, width, maxHeight });
  }
}
