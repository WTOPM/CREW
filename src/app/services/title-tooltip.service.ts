import { Injectable } from '@angular/core';
import { showPlainTooltip } from '../utils/hint-tooltip.util';

const SHOW_DELAY_MS = 420;

@Injectable({ providedIn: 'root' })
export class TitleTooltipService {
  private installed = false;
  private activeEl: HTMLElement | null = null;
  private hideFn: (() => void) | null = null;
  private showTimer: ReturnType<typeof setTimeout> | null = null;

  install(): void {
    if (this.installed || typeof document === 'undefined') return;
    this.installed = true;

    document.addEventListener('pointerenter', this.onPointerEnter, true);
    document.addEventListener('pointerleave', this.onPointerLeave, true);
    document.addEventListener('focusin', this.onFocusIn, true);
    document.addEventListener('focusout', this.onFocusOut, true);
    window.addEventListener('scroll', this.hide, true);
    window.addEventListener('resize', this.hide, true);
  }

  private onPointerEnter = (event: PointerEvent): void => {
    if (event.pointerType === 'touch') return;
    const host = this.resolveHost(event.target);
    if (!host || host === this.activeEl) return;
    this.scheduleShow(host);
  };

  private onPointerLeave = (event: PointerEvent): void => {
    const host = this.activeEl;
    if (!host) return;
    const related = event.relatedTarget as Node | null;
    if (related && host.contains(related)) return;
    this.hide();
  };

  private onFocusIn = (event: FocusEvent): void => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const host = this.resolveHost(target);
    if (!host) return;
    this.scheduleShow(host);
  };

  private onFocusOut = (): void => {
    this.hide();
  };

  private scheduleShow(host: HTMLElement): void {
    this.hide();
    this.activeEl = host;
    const text = this.readTip(host);
    if (!text) {
      this.activeEl = null;
      return;
    }

    this.showTimer = setTimeout(() => {
      const tip = showPlainTooltip(host, text);
      this.hideFn = tip.hide;
    }, SHOW_DELAY_MS);
  }

  private hide = (): void => {
    if (this.showTimer) {
      clearTimeout(this.showTimer);
      this.showTimer = null;
    }
    this.hideFn?.();
    this.hideFn = null;
    this.activeEl = null;
  };

  private resolveHost(target: EventTarget | null): HTMLElement | null {
    let el = target as HTMLElement | null;
    const portZone = el?.closest('.pkg-bar-port');

    while (el && el !== document.body) {
      if (el.classList.contains('dg-hint-tooltip-host') || el.classList.contains('dg-hint-tooltip')) {
        return null;
      }
      if (el.matches('input, textarea, select')) {
        el = el.parentElement;
        continue;
      }
      if (portZone && !portZone.contains(el)) {
        break;
      }
      const tip = el.getAttribute('title')?.trim() || el.dataset['appTip']?.trim();
      if (tip) return el;
      el = el.parentElement;
    }
    return null;
  }

  private readTip(el: HTMLElement): string {
    const fromTitle = el.getAttribute('title')?.trim();
    if (fromTitle) {
      el.dataset['appTip'] = fromTitle;
      el.removeAttribute('title');
      if (!el.hasAttribute('aria-label')) {
        el.setAttribute('aria-label', fromTitle);
      }
    }
    return el.dataset['appTip']?.trim() ?? '';
  }
}
