import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AppData,
  CREW_IDENTITY_PASSPORT,
  CREW_IDENTITY_SEAMANS_BOOK,
  PortCallHistoryEntry,
  portCountry,
} from '../../models/crew.models';
import { crewListIdentityPdfFileName } from '../../utils/pdf-filename.util';
import { PartialDateInputComponent } from '../partial-date-input/partial-date-input.component';
import { PortSelectComponent } from '../port-select/port-select.component';
import { TimeInputComponent } from '../time-input/time-input.component';
import { defaultIsoDateInCurrentMonth } from '../../utils/partial-date.util';
import { PdfCrewArrService } from '../../services/pdf-crew-arr.service';
import { PdfCrewListType2Service } from '../../services/pdf-crew-list-type2.service';
import { PdfMdhService } from '../../services/pdf-mdh.service';
import { PdfPortOfCallService } from '../../services/pdf-port-of-call.service';
import { PdfShipStoresService } from '../../services/pdf-ship-stores.service';
import { POC_MAX_ROW_COUNT, POC_MIN_ROW_COUNT, POC_TEMPLATE_ROW_COUNT } from '../../services/port-of-call-coordinates';
import { StorageService } from '../../services/storage.service';
import { ToastService } from '../../services/toast.service';
import { DocumentStampOptionsComponent } from '../document-stamp-options/document-stamp-options.component';
import { CrewListSettingsComponent } from '../crew-list-settings/crew-list-settings.component';
import { ShipStoresSettingsComponent } from '../ship-stores-settings/ship-stores-settings.component';

@Component({
  selector: 'app-documents-nav',
  imports: [
    FormsModule,
    PortSelectComponent,
    PartialDateInputComponent,
    TimeInputComponent,
    DocumentStampOptionsComponent,
    CrewListSettingsComponent,
    ShipStoresSettingsComponent,
  ],
  templateUrl: './documents-nav.component.html',
  styleUrl: './documents-nav.component.css',
})
export class DocumentsNavComponent {
  private readonly storage = inject(StorageService);
  private readonly crewPdf = inject(PdfCrewArrService);
  private readonly crewListType2Pdf = inject(PdfCrewListType2Service);
  private readonly mdhPdf = inject(PdfMdhService);
  private readonly portOfCallPdf = inject(PdfPortOfCallService);
  private readonly shipStoresPdf = inject(PdfShipStoresService);
  private readonly toast = inject(ToastService);

  protected readonly pocMinPorts = POC_MIN_ROW_COUNT;
  protected readonly pocMaxPorts = POC_MAX_ROW_COUNT;
  protected readonly pocRowsPerPage = POC_TEMPLATE_ROW_COUNT;

  protected readonly ports = this.storage.ports;
  protected readonly portCallHistory = this.storage.portCallHistory;
  protected readonly portOfCall = this.storage.portOfCall;

  /** Type 2 Alger crew list is arrival-only. */
  protected readonly crewListType2Alger = computed(
    () => this.storage.documentOverlay().crewList.listType === 'type2Alger',
  );

  protected showPortOfCallSettings = signal(false);
  protected showCrewListSettings = signal(false);
  protected showPaxSettings = signal(false);
  protected showMdhSettings = signal(false);
  protected showShipStoresSettings = signal(false);

  protected openPassengerList(isArrival: boolean): void {
    this.storage.updatePaxArr({ isArrival }, 'silent');
    const passengers = isArrival
      ? this.storage.activePassengersArrival()
      : this.storage.activePassengersDeparture();
    void this.crewPdf.openPassengerPreview(this.appData(), passengers).then((ok) => {
      if (!ok) this.toast.showError('Allow pop-ups to open Passenger List preview');
    });
  }

  protected openCrewList(isArrival: boolean): void {
    const listType = this.storage.documentOverlay().crewList.listType;
    if (listType === 'type2Alger') {
      if (!isArrival) return;
      void this.openCrewListType2();
      return;
    }
    const identityDocumentType =
      listType === 'type1SeamansBook' ? CREW_IDENTITY_SEAMANS_BOOK : CREW_IDENTITY_PASSPORT;
    void this.openCrewListPdf(isArrival, identityDocumentType);
  }

  private async openCrewListType2(): Promise<void> {
    this.storage.updateCrewArr({ isArrival: true }, 'silent');
    const crew = this.storage.activeCrewArrival();
    const data: AppData = {
      ...this.appData(true),
      crewArr: { ...this.appData(true).crewArr, isArrival: true },
    };
    try {
      const ok = await this.crewListType2Pdf.openPreview(data, crew);
      if (!ok) {
        this.toast.showError('Allow pop-ups to open Crew List preview');
      }
    } catch (err) {
      this.toast.showError(err instanceof Error ? err.message : 'Crew list preview failed');
    }
  }

