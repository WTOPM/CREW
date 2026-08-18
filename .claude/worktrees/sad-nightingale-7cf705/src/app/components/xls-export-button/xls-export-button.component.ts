import { Component, output } from '@angular/core';

export const XLS_EXPORT_DISCLAIMER_TITLE = 'Experimental Feature';
export const XLS_EXPORT_DISCLAIMER_BODY =
  'This is an experimental feature intended solely for generating documents in Excel format for data copying purposes. It is not intended for official use.';

@Component({
  selector: 'app-xls-export-button',
  template: `
    <div class="xls-export-wrap">
      <button type="button" class="btn-xls-compact" (click)="export.emit()">XLS</button>
      <span class="xls-info-wrap">
        <span class="xls-info-icon" tabindex="0" aria-label="Excel export information">i</span>
        <span class="xls-info-popover" role="tooltip">
          <strong>{{ disclaimerTitle }}</strong>
          {{ disclaimerBody }}
        </span>
      </span>
    </div>
  `,
  styles: `
    .xls-export-wrap {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.15rem 0 0;
    }

    .btn-xls-compact {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 2.75rem;
      height: 2rem;
      padding: 0 0.55rem;
      border: 1px solid #15803d;
      border-radius: 6px;
      background: linear-gradient(180deg, #16a34a 0%, #15803d 100%);
      color: #fff;
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.04em;
      line-height: 1;
      cursor: pointer;
      box-shadow:
        0 1px 4px rgb(22 163 74 / 30%),
        inset 0 1px 0 rgb(255 255 255 / 18%);
      transition:
        background 0.15s ease,
        box-shadow 0.15s ease,
        transform 0.12s ease;
    }

    .btn-xls-compact:hover {
      background: linear-gradient(180deg, #22c55e 0%, #16a34a 100%);
      box-shadow: 0 2px 8px rgb(22 163 74 / 35%);
      transform: translateY(-1px);
    }

    .btn-xls-compact:active {
      transform: translateY(0);
    }

    .btn-xls-compact:focus-visible {
      outline: 2px solid #86efac;
      outline-offset: 2px;
    }

    .xls-info-wrap {
      position: relative;
      display: inline-flex;
    }

    .xls-info-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.1rem;
      height: 1.1rem;
      border: 1.5px solid #64748b;
      border-radius: 50%;
      color: #64748b;
      font-size: 0.62rem;
      font-weight: 800;
      font-style: italic;
      font-family: Georgia, 'Times New Roman', serif;
      line-height: 1;
      cursor: help;
      user-select: none;
    }

    .xls-info-icon:focus-visible {
      outline: 2px solid var(--accent-soft);
      outline-offset: 2px;
    }

    .xls-info-popover {
      position: absolute;
      left: 0;
      bottom: calc(100% + 8px);
      z-index: 200;
      width: max-content;
      max-width: min(18rem, 85vw);
      padding: 0.65rem 0.75rem;
      border-radius: 8px;
      background: #0f172a;
      color: #f1f5f9;
      font-size: 0.72rem;
      font-weight: 400;
      font-style: normal;
      font-family: Arial, Helvetica, sans-serif;
      line-height: 1.45;
      text-align: left;
      pointer-events: none;
      opacity: 0;
      visibility: hidden;
      transform: translateY(4px);
      transition:
        opacity 0.15s ease,
        transform 0.15s ease,
        visibility 0.15s ease;
      box-shadow: 0 8px 24px rgb(15 23 42 / 28%);
    }

    .xls-info-popover strong {
      display: block;
      margin-bottom: 0.35rem;
      font-size: 0.74rem;
      font-weight: 700;
      letter-spacing: 0.02em;
    }

    .xls-info-popover::after {
      content: '';
      position: absolute;
      left: 0.45rem;
      top: 100%;
      border: 6px solid transparent;
      border-top-color: #0f172a;
    }

    .xls-info-wrap:hover .xls-info-popover,
    .xls-info-wrap:focus-within .xls-info-popover {
      opacity: 1;
      visibility: visible;
      transform: translateY(0);
    }
  `,
})
export class XlsExportButtonComponent {
  readonly export = output<void>();

  protected readonly disclaimerTitle = XLS_EXPORT_DISCLAIMER_TITLE;
  protected readonly disclaimerBody = XLS_EXPORT_DISCLAIMER_BODY;
}
