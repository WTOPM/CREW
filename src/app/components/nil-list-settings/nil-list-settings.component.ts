import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { StorageService } from '../../services/storage.service';
import { DocumentStampOptionsComponent } from '../document-stamp-options/document-stamp-options.component';

@Component({
  selector: 'app-nil-list-settings',
  imports: [FormsModule, DocumentStampOptionsComponent],
  templateUrl: './nil-list-settings.component.html',
  styleUrl: './nil-list-settings.component.css',
})
export class NilListSettingsComponent {
  private readonly storage = inject(StorageService);

  protected form = this.storage.nilListForm;
  protected newPhraseText = signal('');

  protected onPhraseEnabledChange(id: string, enabled: boolean): void {
    this.storage.updateNilListPhrase(id, { enabled });
  }

  protected onPhraseTextChange(id: string, text: string): void {
    this.storage.updateNilListPhrase(id, { text });
  }

  protected addPhrase(): void {
    const text = this.newPhraseText().trim();
    if (!text) return;
    this.storage.addNilListPhrase(text);
    this.newPhraseText.set('');
  }

  protected removePhrase(id: string): void {
    this.storage.removeNilListPhrase(id);
  }
}
