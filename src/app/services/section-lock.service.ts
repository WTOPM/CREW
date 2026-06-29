import { Injectable, computed, signal } from '@angular/core';
import {
  APP_SECTION_LABELS,
  AppSection,
} from '../utils/app-data-section.util';

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
  readonly peerLocks = signal<Partial<Record<AppSection, SectionLockRecord>>>({});

  readonly cooperativeMode = computed(() => !!window.electronAPI?.acquireSectionLock);

  readonly bannerMessage = computed(() => {
    if (!this.readOnly() || !this.activeSection()) return null;
    const section = APP_SECTION_LABELS[this.activeSection()!];
    const who = this.heldBy()?.displayName || 'Another user';
    return `${who} is editing ${section}. View only — your changes here will not be saved.`;
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
      const stored = localStorage.getItem(CLIENT_ID_KEY);
      if (stored) {
        this.clientId = stored;
      } else {
        this.clientId =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `crew-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        localStorage.setItem(CLIENT_ID_KEY, this.clientId);
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
    if (section && this.cooperativeMode() && !this.readOnly()) {
      await window.electronAPI?.releaseSectionLock(section, this.clientId);
    }
    await this.refreshPeerLocks();
  }

  async refreshPeerLocks(): Promise<void> {
    if (!this.cooperativeMode()) {
      this.peerLocks.set({});
      return;
    }
    const locks = await window.electronAPI!.listSectionLocks();
    this.peerLocks.set(locks ?? {});
  }

  /** Re-read lock for the active section (e.g. after manual refresh — other user may have left). */
  async refreshCurrentLockState(): Promise<void> {
    const section = this.activeSection();
    if (!section || !this.cooperativeMode()) return;
    const api = window.electronAPI!;
    const lock = await api.readSectionLock(section);
    if (!lock || lock.clientId === this.clientId) {
      if (this.readOnly()) {
        const result = await api.acquireSectionLock(section, this.clientId, this.displayName);
        if (result.ok) {
          this.readOnly.set(false);
          this.heldBy.set(null);
          this.startHeartbeat(section);
        }
      }
      return;
    }
    this.readOnly.set(true);
    this.heldBy.set(lock);
    this.stopHeartbeat();
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

  /** Short badge on nav tab (null = no badge). */
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
    return !this.readOnly();
  }

  private startHeartbeat(section: AppSection): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      void window.electronAPI?.renewSectionLock(section, this.clientId);
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
