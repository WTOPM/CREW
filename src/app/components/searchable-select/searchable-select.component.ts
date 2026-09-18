import {
  Component,
  computed,
  DestroyRef,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface SearchableSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface PanelPos {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

@Component({
  selector: 'app-searchable-select',
  imports: [FormsModule],
  templateUrl: './searchable-select.component.html',
  styleUrl: './searchable-select.component.css',
})
export class SearchableSelectComponent {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);

  readonly value = input('');
  readonly options = input<SearchableSelectOption[]>([]);
  readonly placeholder = input('— select —');
  readonly unset = input(false);
  readonly valueChange = output<string>();

  private readonly filterInput = viewChild<ElementRef<HTMLInputElement>>('filterInput');
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  protected readonly open = signal(false);
  protected readonly query = signal('');
  protected readonly panelPos = signal<PanelPos>({ top: 0, left: 0, width: 0, maxHeight: 256 });

  protected readonly displayLabel = computed(() => {
    const v = this.value().trim();
    if (!v) return '';
    return this.options().find((o) => o.value === v)?.label ?? v;
  });

  protected readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const opts = this.options();
    if (!q) return opts;
    return opts.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
    );
  });

  constructor() {
    const onScroll = (): void => {
      if (this.open()) this.repositionPanel();
    };
    document.addEventListener('scroll', onScroll, true);
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('scroll', onScroll, true);
      const el = this.panel()?.nativeElement;
      if (el?.isConnected && el.parentElement === document.body) {
        el.remove();
      }
    });
  }

  protected inputText(): string {
    return this.open() ? this.query() : this.displayLabel();
  }

  @HostListener('document:mousedown', ['$event'])
  protected onDocMouseDown(event: MouseEvent): void {
    if (!this.open()) return;
    const t = event.target as Node | null;
    if (t && this.host.nativeElement.contains(t)) return;
    if (t && this.panel()?.nativeElement.contains(t)) return;
    this.closePanel();
  }

  @HostListener('window:resize')
  protected onViewportChange(): void {
    if (this.open()) this.repositionPanel();
  }

  protected onFocus(): void {
    this.openPanel();
  }

  protected onDraftChange(text: string): void {
    if (!this.open()) {
      this.open.set(true);
      queueMicrotask(() => this.afterPanelOpen());
    }
    this.query.set(text);
    queueMicrotask(() => this.repositionPanel());
  }

  protected clearSelection(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.valueChange.emit('');
    this.query.set('');
    this.openPanel();
  }

  protected pick(opt: SearchableSelectOption, event: MouseEvent): void {
    event.preventDefault();
    if (opt.disabled) return;
    this.valueChange.emit(opt.value);
    this.query.set('');
    this.closePanel();
  }

  private openPanel(): void {
    this.open.set(true);
    this.query.set('');
    queueMicrotask(() => this.afterPanelOpen());
  }

  private afterPanelOpen(): void {
    this.attachPanelToBody();
    this.repositionPanel();
    this.filterInput()?.nativeElement?.focus();
  }

  private closePanel(): void {
    this.open.set(false);
    this.query.set('');
  }

  private attachPanelToBody(): void {
    const el = this.panel()?.nativeElement;
    if (!el) return;
    if (el.parentElement !== document.body) {
      document.body.appendChild(el);
    }
  }

  private repositionPanel(): void {
    const input = this.filterInput()?.nativeElement;
    if (!input) return;
    const rect = input.getBoundingClientRect();
    const gap = 4;
    const preferBelow = window.innerHeight - rect.bottom - gap;
    const preferAbove = rect.top - gap;
    const maxH = 256;
    const openUp = preferBelow < 140 && preferAbove > preferBelow;
    const available = openUp ? preferAbove : preferBelow;
    const maxHeight = Math.max(120, Math.min(maxH, available));
    const top = openUp ? Math.max(8, rect.top - gap - maxHeight) : rect.bottom + gap;
    this.panelPos.set({
      top,
      left: rect.left,
      width: rect.width,
      maxHeight,
    });
  }
}
