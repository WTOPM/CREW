import { Injectable, signal } from '@angular/core';

export type ConfirmDialogVariant = 'default' | 'danger';

/** `true` = confirm, `false` = cancel, `'alt'` / `'alt2'` = optional extra actions. */
export type ConfirmDialogResult = boolean | 'alt' | 'alt2';

/** Side-by-side values (e.g. MANIFEST vs DG Reference). */
export interface ConfirmDialogComparison {
  leftLabel: string;
  leftValue: string;
  rightLabel: string;
  rightValue: string;
}

export interface ConfirmDialogOptions {
  title?: string;
  message: string;
  comparison?: ConfirmDialogComparison;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Optional third button (e.g. “Fix all Reference”). */
  altLabel?: string;
  /** Optional fourth button (e.g. “Fix all MANIFEST”). */
  alt2Label?: string;
  variant?: ConfirmDialogVariant;
  /**
   * When false, backdrop click does not dismiss (user must pick a button).
   * Default true.
   */
  dismissOnBackdrop?: boolean;
  /**
   * When false, Escape does not dismiss. Default true (Escape = cancel).
   */
  dismissOnEscape?: boolean;
}

export interface ConfirmDialogState {
  title: string;
  message: string;
  comparison: ConfirmDialogComparison | null;
  confirmLabel: string;
  cancelLabel: string;
  altLabel: string;
  alt2Label: string;
  variant: ConfirmDialogVariant;
  dismissOnBackdrop: boolean;
  dismissOnEscape: boolean;
}

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private readonly state = signal<ConfirmDialogState | null>(null);
  private resolver: ((value: ConfirmDialogResult) => void) | null = null;

  readonly dialog = this.state.asReadonly();

  confirm(options: ConfirmDialogOptions): Promise<ConfirmDialogResult> {
    // Do not auto-cancel a dialog that requires an explicit choice.
    if (this.resolver) {
      const open = this.state();
      if (open && (!open.dismissOnBackdrop || !open.dismissOnEscape)) {
        return Promise.resolve(false);
      }
      this.resolver(false);
    }

    return new Promise<ConfirmDialogResult>((resolve) => {
      this.resolver = resolve;
      this.state.set({
        title: options.title?.trim() || 'Confirm action',
        message: options.message,
        comparison: options.comparison ?? null,
        confirmLabel: options.confirmLabel?.trim() || 'Confirm',
        cancelLabel: options.cancelLabel?.trim() || 'Cancel',
        altLabel: options.altLabel?.trim() || '',
        alt2Label: options.alt2Label?.trim() || '',
        variant: options.variant ?? 'default',
        dismissOnBackdrop: options.dismissOnBackdrop !== false,
        dismissOnEscape: options.dismissOnEscape !== false,
      });
    });
  }

  /** Backdrop click — no-op when dismissOnBackdrop is false. */
  backdropDismiss(): void {
    const open = this.state();
    if (!open?.dismissOnBackdrop) return;
    this.cancel();
  }

  /** Escape — no-op when dismissOnEscape is false. */
  escapeDismiss(): void {
    const open = this.state();
    if (!open?.dismissOnEscape) return;
    this.cancel();
  }

  accept(): void {
    this.resolver?.(true);
    this.close();
  }

  acceptAlt(): void {
    this.resolver?.('alt');
    this.close();
  }

  acceptAlt2(): void {
    this.resolver?.('alt2');
    this.close();
  }

  cancel(): void {
    this.resolver?.(false);
    this.close();
  }

  private close(): void {
    this.resolver = null;
    this.state.set(null);
  }
}
