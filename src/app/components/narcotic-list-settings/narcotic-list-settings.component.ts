import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NARCOTIC_LIST_DEFAULT_UNITS_PER } from '../../models/narcotic-list.models';
import { StorageService } from '../../services/storage.service';
import { FormsStore } from '../../services/forms.store';
import { DocumentStampOptionsComponent } from '../document-stamp-options/document-stamp-options.component';

@Component({
  selector: 'app-narcotic-list-settings',
  imports: [FormsModule, DocumentStampOptionsComponent],
  templateUrl: './narcotic-list-settings.component.html',
  styleUrl: './narcotic-list-settings.component.css',
})
export class NarcoticListSettingsComponent {
  private readonly storage = inject(StorageService);
  private readonly forms = inject(FormsStore);

  protected readonly form = this.storage.narcoticListForm;

  protected onEntryChange(
    id: string,
    field:
      | 'name'
      | 'dosage'
      | 'quantity'
      | 'unitsPack'
      | 'unitsPer'
      | 'totalQuantity'
      | 'expirationDate'
      | 'controlNo'
      | 'placeOfStorage',
    value: string,
  ): void {
    this.forms.updateNarcoticListEntry(id, { [field]: value });
  }

  protected addEntry(): void {
    this.forms.addNarcoticListEntry({
      unitsPer: NARCOTIC_LIST_DEFAULT_UNITS_PER,
      placeOfStorage: "Master's Safe",
    });
  }

  protected removeEntry(id: string): void {
    this.forms.removeNarcoticListEntry(id);
  }
}
