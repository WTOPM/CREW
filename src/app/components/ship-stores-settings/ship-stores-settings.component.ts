import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SHIP_STORES_ROW_COUNT } from '../../models/crew.models';
import { StorageService } from '../../services/storage.service';
import { DocumentStampOptionsComponent } from '../document-stamp-options/document-stamp-options.component';

@Component({
  selector: 'app-ship-stores-settings',
  imports: [FormsModule, DocumentStampOptionsComponent],
  templateUrl: './ship-stores-settings.component.html',
  styleUrl: './ship-stores-settings.component.css',
})
export class ShipStoresSettingsComponent {
  private readonly storage = inject(StorageService);

  protected selectedRow = signal(1);
  protected draftName = signal('');
  protected draftQuantity = signal('');
  protected draftUnit = signal('');

  protected form = this.storage.shipStoresForm;

  constructor() {
    this.loadDraftFromRow(0);
  }

  protected onPlaceOfStorageChange(value: string): void {
    this.storage.updateShipStoresPlaceOfStorage(value);
  }

  protected selectRow(rowNo: number): void {
    const n = Math.min(SHIP_STORES_ROW_COUNT, Math.max(1, Number(rowNo) || 1));
    if (n === this.selectedRow()) return;
    this.selectedRow.set(n);
    this.loadDraftFromRow(n - 1);
  }

  protected saveArticleName(): void {
    const idx = this.selectedRow() - 1;
    this.storage.updateShipStoresRow(idx, { name: this.draftName().trim() });
  }

  protected saveQuantityAndUnit(): void {
    const idx = this.selectedRow() - 1;
    this.storage.updateShipStoresRow(idx, {
      quantity: this.draftQuantity().trim(),
      unit: this.draftUnit().trim(),
    });
  }

  private loadDraftFromRow(index: number): void {
    const row = this.storage.shipStoresForm().rows[index];
    this.draftName.set(row?.name ?? '');
    this.draftQuantity.set(row?.quantity ?? '');
    const unit = row?.unit ?? '';
    this.draftUnit.set(unit === 'NIL' ? '' : unit);
  }
}
