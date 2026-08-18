import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { StorageService } from '../../services/storage.service';
import { FormsStore } from '../../services/forms.store';
import { DocumentStampOptionsComponent } from '../document-stamp-options/document-stamp-options.component';

@Component({
  selector: 'app-ship-money-settings',
  imports: [FormsModule, DocumentStampOptionsComponent],
  templateUrl: './ship-money-settings.component.html',
  styleUrl: './ship-money-settings.component.css',
})
export class ShipMoneySettingsComponent {
  private readonly storage = inject(StorageService);
  private readonly forms = inject(FormsStore);

  protected form = this.storage.shipMoneyForm;
  protected draftAmount = signal('');
  protected draftCurrency = signal('');

  protected onEntryChange(id: string, field: 'amount' | 'currency', value: string): void {
    this.forms.updateShipMoneyEntry(id, { [field]: value });
  }

  protected addEntry(): void {
    const amount = this.draftAmount().trim();
    const currency = this.draftCurrency().trim();
    if (!amount && !currency) return;
    this.forms.addShipMoneyEntry(amount, currency);
    this.draftAmount.set('');
    this.draftCurrency.set('');
  }

  protected removeEntry(id: string): void {
    this.forms.removeShipMoneyEntry(id);
  }
}
