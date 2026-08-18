import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  NIL_LIST_SETTINGS_PARAM,
  nilListFormEditorUrl,
} from '../../models/nil-list-form.paths';
import { StorageService } from '../../services/storage.service';
import { FormsStore } from '../../services/forms.store';

@Component({
  selector: 'app-nil-list-settings',
  imports: [FormsModule],
  templateUrl: './nil-list-settings.component.html',
  styleUrl: './nil-list-settings.component.css',
})
export class NilListSettingsComponent {
  private readonly storage = inject(StorageService);
  private readonly forms = inject(FormsStore);

  protected form = this.storage.nilListForm;
  protected newPhraseText = signal('');

  protected openHtmlFormSettings(): void {
    const q = new URLSearchParams({ [NIL_LIST_SETTINGS_PARAM]: '1' });
    const returnTo = encodeURIComponent(`/?${q.toString()}`);
    window.location.href = nilListFormEditorUrl({ return: returnTo });
  }

  protected onPhraseEnabledChange(id: string, enabled: boolean): void {
    this.forms.updateNilListPhrase(id, { enabled });
  }

  protected onPhraseTextChange(id: string, text: string): void {
    this.forms.updateNilListPhrase(id, { text });
  }

  protected addPhrase(): void {
    const text = this.newPhraseText().trim();
    if (!text) return;
    this.forms.addNilListPhrase(text);
    this.newPhraseText.set('');
  }

  protected removePhrase(id: string): void {
    this.forms.removeNilListPhrase(id);
  }
}
