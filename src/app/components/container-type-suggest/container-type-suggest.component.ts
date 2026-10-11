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
import {
  type ContainerSizeColumnMode,
  resolveContainerColumnValue,
  splitContainerSizeLabel,
  suggestIsoContainerTypes,
  type IsoContainerTypeEntry,
} from '../../utils/iso-container-type.util';

interface PanelPos {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

/**
 * Free-text Size|Type cell with live suggestions.
 * `mode=type` shows codes (45RF); `mode=size` shows short labels (40′RFHC).
 */
@Component({
  selector: 'app-container-type-suggest',
  imports: [FormsModule],
  templateUrl: './container-type-suggest.component.html',
  styleUrl: './container-type-suggest.component.css',
})
export class ContainerTypeSuggestComponent {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);

  readonly value = input('');
  /** Column display mode — type codes fit the narrow Unifeeder column. */
  readonly mode = input<ContainerSizeColumnMode>('type');
  readonly placeholder = input('—');
  readonly inputClass = input('dg-cell-input dg-cell-input--mono');
  readonly valueChange = output<string>();

  private readonly filterInput = viewChild<ElementRef<HTMLInputElement>>('filterInput');
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  protected readonly open = signal(false);
  protected readonly focused = signal(false);
  protected readonly draft = linkedSignal(() =>
    resolveContainerColumnValue(this.value(), this.mode()),
  );
  protected readonly panelPos = signal<PanelPos>({ top: 0, left: 0, width: 0, maxHeight: 256 });

  protected readonly suggestions = computed(() =>
    suggestIsoContainerTypes(this.draft(), 14),
  );

  protected readonly sizeMode = computed(() => this.mode() === 'size');

  /** Colored `40′` + rest when size mode and not editing. */
  protected readonly prettySize = computed(() => {
    if (!this.sizeMode()) return null;
    const parts = splitContainerSizeLabel(this.draft());
    if (!parts.family || !parts.prefix) return null;
    return parts;
  });

  protected readonly showPretty = computed(
    () => this.sizeMode() && !this.focused() && !!this.prettySize(),
  );

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

  @HostListener('document:mousedown', ['$event'])
  protected onDocMouseDown(event: MouseEvent): void {
    if (!this.open()) return;
    const t = event.target as Node | null;
    if (t && this.host.nativeElement.contains(t)) return;
    if (t && this.panel()?.nativeElement.contains(t)) return;
    this.commitDraftAndClose();
  }

  @HostListener('window:resize')
  protected onViewportChange(): void {
    if (this.open()) this.repositionPanel();
  }

  protected sizeParts(label: string) {
    return splitContainerSizeLabel(label);
  }

  protected onFocus(): void {
    this.focused.set(true);
    this.draft.set(resolveContainerColumnValue(this.value(), this.mode()));
  }

  protected onDraftChange(text: string): void {
    this.draft.set(text);
    this.valueChange.emit(text);
    if (!this.suggestions().length) {
      this.closePanel();
      return;
    }
    if (!this.open()) this.openPanel();
    else queueMicrotask(() => this.repositionPanel());
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    event.stopPropagation();
    this.commitDraftAndClose();
    queueMicrotask(() => this.filterInput()?.nativeElement?.blur());
  }

  protected onBlur(): void {
    this.focused.set(false);
    this.commitDraftAndClose();
  }

  protected pick(entry: IsoContainerTypeEntry, event: MouseEvent): void {
    event.preventDefault();
    const next = this.mode() === 'size' ? entry.sizeLabel : entry.code;
    this.draft.set(next);
    this.valueChange.emit(next);
    this.closePanel();
    queueMicrotask(() => this.filterInput()?.nativeElement?.blur());
  }

  private commitDraftAndClose(): void {
    const next = resolveContainerColumnValue(this.draft(), this.mode());
    if (next !== this.draft()) {
      this.draft.set(next);
    }
    const shown = resolveContainerColumnValue(this.value(), this.mode());
    if (next !== shown || (next && next !== this.value())) {
      this.valueChange.emit(next);
    }
    this.closePanel();
  }

  private openPanel(): void {
    if (!this.suggestions().length) {
      this.open.set(false);
      return;
    }
    this.open.set(true);
    queueMicrotask(() => {
      this.attachPanelToBody();
      this.repositionPanel();
    });
  }

  private closePanel(): void {
    this.open.set(false);
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
    const maxH = 280;
    const openUp = preferBelow < 160 && preferAbove > preferBelow;
    const available = openUp ? preferAbove : preferBelow;
    const maxHeight = Math.max(120, Math.min(maxH, available));
    const top = openUp ? Math.max(8, rect.top - gap - maxHeight) : rect.bottom + gap;
    const width = Math.max(rect.width, 200);
    this.panelPos.set({
      top,
      left: rect.left,
      width,
      maxHeight,
    });
  }
}
