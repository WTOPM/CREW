import { Component, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  DOCUMENT_OVERLAY_LABELS,
  DocumentOverlayId,
  DocumentStampOptions,
} from '../../models/document-overlay.models';
import { StorageService } from '../../services/storage.service';

@Component({
  selector: 'app-document-stamp-options',
  imports: [FormsModule],
  template: `
    <div class="stamp-options">
      <label class="stamp-check">
        <input
          type="checkbox"
          [ngModel]="options().useStamp"
          (ngModelChange)="onToggle('useStamp', $event)"
        />
        Put stamp on {{ docLabel() }}
      </label>
      <label class="stamp-check">
        <input
          type="checkbox"
          [ngModel]="options().useSignature"
          (ngModelChange)="onToggle('useSignature', $event)"
        />
        Put captain signature on {{ docLabel() }}
      </label>
    </div>
  `,
  styles: `
    .stamp-options {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 0.25rem 0 0.5rem;
    }

    .stamp-check {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      font-size: 0.9rem;
      cursor: pointer;
    }
  `,
})
export class DocumentStampOptionsComponent {
  readonly documentId = input.required<DocumentOverlayId>();

  private readonly storage = inject(StorageService);

  protected options(): DocumentStampOptions {
    return this.storage.documentOverlay()[this.documentId()];
  }

  protected docLabel(): string {
    return DOCUMENT_OVERLAY_LABELS[this.documentId()];
  }

  protected onToggle(field: keyof DocumentStampOptions, value: boolean): void {
    this.storage.updateDocumentOverlay(this.documentId(), { [field]: value });
  }
}
