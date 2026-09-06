import { Injectable, inject } from '@angular/core';
import { AppStateStore } from './app-state.store';
import { SectionLockService } from './section-lock.service';
import { ToastService } from './toast.service';

/**
 * Shared-data “close everyone” for exe updates.
 * Writes/polls `data/force-quit.json`. Already-saved JSON stays on disk;
 * in-progress form edits that never hit persist may be lost (by design).
 */
@Injectable({ providedIn: 'root' })
export class NetworkForceQuitService {
  private static readonly POLL_MS = 3_000;
  /** Ignore signals created before this process started (safe restart after update). */
  private static readonly START_SKEW_MS = 5_000;

  private readonly state = inject(AppStateStore);
  private readonly sectionLock = inject(SectionLockService);
  private readonly toast = inject(ToastService);

  private readonly startedAt = Date.now();
  private handledId: string | null = null;
  private quitting = false;
  private timer: ReturnType<typeof setInterval> | null = null;

  startWatching(): void {
    if (!window.electronAPI?.readForceQuit || this.timer) return;
    void this.poll();
    this.timer = setInterval(() => void this.poll(), NetworkForceQuitService.POLL_MS);
  }

  stopWatching(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Called from Settings after confirm — signal all peers (and this PC). */
  async requestCloseAll(): Promise<boolean> {
    const api = window.electronAPI;
    if (!api?.requestForceQuitAll) return false;
    const signal = await api.requestForceQuitAll();
    this.toast.show('Closing CREW on all PCs…', 'warning');
    await this.handleSignal(signal.id, signal.by);
    return true;
  }

  private async poll(): Promise<void> {
    if (this.quitting) return;
    const api = window.electronAPI;
    if (!api?.readForceQuit) return;
    try {
      const signal = await api.readForceQuit();
      if (!signal) return;
      if (signal.id === this.handledId) return;
      if (signal.at < this.startedAt - NetworkForceQuitService.START_SKEW_MS) return;
      await this.handleSignal(signal.id, signal.by);
    } catch {
      /* network blip — retry next tick */
    }
  }

  private async handleSignal(id: string, by: string): Promise<void> {
    if (this.quitting || this.handledId === id) return;
    this.handledId = id;
    this.quitting = true;
    this.stopWatching();

    const who = by?.trim();
    this.toast.show(
      who ? `Closing for update (requested by ${who})…` : 'Closing for update…',
      'warning',
    );

    try {
      // Flush whatever this session is allowed to write (skip if view-only).
      // Does not wipe peers’ already-saved data — cooperative merge / lock guard.
      await this.state.persist('silent');
      await this.sectionLock.releaseCurrent();
    } catch {
      /* still quit */
    }

    try {
      await window.electronAPI?.quitApp();
    } catch {
      window.close();
    }
  }
}
