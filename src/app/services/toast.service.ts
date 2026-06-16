import { Injectable, signal } from '@angular/core';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info' | 'deleted';

export interface ToastMessage {
  id: number;
  text: string;
  type: ToastVariant;
  durationMs: number;
}

/** Visible duration for every toast (+1 s vs previous 3.7 s). */
export const TOAST_VISIBLE_MS = 4700;

interface ToastTimer {
  remainingMs: number;
  durationMs: number;
  paused: boolean;
  lastTickMs: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private static readonly TICK_MS = 50;

  private readonly messages = signal<ToastMessage[]>([]);
  private readonly progressTick = signal(0);
  private readonly timers = new Map<number, ToastTimer>();
  private nextId = 0;
  private savedTimer: ReturnType<typeof setTimeout> | null = null;
  private loopHandle: ReturnType<typeof setInterval> | null = null;

  readonly toasts = this.messages.asReadonly();

  show(text: string, type: ToastVariant = 'info', durationMs = TOAST_VISIBLE_MS): void {
    const id = ++this.nextId;
    const now = performance.now();
    this.messages.update((list) => [...list, { id, text, type, durationMs }]);
    this.timers.set(id, {
      remainingMs: durationMs,
      durationMs,
      paused: false,
      lastTickMs: now,
    });
    this.ensureTicker();
  }

  showSelected(label: string): void {
    this.show(`SELECTED: ${label}`, 'success');
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

  /** Debounced — one toast after rapid auto-save edits. */
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

  progressRatio(id: number): number {
    this.progressTick();
    const timer = this.timers.get(id);
    if (!timer) return 0;
    return Math.max(0, Math.min(1, timer.remainingMs / timer.durationMs));
  }

  pause(id: number): void {
    const timer = this.timers.get(id);
    if (!timer || timer.paused) return;
    const now = performance.now();
    timer.remainingMs = Math.max(0, timer.remainingMs - (now - timer.lastTickMs));
    timer.paused = true;
    timer.lastTickMs = now;
    this.progressTick.update((v) => v + 1);
  }

  resume(id: number): void {
    const timer = this.timers.get(id);
    if (!timer || !timer.paused) return;
    timer.paused = false;
    timer.lastTickMs = performance.now();
    this.ensureTicker();
    this.progressTick.update((v) => v + 1);
  }

  dismiss(id: number): void {
    this.timers.delete(id);
    this.messages.update((list) => list.filter((t) => t.id !== id));
    if (this.timers.size === 0) this.stopTicker();
    this.progressTick.update((v) => v + 1);
  }

  private ensureTicker(): void {
    if (this.loopHandle) return;
    this.loopHandle = setInterval(() => this.tick(), ToastService.TICK_MS);
  }

  private stopTicker(): void {
    if (!this.loopHandle) return;
    clearInterval(this.loopHandle);
    this.loopHandle = null;
  }

  private tick(): void {
    if (this.timers.size === 0) {
      this.stopTicker();
      return;
    }

    const now = performance.now();
    const expired: number[] = [];

    for (const [id, timer] of this.timers) {
      if (timer.paused) continue;
      const elapsed = now - timer.lastTickMs;
      timer.remainingMs -= elapsed;
      timer.lastTickMs = now;
      if (timer.remainingMs <= 0) expired.push(id);
    }

    for (const id of expired) this.dismiss(id);
    this.progressTick.update((v) => v + 1);
  }
}
