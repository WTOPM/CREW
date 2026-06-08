import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DocumentOverlayId } from '../../models/document-overlay.models';
import {
  PAX_LIST_TYPE_IDS,
  PAX_LIST_TYPE_LABELS,
  PaxListTypeId,
} from '../../models/passenger.models';
import { StorageService } from '../../services/storage.service';
import { ToastService } from '../../services/toast.service';
import { DocumentStampOptionsComponent } from '../document-stamp-options/document-stamp-options.component';

@Component({
  selector: 'app-passenger-list-settings',
  imports: [FormsModule, DocumentStampOptionsComponent],
  template: `
    <fieldset class="choice-group">
      <legend class="choice-group__legend">Select document</legend>
      <div class="pax-list-type-picker" role="radiogroup" aria-label="Select document">
        <div class="pax-list-type-row">
          @for (id of typeIds; track id) {
            <label class="pax-list-type-btn" [class.pax-list-type-btn--v2]="id === 'paxV2'">
              <input
                type="radio"
                name="paxListType"
                [value]="id"
                [ngModel]="listType()"
                (ngModelChange)="onListTypeChange($event)"
              />
              <span class="pax-list-type-btn__text">{{ typeLabel(id) }}</span>
            </label>
          }
        </div>
      </div>
    </fieldset>
    <app-document-stamp-options [documentId]="stampDocumentId()" />
  `,
  styles: `
    .pax-list-type-picker {
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
      align-self: flex-start;
      max-width: 100%;
    }

    .pax-list-type-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0;
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
      background: #f8fafc;
      width: max-content;
      max-width: 100%;
    }

    .pax-list-type-btn {
      position: relative;
      display: flex;
      margin: 0;
      cursor: pointer;
      flex: 0 0 auto;
    }

    .pax-list-type-btn + .pax-list-type-btn {
      border-left: 1px solid var(--border);
    }

    .pax-list-type-btn input {
      position: absolute;
      opacity: 0;
      width: 0;
      height: 0;
      margin: 0;
      pointer-events: none;
    }

    .pax-list-type-btn__text {
      display: block;
      padding: 0.45rem 0.75rem;
      font-size: 0.78rem;
      font-weight: 600;
      letter-spacing: 0.02em;
      line-height: 1.3;
      white-space: nowrap;
      color: var(--text-muted);
      transition:
        background 0.15s ease,
        color 0.15s ease;
    }

    .pax-list-type-btn:hover .pax-list-type-btn__text {
      background: #dcfce7;
      color: #15803d;
    }

    .pax-list-type-btn:has(input:checked) .pax-list-type-btn__text {
      background: #15803d;
      color: #fff;
    }

    .pax-list-type-btn--v2:hover .pax-list-type-btn__text {
      background: #ede9fe;
      color: #6d28d9;
    }

    .pax-list-type-btn--v2:has(input:checked) .pax-list-type-btn__text {
      background: #6d28d9;
      color: #fff;
    }

    .pax-list-type-btn:has(input:focus-visible) .pax-list-type-btn__text {
      outline: 2px solid var(--accent-soft);
      outline-offset: -2px;
    }
  `,
})
export class PassengerListSettingsComponent {
  private readonly storage = inject(StorageService);
  private readonly toast = inject(ToastService);

  protected readonly typeIds = PAX_LIST_TYPE_IDS;

  protected listType(): PaxListTypeId {
    return this.storage.paxArr().listType;
  }

  protected stampDocumentId = computed((): DocumentOverlayId => this.listType());

  protected typeLabel(id: PaxListTypeId): string {
    return PAX_LIST_TYPE_LABELS[id];
  }

  protected onListTypeChange(value: PaxListTypeId): void {
    if (value === this.listType()) return;
    this.storage.updatePaxArr({ listType: value }, 'silent');
    this.toast.showSelected(PAX_LIST_TYPE_LABELS[value]);
  }
}
