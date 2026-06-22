import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AppData,
  CREW_IDENTITY_PASSPORT,
  CREW_IDENTITY_SEAMANS_BOOK,
  PortCallHistoryEntry,
  PORT_SEC_LVL_OPTIONS,
  PORT_SETTINGS_DOC_IDS,
  PORT_SETTINGS_DOC_LABELS,
  PortSettingsDocId,
  CREW_EFFECT_DOC_IDS,
  CREW_EFFECT_DOC_LABELS,
  CrewEffectDocId,
  SHIP_STORES_DOC_IDS,
  SHIP_STORES_DOC_LABELS,
  ShipStoresDocId,
  portCountry,
} from '../../models/crew.models';
import { crewListIdentityPdfFileName } from '../../utils/pdf-filename.util';
import { PartialDateInputComponent } from '../partial-date-input/partial-date-input.component';
import { PortSelectComponent } from '../port-select/port-select.component';
import { TimeInputComponent } from '../time-input/time-input.component';
import { defaultIsoDateInCurrentMonth } from '../../utils/partial-date.util';
import { PdfCrewArrService } from '../../services/pdf-crew-arr.service';
import { PdfCrewListType2Service } from '../../services/pdf-crew-list-type2.service';
import { PdfCrewListV2Service } from '../../services/pdf-crew-list-v2.service';
import { PdfCrewListV3SbkService } from '../../services/pdf-crew-list-v3-sbk.service';
import { PdfCrewListV3SbkPService } from '../../services/pdf-crew-list-v3-sbk-p.service';
import { PdfCrewListV3SbkP2Service } from '../../services/pdf-crew-list-v3-sbk-p2.service';
import { PdfMdhService } from '../../services/pdf-mdh.service';
import { PdfPassengerListV2Service } from '../../services/pdf-passenger-list-v2.service';
import { PdfPortOfCallService } from '../../services/pdf-port-of-call.service';
import { PdfPortOfCallTemplateService } from '../../services/pdf-port-of-call-template.service';
import { PdfCrewEffect02Service } from '../../services/pdf-crew-effect-02.service';
import { PdfCrewEffect03Service } from '../../services/pdf-crew-effect-03.service';
import { PdfCrewEffectService } from '../../services/pdf-crew-effect.service';
import { PdfNilListService } from '../../services/pdf-nil-list.service';
import { PdfShipMoneyService } from '../../services/pdf-ship-money.service';
import { PdfCashAdvanceService } from '../../services/pdf-cash-advance.service';
import { PdfCrewMoneyListService } from '../../services/pdf-crew-money-list.service';
import { PdfNarcoticListService } from '../../services/pdf-narcotic-list.service';
import { PdfSso0108PortCallsService } from '../../services/pdf-sso0108-port-calls.service';
import { PdfCrewVaccineService } from '../../services/pdf-crew-vaccine.service';
import { PdfShipStoresService } from '../../services/pdf-ship-stores.service';
import { PdfShipStores02Service } from '../../services/pdf-ship-stores-02.service';
import { PdfShipStores03Service } from '../../services/pdf-ship-stores-03.service';
import { CrewListExcelService } from '../../services/crew-list-excel.service';
import { PortOfCallExcelService } from '../../services/port-of-call-excel.service';
import {
  POC_MAX_ROW_COUNT,
  POC_MIN_ROW_COUNT,
  POC_TEMPLATE_ROW_COUNT,
} from '../../services/port-of-call-coordinates';
import { StorageService } from '../../services/storage.service';
import { FormsStore } from '../../services/forms.store';
import { ToastService } from '../../services/toast.service';
import { ClickOutsideDirective } from '../../directives/click-outside.directive';
import { DocumentStampOptionsComponent } from '../document-stamp-options/document-stamp-options.component';
import { PassengerListSettingsComponent } from '../passenger-list-settings/passenger-list-settings.component';
import { CrewListSettingsComponent } from '../crew-list-settings/crew-list-settings.component';
import { PortOfCallSettingsComponent } from '../port-of-call-settings/port-of-call-settings.component';
import { XlsExportButtonComponent } from '../xls-export-button/xls-export-button.component';
import { CrewEffectSettingsComponent } from '../crew-effect-settings/crew-effect-settings.component';
import { NilListSettingsComponent } from '../nil-list-settings/nil-list-settings.component';
import { ShipMoneySettingsComponent } from '../ship-money-settings/ship-money-settings.component';
import { CashAdvanceSettingsComponent } from '../cash-advance-settings/cash-advance-settings.component';
import { CrewMoneyListSettingsComponent } from '../crew-money-list-settings/crew-money-list-settings.component';
import { NarcoticListSettingsComponent } from '../narcotic-list-settings/narcotic-list-settings.component';
import { ShipStoresSettingsComponent } from '../ship-stores-settings/ship-stores-settings.component';
import { NumberSpinDirective } from '../../directives/number-spin.directive';

