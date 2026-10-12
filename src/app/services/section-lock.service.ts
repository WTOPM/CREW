import { Injectable, computed, signal } from '@angular/core';
import type { SectionLockBanner } from '../../electron';
import { AppSection, APP_SECTION_LABELS } from '../utils/app-data-section.util';

export interface SectionLockRecord {
  section: AppSection;
  clientId: string;
  displayName: string;
  acquiredAt: number;
  heartbeatAt: number;
}

export type SectionNavLockState = 'free' | 'mine' | 'other';

/**
 * Tracks the active nav section for merge-on-save only.
 * Exclusive “who is editing” locks / heartbeats / peer polls are disabled —
 * they hammer a weak shared network folder. Users refresh manually before editing.
 */
@Injectable({ providedIn: 'root' })
export class SectionLockService {
  readonly activeSection = signal<AppSection | null>(null);
  readonly readOnly = signal(false);
  readonly heldBy = signal<SectionLockRecord | null>(null);
  readonly displacedBy = signal<SectionLockRecord | null>(null);
  readonly peerLocks = signal<Partial<Record<AppSection, SectionLockRecord>>>({});
  readonly lockLostTick = signal(0);

  /** Locks disabled — no network lock traffic. */
  readonly cooperativeMode = computed(() => false);

  readonly lockBanner = computed((): SectionLockBanner | null => null);

  async ensureClient(): Promise<void> {
    /* no-op */
  }

  /** Remember which section is open (for section merge on save). No lock I/O. */
  async onNavigate(section: AppSection | null): Promise<void> {
    this.activeSection.set(section);
    this.readOnly.set(false);
    this.heldBy.set(null);
    this.displacedBy.set(null);
  }

  async releaseCurrent(): Promise<void> {
    /* no-op */
  }

  async refreshPeerLocks(): Promise<void> {
    this.peerLocks.set({});
  }

  async takeOverControl(): Promise<boolean> {
    return false;
  }

  async refreshCurrentLockState(): Promise<void> {
    /* no-op */
  }

  navLockState(_section: AppSection): SectionNavLockState {
    return 'free';
  }

  navLockTooltip(section: AppSection): string {
    return APP_SECTION_LABELS[section];
  }

  navLockBadge(_section: AppSection): string | null {
    return null;
  }

  canPersist(): boolean {
    return true;
  }
}
