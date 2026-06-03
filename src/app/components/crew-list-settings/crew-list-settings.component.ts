import { Component, inject, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';

import {

  AppData,

  CREW_IDENTITY_PASSPORT,

  CREW_IDENTITY_SEAMANS_BOOK,

} from '../../models/crew.models';

import {

  CREW_LIST_TYPE_IDS,

  CREW_LIST_TYPE_LABELS,

  CrewListTypeId,

} from '../../models/document-overlay.models';

import { PdfCrewArrService } from '../../services/pdf-crew-arr.service';

import { PdfCrewListType2Service } from '../../services/pdf-crew-list-type2.service';

import { StorageService } from '../../services/storage.service';

import { ToastService } from '../../services/toast.service';

import { CrewListCoordinatePreviewComponent } from '../crew-list-coordinate-preview/crew-list-coordinate-preview.component';

import { DocumentStampOptionsComponent } from '../document-stamp-options/document-stamp-options.component';



@Component({

  selector: 'app-crew-list-settings',

  imports: [FormsModule, DocumentStampOptionsComponent, CrewListCoordinatePreviewComponent],

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

    <div class="crew-list-preview-row">

      <button

        type="button"

        class="btn btn-secondary"

        [disabled]="previewLoading()"

        (click)="openCoordinatePreview()"

      >

        @if (previewLoading()) {

          Loading…

        } @else {

          Preview

        }

      </button>

      <span class="crew-list-preview-hint">Real size — move cursor for pdf-lib x, y</span>

    </div>

    <app-document-stamp-options documentId="crewList" />

    @if (showCoordinatePreview() && previewBytes()) {

      <app-crew-list-coordinate-preview

        [pdfBytes]="previewBytes()!"

        [listType]="listType()"

        (close)="closeCoordinatePreview()"

      />

    }

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



    .crew-list-preview-row {

      display: flex;

      flex-wrap: wrap;

      align-items: center;

      gap: 0.5rem 0.75rem;

      margin: 0 0 1rem;

    }



    .crew-list-preview-hint {

      font-size: 0.78rem;

      color: var(--text-muted);

    }

  `,

})

export class CrewListSettingsComponent {

  private readonly storage = inject(StorageService);

  private readonly crewPdf = inject(PdfCrewArrService);

  private readonly crewListType2Pdf = inject(PdfCrewListType2Service);

  private readonly toast = inject(ToastService);



  protected readonly typeIds = CREW_LIST_TYPE_IDS;



  protected readonly previewLoading = signal(false);

  protected readonly showCoordinatePreview = signal(false);

  protected readonly previewBytes = signal<Uint8Array | null>(null);



  protected listType(): CrewListTypeId {

    return this.storage.documentOverlay().crewList.listType;

  }



  protected typeLabel(id: CrewListTypeId): string {

    return CREW_LIST_TYPE_LABELS[id];

  }



  protected onListTypeChange(value: CrewListTypeId): void {

    this.storage.updateDocumentOverlay('crewList', { listType: value });

  }



  protected closeCoordinatePreview(): void {

    this.showCoordinatePreview.set(false);

    this.previewBytes.set(null);

  }



  protected async openCoordinatePreview(): Promise<void> {

    this.previewLoading.set(true);

    try {

      const bytes = await this.buildPreviewPdf();

      this.previewBytes.set(bytes);

      this.showCoordinatePreview.set(true);

    } catch (err) {

      this.toast.showError(err instanceof Error ? err.message : 'Crew list preview failed');

    } finally {

      this.previewLoading.set(false);

    }

  }



  private async buildPreviewPdf(): Promise<Uint8Array> {

    const listType = this.listType();

    const data = this.appData();

    const crew = this.storage.activeCrewArrival();



    if (listType === 'type2Alger') {

      const arrivalData: AppData = {

        ...data,

        crewArr: { ...data.crewArr, isArrival: true },

      };

      return this.crewListType2Pdf.buildPreviewBytes(arrivalData, crew);

    }



    const identityDocumentType =

      listType === 'type1SeamansBook' ? CREW_IDENTITY_SEAMANS_BOOK : CREW_IDENTITY_PASSPORT;

    const pdfData: AppData = {

      ...data,

      crewArr: { ...data.crewArr, isArrival: true, identityDocumentType },

    };

    return this.crewPdf.buildPdfBytes(pdfData, crew);

  }



  private appData(): AppData {

    return {

      ship: this.storage.ship(),

      crew: this.storage.allCrew(),

      crewArr: this.storage.crewArr(),

      passengers: this.storage.allPassengers(),

      paxArr: this.storage.paxArr(),

      ports: this.storage.ports(),

      ranks: this.storage.ranks(),

      nationalities: this.storage.nationalities(),

      portCallHistory: this.storage.portCallHistory(),

      portOfCall: this.storage.portOfCall(),

      documentOverlay: this.storage.documentOverlay(),

      shipAssets: this.storage.shipAssets(),

    };

  }

}

