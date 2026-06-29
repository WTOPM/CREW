import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { Component, computed, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  SHIP_STORES_02_ROW_COUNT,
  SHIP_STORES_03_ROW_COUNT,
  SHIP_STORES_DOC_LABELS,
  SHIP_STORES_ROW_COUNT,
  SHIP_STORES_SETTINGS_DOC_PARAM,
  ShipStoresDocId,
} from '../../models/crew.models';
import { DocumentOverlayId } from '../../models/document-overlay.models';
import {
  SHIP_STORES_SETTINGS_PARAM,
  shipStoresForm01EditorUrl,
} from '../../models/ship-stores-form-01.paths';
import { shipStoresForm02EditorUrl } from '../../models/ship-stores-form-02.paths';
import { StorageService } from '../../services/storage.service';
import { FormsStore } from '../../services/forms.store';
import { DocumentStampOptionsComponent } from '../document-stamp-options/document-stamp-options.component';

type ShipStoresCellField = 'name' | 'quantity' | 'unit';

@Component({
  selector: 'app-ship-stores-settings',
  imports: [FormsModule, DragDropModule, DocumentStampOptionsComponent],
  templateUrl: './ship-stores-settings.component.html',
  styleUrl: './ship-stores-settings.component.css',
})
export class ShipStoresSettingsComponent {
  private readonly storage = inject(StorageService);
  private readonly forms = inject(FormsStore);

  readonly docId = input<ShipStoresDocId>('shipStores');

  private readonly editSnapshot = new Map<string, string>();

  protected readonly form = computed(() => {
    const id = this.docId();
    if (id === 'shipStores03') return this.storage.shipStoresForm03();
    if (id === 'shipStores02') return this.storage.shipStoresForm02();
    return this.storage.shipStoresForm();
  });

  protected readonly stampDocumentId = computed((): DocumentOverlayId => {
    const id = this.docId();
    if (id === 'shipStores03') return 'shipStores03';
    if (id === 'shipStores02') return 'shipStores02';
    return 'shipStores';
  });

  protected readonly usesHtmlEditor = computed(() => {
    const id = this.docId();
    return id === 'shipStores' || id === 'shipStores02';
  });

  protected readonly rowCount = computed(() => {
    const id = this.docId();
    if (id === 'shipStores03') return SHIP_STORES_03_ROW_COUNT;
    if (id === 'shipStores02') return SHIP_STORES_02_ROW_COUNT;
    return SHIP_STORES_ROW_COUNT;
  });

  protected docLabel(): string {
    return SHIP_STORES_DOC_LABELS[this.docId()];
  }

  protected unitDisplay(unit: string): string {
    return unit === 'NIL' ? '' : unit;
  }

  protected openHtmlFormSettings(): void {
    const q = new URLSearchParams({
      [SHIP_STORES_SETTINGS_PARAM]: '1',
      [SHIP_STORES_SETTINGS_DOC_PARAM]: this.docId(),
    });
    const returnTo = encodeURIComponent(`/?${q.toString()}`);
    if (this.docId() === 'shipStores02') {
      window.location.href = shipStoresForm02EditorUrl({ return: returnTo });
      return;
    }
    window.location.href = shipStoresForm01EditorUrl({ return: returnTo });
  }

  protected onPlaceOfStorageChange(value: string): void {
    this.forms.updateShipStoresPlaceOfStorage(this.docId(), value);
  }

  protected onRowDrop(event: CdkDragDrop<unknown>): void {
    this.forms.reorderShipStoresRows(this.docId(), event.previousIndex, event.currentIndex);
  }

  protected onCellFocus(
    rowIndex: number,
    field: ShipStoresCellField,
    event: FocusEvent,
  ): void {
    const input = event.target as HTMLInputElement;
    this.editSnapshot.set(this.cellKey(rowIndex, field), input.value);
    queueMicrotask(() => input.select());
  }

  protected onCellCommit(
    rowIndex: number,
    field: ShipStoresCellField,
    event: Event,
  ): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    this.editSnapshot.delete(this.cellKey(rowIndex, field));
    this.commitCell(rowIndex, field, value);
  }

  protected onCellKeydown(
    rowIndex: number,
    field: ShipStoresCellField,
    event: KeyboardEvent,
  ): void {
    const input = event.target as HTMLInputElement;
    if (event.key === 'Enter') {
      event.preventDefault();
      input.blur();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      const snap = this.editSnapshot.get(this.cellKey(rowIndex, field));
      if (snap !== undefined) {
        input.value = snap;
      }
      this.editSnapshot.delete(this.cellKey(rowIndex, field));
      input.blur();
    }
  }

  private cellKey(rowIndex: number, field: ShipStoresCellField): string {
    return `${this.docId()}:${rowIndex}:${field}`;
  }

  private commitCell(rowIndex: number, field: ShipStoresCellField, raw: string): void {
    if (field === 'name') {
      this.forms.updateShipStoresRow(this.docId(), rowIndex, { name: raw.trim() });
      return;
    }
    if (field === 'quantity') {
      this.forms.updateShipStoresRow(this.docId(), rowIndex, { quantity: raw.trim() });
      return;
    }
    this.forms.updateShipStoresRow(this.docId(), rowIndex, { unit: raw.trim() });
  }
}
