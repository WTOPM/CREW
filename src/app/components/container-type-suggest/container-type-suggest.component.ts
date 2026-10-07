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
  containerTypeSizeLabel,
  lookupIsoContainerType,
  suggestIsoContainerTypes,
} from '../../utils/iso-container-type.util';

interface PanelPos {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

/**
 * Free-text Size/Type cell with live suggestions (e.g. type `4` → 40′ codes).
 * Keeps arbitrary values — suggestions only help pick common codes.
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
  readonly placeholder = input('—');
  readonly inputClass = input('dg-cell-input dg-cell-input--mono');
  readonly valueChange = output<string>();

  private readonly filterInput = viewChild<ElementRef<HTMLInputElement>>('filterInput');
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  protected readonly open = signal(false);
  protected readonly draft = linkedSignal(() => this.value());
  protected readonly panelPos = signal<PanelPos>({ top: 0, left: 0, width: 0, maxHeight: 256 });

  protected readonly suggestions = computed(() =>
    suggestIsoContainerTypes(this.draft(), 14),
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
    this.closePanel();
  }

  @HostListener('window:resize')
  protected onViewportChange(): void {
    if (this.open()) this.repositionPanel();
  }

  protected sizeLabel(code: string): string {
    const entry = lookupIsoContainerType(code);
    return entry ? containerTypeSizeLabel(entry) : '';
  }

  protected onFocus(): void {
    // Sync draft only — do not open the list on focus alone (avoids a second
    // bubble fighting the hover tooltip right after a pick).
    this.draft.set(this.value());
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

  protected pick(code: string, event: MouseEvent): void {
    event.preventDefault();
    this.draft.set(code);
    this.valueChange.emit(code);
    this.closePanel();
    // Leave the field so the hover tip can show cleanly afterwards.
    queueMicrotask(() => this.filterInput()?.nativeElement?.blur());
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
    const width = Math.max(rect.width, 220);
    this.panelPos.set({
      top,
      left: rect.left,
      width,
      maxHeight,
    });
  }
}
