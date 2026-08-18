import { Injectable, computed, signal } from '@angular/core';
import type { SectionLockBanner } from '../../electron';
import { APP_SECTION_LABELS, AppSection } from '../utils/app-data-section.util';
import { readLocalStorage, writeLocalStorage } from '../utils/browser-storage.util';

export interface SectionLockRecord {
  section: AppSection;
  clientId: string;
  displayName: string;
  acquiredAt: number;
  heartbeatAt: number;
}

export type SectionNavLockState = 'free' | 'mine' | 'other';

const CLIENT_ID_KEY = 'crew-workstation-id';
const HEARTBEAT_MS = 30_000;
const PEER_POLL_MS = 12_000;

@Injectable({ providedIn: 'root' })
export class SectionLockService {
  readonly activeSection = signal<AppSection | null>(null);
  readonly readOnly = signal(false);
  readonly heldBy = signal<SectionLockRecord | null>(null);
  /** Set when another user force-took the lock while we were editing. */
  readonly displacedBy = signal<SectionLockRecord | null>(null);
  readonly peerLocks = signal<Partial<Record<AppSection, SectionLockRecord>>>({});
  /** Increments when this workstation loses the active section lock. */
  readonly lockLostTick = signal(0);

  readonly cooperativeMode = computed(() => !!window.electronAPI?.acquireSectionLock);

  readonly lockBanner = computed((): SectionLockBanner | null => {
    const section = this.activeSection();
    if (!section || !this.cooperativeMode()) return null;
    const label = APP_SECTION_LABELS[section];
    if (this.displacedBy()) {
      const who = this.displacedBy()!.displayName || 'Another user';
      return {
        kind: 'displaced',
        message: `${who} took over ${label}. Your unsaved edits here were discarded.`,
      };
    }
    if (this.readOnly()) {
      const who = this.heldBy()?.displayName || 'Another user';
      return {
        kind: 'view-only',
        message: `${who} is editing ${label}. View only — changes here will not be saved.`,
      };
    }
    return null;
  });

  private clientId = '';
  private displayName = 'User';
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private peerPollTimer: ReturnType<typeof setInterval> | null = null;
  private initialized = false;

