import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CREW_LIST_TYPE_IDS,
  CREW_LIST_TYPE_LABELS,
  CREW_LIST_TYPE_OPTION_LABELS,
  crewListTypeOrderNo,
  CrewListTypeId,
  CREW_FORM_03,
  CREW_FORM_04,
  CREW_FORM_05,
} from '../../models/document-overlay.models';
import { StorageService } from '../../services/storage.service';
import { DocumentSettingsStore } from '../../services/document-settings.store';
import { ToastService } from '../../services/toast.service';
import { CrewAbbrChipComponent } from '../crew-abbr-chip/crew-abbr-chip.component';
import { DocumentExportSettingsComponent } from '../document-export-settings/document-export-settings.component';
import { crewListForm03EditorUrl } from '../../models/crew-list-form-03.paths';
import { crewListForm04EditorUrl } from '../../models/crew-list-form-04.paths';
import { crewListForm05EditorUrl } from '../../models/crew-list-form-05.paths';

@Component({
  selector: 'app-crew-list-settings',
  imports: [FormsModule, DocumentExportSettingsComponent, CrewAbbrChipComponent],
  template: `
    <fieldset class="choice-group">
      <legend class="choice-group__legend">Select document</legend>
      <div class="crew-list-type-list" role="radiogroup" aria-label="Select document">
        @for (id of typeIds; track id) {
          <label
            class="crew-list-type-option"
            [class.crew-list-type-option--selected]="listType() === id"
          >
            <input
              type="radio"
              name="crewListType"
              [value]="id"
              [ngModel]="listType()"
              (ngModelChange)="onListTypeChange($event)"
            />
            <span class="crew-list-type-option__label">
              <span class="crew-list-type-option__order">{{ typeOrder(id) }} -</span>
              <span class="crew-list-type-option__prefix">{{ typeOption(id).prefix }}</span>
              <span class="crew-list-type-option__chips">
                @for (abbr of typeOption(id).abbrs; track $index) {
                  <app-crew-abbr-chip [abbr]="abbr" />
                }
              </span>
            </span>
          </label>
        }
      </div>
    </fieldset>
    @if (listType() === crewForm03 || listType() === crewForm04 || listType() === crewForm05) {
      <div style="padding: 0.25rem 0 0.5rem;">
        <button type="button" class="btn btn-placement" style="width: 100%;" (click)="openHtmlFormSettings()">
          ⚙ Settings
        </button>
      </div>
    } @else {
      <app-document-export-settings documentId="crewList" />
    }
  `,
  styles: `
    .crew-list-type-list {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      align-self: stretch;
      max-width: 100%;
    }

    .crew-list-type-option {
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

    .crew-list-type-option:hover {
      background: #f1f5f9;
      border-color: #cbd5e1;
    }

    .crew-list-type-option--selected {
      background: #eff6ff;
      border-color: #93c5fd;
      box-shadow: inset 3px 0 0 #2563eb;
    }

    .crew-list-type-option input {
      position: absolute;
      opacity: 0;
      width: 0;
      height: 0;
      margin: 0;
      pointer-events: none;
    }

    .crew-list-type-option__label {
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

    .crew-list-type-option--selected .crew-list-type-option__label {
      color: #1e3a8a;
    }

    .crew-list-type-option__order {
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
      color: #64748b;
    }

    .crew-list-type-option--selected .crew-list-type-option__order {
      color: #3b82f6;
    }

    .crew-list-type-option__prefix {
      white-space: nowrap;
    }

    .crew-list-type-option__chips {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.28rem;
    }

    .crew-list-type-option:has(input:focus-visible) {
      outline: 2px solid var(--accent-soft);
      outline-offset: 1px;
    }
  `,
})
export class CrewListSettingsComponent {
  private readonly storage = inject(StorageService);
  private readonly docSettings = inject(DocumentSettingsStore);
  private readonly toast = inject(ToastService);

  /** HTML form types exposed to template */
  protected readonly crewForm03 = CREW_FORM_03;
  protected readonly crewForm04 = CREW_FORM_04;
  protected readonly crewForm05 = CREW_FORM_05;
  protected readonly typeIds = CREW_LIST_TYPE_IDS;

  protected listType(): CrewListTypeId {
    return this.storage.documentOverlay().crewList.listType;
  }

  protected typeOption(id: CrewListTypeId) {
    return CREW_LIST_TYPE_OPTION_LABELS[id];
  }

  protected typeOrder(id: CrewListTypeId): string {
    return crewListTypeOrderNo(id);
  }

  protected onListTypeChange(value: CrewListTypeId): void {
    if (value === this.listType()) return;
    this.docSettings.updateDocumentOverlay('crewList', { listType: value }, 'silent');
    this.toast.showSelected(CREW_LIST_TYPE_LABELS[value]);
  }

  protected openHtmlFormSettings(): void {
    const returnTo = encodeURIComponent('/?crewListSettings=1');
    if (this.listType() === CREW_FORM_03) {
      const mode = this.storage.crewArr().isArrival ? 'arrival' : 'departure';
      window.location.href = crewListForm03EditorUrl({ mode, return: returnTo });
      return;
    }
    if (this.listType() === CREW_FORM_04) {
      const mode = this.storage.crewArr().isArrival ? 'arrival' : 'departure';
      window.location.href = crewListForm04EditorUrl({ mode, return: returnTo });
      return;
    }
    const mode = this.storage.crewArr().isArrival ? 'arrival' : 'departure';
    window.location.href = crewListForm05EditorUrl({ mode, return: returnTo });
  }
}
