import {
  Directive,
  ElementRef,
  Input,
  OnDestroy,
  inject,
} from '@angular/core';
import { copyTextToClipboard } from '../utils/copy-text.util';
import { ToastService } from '../services/toast.service';

const SKIP_TD =
  '.uf-act, .uf-line-act, .col-act, .col-actions, .col-line-act, .dg-col-act, .dg-line-act';

const SKIP_TH = '.uf-act, .uf-line-act, .col-act, .col-actions, .col-line-act';

type CellPos = { r: number; c: number };

/**
 * Excel-like rectangular selection for DG Copy view.
 * Keeps a cell grid cache so drag-paint stays O(changed cells).
 */
@Directive({
  selector: '[appDgSheetSelect]',
  standalone: true,
  host: {
    tabindex: '-1',
  },
})
export class DgSheetSelectDirective implements OnDestroy {
  private readonly toast = inject(ToastService);
  private readonly root = inject(ElementRef<HTMLElement>).nativeElement;

  @Input({ alias: 'appDgSheetSelect' })
  set enabled(value: boolean) {
    this._enabled = !!value;
    if (!this._enabled) {
      this.clearPaint();
      this.clearIndexes();
      return;
    }
    // After Angular flattens rowspan rows.
    queueMicrotask(() => requestAnimationFrame(() => this.indexCells()));
  }
  get enabled(): boolean {
    return this._enabled;
  }
  private _enabled = false;

  private anchor: CellPos | null = null;
  private focus: CellPos | null = null;
  private dragging = false;
  /** Drag started on a column header → keep full-height column range. */
  private colDragging = false;
  private copyHandledAt = 0;

  /** row → col → td */
  private grid: HTMLElement[][] = [];
  private maxR = -1;
  private maxC = -1;
  private readonly posOf = new WeakMap<Element, CellPos>();
  private painted = new Set<HTMLElement>();

  constructor() {
    this.root.addEventListener('pointerdown', this.onPointerDown, true);
    document.addEventListener('pointermove', this.onPointerMove, true);
    document.addEventListener('pointerup', this.onPointerUp, true);
    document.addEventListener('keydown', this.onKeyDown, true);
    document.addEventListener('copy', this.onCopy, true);
    this.root.addEventListener('dblclick', this.onDblClick, true);
  }

  ngOnDestroy(): void {
    this.root.removeEventListener('pointerdown', this.onPointerDown, true);
    document.removeEventListener('pointermove', this.onPointerMove, true);
    document.removeEventListener('pointerup', this.onPointerUp, true);
    document.removeEventListener('keydown', this.onKeyDown, true);
    document.removeEventListener('copy', this.onCopy, true);
    this.root.removeEventListener('dblclick', this.onDblClick, true);
  }

  private readonly onPointerDown = (event: Event): void => {
    if (!this._enabled || !(event instanceof PointerEvent) || event.button !== 0) return;
    if (this.maxR < 0) this.indexCells();

    const thCol = this.headerColFromEvent(event);
    if (thCol != null) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (this.maxR < 0) return;
      this.dragging = true;
      this.colDragging = true;
      if (event.shiftKey && this.anchor) {
        this.anchor = { r: 0, c: this.anchor.c };
        this.focus = { r: this.maxR, c: thCol };
      } else {
        this.anchor = { r: 0, c: thCol };
        this.focus = { r: this.maxR, c: thCol };
      }
      this.claimKeyboardFocus();
      this.paint();
      return;
    }

