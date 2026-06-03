import { Component, inject, input, signal } from '@angular/core';
import { DocumentOverlayId } from '../../models/document-overlay.models';
import { OverlayPlacementPickerComponent } from '../overlay-placement-picker/overlay-placement-picker.component';

@Component({
  selector: 'app-document-stamp-options',
  imports: [OverlayPlacementPickerComponent],
  template: `
    <div class="stamp-options">
      <button type="button" class="btn btn-secondary btn-placement" (click)="showPlacement.set(true)">
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
      font-size: 0.9rem;
    }
  `,
})
export class DocumentStampOptionsComponent {
  readonly documentId = input.required<DocumentOverlayId>();

  protected readonly showPlacement = signal(false);
}
