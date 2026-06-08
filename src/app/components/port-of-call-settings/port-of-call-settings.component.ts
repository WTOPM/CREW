import { Component } from '@angular/core';
import { DocumentStampOptionsComponent } from '../document-stamp-options/document-stamp-options.component';

@Component({
  selector: 'app-port-of-call-settings',
  imports: [DocumentStampOptionsComponent],
  template: `<app-document-stamp-options documentId="portOfCall" />`,
})
export class PortOfCallSettingsComponent {}
