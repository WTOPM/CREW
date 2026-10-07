import { Directive, ElementRef, HostListener, Input, OnDestroy } from '@angular/core';
import { lookupIsoContainerType, containerTypeSizeLabel } from '../utils/iso-container-type.util';
import { showHintTooltip } from '../utils/hint-tooltip.util';

const SHOW_DELAY_MS = 500;

@Directive({
  selector: '[appContainerTypeTooltip]',
  standalone: true,
  host: {
    class: 'dg-hint-tooltip-host',
  },
})
export class ContainerTypeTooltipDirective implements OnDestroy {
  @Input({ alias: 'appContainerTypeTooltip' }) typeCode = '';

  private showTimer: ReturnType<typeof setTimeout> | null = null;
  private tooltipHide: (() => void) | null = null;

  constructor(private readonly el: ElementRef<HTMLElement>) {}

  @HostListener('mouseenter')
  onMouseEnter(): void {
    this.clearShowTimer();
    // Drop any existing tip immediately so focus+hover never stacks two bubbles.
    this.hide();
    // While the Size/Type input is focused (typing / just picked), skip the tip —
    // suggestions already cover that; hover-only tip is for at-a-glance later.
    if (this.hostContainsFocusedInput()) return;

    const entry = lookupIsoContainerType(this.typeCode);
    if (!entry) return;

    this.showTimer = setTimeout(() => {
      if (this.hostContainsFocusedInput()) return;
      this.hide();
      const tip = showHintTooltip(
        this.el.nativeElement,
        entry.code,
        entry.summary,
        containerTypeSizeLabel(entry),
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

  private hostContainsFocusedInput(): boolean {
    const root = this.el.nativeElement;
    const active = document.activeElement;
    return !!active && active.tagName === 'INPUT' && root.contains(active);
  }
}
