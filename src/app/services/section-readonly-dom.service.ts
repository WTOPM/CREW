import { effect, inject, Injectable } from '@angular/core';
import { SectionLockService } from './section-lock.service';

/**
 * When a section is view-only, hard-disable form controls in the main area.
 * Elements marked `.section-readonly-allow` (PDF/Excel export) stay usable.
 */
@Injectable({ providedIn: 'root' })
export class SectionReadonlyDomService {
  private readonly sectionLock = inject(SectionLockService);
  private observer: MutationObserver | null = null;
  private scheduled = false;

  constructor() {
    effect(() => {
      const readonly = this.sectionLock.readOnly() || !!this.sectionLock.displacedBy();
      this.scheduleSync(readonly);
    });
  }

  private scheduleSync(readonly: boolean): void {
    if (this.scheduled) return;
    this.scheduled = true;
    queueMicrotask(() => {
      this.scheduled = false;
      this.sync(readonly);
    });
  }

  private sync(readonly: boolean): void {
    const main = document.querySelector('.app-main');
    if (!main) return;
    if (readonly) {
      this.applyReadonly(main);
      if (!this.observer) {
        this.observer = new MutationObserver(() => this.applyReadonly(main));
        this.observer.observe(main, { childList: true, subtree: true, attributes: true });
      }
    } else {
      this.observer?.disconnect();
      this.observer = null;
      this.clearReadonly(main);
    }
  }

  private isAllowed(el: Element): boolean {
    return !!el.closest('.section-readonly-allow');
  }

  private applyReadonly(root: Element): void {
    root.querySelectorAll('input, textarea, select, [contenteditable]').forEach((el) => {
      if (this.isAllowed(el)) return;
      if (el.getAttribute('data-crew-ro') === '1') return;
      if (el instanceof HTMLInputElement) {
        if (el.type === 'checkbox' || el.type === 'radio') {
          el.dataset['crewPrevDisabled'] = String(el.disabled);
          el.disabled = true;
        } else {
          el.dataset['crewPrevReadonly'] = String(el.readOnly);
          el.readOnly = true;
        }
      } else if (el instanceof HTMLTextAreaElement) {
        el.dataset['crewPrevReadonly'] = String(el.readOnly);
        el.readOnly = true;
      } else if (el instanceof HTMLSelectElement) {
        el.dataset['crewPrevDisabled'] = String(el.disabled);
        el.disabled = true;
      } else if (el instanceof HTMLElement && el.isContentEditable) {
        el.dataset['crewPrevCe'] = 'true';
        el.contentEditable = 'false';
      }
      el.setAttribute('data-crew-ro', '1');
    });

    root.querySelectorAll('button').forEach((el) => {
      if (this.isAllowed(el)) return;
      if (el.getAttribute('data-crew-ro-btn') === '1') return;
      el.dataset['crewPrevDisabled'] = String(el.disabled);
      el.disabled = true;
      el.setAttribute('data-crew-ro-btn', '1');
    });

    root.querySelectorAll('a.btn, .btn:not(button)').forEach((el) => {
      if (this.isAllowed(el)) return;
      if (el.getAttribute('data-crew-ro-link') === '1') return;
      el.setAttribute('aria-disabled', 'true');
      el.setAttribute('tabindex', '-1');
      el.setAttribute('data-crew-ro-link', '1');
    });
  }

  private clearReadonly(root: Element): void {
    root.querySelectorAll('[data-crew-ro="1"]').forEach((el) => {
      if (el instanceof HTMLInputElement) {
        if (el.type === 'checkbox' || el.type === 'radio') {
          el.disabled = el.dataset['crewPrevDisabled'] === 'true';
        } else {
          el.readOnly = el.dataset['crewPrevReadonly'] === 'true';
        }
        delete el.dataset['crewPrevDisabled'];
        delete el.dataset['crewPrevReadonly'];
      } else if (el instanceof HTMLTextAreaElement) {
        el.readOnly = el.dataset['crewPrevReadonly'] === 'true';
        delete el.dataset['crewPrevReadonly'];
      } else if (el instanceof HTMLSelectElement) {
        el.disabled = el.dataset['crewPrevDisabled'] === 'true';
        delete el.dataset['crewPrevDisabled'];
      } else if (el instanceof HTMLElement && el.dataset['crewPrevCe'] === 'true') {
        el.contentEditable = 'true';
        delete el.dataset['crewPrevCe'];
      }
      el.removeAttribute('data-crew-ro');
    });

    root.querySelectorAll('[data-crew-ro-btn="1"]').forEach((el) => {
      if (el instanceof HTMLButtonElement) {
        el.disabled = el.dataset['crewPrevDisabled'] === 'true';
        delete el.dataset['crewPrevDisabled'];
      }
      el.removeAttribute('data-crew-ro-btn');
    });

    root.querySelectorAll('[data-crew-ro-link="1"]').forEach((el) => {
      el.removeAttribute('aria-disabled');
      el.removeAttribute('tabindex');
      el.removeAttribute('data-crew-ro-link');
    });
  }
}
