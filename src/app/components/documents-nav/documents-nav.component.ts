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
import { PdfCrewEffectService } from '../../services/pdf-crew-effect.service';
import { PdfNilListService } from '../../services/pdf-nil-list.service';
import { PdfShipMoneyService } from '../../services/pdf-ship-money.service';
import { PdfCashAdvanceService } from '../../services/pdf-cash-advance.service';
import { PdfCrewMoneyListService } from '../../services/pdf-crew-money-list.service';
import { PdfNarcoticListService } from '../../services/pdf-narcotic-list.service';
import { PdfSso0108PortCallsService } from '../../services/pdf-sso0108-port-calls.service';
import { PdfShipStoresService } from '../../services/pdf-ship-stores.service';
import { POC_MAX_ROW_COUNT, POC_MIN_ROW_COUNT, POC_TEMPLATE_ROW_COUNT } from '../../services/port-of-call-coordinates';
import { StorageService } from '../../services/storage.service';
import { ToastService } from '../../services/toast.service';
import { DocumentStampOptionsComponent } from '../document-stamp-options/document-stamp-options.component';
import { CrewListSettingsComponent } from '../crew-list-settings/crew-list-settings.component';
import { CrewEffectSettingsComponent } from '../crew-effect-settings/crew-effect-settings.component';
import { NilListSettingsComponent } from '../nil-list-settings/nil-list-settings.component';
import { ShipMoneySettingsComponent } from '../ship-money-settings/ship-money-settings.component';
import { CashAdvanceSettingsComponent } from '../cash-advance-settings/cash-advance-settings.component';
import { CrewMoneyListSettingsComponent } from '../crew-money-list-settings/crew-money-list-settings.component';
import { NarcoticListSettingsComponent } from '../narcotic-list-settings/narcotic-list-settings.component';
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
    CrewEffectSettingsComponent,
    NilListSettingsComponent,
    ShipMoneySettingsComponent,
    CashAdvanceSettingsComponent,
    CrewMoneyListSettingsComponent,
    NarcoticListSettingsComponent,
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
  private readonly crewEffectPdf = inject(PdfCrewEffectService);
  private readonly nilListPdf = inject(PdfNilListService);
  private readonly shipMoneyPdf = inject(PdfShipMoneyService);
  private readonly cashAdvancePdf = inject(PdfCashAdvanceService);
  private readonly crewMoneyListPdf = inject(PdfCrewMoneyListService);
  private readonly narcoticListPdf = inject(PdfNarcoticListService);
  private readonly sso0108PortCallsPdf = inject(PdfSso0108PortCallsService);
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
  /** Which port document the unified Port Settings modal is editing. */
  protected portSettingsDoc = signal<'portOfCall' | 'sso0108'>('portOfCall');
  protected showCrewListSettings = signal(false);
  protected showPaxSettings = signal(false);
  protected showMdhSettings = signal(false);
  protected showShipStoresSettings = signal(false);
  protected showCrewEffectSettings = signal(false);
  protected showNilListSettings = signal(false);
  protected showShipMoneySettings = signal(false);
  protected showCashAdvanceSettings = signal(false);
  protected showCrewMoneyListSettings = signal(false);
  protected showNarcoticListSettings = signal(false);

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
    this.storage.finishFormSession();
  }

  protected openPaxSettings(): void {
    this.showPaxSettings.set(true);
  }

  protected closePaxSettings(): void {
    this.showPaxSettings.set(false);
    this.storage.finishFormSession();
  }

  protected openMdhSettings(): void {
    this.showMdhSettings.set(true);
  }

  protected closeMdhSettings(): void {
    this.showMdhSettings.set(false);
    this.storage.finishFormSession();
  }

  protected openPortOfCallPdf(): void {
    void this.portOfCallPdf.openPreview(this.appData()).then((ok) => {
      if (!ok) this.toast.showError('Allow pop-ups to open Port of Call preview');
    });
  }

  protected openSso0108PortCallsPdf(): void {
    void this.sso0108PortCallsPdf.openPreview(this.appData()).then((ok) => {
      if (!ok) this.toast.showError('Allow pop-ups to open SSO-0108 Port Calls preview');
    }).catch((err) => {
      this.toast.showError(err instanceof Error ? err.message : 'Failed to open SSO-0108 Port Calls');
    });
  }

  protected openPortOfCallSettings(): void {
    this.showPortOfCallSettings.set(true);
  }

  protected closePortOfCallSettings(): void {
    this.showPortOfCallSettings.set(false);
    this.storage.finishFormSession();
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
    this.storage.updatePortCallEntry(
      id,
      {
        portName,
        ...(country ? { country } : {}),
      },
      'saved',
    );
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
    this.storage.finishFormSession();
  }

  protected openCrewEffect(): void {
    void this.crewEffectPdf.openPreview(this.appData()).then((ok) => {
      if (!ok) {
        this.toast.showError('Allow pop-ups to open Crew Effect preview');
      }
    }).catch((err) => {
      this.toast.showError(err instanceof Error ? err.message : 'Failed to open Crew Effect');
    });
  }

  protected openCrewEffectSettings(): void {
    this.showCrewEffectSettings.set(true);
  }

  protected closeCrewEffectSettings(): void {
    this.showCrewEffectSettings.set(false);
    this.storage.finishFormSession();
  }

  protected openNilList(): void {
    void this.nilListPdf.openPreview(this.appData()).then((ok) => {
      if (!ok) {
        this.toast.showError('Allow pop-ups to open NIL List preview');
      }
    }).catch((err) => {
      this.toast.showError(err instanceof Error ? err.message : 'Failed to open NIL List');
    });
  }

  protected openNilListSettings(): void {
    this.showNilListSettings.set(true);
  }

  protected closeNilListSettings(): void {
    this.showNilListSettings.set(false);
    this.storage.finishFormSession();
  }

  protected openShipMoney(): void {
    void this.shipMoneyPdf.openPreview(this.appData()).then((ok) => {
      if (!ok) {
        this.toast.showError('Allow pop-ups to open Ship Money preview');
      }
    }).catch((err) => {
      this.toast.showError(err instanceof Error ? err.message : 'Failed to open Ship Money');
    });
  }

  protected openShipMoneySettings(): void {
    this.showShipMoneySettings.set(true);
  }

  protected closeShipMoneySettings(): void {
    this.showShipMoneySettings.set(false);
    this.storage.finishFormSession();
  }

  protected openCashAdvance(): void {
    void this.cashAdvancePdf.openPreview(this.appData()).then((ok) => {
      if (!ok) this.toast.showError('Allow pop-ups to open Cash Advance preview');
    }).catch((err) => {
      this.toast.showError(err instanceof Error ? err.message : 'Failed to open Cash Advance');
    });
  }

  protected openCashAdvanceSettings(): void {
    this.showCashAdvanceSettings.set(true);
  }

  protected closeCashAdvanceSettings(): void {
    this.showCashAdvanceSettings.set(false);
    this.storage.finishFormSession();
  }

  protected openCrewMoneyList(): void {
    void this.crewMoneyListPdf.openPreview(this.appData()).then((ok) => {
      if (!ok) this.toast.showError('Allow pop-ups to open Crew Money preview');
    }).catch((err) => {
      this.toast.showError(err instanceof Error ? err.message : 'Failed to open Crew Money');
    });
  }

  protected openCrewMoneyListSettings(): void {
    this.showCrewMoneyListSettings.set(true);
  }

  protected closeCrewMoneyListSettings(): void {
    this.showCrewMoneyListSettings.set(false);
    this.storage.finishFormSession();
  }

  protected openNarcoticList(): void {
    void this.narcoticListPdf.openPreview(this.appData()).then((ok) => {
      if (!ok) this.toast.showError('Allow pop-ups to open Narcotic List preview');
    }).catch((err) => {
      this.toast.showError(err instanceof Error ? err.message : 'Failed to open Narcotic List');
    });
  }

  protected openNarcoticListSettings(): void {
    this.showNarcoticListSettings.set(true);
  }

  protected closeNarcoticListSettings(): void {
    this.showNarcoticListSettings.set(false);
    this.storage.finishFormSession();
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
      crewEffectForm: this.storage.crewEffectForm(),
      nilListForm: this.storage.nilListForm(),
      shipMoneyForm: this.storage.shipMoneyForm(),
      cashAdvanceForm: this.storage.cashAdvanceForm(),
      crewMoneyListForm: this.storage.crewMoneyListForm(),
      narcoticListForm: this.storage.narcoticListForm(),
      documentOverlay: this.storage.documentOverlay(),
      shipAssets: this.storage.shipAssets(),
    };
  }
}
