import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DocumentOverlayId } from '../../models/document-overlay.models';
import {
  PAX_LIST_TYPE_IDS,
  PAX_LIST_TYPE_LABELS,
  PAX_LIST_TYPE_OPTION_LABELS,
  paxListTypeOrderNo,
  PaxListTypeId,
} from '../../models/passenger.models';
import { StorageService } from '../../services/storage.service';
import { ToastService } from '../../services/toast.service';
import { CrewAbbrChipComponent } from '../crew-abbr-chip/crew-abbr-chip.component';
import { DocumentStampOptionsComponent } from '../document-stamp-options/document-stamp-options.component';

@Component({
  selector: 'app-passenger-list-settings',
  imports: [FormsModule, DocumentStampOptionsComponent, CrewAbbrChipComponent],
  template: `
    <fieldset class="choice-group">
      <legend class="choice-group__legend">Select document</legend>
      <div class="pax-list-type-list" role="radiogroup" aria-label="Select document">
        @for (id of typeIds; track id) {
          <label
            class="pax-list-type-option"
            [class.pax-list-type-option--selected]="listType() === id"
          >
            <input
              type="radio"
              name="paxListType"
              [value]="id"
              [ngModel]="listType()"
              (ngModelChange)="onListTypeChange($event)"
            />
            <span class="pax-list-type-option__label">
              <span class="pax-list-type-option__order">{{ typeOrder(id) }} -</span>
              <span class="pax-list-type-option__prefix">{{ typeOption(id).prefix }}</span>
              <span class="pax-list-type-option__chips">
                @for (abbr of typeOption(id).abbrs; track $index) {
                  <app-crew-abbr-chip [abbr]="abbr" />
                }
              </span>
            </span>
          </label>
        }
      </div>
    </fieldset>
    <app-document-stamp-options [documentId]="stampDocumentId()" />
  `,
  styles: `
    .pax-list-type-list {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      align-self: stretch;
      max-width: 100%;
    }

    .pax-list-type-option {
      position: relative;
      display: flex;
      margin: 0;
      cursor: pointer;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: #f8fafc;
      transition:
        background 0.15s ease,
        border-color 0.15s ease,
        box-shadow 0.15s ease;
    }

    .pax-list-type-option:hover {
      background: #f0fdf4;
      border-color: #86efac;
    }

    .pax-list-type-option--selected {
      background: #ecfdf5;
      border-color: #6ee7b7;
      box-shadow: inset 3px 0 0 #15803d;
    }

    .pax-list-type-option input {
      position: absolute;
      opacity: 0;
      width: 0;
      height: 0;
      margin: 0;
      pointer-events: none;
    }

    .pax-list-type-option__label {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.35rem;
      width: 100%;
      padding: 0.5rem 0.65rem;
      font-size: 0.74rem;
      font-weight: 600;
      letter-spacing: 0.02em;
      line-height: 1.35;
      color: #334155;
    }

    .pax-list-type-option--selected .pax-list-type-option__label {
      color: #14532d;
    }

    .pax-list-type-option__order {
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
      color: #64748b;
    }

    .pax-list-type-option--selected .pax-list-type-option__order {
      color: #16a34a;
    }

    .pax-list-type-option__prefix {
      white-space: nowrap;
    }

    .pax-list-type-option__chips {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.28rem;
    }

    .pax-list-type-option:has(input:focus-visible) {
      outline: 2px solid var(--accent-soft);
      outline-offset: 1px;
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

  protected typeOption(id: PaxListTypeId) {
    return PAX_LIST_TYPE_OPTION_LABELS[id];
  }

  protected typeOrder(id: PaxListTypeId): string {
    return paxListTypeOrderNo(id);
  }

  protected onListTypeChange(value: PaxListTypeId): void {
    if (value === this.listType()) return;
    this.storage.updatePaxArr({ listType: value }, 'silent');
    this.toast.showSelected(PAX_LIST_TYPE_LABELS[value]);
  }
}
