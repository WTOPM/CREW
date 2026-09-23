import { Injectable, signal } from '@angular/core';

export type ConfirmDialogVariant = 'default' | 'danger';

/** `true` = confirm, `false` = cancel, `'alt'` = optional third action. */
export type ConfirmDialogResult = boolean | 'alt';

export interface ConfirmDialogOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Optional third button (e.g. “Fix all”). */
  altLabel?: string;
  variant?: ConfirmDialogVariant;
}

export interface ConfirmDialogState extends Required<Omit<ConfirmDialogOptions, 'altLabel'>> {
  title: string;
  confirmLabel: string;
  cancelLabel: string;
  altLabel: string;
  variant: ConfirmDialogVariant;
}

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private readonly state = signal<ConfirmDialogState | null>(null);
  private resolver: ((value: ConfirmDialogResult) => void) | null = null;

  readonly dialog = this.state.asReadonly();

  confirm(options: ConfirmDialogOptions): Promise<ConfirmDialogResult> {
    if (this.resolver) {
      this.resolver(false);
    }

    return new Promise<ConfirmDialogResult>((resolve) => {
      this.resolver = resolve;
      this.state.set({
        title: options.title?.trim() || 'Confirm action',
        message: options.message,
        confirmLabel: options.confirmLabel?.trim() || 'Confirm',
        cancelLabel: options.cancelLabel?.trim() || 'Cancel',
        altLabel: options.altLabel?.trim() || '',
        variant: options.variant ?? 'default',
      });
    });
  }

  accept(): void {
    this.resolver?.(true);
    this.close();
  }

  acceptAlt(): void {
    this.resolver?.('alt');
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
