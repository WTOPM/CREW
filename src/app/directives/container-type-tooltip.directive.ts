import {
  Directive,
  ElementRef,
  HostListener,
  Input,
  OnDestroy,
} from '@angular/core';
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
    const entry = lookupIsoContainerType(this.typeCode);
    if (!entry) return;

    this.showTimer = setTimeout(() => {
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
