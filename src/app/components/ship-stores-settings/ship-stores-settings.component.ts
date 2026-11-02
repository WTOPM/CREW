import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import {
  Component,
  computed,
  HostListener,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  SHIP_STORES_02_ROW_COUNT,
  SHIP_STORES_03_ROW_COUNT,
  SHIP_STORES_DOC_IDS,
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
import {
  evaluateShipStoresQtyFactors,
  normalizeShipStoresQtyFactors,
  SHIP_STORES_QTY_FACTOR_MAX,
  shipStoresRowHasQtyCalc,
  type ShipStoresRow,
} from '../../models/ship-stores.models';
import { StorageService } from '../../services/storage.service';
import { FormsStore } from '../../services/forms.store';
import { ToastService } from '../../services/toast.service';
import { formatShipStoresCopyToast } from '../../utils/ship-stores-sync.util';
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
  private readonly toast = inject(ToastService);

  readonly docId = input<ShipStoresDocId>('shipStores');

  private readonly editSnapshot = new Map<string, string>();

  protected readonly qtyFactorMax = SHIP_STORES_QTY_FACTOR_MAX;
  /** Row index with open qty-calculator popover. */
  protected readonly qtyCalcOpen = signal<number | null>(null);
  /** Working factor fields while the popover is open. */
  protected readonly qtyCalcDraft = signal<string[]>([]);

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

  protected readonly otherDocIds = computed(() =>
    SHIP_STORES_DOC_IDS.filter((id) => id !== this.docId()),
  );

  protected readonly qtyCalcPreview = computed(() =>
    evaluateShipStoresQtyFactors(this.qtyCalcDraft()),
  );

  protected docLabel(): string {
    return SHIP_STORES_DOC_LABELS[this.docId()];
  }

  protected otherDocLabel(id: ShipStoresDocId): string {
    return SHIP_STORES_DOC_LABELS[id];
  }

  protected syncShortLabel(id: ShipStoresDocId): string {
    if (id === 'shipStores03') return '03 Germany';
    if (id === 'shipStores02') return '02 Long';
    return '01 Short';
  }

  protected unitDisplay(unit: string): string {
    return unit === 'NIL' ? '' : unit;
  }

  protected rowHasQtyCalc(row: ShipStoresRow): boolean {
    return shipStoresRowHasQtyCalc(row);
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

  /** Copy articles from another Ship Stores form into the one currently open. */
  protected syncFrom(from: ShipStoresDocId): void {
    const stats = this.forms.copyShipStoresForm(from, this.docId());
    if (!stats) return;
    this.toast.show(formatShipStoresCopyToast(stats), 'success');
  }

  /** Copy articles from the open form into another Ship Stores form. */
  protected syncInto(to: ShipStoresDocId): void {
    const stats = this.forms.copyShipStoresForm(this.docId(), to);
    if (!stats) return;
    this.toast.show(formatShipStoresCopyToast(stats), 'success');
  }

  protected onRowDrop(event: CdkDragDrop<unknown>): void {
    this.closeQtyCalc();
    this.forms.reorderShipStoresRows(this.docId(), event.previousIndex, event.currentIndex);
  }

  protected toggleQtyCalc(rowIndex: number, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.qtyCalcOpen() === rowIndex) {
      this.closeQtyCalc();
      return;
    }
    this.openQtyCalc(rowIndex);
  }

  protected openQtyCalc(rowIndex: number): void {
    const row = this.form().rows[rowIndex];
    if (!row) return;
    const existing = normalizeShipStoresQtyFactors(row.qtyFactors);
    // Never seed from Qty total — that looked like "2000 × 0" after reopen.
    const draft = existing.length >= 2 ? [...existing] : ['', ''];
    while (draft.length < 2) draft.push('');
    this.qtyCalcDraft.set(draft);
    this.qtyCalcOpen.set(rowIndex);
  }

  protected closeQtyCalc(): void {
    this.persistQtyCalcDraft();
    this.qtyCalcOpen.set(null);
    this.qtyCalcDraft.set([]);
  }

  protected onQtyFactorChange(factorIndex: number, value: string): void {
    const next = [...this.qtyCalcDraft()];
    next[factorIndex] = value;
    this.qtyCalcDraft.set(next);
    this.persistQtyCalcDraft();
  }

  protected addQtyFactor(): void {
    const draft = this.qtyCalcDraft();
    if (draft.length >= SHIP_STORES_QTY_FACTOR_MAX) return;
    this.qtyCalcDraft.set([...draft, '']);
  }

  protected removeQtyFactor(factorIndex: number): void {
    const draft = this.qtyCalcDraft();
    if (draft.length <= 2) {
      // Keep two slots; just clear the value.
      const next = [...draft];
      next[factorIndex] = '';
      this.qtyCalcDraft.set(next);
      this.persistQtyCalcDraft();
      return;
    }
    this.qtyCalcDraft.set(draft.filter((_, i) => i !== factorIndex));
    this.persistQtyCalcDraft();
  }

  protected clearQtyCalc(rowIndex: number): void {
    this.forms.updateShipStoresRow(this.docId(), rowIndex, { qtyFactors: [] });
    this.qtyCalcDraft.set(['', '']);
  }

  /** Write factors + Qty only when the expression is complete — never wipe a saved formula mid-edit. */
  private persistQtyCalcDraft(): void {
    const rowIndex = this.qtyCalcOpen();
    if (rowIndex == null) return;
    const factors = normalizeShipStoresQtyFactors(this.qtyCalcDraft());
    const product = evaluateShipStoresQtyFactors(this.qtyCalcDraft());
    if (product == null || factors.length < 2) return;
    this.forms.updateShipStoresRow(this.docId(), rowIndex, {
      qtyFactors: factors,
      quantity: product,
    });
  }

  @HostListener('document:keydown.escape', ['$event'])
  protected onEscapeQtyCalc(event: Event): void {
    if (this.qtyCalcOpen() == null) return;
    event.preventDefault();
    event.stopPropagation();
    this.closeQtyCalc();
  }

  @HostListener('document:mousedown', ['$event'])
  protected onDocMouseDown(event: MouseEvent): void {
    if (this.qtyCalcOpen() == null) return;
    const t = event.target;
    if (!(t instanceof Element)) return;
    if (t.closest('.ss-qty-calc')) return;
    this.closeQtyCalc();
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
      const row = this.form().rows[rowIndex];
      // Calculator owns Qty while a formula is active.
      if (row && shipStoresRowHasQtyCalc(row)) return;
      this.forms.updateShipStoresRow(this.docId(), rowIndex, {
        quantity: raw.trim(),
        qtyFactors: [],
      });
      return;
    }
    this.forms.updateShipStoresRow(this.docId(), rowIndex, { unit: raw.trim() });
  }
}
