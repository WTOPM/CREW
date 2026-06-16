import { Component, HostListener, inject } from '@angular/core';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';

@Component({
  selector: 'app-confirm-dialog',
  template: `
    @if (dialog(); as d) {
      <div class="modal-backdrop confirm-backdrop" (click)="cancel()">
        <div
          class="modal dg-archive-modal confirm-dialog"
          [class.confirm-dialog--danger]="d.variant === 'danger'"
          role="alertdialog"
          aria-modal="true"
          [attr.aria-labelledby]="'confirm-dialog-title'"
          [attr.aria-describedby]="'confirm-dialog-message'"
          (click)="$event.stopPropagation()"
        >
          <header class="dg-archive-modal__head">
            <div
              class="dg-archive-modal__icon confirm-dialog__icon"
              [class.confirm-dialog__icon--danger]="d.variant === 'danger'"
              aria-hidden="true"
            >
              <svg viewBox="0 0 24 24" focusable="false">
                @if (d.variant === 'danger') {
                  <path
                    fill="currentColor"
                    d="M12 2 1 21h22L12 2zm0 4.2L19.5 19H4.5L12 6.2zM11 10v5h2v-5h-2zm0 7v2h2v-2h-2z"
                  />
                } @else {
                  <path
                    fill="currentColor"
                    d="M11 17h2v-6h-2v6zm1-8a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5zM12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"
                  />
                }
              </svg>
            </div>
            <div class="dg-archive-modal__intro">
              <h3 id="confirm-dialog-title">{{ d.title }}</h3>
              <p id="confirm-dialog-message" class="confirm-dialog__message">{{ d.message }}</p>
            </div>
          </header>

          <footer class="dg-archive-modal__foot">
            <button type="button" class="btn btn-secondary" (click)="cancel()">{{ d.cancelLabel }}</button>
            <button
              type="button"
              class="btn"
              [class.btn-primary]="d.variant !== 'danger'"
              [class.btn-danger]="d.variant === 'danger'"
              (click)="accept()"
            >
              {{ d.confirmLabel }}
            </button>
          </footer>
        </div>
      </div>
    }
  `,
  styles: `
    .confirm-backdrop {
      z-index: 10050;
    }

    .confirm-dialog {
      width: min(30rem, calc(100vw - 1.5rem));
      max-width: 30rem;
    }

    .confirm-dialog__icon {
      background: linear-gradient(145deg, #60a5fa, #2563eb);
      box-shadow: 0 4px 14px rgb(37 99 235 / 32%);
    }

    .confirm-dialog__icon--danger {
      background: linear-gradient(145deg, #f87171, #dc2626);
      box-shadow: 0 4px 14px rgb(220 38 38 / 28%);
    }

    .confirm-dialog__message {
      margin: 0;
      font-size: 0.86rem;
      color: var(--text-muted);
      line-height: 1.55;
      white-space: pre-line;
    }

    .confirm-dialog--danger .dg-archive-modal__head {
      background: linear-gradient(135deg, #fef2f2 0%, #f8fafc 55%, #fff 100%);
    }

    .btn-danger {
      background: #dc2626;
      color: #fff;
      border: 1px solid transparent;
    }

    .btn-danger:hover {
      background: #b91c1c;
    }
  `,
})
export class ConfirmDialogComponent {
  private readonly confirmDialog = inject(ConfirmDialogService);
  protected readonly dialog = this.confirmDialog.dialog;

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.dialog()) this.cancel();
  }

  protected accept(): void {
    this.confirmDialog.accept();
  }

  protected cancel(): void {
    this.confirmDialog.cancel();
  }
}
