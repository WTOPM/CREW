import { Injectable, signal } from '@angular/core';

export interface ToastMessage {
  id: number;
  text: string;
  type: 'success' | 'error';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly messages = signal<ToastMessage[]>([]);
  private nextId = 0;
  private savedTimer: ReturnType<typeof setTimeout> | null = null;

  readonly toasts = this.messages.asReadonly();

  show(text: string, type: 'success' | 'error' = 'success'): void {
    const id = ++this.nextId;
    this.messages.update((list) => [...list, { id, text, type }]);
    setTimeout(() => this.dismiss(id), 3000);
  }

  showSaved(): void {
    this.show('Saved');
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
    this.show('PDF generated');
  }

  showError(text: string): void {
    this.show(text, 'error');
  }

  dismiss(id: number): void {
    this.messages.update((list) => list.filter((t) => t.id !== id));
  }
}