  async ensureClient(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    try {
      const stored = readLocalStorage(CLIENT_ID_KEY);
      if (stored) {
        this.clientId = stored;
      } else {
        this.clientId =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `crew-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        writeLocalStorage(CLIENT_ID_KEY, this.clientId);
      }
    } catch {
      this.clientId = `crew-${Date.now()}`;
    }
    const info = await window.electronAPI?.getClientInfo?.();
    if (info) {
      const user = info.userName?.trim();
      const host = info.hostName?.trim();
      this.displayName = user && host ? `${user}@${host}` : host || user || 'User';
    }
    window.addEventListener('beforeunload', () => {
      void this.releaseCurrent();
    });
    if (this.cooperativeMode()) {
      this.startPeerPoll();
    }
  }

  /** Enter a main section: try write lock, or view-only if held elsewhere. */
  async onNavigate(section: AppSection | null): Promise<void> {
    await this.ensureClient();
    await this.releaseCurrent();
    this.activeSection.set(section);
    this.displacedBy.set(null);
    if (!section || !this.cooperativeMode()) {
      this.readOnly.set(false);
      this.heldBy.set(null);
      await this.refreshPeerLocks();
      return;
    }
    const api = window.electronAPI!;
    const result = await api.acquireSectionLock(section, this.clientId, this.displayName);
    if (result.ok) {
      this.readOnly.set(false);
      this.heldBy.set(null);
      this.startHeartbeat(section);
    } else {
      this.readOnly.set(true);
      this.heldBy.set(result.heldBy ?? null);
    }
    await this.refreshPeerLocks();
  }

  async releaseCurrent(): Promise<void> {
    this.stopHeartbeat();
    const section = this.activeSection();
    if (section && this.cooperativeMode() && !this.readOnly() && !this.displacedBy()) {
      await window.electronAPI?.releaseSectionLock(section, this.clientId);
    }
    await this.refreshPeerLocks();
  }

  async refreshPeerLocks(): Promise<void> {
    if (!this.cooperativeMode()) {
      this.peerLocks.set({});
      return;
    }
    await this.verifyStillHoldingLock();
    const locks = await window.electronAPI!.listSectionLocks();
    this.peerLocks.set(locks ?? {});
  }

  /** Force-take the active section lock from another workstation. */
  async takeOverControl(): Promise<boolean> {
    const section = this.activeSection();
    if (!section || !this.cooperativeMode()) return false;
    await this.ensureClient();
    const api = window.electronAPI!;
    const result = await api.forceAcquireSectionLock(section, this.clientId, this.displayName);
    if (!result.ok) return false;
    this.readOnly.set(false);
    this.heldBy.set(null);
    this.displacedBy.set(null);
    this.startHeartbeat(section);
    await this.refreshPeerLocks();
    return true;
  }

  /** Re-read lock for the active section (e.g. after manual refresh — other user may have left). */
  async refreshCurrentLockState(): Promise<void> {
    const section = this.activeSection();
    if (!section || !this.cooperativeMode()) return;
    const api = window.electronAPI!;
    const lock = await api.readSectionLock(section);
    if (!lock || lock.clientId === this.clientId) {
      if (this.readOnly() || this.displacedBy()) {
        const result = await api.acquireSectionLock(section, this.clientId, this.displayName);
        if (result.ok) {
          this.readOnly.set(false);
          this.heldBy.set(null);
          this.displacedBy.set(null);
          this.startHeartbeat(section);
        }
      }
      return;
    }
    await this.handleLockLost(section, lock);
  }

  navLockState(section: AppSection): SectionNavLockState {
    const lock = this.peerLocks()[section];
    if (!lock) return 'free';
    if (lock.clientId === this.clientId) return 'mine';
    return 'other';
  }

  navLockTooltip(section: AppSection): string {
    const label = APP_SECTION_LABELS[section];
    const state = this.navLockState(section);
    if (state === 'mine') return `${label} — you are editing`;
    if (state === 'other') {
      const who = this.peerLocks()[section]?.displayName || 'Another user';
      return `${label} — ${who} is editing`;
    }
    return label;
  }

  navLockBadge(section: AppSection): string | null {
    const state = this.navLockState(section);
    if (state === 'free') return null;
    if (state === 'mine') return '●';
    const name = this.peerLocks()[section]?.displayName || '?';
    const user = name.split('@')[0]?.trim() || name;
    return user.slice(0, 3).toUpperCase();
  }

  canPersist(): boolean {
    if (!this.cooperativeMode()) return true;
    const section = this.activeSection();
    if (!section) return true;
    return !this.readOnly() && !this.displacedBy();
  }

  private async verifyStillHoldingLock(): Promise<void> {
    const section = this.activeSection();
    if (!section || this.readOnly() || this.displacedBy()) return;
    const lock = await window.electronAPI!.readSectionLock(section);
    if (lock && lock.clientId !== this.clientId) {
      await this.handleLockLost(section, lock);
    }
  }

  private async handleLockLost(section: AppSection, lock: SectionLockRecord): Promise<void> {
    this.stopHeartbeat();
    this.readOnly.set(true);
    this.heldBy.set(lock);
    this.displacedBy.set(lock);
    this.lockLostTick.update((n) => n + 1);
  }

  private startHeartbeat(section: AppSection): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      void window.electronAPI?.renewSectionLock(section, this.clientId).then((res) => {
        if (!res?.ok) {
          void window.electronAPI?.readSectionLock(section).then((lock) => {
            if (lock && lock.clientId !== this.clientId) {
              void this.handleLockLost(section, lock);
            }
          });
        }
      });
    }, HEARTBEAT_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer != null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private startPeerPoll(): void {
    this.stopPeerPoll();
    void this.refreshPeerLocks();
    this.peerPollTimer = setInterval(() => {
      void this.refreshPeerLocks();
    }, PEER_POLL_MS);
  }

  private stopPeerPoll(): void {
    if (this.peerPollTimer != null) {
      clearInterval(this.peerPollTimer);
      this.peerPollTimer = null;
    }
  }
}
