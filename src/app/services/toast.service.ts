import { Injectable, signal } from '@angular/core';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info' | 'deleted';

export interface ToastMessage {
  id: number;
  text: string;
  type: ToastVariant;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly messages = signal<ToastMessage[]>([]);
  private nextId = 0;
  private savedTimer: ReturnType<typeof setTimeout> | null = null;

  readonly toasts = this.messages.asReadonly();

  show(text: string, type: ToastVariant = 'info'): void {
    const id = ++this.nextId;
    this.messages.update((list) => [...list, { id, text, type }]);
    setTimeout(() => this.dismiss(id), 3200);
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

  /** Debounced — one toast after rapid auto-save edits */
  debouncedSaved(delayMs = 600): void {
    if (this.savedTimer) clearTimeout(this.savedTimer);
    this.savedTimer = setTimeout(() => {
      this.showSaved();
      this.savedTimer = null;
    }, delayMs);
  }

  showPdfGenerated(): void {
    this.show('PDF generated', 'success');
  }

  showError(text: string): void {
    this.show(text, 'error');
  }

  dismiss(id: number): void {
    this.messages.update((list) => list.filter((t) => t.id !== id));
  }
}
