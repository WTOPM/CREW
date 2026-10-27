import { Component, inject, input } from '@angular/core';
import {
  PortSettingsDocId,
  PORT_SETTINGS_DOC_LABELS,
  PORT_SETTINGS_DOC_PARAM,
} from '../../models/crew.models';
import {
  PORT_OF_CALL_SETTINGS_PARAM,
  portOfCallForm01EditorUrl,
} from '../../models/port-of-call-form-01.paths';
import { portOfCallForm02EditorUrl } from '../../models/port-of-call-form-02.paths';
import { StorageService } from '../../services/storage.service';
import { DocumentStampOptionsComponent } from '../document-stamp-options/document-stamp-options.component';

@Component({
  selector: 'app-port-of-call-settings',
  imports: [DocumentStampOptionsComponent],
  templateUrl: './port-of-call-settings.component.html',
  styleUrl: './port-of-call-settings.component.css',
})
export class PortOfCallSettingsComponent {
  private readonly storage = inject(StorageService);

  readonly docId = input.required<PortSettingsDocId>();

  protected docLabel(): string {
    return PORT_SETTINGS_DOC_LABELS[this.docId()];
  }

  protected async openHtmlFormSettings(): Promise<void> {
    const q = new URLSearchParams({
      [PORT_OF_CALL_SETTINGS_PARAM]: '1',
      [PORT_SETTINGS_DOC_PARAM]: this.docId(),
    });
    const returnTo = encodeURIComponent(`/?${q.toString()}`);
    const url =
      this.docId() === 'portsOfCall'
        ? portOfCallForm02EditorUrl({ return: returnTo })
        : portOfCallForm01EditorUrl({ return: returnTo });
    // Flush Port Settings (incl. deletes / Ports in PDF) before Form reads disk.
    await this.storage.flushThenNavigate(url);
  }
}