    const cell = this.cellFromEvent(event);
    if (!cell) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.dragging = true;
    this.colDragging = false;
    if (event.shiftKey && this.anchor) {
      this.focus = cell;
    } else {
      this.anchor = cell;
      this.focus = cell;
    }
    this.claimKeyboardFocus();
    this.paint();
  };

  private readonly onPointerMove = (event: Event): void => {
    if (!this._enabled || !this.dragging || !this.anchor) return;
    if (!(event instanceof PointerEvent)) return;

    if (this.colDragging) {
      const col = this.colFromPoint(event.clientX, event.clientY);
      if (col == null || this.focus?.c === col) return;
      this.focus = { r: this.maxR, c: col };
      this.paint();
      return;
    }

    const cell = this.cellFromPoint(event.clientX, event.clientY);
    if (!cell) return;
    if (this.focus?.r === cell.r && this.focus?.c === cell.c) return;
    this.focus = cell;
    this.paint();
  };

  private readonly onPointerUp = (): void => {
    this.dragging = false;
    this.colDragging = false;
  };

  private readonly onDblClick = (event: Event): void => {
    if (!this._enabled) return;
    if (!this.cellFromEvent(event) && this.headerColFromEvent(event) == null) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.toast.show('Switch to Edit mode to change the inventory', 'info');
  };

  private readonly onCopy = (event: Event): void => {
    if (!(event instanceof ClipboardEvent)) return;
    if (!this.shouldHandleCopy()) return;
    if (this.outsideFieldOwnsTextSelection()) return;
    const text = this.selectionTsv();
    if (text == null) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    event.clipboardData?.setData('text/plain', text);
    this.toastCopied(text);
  };

  private readonly onKeyDown = (event: Event): void => {
    if (!(event instanceof KeyboardEvent)) return;
    if (!this.shouldHandleCopy()) return;
    if (!(event.ctrlKey || event.metaKey)) return;
    if (event.key.toLowerCase() !== 'c' && event.code !== 'KeyC') return;
    if (this.outsideFieldOwnsTextSelection()) return;
    this.claimKeyboardFocus();
    event.preventDefault();
    event.stopImmediatePropagation();
    void this.copySelection();
  };

  private claimKeyboardFocus(): void {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== this.root) active.blur();
    try {
      this.root.focus({ preventScroll: true });
    } catch {
      /* ignore */
    }
  }

  private shouldHandleCopy(): boolean {
    return this._enabled && !!this.anchor && !!this.focus;
  }

  private outsideFieldOwnsTextSelection(): boolean {
    const active = document.activeElement;
    if (
      !(active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) ||
      this.root.contains(active)
    ) {
      return false;
    }
    const start = active.selectionStart ?? 0;
    const end = active.selectionEnd ?? 0;
    return end > start;
  }

  private indexCells(): void {
    this.grid = [];
    this.maxR = -1;
    this.maxC = -1;
    const rows = this.root.querySelectorAll('tbody tr');
    rows.forEach((tr: Element, r: number) => {
      const row: HTMLElement[] = [];
      let c = 0;
      tr.querySelectorAll(':scope > td').forEach((td: Element) => {
        const cell = td as HTMLElement;
        if (cell.matches(SKIP_TD)) {
          cell.removeAttribute('data-sr');
          cell.removeAttribute('data-sc');
          cell.classList.remove('dg-sheet-cell');
          return;
        }
        cell.dataset['sr'] = String(r);
        cell.dataset['sc'] = String(c);
        cell.classList.add('dg-sheet-cell');
        const pos = { r, c };
        this.posOf.set(cell, pos);
        row[c] = cell;
        if (c > this.maxC) this.maxC = c;
        c += 1;
      });
      this.grid[r] = row;
      this.maxR = r;
    });

    const headRow = this.root.querySelector('thead tr');
    if (headRow) {
      let c = 0;
      headRow.querySelectorAll(':scope > th').forEach((th: Element) => {
        const cell = th as HTMLElement;
        if (cell.matches(SKIP_TH)) {
          delete cell.dataset['sc'];
          return;
        }
        cell.dataset['sc'] = String(c);
        c += 1;
      });
    }
  }

  private clearIndexes(): void {
    for (const el of this.root.querySelectorAll('.dg-sheet-cell, [data-sr], [data-sc]')) {
      const node = el as HTMLElement;
      delete node.dataset['sr'];
      delete node.dataset['sc'];
      node.classList.remove('dg-sheet-cell');
    }
    this.grid = [];
    this.maxR = -1;
    this.maxC = -1;
  }

  private headerColFromEvent(event: Event): number | null {
    const t = event.target;
    if (!(t instanceof Element)) return null;
    const th = t.closest('th[data-sc]') as HTMLElement | null;
    if (!th || !this.root.contains(th)) return null;
    const c = Number(th.dataset['sc']);
    return Number.isFinite(c) ? c : null;
  }

  private cellFromEvent(event: Event): CellPos | null {
    const t = event.target;
    if (!(t instanceof Element)) return null;
    return this.posFromTd(t.closest('td'));
  }

  private cellFromPoint(x: number, y: number): CellPos | null {
    const el = document.elementFromPoint(x, y);
    if (!(el instanceof Element) || !this.root.contains(el)) return null;
    return this.posFromTd(el.closest('td'));
  }

  private posFromTd(td: Element | null): CellPos | null {
    if (!td || !this.root.contains(td) || td.matches(SKIP_TD)) return null;
    let pos = this.posOf.get(td);
    if (!pos) {
      // DOM was re-rendered (filter/sort) — rebuild cache once.
      this.indexCells();
      pos = this.posOf.get(td);
    }
    return pos ?? null;
  }

  private colFromPoint(x: number, y: number): number | null {
    const el = document.elementFromPoint(x, y);
    if (!(el instanceof Element) || !this.root.contains(el)) return null;
    const th = el.closest('th[data-sc]') as HTMLElement | null;
    if (th) {
      const c = Number(th.dataset['sc']);
      return Number.isFinite(c) ? c : null;
    }
    // Dragged down into the body — still extend by column under cursor.
    return this.posFromTd(el.closest('td'))?.c ?? null;
  }

  private clearPaint(): void {
    this.anchor = null;
    this.focus = null;
    this.dragging = false;
    this.colDragging = false;
    for (const el of this.painted) el.classList.remove('dg-sheet-sel');
    this.painted.clear();
  }

  /** Only touch cells that entered/left the selection. */
  private paint(): void {
    const next = new Set<HTMLElement>();
    if (this.anchor && this.focus) {
      const r0 = Math.min(this.anchor.r, this.focus.r);
      const r1 = Math.max(this.anchor.r, this.focus.r);
      const c0 = Math.min(this.anchor.c, this.focus.c);
      const c1 = Math.max(this.anchor.c, this.focus.c);
      for (let r = r0; r <= r1; r++) {
        const row = this.grid[r];
        if (!row) continue;
        for (let c = c0; c <= c1; c++) {
          const td = row[c];
          if (td) next.add(td);
        }
      }
    }
    for (const el of this.painted) {
      if (!next.has(el)) el.classList.remove('dg-sheet-sel');
    }
    for (const el of next) {
      if (!this.painted.has(el)) el.classList.add('dg-sheet-sel');
    }
    this.painted = next;
  }

  private selectionBounds(): {
    r0: number;
    r1: number;
    c0: number;
    c1: number;
  } | null {
    if (!this.anchor || !this.focus) return null;
    return {
      r0: Math.min(this.anchor.r, this.focus.r),
      r1: Math.max(this.anchor.r, this.focus.r),
      c0: Math.min(this.anchor.c, this.focus.c),
      c1: Math.max(this.anchor.c, this.focus.c),
    };
  }

  private selectionTsv(): string | null {
    const b = this.selectionBounds();
    if (!b) return null;
    const lines: string[] = [];
    for (let r = b.r0; r <= b.r1; r++) {
      const cols: string[] = [];
      const row = this.grid[r];
      for (let c = b.c0; c <= b.c1; c++) {
        cols.push(cellPlainText(row?.[c] ?? null));
      }
      lines.push(cols.join('\t'));
    }
    return lines.join('\n');
  }

  private toastCopied(text: string): void {
    const now = Date.now();
    if (now - this.copyHandledAt < 400) return;
    this.copyHandledAt = now;
    const b = this.selectionBounds();
    if (!b) return;
    const rows = b.r1 - b.r0 + 1;
    const cols = b.c1 - b.c0 + 1;
    this.toast.show(
      text.length === 0
        ? `Copied empty ${rows}×${cols}`
        : `Copied ${rows}×${cols} to clipboard`,
      'success',
    );
  }

  private async copySelection(): Promise<void> {
    const text = this.selectionTsv();
    if (text == null) return;
    const ok = await copyTextToClipboard(text);
    if (ok) {
      this.toastCopied(text);
    } else if (Date.now() - this.copyHandledAt >= 400) {
      this.toast.showError('Could not copy');
    }
  }
}

function cellPlainText(td: Element | null): string {
  if (!td) return '';
  const input = td.querySelector('input, textarea, select') as
    | HTMLInputElement
    | HTMLTextAreaElement
    | HTMLSelectElement
    | null;
  if (input && 'value' in input) return String(input.value ?? '').trim();

  const portLabel = td.querySelector('.port-select__text');
  if (portLabel) return (portLabel.textContent ?? '').replace(/\s+/g, ' ').trim();

  const clone = td.cloneNode(true) as HTMLElement;
  for (const junk of clone.querySelectorAll(
    '[aria-hidden="true"], .port-select__chev, .cts__pretty, button, svg',
  )) {
    junk.remove();
  }
  return (clone.textContent ?? '').replace(/\s+/g, ' ').trim();
}