const MONEY_DOC_IDS = ['shipMoney', 'cashAdvance', 'crewMoney'] as const;
type MoneyDocId = (typeof MONEY_DOC_IDS)[number];

@Component({
  selector: 'app-documents-nav',
  imports: [
    FormsModule,
    PortSelectComponent,
    PartialDateInputComponent,
    TimeInputComponent,
    DocumentStampOptionsComponent,
    PassengerListSettingsComponent,
    CrewListSettingsComponent,
    PortOfCallSettingsComponent,
    XlsExportButtonComponent,
    ShipStoresSettingsComponent,
    CrewEffectSettingsComponent,
    NilListSettingsComponent,
    ShipMoneySettingsComponent,
    CashAdvanceSettingsComponent,
    CrewMoneyListSettingsComponent,
    NarcoticListSettingsComponent,
    ClickOutsideDirective,
    NumberSpinDirective,
  ],
  templateUrl: './documents-nav.component.html',
  styleUrl: './documents-nav.component.css',
})
export class DocumentsNavComponent {
  private readonly storage = inject(StorageService);
  private readonly forms = inject(FormsStore);
  private readonly crewPdf = inject(PdfCrewArrService);
  private readonly passengerListV2Pdf = inject(PdfPassengerListV2Service);
  private readonly crewListType2Pdf = inject(PdfCrewListType2Service);
  private readonly crewListV2Pdf = inject(PdfCrewListV2Service);
  private readonly crewListV3SbkPdf = inject(PdfCrewListV3SbkService);
  private readonly crewListV3SbkPPdf = inject(PdfCrewListV3SbkPService);
  private readonly crewListV3SbkP2Pdf = inject(PdfCrewListV3SbkP2Service);
  private readonly mdhPdf = inject(PdfMdhService);
  private readonly crewVaccinePdf = inject(PdfCrewVaccineService);
  private readonly portOfCallPdf = inject(PdfPortOfCallService);
  private readonly portOfCallTemplatePdf = inject(PdfPortOfCallTemplateService);
  private readonly shipStoresPdf = inject(PdfShipStoresService);
  private readonly shipStores02Pdf = inject(PdfShipStores02Service);
  private readonly shipStores03Pdf = inject(PdfShipStores03Service);
  private readonly crewEffectPdf = inject(PdfCrewEffectService);
  private readonly crewEffect02Pdf = inject(PdfCrewEffect02Service);
  private readonly crewEffect03Pdf = inject(PdfCrewEffect03Service);
  private readonly nilListPdf = inject(PdfNilListService);
  private readonly shipMoneyPdf = inject(PdfShipMoneyService);
  private readonly cashAdvancePdf = inject(PdfCashAdvanceService);
  private readonly crewMoneyListPdf = inject(PdfCrewMoneyListService);
  private readonly narcoticListPdf = inject(PdfNarcoticListService);
  private readonly sso0108PortCallsPdf = inject(PdfSso0108PortCallsService);
  private readonly portOfCallExcel = inject(PortOfCallExcelService);
  private readonly crewListExcel = inject(CrewListExcelService);
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

  protected readonly crewListXlsVisible = computed(() => true);

  protected showPortOfCallSettings = signal(false);
  /** Which port document the unified Port Settings modal is editing. */
  protected readonly portSettingsDocIds = PORT_SETTINGS_DOC_IDS;
  protected readonly portSecLvlOptions = PORT_SEC_LVL_OPTIONS;
  protected portSettingsDoc = signal<PortSettingsDocId>('portOfCall');
  protected showCrewListSettings = signal(false);
  protected showPaxSettings = signal(false);
  protected showMdhSettings = signal(false);
  /** Which MDH document the unified MDH Settings modal is editing. */
  protected mdhSettingsDoc = signal<'mdh' | 'crewVaccine'>('mdh');
  protected showShipStoresSettings = signal(false);
  protected readonly shipStoresDocIds = SHIP_STORES_DOC_IDS;
  protected shipStoresSettingsDoc = signal<ShipStoresDocId>('shipStores');
  protected showCrewEffectSettings = signal(false);
  protected readonly crewEffectDocIds = CREW_EFFECT_DOC_IDS;
  protected crewEffectSettingsDoc = signal<CrewEffectDocId>('crewEffect');
  protected showNilListSettings = signal(false);
  protected showMoneySettings = signal(false);
  protected readonly moneyDocIds = MONEY_DOC_IDS;
  protected moneySettingsDoc = signal<MoneyDocId>('shipMoney');
  protected showNarcoticListSettings = signal(false);

