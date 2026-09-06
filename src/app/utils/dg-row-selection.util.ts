import { computed, signal } from '@angular/core';

/**
 * Multi-select for DG inventory rows (CMA / DP WORLD).
 * Click / drag on row numbers: unselected cells are added, already-selected are removed.
 * No Ctrl required — each gesture paints add or remove based on the starting cell.
 */
export class DgRowSelection {
  private readonly selected = signal<ReadonlySet<string>>(new Set());
  private dragging = false;
  private anchorId: string | null = null;
  private paintMode: 'add' | 'remove' = 'add';
  /** Selection snapshot at gesture start — range paint is applied on top of this. */
  private snapshot: ReadonlySet<string> = new Set();
  private orderedIds: readonly string[] = [];

  readonly selectedIds = this.selected.asReadonly();
  readonly count = computed(() => this.selected().size);
  readonly hasSelection = computed(() => this.selected().size > 0);
  readonly exactlyOneSelected = computed(() => this.selected().size === 1);

  /** Sole selected id when exactly one is selected; otherwise null. */
  soleSelectedId(): string | null {
    if (this.selected().size !== 1) return null;
    return this.selected().values().next().value ?? null;
  }

  setOrderedIds(ids: readonly string[]): void {
    this.orderedIds = ids;
    const alive = new Set(ids);
    const next = new Set<string>();
    for (const id of this.selected()) {
      if (alive.has(id)) next.add(id);
    }
    if (next.size !== this.selected().size) this.selected.set(next);
  }

  isSelected(id: string): boolean {
    return this.selected().has(id);
  }

  allSelected(): boolean {
    const ids = this.orderedIds;
    return ids.length > 0 && ids.every((id) => this.selected().has(id));
  }

  clear(): void {
    if (this.selected().size === 0) return;
    this.selected.set(new Set());
  }

  /**
   * Header No / ✓ toggle:
   * - something selected → clear
   * - nothing selected → select all visible
   */
  toggleSelectAll(): void {
    if (this.selected().size > 0) {
      this.clear();
      return;
    }
    this.selected.set(new Set(this.orderedIds));
  }

  /**
   * Start paint on the row number (applies immediately).
   * Starting on an unselected cell → add mode; on a selected cell → remove mode.
   */
  onIndexPointerDown(id: string, event: PointerEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    this.dragging = true;
    this.anchorId = id;
    this.paintMode = this.selected().has(id) ? 'remove' : 'add';
    this.snapshot = new Set(this.selected());
    this.applyPaintRange(id, id);
  }

  /** While dragging, paint inclusive range from anchor to hovered id. */
  onIndexPointerEnter(id: string): void {
    if (!this.dragging || !this.anchorId) return;
    this.applyPaintRange(this.anchorId, id);
  }

  onIndexPointerUp(event: PointerEvent): void {
    if (event.button !== 0) return;
    this.endDragGlobal();
  }

  onIndexPointerCancel(_event: PointerEvent): void {
    this.endDragGlobal();
  }

  endDragGlobal(): void {
    this.dragging = false;
    this.anchorId = null;
  }

  private applyPaintRange(fromId: string, toId: string): void {
    const ids = this.orderedIds;
    const a = ids.indexOf(fromId);
    const b = ids.indexOf(toId);
    const next = new Set(this.snapshot);
    if (a < 0 || b < 0) {
      if (this.paintMode === 'add') next.add(toId);
      else next.delete(toId);
      this.selected.set(next);
      return;
    }
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    for (let i = lo; i <= hi; i++) {
      const id = ids[i];
      if (this.paintMode === 'add') next.add(id);
      else next.delete(id);
    }
    this.selected.set(next);
  }
}
