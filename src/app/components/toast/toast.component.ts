import { Component, inject } from '@angular/core';
import { ToastService, ToastVariant } from '../../services/toast.service';

@Component({
  selector: 'app-toast',
  template: `
    <div class="toast-container" aria-live="polite">
      @for (toast of toasts(); track toast.id) {
        <div
          class="toast"
          [class]="'toast toast--' + toast.type"
          role="status"
          (mouseenter)="pause(toast.id)"
          (mouseleave)="resume(toast.id)"
          (click)="dismiss(toast.id)"
        >
          <div class="toast__body">
            <span class="toast-icon" aria-hidden="true">{{ icon(toast.type) }}</span>
            <span class="toast-text">{{ toast.text }}</span>
          </div>
          <div class="toast-progress" aria-hidden="true">
            <div class="toast-progress__fill" [style.width.%]="progressPercent(toast.id)"></div>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .toast-container {
      position: fixed;
      bottom: 1.5rem;
      right: 1.5rem;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      justify-content: flex-end;
      gap: 0.94rem;
      pointer-events: none;
      max-width: min(27.5rem, calc(100vw - 2rem));
      max-height: min(70vh, calc(100vh - 3rem));
      overflow: hidden;
    }

    .toast {
      pointer-events: auto;
      flex-shrink: 0;
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      border-radius: 15px;
      font-size: 1.125rem;
      font-weight: 600;
      letter-spacing: 0.02em;
      cursor: pointer;
      border: 1px solid transparent;
      backdrop-filter: blur(12px);
      box-shadow:
        0 10px 40px rgb(15 23 42 / 14%),
        0 2px 8px rgb(15 23 42 / 8%);
      animation: toast-in 0.4s cubic-bezier(0.22, 1, 0.36, 1);
      transition:
        transform 0.2s ease,
        box-shadow 0.2s ease;
      overflow: hidden;
    }

    .toast:hover {
      transform: translateY(-1px);
      box-shadow:
        0 14px 48px rgb(15 23 42 / 18%),
        0 4px 12px rgb(15 23 42 / 10%);
    }

    .toast__body {
      display: flex;
      align-items: center;
      gap: 0.81rem;
      padding: 0.94rem 1.25rem 0.88rem 1.06rem;
    }

    .toast-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 2.19rem;
      height: 2.19rem;
      border-radius: 10px;
      font-size: 1.19rem;
      flex-shrink: 0;
    }

    .toast-text {
      flex: 1;
      text-transform: uppercase;
      font-size: 1.025rem;
      line-height: 1.35;
    }

    .toast-progress {
      height: 3px;
      background: rgb(15 23 42 / 7%);
    }

    .toast-progress__fill {
      height: 100%;
      opacity: 0.38;
      background: currentColor;
      transition: width 0.08s linear;
    }

    .toast--success {
      background: linear-gradient(135deg, rgb(240 253 244 / 96%) 0%, rgb(220 252 231 / 96%) 100%);
      color: #14532d;
      border-color: rgb(34 197 94 / 35%);
    }

    .toast--success .toast-icon {
      background: rgb(34 197 94 / 18%);
      color: #16a34a;
    }

    .toast--warning {
      background: linear-gradient(135deg, rgb(255 251 235 / 96%) 0%, rgb(254 243 199 / 96%) 100%);
      color: #78350f;
      border-color: rgb(245 158 11 / 40%);
    }

    .toast--warning .toast-icon {
      background: rgb(245 158 11 / 22%);
      color: #d97706;
    }

    .toast--info {
      background: linear-gradient(135deg, rgb(239 246 255 / 96%) 0%, rgb(219 234 254 / 96%) 100%);
      color: #1e3a8a;
      border-color: rgb(59 130 246 / 35%);
    }

    .toast--info .toast-icon {
      background: rgb(59 130 246 / 18%);
      color: #2563eb;
    }

    .toast--deleted,
    .toast--error {
      background: linear-gradient(135deg, rgb(254 242 242 / 96%) 0%, rgb(254 226 226 / 96%) 100%);
      color: #7f1d1d;
      border-color: rgb(239 68 68 / 40%);
    }

    .toast--deleted .toast-icon,
    .toast--error .toast-icon {
      background: rgb(239 68 68 / 20%);
      color: #dc2626;
    }

    @keyframes toast-in {
      from {
        opacity: 0;
        transform: translateX(1.25rem) scale(0.92);
      }
      to {
        opacity: 1;
        transform: translateX(0) scale(1);
      }
    }
  `,
})
export class ToastComponent {
  private readonly toastService = inject(ToastService);
  protected readonly toasts = this.toastService.toasts;

  protected icon(type: ToastVariant): string {
    switch (type) {
      case 'success':
        return '✓';
      case 'warning':
        return '▣';
      case 'info':
        return '↩';
      case 'deleted':
      case 'error':
        return '✕';
      default:
        return '•';
    }
  }

  protected progressPercent(id: number): number {
    return this.toastService.progressRatio(id) * 100;
  }

  protected pause(id: number): void {
    this.toastService.pause(id);
  }

  protected resume(id: number): void {
    this.toastService.resume(id);
  }

  protected dismiss(id: number): void {
    this.toastService.dismiss(id);
  }
}
