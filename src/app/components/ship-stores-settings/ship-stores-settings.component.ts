import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  SHIP_STORES_02_ROW_COUNT,
  SHIP_STORES_ROW_COUNT,
  ShipStoresDocId,
} from '../../models/crew.models';
import { DocumentOverlayId } from '../../models/document-overlay.models';
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

  readonly docId = input<ShipStoresDocId>('shipStores');

  protected selectedRow = signal(1);
  protected draftName = signal('');
  protected draftQuantity = signal('');
  protected draftUnit = signal('');

  protected readonly form = computed(() =>
    this.docId() === 'shipStores02'
      ? this.storage.shipStoresForm02()
      : this.storage.shipStoresForm(),
  );

  protected readonly stampDocumentId = computed((): DocumentOverlayId =>
    this.docId() === 'shipStores02' ? 'shipStores02' : 'shipStores',
  );

  protected readonly rowCount = computed(() =>
    this.docId() === 'shipStores02' ? SHIP_STORES_02_ROW_COUNT : SHIP_STORES_ROW_COUNT,
  );

  constructor() {
    effect(() => {
      this.docId();
      untracked(() => {
        this.selectedRow.set(1);
        this.loadDraftFromRow(0);
      });
    });
  }

  protected onPlaceOfStorageChange(value: string): void {
    this.storage.updateShipStoresPlaceOfStorage(this.docId(), value);
  }

  protected selectRow(rowNo: number): void {
    const n = Math.min(this.rowCount(), Math.max(1, Number(rowNo) || 1));
    if (n === this.selectedRow()) return;
    this.selectedRow.set(n);
    this.loadDraftFromRow(n - 1);
  }

  protected saveArticleName(): void {
    const idx = this.selectedRow() - 1;
    this.storage.updateShipStoresRow(this.docId(), idx, { name: this.draftName().trim() });
  }

  protected saveQuantityAndUnit(): void {
    const idx = this.selectedRow() - 1;
    this.storage.updateShipStoresRow(this.docId(), idx, {
      quantity: this.draftQuantity().trim(),
      unit: this.draftUnit().trim(),
    });
  }

  private loadDraftFromRow(index: number): void {
    const row = this.form().rows[index];
    this.draftName.set(row?.name ?? '');
    this.draftQuantity.set(row?.quantity ?? '');
    const unit = row?.unit ?? '';
    this.draftUnit.set(unit === 'NIL' ? '' : unit);
  }
}
