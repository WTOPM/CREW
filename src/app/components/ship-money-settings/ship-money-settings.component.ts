import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { StorageService } from '../../services/storage.service';
import { ToastService } from '../../services/toast.service';
import { DocumentStampOptionsComponent } from '../document-stamp-options/document-stamp-options.component';

@Component({
  selector: 'app-ship-money-settings',
  imports: [FormsModule, DocumentStampOptionsComponent],
  templateUrl: './ship-money-settings.component.html',
  styleUrl: './ship-money-settings.component.css',
})
export class ShipMoneySettingsComponent {
  private readonly storage = inject(StorageService);
  private readonly toast = inject(ToastService);

  protected form = this.storage.shipMoneyForm;
  protected draftAmount = signal('');
  protected draftCurrency = signal('');

  protected onEntryChange(
    id: string,
    field: 'amount' | 'currency',
    value: string,
  ): void {
    this.storage.updateShipMoneyEntry(id, { [field]: value });
  }

  protected addEntry(): void {
    const amount = this.draftAmount().trim();
    const currency = this.draftCurrency().trim();
    if (!amount && !currency) return;
    this.storage.addShipMoneyEntry(amount, currency);
    this.draftAmount.set('');
    this.draftCurrency.set('');
    this.toast.showSaved();
  }

  protected removeEntry(id: string): void {
    this.storage.removeShipMoneyEntry(id);
    this.toast.showSaved();
  }
}
