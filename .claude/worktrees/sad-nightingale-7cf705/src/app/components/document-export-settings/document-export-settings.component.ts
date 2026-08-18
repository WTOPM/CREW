import { Component, input } from '@angular/core';
import { DocumentOverlayId } from '../../models/document-overlay.models';
import { DocumentStampOptionsComponent } from '../document-stamp-options/document-stamp-options.component';

@Component({
  selector: 'app-document-export-settings',
  imports: [DocumentStampOptionsComponent],
  template: `<app-document-stamp-options [documentId]="documentId()" />`,
})
export class DocumentExportSettingsComponent {
  readonly documentId = input.required<DocumentOverlayId>();
}
