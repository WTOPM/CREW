import { Directive, ElementRef, HostListener, Input, OnDestroy } from '@angular/core';
import {
  formatDgPackingGroupReference,
  lookupDgPackingGroup,
} from '../utils/dg-packing-group.util';
import { showHintTooltip, showPlainTooltip } from '../utils/hint-tooltip.util';

const SHOW_DELAY_MS = 500;

@Directive({
  selector: '[appPackingGroupTooltip]',
  standalone: true,
  host: {
    class: 'dg-hint-tooltip-host',
  },
})
export class PackingGroupTooltipDirective implements OnDestroy {
  @Input({ alias: 'appPackingGroupTooltip' }) packingGroup = '';
  /** When true, show all three packing groups (for column header). */
  @Input() appPackingGroupTooltipReference = false;

  private showTimer: ReturnType<typeof setTimeout> | null = null;
  private tooltipHide: (() => void) | null = null;

  constructor(private readonly el: ElementRef<HTMLElement>) {}

  @HostListener('mouseenter')
  onMouseEnter(): void {
    this.clearShowTimer();
    this.showTimer = setTimeout(() => {
      this.hide();
      if (this.appPackingGroupTooltipReference) {
        const tip = showPlainTooltip(this.el.nativeElement, formatDgPackingGroupReference());
        this.tooltipHide = tip.hide;
        return;
      }
      const entry = lookupDgPackingGroup(this.packingGroup);
      if (!entry) return;
      const tip = showHintTooltip(this.el.nativeElement, entry.label, entry.summary);
      this.tooltipHide = tip.hide;
    }, SHOW_DELAY_MS);
  }

  @HostListener('mouseleave')
  onMouseLeave(): void {
    this.clearShowTimer();
    this.hide();
  }

  @HostListener('focusin', ['$event'])
  onFocusIn(event: FocusEvent): void {
    const target = event.target as HTMLElement | null;
    if (target?.tagName !== 'INPUT') return;
    this.onMouseEnter();
  }

  @HostListener('focusout')
  onFocusOut(): void {
    this.onMouseLeave();
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
