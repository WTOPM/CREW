import { Directive, ElementRef, HostListener, Input, OnDestroy } from '@angular/core';
import { showPlainTooltip } from '../utils/hint-tooltip.util';

const SHOW_DELAY_MS = 450;

/** Hover-only plain tip — never opens on keyboard focus / Tab. */
@Directive({
  selector: '[appPlainTooltip]',
  standalone: true,
  host: {
    class: 'dg-hint-tooltip-host',
  },
})
export class PlainTooltipDirective implements OnDestroy {
  @Input({ alias: 'appPlainTooltip' }) text = '';
  /** Optional CAPS title shown above the body (action-button tips). */
  @Input() appPlainTooltipTitle = '';

  private showTimer: ReturnType<typeof setTimeout> | null = null;
  private tooltipHide: (() => void) | null = null;

  constructor(private readonly el: ElementRef<HTMLElement>) {}

  @HostListener('mouseenter')
  onMouseEnter(): void {
    this.clearShowTimer();
    const text = this.text.trim();
    if (!text) return;

    this.showTimer = setTimeout(() => {
      this.hide();
      const tip = showPlainTooltip(
        this.el.nativeElement,
        text,
        this.appPlainTooltipTitle.trim() || undefined,
      );
      this.tooltipHide = tip.hide;
    }, SHOW_DELAY_MS);
  }

  @HostListener('mouseleave')
  onMouseLeave(): void {
    this.clearShowTimer();
    this.hide();
  }

  ngOnDestroy(): void {
    this.clearShowTimer();
    this.hide();
  }

  private hide(): void {
    this.tooltipHide?.();
    this.tooltipHide = null;
  }

  private clearShowTimer(): void {
    if (this.showTimer) {
      clearTimeout(this.showTimer);
      this.showTimer = null;
    }
  }
}
