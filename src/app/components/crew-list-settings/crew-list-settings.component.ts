import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CREW_LIST_TYPE_IDS,
  CREW_LIST_TYPE_LABELS,
  CrewListTypeId,
} from '../../models/document-overlay.models';
import { StorageService } from '../../services/storage.service';
import { DocumentStampOptionsComponent } from '../document-stamp-options/document-stamp-options.component';

@Component({
  selector: 'app-crew-list-settings',
  imports: [FormsModule, DocumentStampOptionsComponent],
  template: `
    <fieldset class="crew-list-types">
      <legend>List type</legend>
      @for (id of typeIds; track id) {
        <label class="crew-list-type-option">
          <input
            type="radio"
            name="crewListType"
            [value]="id"
            [ngModel]="listType()"
            (ngModelChange)="onListTypeChange($event)"
          />
          {{ typeLabel(id) }}
        </label>
      }
    </fieldset>
    @if (listType() === 'type2Alger') {
      <p class="crew-list-type2-note">
        Type 2 — Alger (arrival only). Fills header + crew columns (passport and seaman&apos;s book per member).
        Temperature column left empty. Departure is disabled in the CREW LIST menu.
      </p>
    }
    <app-document-stamp-options documentId="crewList" />
  `,
  styles: `
    .crew-list-types {
      margin: 0 0 1rem;
      padding: 0.65rem 0.75rem;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }

    .crew-list-types legend {
      font-size: 0.78rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #475569;
      padding: 0 0.25rem;
    }

    .crew-list-type-option {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      font-size: 0.9rem;
      cursor: pointer;
    }

    .crew-list-type2-note {
      margin: 0 0 0.85rem;
      font-size: 0.82rem;
      color: var(--text-muted);
      line-height: 1.4;
    }
  `,
})
export class CrewListSettingsComponent {
  private readonly storage = inject(StorageService);

  protected readonly typeIds = CREW_LIST_TYPE_IDS;

  protected listType(): CrewListTypeId {
    return this.storage.documentOverlay().crewList.listType;
  }

  protected typeLabel(id: CrewListTypeId): string {
    return CREW_LIST_TYPE_LABELS[id];
  }

  protected onListTypeChange(value: CrewListTypeId): void {
    this.storage.updateDocumentOverlay('crewList', { listType: value });
  }
}
