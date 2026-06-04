import { Injectable, signal } from '@angular/core';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info' | 'deleted';

export interface ToastMessage {
  id: number;
  text: string;
  type: ToastVariant;
}

/** Visible duration for every toast (+0.5 s vs previous 3.2 s). */
export const TOAST_VISIBLE_MS = 3700;

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly messages = signal<ToastMessage[]>([]);
  private nextId = 0;
  private savedTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly dismissTimers = new Map<number, ReturnType<typeof setTimeout>>();

  readonly toasts = this.messages.asReadonly();

  show(text: string, type: ToastVariant = 'info'): void {
    const id = ++this.nextId;
    this.messages.update((list) => [...list, { id, text, type }]);
    const timer = setTimeout(() => this.dismiss(id), TOAST_VISIBLE_MS);
    this.dismissTimers.set(id, timer);
  }

  showSaved(): void {
    this.show('Saved', 'success');
  }

  showArchived(): void {
    this.show('Archived', 'warning');
  }

  showRestored(): void {
    this.show('Restored', 'info');
  }

  showDeleted(): void {
    this.show('DELETED', 'deleted');
  }

  showPortAdded(): void {
    this.show('ADDED A NEW PORT', 'success');
  }

  showPortDeleted(): void {
    this.show('DELETED PORT', 'deleted');
  }

  showRankAdded(): void {
    this.show('ADDED RANK', 'success');
  }

  showRankDeleted(): void {
    this.show('DELETED RANK', 'deleted');
  }

  showNationalityAdded(): void {
    this.show('ADDED NATIONALITY', 'success');
  }

  showNationalityDeleted(): void {
    this.show('DELETED NATIONALITY', 'deleted');
  }

  /** Debounced — one toast after rapid auto-save edits (+0.5 s vs previous delay). */
  debouncedSaved(delayMs = 1100): void {
    if (this.savedTimer) clearTimeout(this.savedTimer);
    this.savedTimer = setTimeout(() => {
      this.showSaved();
      this.savedTimer = null;
    }, delayMs);
  }

  cancelDebouncedSaved(): void {
    if (this.savedTimer) {
      clearTimeout(this.savedTimer);
      this.savedTimer = null;
    }
  }

  showPdfGenerated(): void {
    this.show('PDF generated', 'success');
  }

  showError(text: string): void {
    this.show(text, 'error');
  }

  dismiss(id: number): void {
    const timer = this.dismissTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.dismissTimers.delete(id);
    }
    this.messages.update((list) => list.filter((t) => t.id !== id));
  }
}