  private async openCrewListPdf(isArrival: boolean, identityDocumentType: string): Promise<void> {
    this.storage.updateCrewArr({ isArrival }, 'silent');
    const crew = isArrival ? this.storage.activeCrewArrival() : this.storage.activeCrewDeparture();
    const base = this.appData(isArrival);
    const pdfData: AppData = {
      ...base,
      crewArr: { ...base.crewArr, isArrival, identityDocumentType },
    };
    const { ship } = base;
    const voyageDate = isArrival ? ship.dateOfArrival : ship.dateOfDeparture;
    const ok = await this.crewPdf.openPreview(pdfData, crew, {
      fileName: crewListIdentityPdfFileName(
        ship.name,
        ship.portOfCall,
        voyageDate,
        isArrival,
        identityDocumentType,
      ),
    });
    if (!ok) {
      this.toast.showError('Allow pop-ups to open Crew List preview');
    }
  }

  protected openCrewListSettings(): void {
    this.showCrewListSettings.set(true);
  }

  protected closeCrewListSettings(): void {
    this.showCrewListSettings.set(false);
  }

  protected openPaxSettings(): void {
    this.showPaxSettings.set(true);
  }

  protected closePaxSettings(): void {
    this.showPaxSettings.set(false);
  }

  protected openMdhSettings(): void {
    this.showMdhSettings.set(true);
  }

  protected closeMdhSettings(): void {
    this.showMdhSettings.set(false);
  }

  protected openPortOfCallPdf(): void {
    void this.portOfCallPdf.openPreview(this.appData()).then((ok) => {
      if (!ok) this.toast.showError('Allow pop-ups to open Port of Call preview');
    });
  }

  protected openPortOfCallSettings(): void {
    this.showPortOfCallSettings.set(true);
  }

  protected closePortOfCallSettings(): void {
    this.showPortOfCallSettings.set(false);
  }

  protected onPdfPortCountChange(value: string | number): void {
    const n = typeof value === 'number' ? value : parseInt(String(value), 10);
    if (isNaN(n)) return;
    this.storage.updatePortOfCallSettings({ pdfRowCount: n });
  }

  protected addPortCallRow(): void {
    const todayInMonth = defaultIsoDateInCurrentMonth();
    this.storage.addPortCallEntry({
      arrivalDate: todayInMonth,
      departureDate: todayInMonth,
    });
  }

  protected removePortCallRow(id: string): void {
    this.storage.removePortCallEntry(id);
  }

  protected updatePortCallField(id: string, field: keyof PortCallHistoryEntry, value: string): void {
    this.storage.updatePortCallEntry(id, { [field]: value });
  }

  protected onPortCallPortChange(id: string, portName: string): void {
    const country = portCountry(portName, this.ports());
    this.storage.updatePortCallEntry(id, {
      portName,
      ...(country ? { country } : {}),
    });
  }

  protected openShipStores(): void {
    void this.shipStoresPdf.openPreview(this.appData()).then((ok) => {
      if (!ok) {
        this.toast.showError('Allow pop-ups to open Ship Stores preview');
      }
    }).catch((err) => {
      this.toast.showError(err instanceof Error ? err.message : 'Failed to open Ship Stores');
    });
  }

  protected openShipStoresSettings(): void {
    this.showShipStoresSettings.set(true);
  }

  protected closeShipStoresSettings(): void {
    this.showShipStoresSettings.set(false);
  }

  protected openMdh(): void {
    void this.mdhPdf.openPreview(this.appData()).then((ok) => {
      if (!ok) {
        this.toast.showError('Allow pop-ups to open MDH preview');
      }
    }).catch((err) => {
      this.toast.showError(err instanceof Error ? err.message : 'Failed to generate MDH');
    });
  }

  private appData(isArrival?: boolean): AppData {
    const crewArr = this.storage.crewArr();
    return {
      ship: this.storage.ship(),
      crew: this.storage.allCrew(),
      crewArr: isArrival === undefined ? crewArr : { ...crewArr, isArrival },
      passengers: this.storage.allPassengers(),
      paxArr: this.storage.paxArr(),
      ports: this.storage.ports(),
      ranks: this.storage.ranks(),
      nationalities: this.storage.nationalities(),
      portCallHistory: this.storage.portCallHistory(),
      portOfCall: this.storage.portOfCall(),
      shipStoresForm: this.storage.shipStoresForm(),
      documentOverlay: this.storage.documentOverlay(),
      shipAssets: this.storage.shipAssets(),
    };
  }
}
