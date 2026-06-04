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
    <fieldset class="choice-group">
      <legend class="choice-group__legend">List type</legend>
      <div class="choice-segmented choice-segmented--row" role="radiogroup" aria-label="List type">
        @for (id of typeIds; track id) {
          <label class="choice-segmented__item">
            <input
              type="radio"
              name="crewListType"
              [value]="id"
              [ngModel]="listType()"
              (ngModelChange)="onListTypeChange($event)"
            />
            <span class="choice-segmented__text">{{ typeLabel(id) }}</span>
          </label>
        }
      </div>
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
