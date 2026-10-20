import {
  Directive,
  ElementRef,
  Input,
  OnDestroy,
  inject,
} from '@angular/core';
import { ToastService } from '../services/toast.service';

const ALLOW =
  '.dg-inventory-view-mode, .dg-inventory-tab, .uf-search-box, .dg-pdf-btn, .dg-excel-btn, .dg-unifeeder-table, .dg-master-table';

const BLOCK =
  'button, .uf-drop, .uf-toggle, .uf-manifest-chip__remove, .dg-inventory-transfer-btn, .dg-inventory-clear-btn, .dg-bulk-actions, .choice-segmented:not(.dg-inventory-view-mode), a.btn, label.uf-toggle';

/**
 * In Copy mode: any click on edit controls shows a toast instead of acting.
 * Capture phase so disabled-looking / short-circuited handlers still notify.
 */
@Directive({
  selector: '[appDgCopyModeGuard]',
  standalone: true,
})
export class DgCopyModeGuardDirective implements OnDestroy {
  private readonly toast = inject(ToastService);
  private readonly el = inject(ElementRef<HTMLElement>);
  private _enabled = false;
  private lastToastAt = 0;

  @Input({ alias: 'appDgCopyModeGuard' })
  set enabled(value: boolean) {
    this._enabled = !!value;
  }

  private readonly onClickCapture = (event: Event): void => {
    if (!this._enabled) return;
    const t = event.target;
    if (!(t instanceof Element)) return;
    if (t.closest(ALLOW)) return;
    const blocked = t.closest(BLOCK);
    if (!blocked) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const now = Date.now();
    if (now - this.lastToastAt < 600) return;
    this.lastToastAt = now;
    this.toast.show('Switch to Edit mode to change the inventory', 'info');
  };

  constructor() {
    this.el.nativeElement.addEventListener('click', this.onClickCapture, true);
    this.el.nativeElement.addEventListener('pointerdown', this.onPointerDownCapture, true);
  }

  /** Stop drag/import start before click on drop zones. */
  private readonly onPointerDownCapture = (event: Event): void => {
    if (!this._enabled) return;
    const t = event.target;
    if (!(t instanceof Element)) return;
    if (t.closest(ALLOW)) return;
    if (!t.closest('.uf-drop, .cma-drop, .dg-drop')) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const now = Date.now();
    if (now - this.lastToastAt < 600) return;
    this.lastToastAt = now;
    this.toast.show('Switch to Edit mode to change the inventory', 'info');
  };

  ngOnDestroy(): void {
    this.el.nativeElement.removeEventListener('click', this.onClickCapture, true);
    this.el.nativeElement.removeEventListener(
      'pointerdown',
      this.onPointerDownCapture,
      true,
    );
  }
}
