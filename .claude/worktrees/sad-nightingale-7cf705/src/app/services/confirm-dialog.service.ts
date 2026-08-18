import { Injectable, signal } from '@angular/core';

export type ConfirmDialogVariant = 'default' | 'danger';

export interface ConfirmDialogOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmDialogVariant;
}

export interface ConfirmDialogState extends Required<ConfirmDialogOptions> {
  title: string;
  confirmLabel: string;
  cancelLabel: string;
  variant: ConfirmDialogVariant;
}

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private readonly state = signal<ConfirmDialogState | null>(null);
  private resolver: ((value: boolean) => void) | null = null;

  readonly dialog = this.state.asReadonly();

  confirm(options: ConfirmDialogOptions): Promise<boolean> {
    if (this.resolver) {
      this.resolver(false);
    }

    return new Promise<boolean>((resolve) => {
      this.resolver = resolve;
      this.state.set({
        title: options.title?.trim() || 'Confirm action',
        message: options.message,
        confirmLabel: options.confirmLabel?.trim() || 'Confirm',
        cancelLabel: options.cancelLabel?.trim() || 'Cancel',
        variant: options.variant ?? 'default',
      });
    });
  }

  accept(): void {
    this.resolver?.(true);
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
