import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SHIP_STORES_ROW_COUNT } from '../../models/crew.models';
import { StorageService } from '../../services/storage.service';
import { ToastService } from '../../services/toast.service';
import { DocumentStampOptionsComponent } from '../document-stamp-options/document-stamp-options.component';

@Component({
  selector: 'app-ship-stores-settings',
  imports: [FormsModule, DocumentStampOptionsComponent],
  templateUrl: './ship-stores-settings.component.html',
  styleUrl: './ship-stores-settings.component.css',
})
export class ShipStoresSettingsComponent {
  private readonly storage = inject(StorageService);
  private readonly toast = inject(ToastService);

  protected readonly rowNumbers = Array.from({ length: SHIP_STORES_ROW_COUNT }, (_, i) => i + 1);

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

  protected onRowChange(rowNo: number): void {
    const n = Math.min(SHIP_STORES_ROW_COUNT, Math.max(1, Number(rowNo) || 1));
    this.selectedRow.set(n);
    this.loadDraftFromRow(n - 1);
  }

  protected saveArticleName(): void {
    const idx = this.selectedRow() - 1;
    this.storage.updateShipStoresRow(idx, { name: this.draftName().trim() });
    this.toast.showSaved();
  }

  protected saveQuantityAndUnit(): void {
    const idx = this.selectedRow() - 1;
    this.storage.updateShipStoresRow(idx, {
      quantity: this.draftQuantity().trim(),
      unit: this.draftUnit().trim(),
    });
    this.toast.showSaved();
  }

  private loadDraftFromRow(index: number): void {
    const row = this.storage.shipStoresForm().rows[index];
    this.draftName.set(row?.name ?? '');
    this.draftQuantity.set(row?.quantity ?? '');
    const unit = row?.unit ?? '';
    this.draftUnit.set(unit === 'NIL' ? '' : unit);
  }
}
