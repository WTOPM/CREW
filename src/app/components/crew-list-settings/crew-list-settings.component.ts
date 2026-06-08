import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CREW_LIST_TYPE_LABELS,
  CrewListTypeId,
} from '../../models/document-overlay.models';
import { StorageService } from '../../services/storage.service';
import { ToastService } from '../../services/toast.service';
import { DocumentExportSettingsComponent } from '../document-export-settings/document-export-settings.component';

@Component({
  selector: 'app-crew-list-settings',
  imports: [FormsModule, DocumentExportSettingsComponent],
  template: `
    <fieldset class="choice-group">
      <legend class="choice-group__legend">Select document</legend>
      <div class="crew-list-type-picker" role="radiogroup" aria-label="Select document">
        <div class="crew-list-type-row">
          @for (id of type1Ids; track id) {
            <label class="crew-list-type-btn crew-list-type-btn--type1">
              <input
                type="radio"
                name="crewListType"
                [value]="id"
                [ngModel]="listType()"
                (ngModelChange)="onListTypeChange($event)"
              />
              <span class="crew-list-type-btn__text">{{ typeLabel(id) }}</span>
            </label>
          }
        </div>
        <div class="crew-list-type-row">
          <label class="crew-list-type-btn crew-list-type-btn--alger">
            <input
              type="radio"
              name="crewListType"
              value="type2Alger"
              [ngModel]="listType()"
              (ngModelChange)="onListTypeChange($event)"
            />
            <span class="crew-list-type-btn__text">{{ typeLabel('type2Alger') }}</span>
          </label>
          <label class="crew-list-type-btn crew-list-type-btn--v2">
            <input
              type="radio"
              name="crewListType"
              value="type3V2"
              [ngModel]="listType()"
              (ngModelChange)="onListTypeChange($event)"
            />
            <span class="crew-list-type-btn__text">{{ typeLabel('type3V2') }}</span>
          </label>
          <label class="crew-list-type-btn crew-list-type-btn--v3sbk">
            <input
              type="radio"
              name="crewListType"
              value="type4V3Sbk"
              [ngModel]="listType()"
              (ngModelChange)="onListTypeChange($event)"
            />
            <span class="crew-list-type-btn__text">{{ typeLabel('type4V3Sbk') }}</span>
          </label>
        </div>
      </div>
    </fieldset>
    <app-document-export-settings documentId="crewList" />
  `,
  styles: `
    .crew-list-type-picker {
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
      align-self: flex-start;
      max-width: 100%;
    }

    .crew-list-type-row {
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

    .crew-list-type-btn {
      position: relative;
      display: flex;
      margin: 0;
      cursor: pointer;
      flex: 0 0 auto;
    }

    .crew-list-type-btn + .crew-list-type-btn {
      border-left: 1px solid var(--border);
    }

    .crew-list-type-btn input {
      position: absolute;
      opacity: 0;
      width: 0;
      height: 0;
      margin: 0;
      pointer-events: none;
    }

    .crew-list-type-btn__text {
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

    .crew-list-type-btn--type1:hover .crew-list-type-btn__text {
      background: #e0f2fe;
      color: #0369a1;
    }

    .crew-list-type-btn--type1:has(input:checked) .crew-list-type-btn__text {
      background: #0369a1;
      color: #fff;
    }

    .crew-list-type-btn--alger:hover .crew-list-type-btn__text {
      background: #cffafe;
      color: #0e7490;
    }

    .crew-list-type-btn--alger:has(input:checked) .crew-list-type-btn__text {
      background: #0e7490;
      color: #fff;
    }

    .crew-list-type-btn--v2:hover .crew-list-type-btn__text {
      background: #ede9fe;
      color: #6d28d9;
    }

    .crew-list-type-btn--v2:has(input:checked) .crew-list-type-btn__text {
      background: #6d28d9;
      color: #fff;
    }

    .crew-list-type-btn--v3sbk:hover .crew-list-type-btn__text {
      background: #ffedd5;
      color: #c2410c;
    }

    .crew-list-type-btn--v3sbk:has(input:checked) .crew-list-type-btn__text {
      background: #ea580c;
      color: #fff;
    }

    .crew-list-type-btn:has(input:focus-visible) .crew-list-type-btn__text {
      outline: 2px solid var(--accent-soft);
      outline-offset: -2px;
    }
  `,
})
export class CrewListSettingsComponent {
  private readonly storage = inject(StorageService);
  private readonly toast = inject(ToastService);

  protected readonly type1Ids: readonly CrewListTypeId[] = ['type1Passport', 'type1SeamansBook'];

  protected listType(): CrewListTypeId {
    return this.storage.documentOverlay().crewList.listType;
  }

  protected typeLabel(id: CrewListTypeId): string {
    return CREW_LIST_TYPE_LABELS[id];
  }

  protected onListTypeChange(value: CrewListTypeId): void {
    if (value === this.listType()) return;
    this.storage.updateDocumentOverlay('crewList', { listType: value }, 'silent');
    this.toast.showSelected(CREW_LIST_TYPE_LABELS[value]);
  }
}
