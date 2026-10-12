import { Injectable, signal } from '@angular/core';
import { AppSection } from '../utils/app-data-section.util';

/**
 * Tracks the active nav section for merge-on-save only.
 * Exclusive edit locks were removed (weak shared-folder load).
 */
@Injectable({ providedIn: 'root' })
export class SectionLockService {
  readonly activeSection = signal<AppSection | null>(null);

  /** Remember which section is open (for section merge on save). */
  async onNavigate(section: AppSection | null): Promise<void> {
    this.activeSection.set(section);
  }
}
