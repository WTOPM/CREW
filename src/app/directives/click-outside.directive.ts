import { Directive, ElementRef, EventEmitter, HostListener, Output } from '@angular/core';

/**
 * Directive that emits when user clicks outside the element.
 * Only triggers if both mousedown AND mouseup happen outside the element.
 * This prevents closing when user starts selecting text inside and releases outside.
 */
@Directive({
  selector: '[appClickOutside]',
  standalone: true,
})
export class ClickOutsideDirective {
  @Output() appClickOutside = new EventEmitter<void>();

  private mouseDownOutside = false;

  constructor(private elementRef: ElementRef) {}

  @HostListener('document:mousedown', ['$event'])
  onMouseDown(event: MouseEvent): void {
    if (this.inOverlay(event.target)) {
      this.mouseDownOutside = false;
      return;
    }
    const clickedInside = this.elementRef.nativeElement.contains(event.target);
    this.mouseDownOutside = !clickedInside;
  }

  @HostListener('document:mouseup', ['$event'])
  onMouseUp(event: MouseEvent): void {
    // Clicks inside a confirm dialog (rendered above this modal) must not close it.
    if (this.inOverlay(event.target)) {
      this.mouseDownOutside = false;
      return;
    }
    const clickedInside = this.elementRef.nativeElement.contains(event.target);

    // Only emit if both mousedown and mouseup happened outside
    if (this.mouseDownOutside && !clickedInside) {
      this.appClickOutside.emit();
    }

    this.mouseDownOutside = false;
  }

  /**
   * True when the event happened in a layer that must not count as "outside"
   * (confirm dialogs, CDK overlays like date-picker / selects).
   * CDK portals render outside the host element DOM, so without this a calendar
   * click would close the parent modal via appClickOutside.
   */
  private inOverlay(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false;
    return !!(
      target.closest('.confirm-backdrop') ||
      target.closest('.cdk-overlay-container') ||
      target.closest('.date-picker-popup')
    );
  }
}
