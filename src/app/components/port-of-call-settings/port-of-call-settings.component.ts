import { Component, input } from '@angular/core';
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
import { DocumentStampOptionsComponent } from '../document-stamp-options/document-stamp-options.component';

@Component({
  selector: 'app-port-of-call-settings',
  imports: [DocumentStampOptionsComponent],
  template: `
    @if (docId() === 'portOfCall' || docId() === 'portsOfCall') {
      <div class="poc-html-settings">
        <button type="button" class="btn btn-placement poc-html-settings__btn" (click)="openHtmlFormSettings()">
          ⚙ Settings
        </button>
        <p class="poc-html-settings__hint">
          Open the HTML editor to place stamp and signature on
          {{ docLabel() }}.
        </p>
      </div>
    } @else {
      <app-document-stamp-options documentId="sso0108PortCalls" />
    }
  `,
  styles: `
    .poc-html-settings {
      padding: 0.25rem 0 0.75rem;
    }

    .poc-html-settings__btn {
      width: 100%;
    }

    .poc-html-settings__hint {
      margin: 0.45rem 0 0;
      font-size: 0.72rem;
      line-height: 1.35;
      color: #64748b;
    }
  `,
})
export class PortOfCallSettingsComponent {
  readonly docId = input.required<PortSettingsDocId>();

  protected docLabel(): string {
    return PORT_SETTINGS_DOC_LABELS[this.docId()];
  }

  protected openHtmlFormSettings(): void {
    const q = new URLSearchParams({
      [PORT_OF_CALL_SETTINGS_PARAM]: '1',
      [PORT_SETTINGS_DOC_PARAM]: this.docId(),
    });
    const returnTo = encodeURIComponent(`/?${q.toString()}`);
    if (this.docId() === 'portsOfCall') {
      window.location.href = portOfCallForm02EditorUrl({ return: returnTo });
      return;
    }
    window.location.href = portOfCallForm01EditorUrl({ return: returnTo });
  }
}
