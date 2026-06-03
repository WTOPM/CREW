import { Component, inject, input, signal } from '@angular/core';
import { DocumentOverlayId } from '../../models/document-overlay.models';
import { OverlayPlacementPickerComponent } from '../overlay-placement-picker/overlay-placement-picker.component';

@Component({
  selector: 'app-document-stamp-options',
  imports: [OverlayPlacementPickerComponent],
  template: `
    <div class="stamp-options">
      <button type="button" class="btn btn-placement" (click)="showPlacement.set(true)">
        Stamp & signature…
      </button>
    </div>

    @if (showPlacement()) {
      <app-overlay-placement-picker
        [documentId]="documentId()"
        (close)="showPlacement.set(false)"
      />
    }
  `,
  styles: `
    .stamp-options {
      padding: 0.25rem 0 0.5rem;
    }

    .btn-placement {
      width: 100%;
      font-size: 0.9rem;
      font-weight: 600;
      letter-spacing: 0.02em;
      color: #fff;
      border: none;
      background: linear-gradient(
        120deg,
        #4f46e5 0%,
        #7c3aed 28%,
        #c026d3 58%,
        #e11d48 100%
      );
      background-size: 200% 200%;
      background-position: 0% 50%;
      box-shadow:
        0 2px 10px rgb(124 58 237 / 40%),
        inset 0 1px 0 rgb(255 255 255 / 22%);
      transition:
        background-position 0.35s ease,
        box-shadow 0.2s ease,
        transform 0.15s ease;
    }

    .btn-placement:hover {
      background-position: 100% 50%;
      box-shadow:
        0 4px 16px rgb(192 38 211 / 45%),
        inset 0 1px 0 rgb(255 255 255 / 28%);
      transform: translateY(-1px);
    }

    .btn-placement:active {
      transform: translateY(0);
      box-shadow: 0 2px 8px rgb(124 58 237 / 35%);
    }

    .btn-placement:focus-visible {
      outline: 2px solid #c4b5fd;
      outline-offset: 2px;
    }
  `,
})
export class DocumentStampOptionsComponent {
  readonly documentId = input.required<DocumentOverlayId>();

  protected readonly showPlacement = signal(false);
}