  protected openPassengerList(isArrival: boolean): void {
    this.storage.updatePaxArr({ isArrival }, 'silent');
    const passengers = isArrival
      ? this.storage.activePassengersArrival()
      : this.storage.activePassengersDeparture();
    const listType = this.storage.paxArr().listType;
    if (listType === 'paxV2') {
      void this.passengerListV2Pdf.openPreview(this.appData(), passengers).then((ok) => {
        if (!ok) this.toast.showError('Allow pop-ups to open Passenger List v2 preview');
      });
      return;
    }
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
    if (listType === 'type3V2') {
      void this.openCrewListV2(isArrival);
      return;
    }
    if (listType === 'type4V3Sbk') {
      void this.openCrewListV3Sbk(isArrival);
      return;
    }
    if (listType === 'type5V3SbkP') {
      void this.openCrewListV3SbkP(isArrival);
      return;
    }
    if (listType === 'type6V3SbkP2') {
      void this.openCrewListV3SbkP2(isArrival);
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

  private async openCrewListV2(isArrival: boolean): Promise<void> {
    await this.openCrewListTemplatePdf(isArrival, this.crewListV2Pdf);
  }

  private async openCrewListV3Sbk(isArrival: boolean): Promise<void> {
    await this.openCrewListTemplatePdf(isArrival, this.crewListV3SbkPdf);
  }

  private async openCrewListV3SbkP(isArrival: boolean): Promise<void> {
    await this.openCrewListTemplatePdf(isArrival, this.crewListV3SbkPPdf);
  }

  private async openCrewListV3SbkP2(isArrival: boolean): Promise<void> {
    await this.openCrewListTemplatePdf(isArrival, this.crewListV3SbkP2Pdf);
  }

  private async openCrewListTemplatePdf(
    isArrival: boolean,
    pdf:
      | PdfCrewListV2Service
      | PdfCrewListV3SbkService
      | PdfCrewListV3SbkPService
      | PdfCrewListV3SbkP2Service,
  ): Promise<void> {
    this.storage.updateCrewArr({ isArrival }, 'silent');
    const crew = isArrival ? this.storage.activeCrewArrival() : this.storage.activeCrewDeparture();
    const data: AppData = {
      ...this.appData(isArrival),
      crewArr: { ...this.appData(isArrival).crewArr, isArrival },
    };
    try {
      const ok = await pdf.openPreview(data, crew);
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

  protected onMdhSettingsDocChange(value: 'mdh' | 'crewVaccine'): void {
    if (value === this.mdhSettingsDoc()) return;
    this.mdhSettingsDoc.set(value);
    this.toast.showSelected(value === 'mdh' ? 'Maritime Declaration of Health' : 'Crew Vaccine');
  }

  protected openPortOfCallPdf(): void {
    void this.portOfCallPdf.openPreview(this.appData()).then((ok) => {
      if (!ok) this.toast.showError('Allow pop-ups to open Port of Call preview');
    });
  }

  protected openPortsOfCallPdf(): void {
    void this.portOfCallTemplatePdf
      .openPreview(this.appData())
      .then((ok) => {
        if (!ok) this.toast.showError('Allow pop-ups to open Port of Call - Security preview');
      })
      .catch((err) => {
        this.toast.showError(
          err instanceof Error ? err.message : 'Port of Call - Security preview failed',
        );
      });
  }

  protected openSso0108PortCallsPdf(): void {
    void this.sso0108PortCallsPdf
      .openPreview(this.appData())
      .then((ok) => {
        if (!ok) this.toast.showError('Allow pop-ups to open Port of Call - SSO-0108 preview');
      })
      .catch((err) => {
        this.toast.showError(
          err instanceof Error ? err.message : 'Failed to open Port of Call - SSO-0108',
        );
      });
  }

  protected openPortOfCallSettings(): void {
    this.showPortOfCallSettings.set(true);
  }

  protected closePortOfCallSettings(): void {
    this.showPortOfCallSettings.set(false);
    this.storage.finishFormSession();
  }

  protected portSettingsDocLabel(id: PortSettingsDocId): string {
    return PORT_SETTINGS_DOC_LABELS[id];
  }

  protected onPortSettingsDocChange(value: PortSettingsDocId): void {
    if (value === this.portSettingsDoc()) return;
    this.portSettingsDoc.set(value);
    this.toast.showSelected(PORT_SETTINGS_DOC_LABELS[value]);
  }

  protected onPdfPortCountChange(value: string | number): void {
    const n = typeof value === 'number' ? value : parseInt(String(value), 10);
    if (isNaN(n)) return;
    this.forms.updatePortOfCallSettings({ pdfRowCount: n });
  }

  protected addPortCallRow(): void {
    const todayInMonth = defaultIsoDateInCurrentMonth();
    this.forms.addPortCallEntry({
      arrivalDate: todayInMonth,
      departureDate: todayInMonth,
    });
  }

  protected exportPortOfCallXls(): void {
    void this.portOfCallExcel.openForDoc(this.portSettingsDoc()).then((ok) => {
      if (!ok) {
        this.toast.showError('Could not open Excel file');
      }
    });
  }

  protected exportCrewListXls(): void {
    const listType = this.storage.documentOverlay().crewList.listType;
    void this.crewListExcel.openForListType(listType).then((ok) => {
      if (!ok) {
        this.toast.showError('Could not open Excel file');
      }
    });
  }

  protected removePortCallRow(id: string): void {
    this.forms.removePortCallEntry(id);
  }

  protected updatePortCallField(
    id: string,
    field: keyof PortCallHistoryEntry,
    value: string,
  ): void {
    this.forms.updatePortCallEntry(id, { [field]: value });
  }

  protected onPortCallPortChange(id: string, portName: string): void {
    const country = portCountry(portName, this.ports());
    this.forms.updatePortCallEntry(
      id,
      {
        portName,
        ...(country ? { country } : {}),
      },
      'saved',
    );
  }

  protected shipStoresDocLabel(id: ShipStoresDocId): string {
    return SHIP_STORES_DOC_LABELS[id];
  }

  protected onShipStoresSettingsDocChange(value: ShipStoresDocId): void {
    if (value === this.shipStoresSettingsDoc()) return;
    this.shipStoresSettingsDoc.set(value);
    this.toast.showSelected(SHIP_STORES_DOC_LABELS[value]);
  }

  protected openShipStores(): void {
    void this.shipStoresPdf
      .openPreview(this.appData())
      .then((ok) => {
        if (!ok) {
          this.toast.showError('Allow pop-ups to open Ship Stores preview');
        }
      })
      .catch((err) => {
        this.toast.showError(err instanceof Error ? err.message : 'Failed to open Ship Stores');
      });
  }

  protected openShipStores02(): void {
    void this.shipStores02Pdf
      .openPreview(this.appData())
      .then((ok) => {
        if (!ok) {
          this.toast.showError('Allow pop-ups to open Ship Stores preview');
        }
      })
      .catch((err) => {
        this.toast.showError(err instanceof Error ? err.message : 'Failed to open Ship Stores');
      });
  }

  protected openShipStores03(): void {
    void this.shipStores03Pdf
      .openPreview(this.appData())
      .then((ok) => {
        if (!ok) {
          this.toast.showError('Allow pop-ups to open Ship Stores preview');
        }
      })
      .catch((err) => {
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

  protected crewEffectDocLabel(id: CrewEffectDocId): string {
    return CREW_EFFECT_DOC_LABELS[id];
  }

  protected onCrewEffectSettingsDocChange(value: CrewEffectDocId): void {
    if (value === this.crewEffectSettingsDoc()) return;
    this.crewEffectSettingsDoc.set(value);
    this.toast.showSelected(CREW_EFFECT_DOC_LABELS[value]);
  }

  protected openCrewEffect(): void {
    void this.crewEffectPdf
      .openPreview(this.appData())
      .then((ok) => {
        if (!ok) {
          this.toast.showError('Allow pop-ups to open Crew Effect preview');
        }
      })
      .catch((err) => {
        this.toast.showError(err instanceof Error ? err.message : 'Failed to open Crew Effect');
      });
  }

  protected openCrewEffect02(): void {
    void this.crewEffect02Pdf
      .openPreview(this.appData())
      .then((ok) => {
        if (!ok) {
          this.toast.showError('Allow pop-ups to open Crew Effect preview');
        }
      })
      .catch((err) => {
        this.toast.showError(err instanceof Error ? err.message : 'Failed to open Crew Effect');
      });
  }

  protected openCrewEffect03(): void {
    void this.crewEffect03Pdf
      .openPreview(this.appData())
      .then((ok) => {
        if (!ok) {
          this.toast.showError('Allow pop-ups to open Crew Effect preview');
        }
      })
      .catch((err) => {
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
    void this.nilListPdf
      .openPreview(this.appData())
      .then((ok) => {
        if (!ok) {
          this.toast.showError('Allow pop-ups to open NIL List preview');
        }
      })
      .catch((err) => {
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

  protected openMoneySettings(): void {
    this.showMoneySettings.set(true);
  }

  protected closeMoneySettings(): void {
    this.showMoneySettings.set(false);
    this.storage.finishFormSession();
  }

  protected moneyDocLabel(id: MoneyDocId): string {
    const labels: Record<MoneyDocId, string> = {
      shipMoney: 'Ship Money',
      cashAdvance: 'Cash Advance',
      crewMoney: 'Crew Money',
    };
    return labels[id];
  }

  protected onMoneySettingsDocChange(value: MoneyDocId): void {
    if (value === this.moneySettingsDoc()) return;
    this.moneySettingsDoc.set(value);
    this.toast.showSelected(this.moneyDocLabel(value));
  }

  protected openShipMoney(): void {
    void this.shipMoneyPdf
      .openPreview(this.appData())
      .then((ok) => {
        if (!ok) {
          this.toast.showError('Allow pop-ups to open Ship Money preview');
        }
      })
      .catch((err) => {
        this.toast.showError(err instanceof Error ? err.message : 'Failed to open Ship Money');
      });
  }

  protected openCashAdvance(): void {
    void this.cashAdvancePdf
      .openPreview(this.appData())
      .then((ok) => {
        if (!ok) this.toast.showError('Allow pop-ups to open Cash Advance preview');
      })
      .catch((err) => {
        this.toast.showError(err instanceof Error ? err.message : 'Failed to open Cash Advance');
      });
  }

  protected openCrewMoneyList(): void {
    void this.crewMoneyListPdf
      .openPreview(this.appData())
      .then((ok) => {
        if (!ok) this.toast.showError('Allow pop-ups to open Crew Money preview');
      })
      .catch((err) => {
        this.toast.showError(err instanceof Error ? err.message : 'Failed to open Crew Money');
      });
  }

  protected openNarcoticList(): void {
    void this.narcoticListPdf
      .openPreview(this.appData())
      .then((ok) => {
        if (!ok) this.toast.showError('Allow pop-ups to open Narcotic List preview');
      })
      .catch((err) => {
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
    void this.mdhPdf
      .openPreview(this.appData())
      .then((ok) => {
        if (!ok) {
          this.toast.showError('Allow pop-ups to open MDH preview');
        }
      })
      .catch((err) => {
        this.toast.showError(err instanceof Error ? err.message : 'Failed to generate MDH');
      });
  }

  protected openCrewVaccine(): void {
    void this.crewVaccinePdf
      .openPreview(this.appData())
      .then((ok) => {
        if (!ok) {
          this.toast.showError('Allow pop-ups to open Crew Vaccine preview');
        }
      })
      .catch((err) => {
        this.toast.showError(err instanceof Error ? err.message : 'Failed to open Crew Vaccine');
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
      shipStoresForm02: this.storage.shipStoresForm02(),
      shipStoresForm03: this.storage.shipStoresForm03(),
      crewEffectForm: this.storage.crewEffectForm(),
      crewEffectForm02: this.storage.crewEffectForm02(),
      crewEffectForm03: this.storage.crewEffectForm03(),
      nilListForm: this.storage.nilListForm(),
      shipMoneyForm: this.storage.shipMoneyForm(),
      cashAdvanceForm: this.storage.cashAdvanceForm(),
      crewMoneyListForm: this.storage.crewMoneyListForm(),
      narcoticListForm: this.storage.narcoticListForm(),
      dgLibrary: this.storage.dgLibrary(),
      reeferLibrary: this.storage.reeferLibrary(),
      documentOverlay: this.storage.documentOverlay(),
      shipAssets: this.storage.shipAssets(),
      outputSettings: this.storage.outputSettings(),
      printPackages: this.storage.printPackages(),
      customDocuments: this.storage.customDocuments(),
    };
  }
}
