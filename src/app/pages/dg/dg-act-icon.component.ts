import { Component, input } from '@angular/core';

export type DgActIconKind = 'discharge' | 'restore' | 'add' | 'remove' | 'line-remove';

@Component({
  selector: 'dg-act-icon',
  template: `
    @switch (kind()) {
      @case ('discharge') {
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3v12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          <path d="M8 11l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M5 19h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      }
      @case ('restore') {
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 14 4 9l5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M4 9h10a5 5 0 0 1 5 5v1" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      }
      @case ('add') {
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      }
      @case ('remove') {
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          <path d="M10 11v6M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          <path d="M9 7V5h6v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M8 7l1 12h6l1-12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      }
      @case ('line-remove') {
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      }
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      line-height: 0;
    }

    svg {
      width: 14px;
      height: 14px;
      fill: none;
      pointer-events: none;
    }

    :host-context(.dg-act--discharge:hover) svg,
    :host-context(.dg-act--discharge:focus-visible) svg {
      animation: dg-icon-drop 0.45s ease;
    }

    :host-context(.dg-act--restore:hover) svg,
    :host-context(.dg-act--restore:focus-visible) svg {
      animation: dg-icon-undo 0.5s ease;
    }

    :host-context(.dg-act--add:hover) svg,
    :host-context(.dg-act--add:focus-visible) svg {
      animation: dg-icon-plus 0.35s ease;
    }

    :host-context(.dg-act--remove:hover) svg,
    :host-context(.dg-act--remove:focus-visible) svg {
      animation: dg-icon-shake 0.4s ease;
    }

    :host-context(.dg-act--line-remove:hover) svg,
    :host-context(.dg-act--line-remove:focus-visible) svg {
      animation: dg-icon-shrink 0.3s ease;
    }

    @keyframes dg-icon-drop {
      0%,
      100% {
        transform: translateY(0);
      }
      40% {
        transform: translateY(2px);
      }
    }

    @keyframes dg-icon-undo {
      0% {
        transform: rotate(0deg);
      }
      40% {
        transform: rotate(-28deg);
      }
      100% {
        transform: rotate(0deg);
      }
    }

    @keyframes dg-icon-plus {
      0%,
      100% {
        transform: scale(1);
      }
      50% {
        transform: scale(1.18);
      }
    }

    @keyframes dg-icon-shake {
      0%,
      100% {
        transform: rotate(0deg);
      }
      25% {
        transform: rotate(-8deg);
      }
      75% {
        transform: rotate(8deg);
      }
    }

    @keyframes dg-icon-shrink {
      0%,
      100% {
        transform: scaleX(1);
      }
      50% {
        transform: scaleX(0.55);
      }
    }
  `,
})
export class DgActIconComponent {
  readonly kind = input.required<DgActIconKind>();
}
