import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AppData,
  CREW_IDENTITY_PASSPORT,
  CREW_IDENTITY_SEAMANS_BOOK,
  PortCallHistoryEntry,
  PORT_SEC_LVL_OPTIONS,
  PORT_SETTINGS_DOC_IDS,
  PORT_SETTINGS_DOC_LABELS,
  PORT_SETTINGS_DOC_PARAM,
  PortSettingsDocId,
  SHIP_STORES_SETTINGS_DOC_PARAM,
  CREW_EFFECT_DOC_IDS,
  CREW_EFFECT_DOC_LABELS,
  CrewEffectDocId,
  SHIP_STORES_DOC_IDS,
  SHIP_STORES_DOC_LABELS,
  ShipStoresDocId,
  portCountry,
} from '../../models/crew.models';
import {
  crewListIdentityPdfFileName,
} from '../../utils/pdf-filename.util';
import {
  CREW_FORM_01,
  CREW_FORM_02,
  CREW_FORM_03,
  CREW_FORM_04,
  CREW_FORM_05,
  CREW_FORM_06,
  CREW_FORM_07,
  CREW_LIST_TYPE_IDS,
  CREW_LIST_TYPE_LABELS,
  CrewListTypeId,
} from '../../models/document-overlay.models';
import { CREW_LIST_FORM_01_FEEDBACK_PARAM } from '../../models/crew-list-form-01.paths';
import { PASSENGER_LIST_FORM_01_FEEDBACK_PARAM } from '../../models/passenger-list-form-01.paths';
import { PASSENGER_LIST_FORM_02_FEEDBACK_PARAM } from '../../models/passenger-list-form-02.paths';
import { PAX_LIST_TYPE_IDS, PAX_LIST_TYPE_LABELS, PaxListTypeId } from '../../models/passenger.models';
import { CREW_LIST_FORM_02_FEEDBACK_PARAM } from '../../models/crew-list-form-02.paths';
import { CREW_LIST_FORM_03_FEEDBACK_PARAM } from '../../models/crew-list-form-03.paths';
import { CREW_LIST_FORM_04_FEEDBACK_PARAM } from '../../models/crew-list-form-04.paths';
import { CREW_LIST_FORM_05_FEEDBACK_PARAM } from '../../models/crew-list-form-05.paths';
import { CREW_LIST_FORM_06_FEEDBACK_PARAM } from '../../models/crew-list-form-06.paths';
import { CREW_LIST_FORM_07_FEEDBACK_PARAM } from '../../models/crew-list-form-07.paths';
import {
  PORT_OF_CALL_FORM_01_FEEDBACK_PARAM,
  PORT_OF_CALL_SETTINGS_PARAM,
} from '../../models/port-of-call-form-01.paths';
import { PORT_OF_CALL_FORM_02_FEEDBACK_PARAM } from '../../models/port-of-call-form-02.paths';
import {
  SHIP_STORES_FORM_01_FEEDBACK_PARAM,
  SHIP_STORES_SETTINGS_PARAM,
} from '../../models/ship-stores-form-01.paths';
import { SHIP_STORES_FORM_02_FEEDBACK_PARAM } from '../../models/ship-stores-form-02.paths';
import {
  CREW_EFFECT_FORM_01_FEEDBACK_PARAM,
  CREW_EFFECT_SETTINGS_PARAM,
} from '../../models/crew-effect-form-01.paths';
import { CREW_EFFECT_FORM_02_FEEDBACK_PARAM } from '../../models/crew-effect-form-02.paths';
import { PartialDateInputComponent } from '../partial-date-input/partial-date-input.component';
import { PortSelectComponent } from '../port-select/port-select.component';
import { TimeInputComponent } from '../time-input/time-input.component';
import { defaultIsoDateInCurrentMonth } from '../../utils/partial-date.util';
import { PdfCrewArrService } from '../../services/pdf-crew-arr.service';
import { PdfCrewListForm01Service } from '../../services/pdf-crew-list-form01.service';
import { PdfCrewListForm02Service } from '../../services/pdf-crew-list-form02.service';
import { PdfCrewListForm03Service } from '../../services/pdf-crew-list-form03.service';
import { PdfCrewListForm04Service } from '../../services/pdf-crew-list-form04.service';
import { PdfCrewListForm05Service } from '../../services/pdf-crew-list-form05.service';
import { PdfCrewListForm06Service } from '../../services/pdf-crew-list-form06.service';
import { PdfCrewListForm07Service } from '../../services/pdf-crew-list-form07.service';
import { PdfMdhService } from '../../services/pdf-mdh.service';
import { PdfPassengerListForm01Service } from '../../services/pdf-passenger-list-form01.service';
import { PdfPassengerListForm02Service } from '../../services/pdf-passenger-list-form02.service';
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
import { PortOfCallExcelService } from '../../services/port-of-call-excel.service';
import {
  POC_MAX_ROW_COUNT,
  POC_MIN_ROW_COUNT,
  POC_TEMPLATE_ROW_COUNT,
} from '../../services/port-of-call-coordinates';
import { CrewListHtmlFormExcelService } from '../../services/crew-list-html-form-excel.service';
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
import {
  NIL_LIST_FORM_FEEDBACK_PARAM,
  NIL_LIST_SETTINGS_PARAM,
} from '../../models/nil-list-form.paths';
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
export class DocumentsNavComponent implements OnInit {
  private readonly storage = inject(StorageService);
  private readonly htmlFormExcel = inject(CrewListHtmlFormExcelService);
  private readonly forms = inject(FormsStore);
  private readonly crewPdf = inject(PdfCrewArrService);
  private readonly passengerListForm01Pdf = inject(PdfPassengerListForm01Service);
  private readonly passengerListForm02Pdf = inject(PdfPassengerListForm02Service);
  private readonly crewListForm01Pdf = inject(PdfCrewListForm01Service);
  private readonly crewListForm02Pdf = inject(PdfCrewListForm02Service);
  private readonly crewListForm03Pdf = inject(PdfCrewListForm03Service);
  private readonly crewListForm04Pdf = inject(PdfCrewListForm04Service);
  private readonly crewListForm05Pdf = inject(PdfCrewListForm05Service);
  private readonly crewListForm06Pdf = inject(PdfCrewListForm06Service);
  private readonly crewListForm07Pdf = inject(PdfCrewListForm07Service);
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
  private readonly toast = inject(ToastService);

  protected readonly pocMinPorts = POC_MIN_ROW_COUNT;
  protected readonly pocMaxPorts = POC_MAX_ROW_COUNT;
  protected readonly pocRowsPerPage = POC_TEMPLATE_ROW_COUNT;

  protected readonly ports = this.storage.ports;
  protected readonly portCallHistory = this.storage.portCallHistory;
  protected readonly portOfCall = this.storage.portOfCall;

  protected showPortOfCallSettings = signal(false);
  /** Which port document the unified Port Settings modal is editing. */
  protected readonly portSettingsDocIds = PORT_SETTINGS_DOC_IDS;
  protected readonly portSecLvlOptions = PORT_SEC_LVL_OPTIONS;
  protected showCrewListSettings = signal(false);
  protected readonly crewListDocIds = CREW_LIST_TYPE_IDS;
  protected showPaxSettings = signal(false);
  protected readonly paxListDocIds = PAX_LIST_TYPE_IDS;
  protected showMdhSettings = signal(false);
  /** Which MDH document the unified MDH Settings modal is editing. */
  protected mdhSettingsDoc = signal<'mdh' | 'crewVaccine'>('mdh');
  protected showShipStoresSettings = signal(false);
  protected readonly shipStoresDocIds = SHIP_STORES_DOC_IDS;
  protected showCrewEffectSettings = signal(false);
  protected readonly crewEffectDocIds = CREW_EFFECT_DOC_IDS;
  protected crewEffectSettingsDoc = signal<CrewEffectDocId>('crewEffect');
  protected showNilListSettings = signal(false);
  protected showMoneySettings = signal(false);
  protected readonly moneyDocIds = MONEY_DOC_IDS;
  protected moneySettingsDoc = signal<MoneyDocId>('shipMoney');
  protected showNarcoticListSettings = signal(false);

  protected paxListDocLabel(id: PaxListTypeId): string {
    return PAX_LIST_TYPE_LABELS[id];
  }

  protected openPassengerListFor(listType: PaxListTypeId, isArrival: boolean): void {
    this.storage.updatePaxArr({ isArrival }, 'silent');
    const passengers = isArrival
      ? this.storage.activePassengersArrival()
      : this.storage.activePassengersDeparture();
    if (listType === 'paxV2') {
      void this.passengerListForm02Pdf.openPreview(this.appData(), passengers, isArrival).then((ok) => {
        if (!ok) this.toast.showError('Allow pop-ups to open Passenger List preview');
      });
      return;
    }
    void this.passengerListForm01Pdf.openPreview(this.appData(), passengers, isArrival).then((ok) => {
      if (!ok) this.toast.showError('Allow pop-ups to open Passenger List preview');
    });
  }

  protected crewListDocLabel(id: CrewListTypeId): string {
    return CREW_LIST_TYPE_LABELS[id];
  }

  protected openCrewListFor(listType: CrewListTypeId, isArrival: boolean): void {
    if (listType === CREW_FORM_01) {
      void this.openCrewListForm01Pdf(isArrival);
      return;
    }
    if (listType === CREW_FORM_02) {
      void this.openCrewListForm02Pdf(isArrival);
      return;
    }
    if (listType === CREW_FORM_03) {
      void this.openCrewListForm03Pdf(isArrival);
      return;
    }
    if (listType === CREW_FORM_04) {
      void this.openCrewListForm04Pdf(isArrival);
      return;
    }
    if (listType === CREW_FORM_05) {
      void this.openCrewListForm05Pdf(isArrival);
      return;
    }
    if (listType === CREW_FORM_06) {
      void this.openCrewListForm06Pdf(isArrival);
      return;
    }
    if (listType === CREW_FORM_07) {
      void this.openCrewListForm07Pdf(isArrival);
      return;
    }
    void this.openCrewListPdf(isArrival, CREW_IDENTITY_PASSPORT);
  }

  /** Form 01 - IMO CREW LIST - P — HTML editor → vector PDF (Electron) or html2canvas fallback. */
  private async openCrewListForm01Pdf(isArrival: boolean): Promise<void> {
    this.storage.updateCrewArr({ isArrival }, 'silent');
    const crew = isArrival ? this.storage.activeCrewArrival() : this.storage.activeCrewDeparture();
    const data: AppData = {
      ...this.appData(isArrival),
      crewArr: { ...this.appData(isArrival).crewArr, isArrival, identityDocumentType: CREW_IDENTITY_PASSPORT },
    };
    try {
      const ok = await this.crewListForm01Pdf.openPreview(data, crew, isArrival);
      if (!ok) {
        this.toast.showError('Allow pop-ups to open Crew List preview');
      }
    } catch (err) {
      this.toast.showError(err instanceof Error ? err.message : 'Crew list preview failed');
    }
  }

  /** Form 02 - IMO CREW LIST - SBK — HTML editor → vector PDF (Electron) or html2canvas fallback. */
  private async openCrewListForm02Pdf(isArrival: boolean): Promise<void> {
    this.storage.updateCrewArr({ isArrival }, 'silent');
    const crew = isArrival ? this.storage.activeCrewArrival() : this.storage.activeCrewDeparture();
    const data: AppData = {
      ...this.appData(isArrival),
      crewArr: {
        ...this.appData(isArrival).crewArr,
        isArrival,
        identityDocumentType: CREW_IDENTITY_SEAMANS_BOOK,
      },
    };
    try {
      const ok = await this.crewListForm02Pdf.openPreview(data, crew, isArrival);
      if (!ok) {
        this.toast.showError('Allow pop-ups to open Crew List preview');
      }
    } catch (err) {
      this.toast.showError(err instanceof Error ? err.message : 'Crew list preview failed');
    }
  }

  /** Form 03 - IMO CREW LIST [P][SBK][J][T] — HTML editor → vector PDF (Electron) or html2canvas fallback. */
  private async openCrewListForm03Pdf(isArrival: boolean): Promise<void> {
    this.storage.updateCrewArr({ isArrival }, 'silent');
    const crew = isArrival ? this.storage.activeCrewArrival() : this.storage.activeCrewDeparture();
    const data: AppData = {
      ...this.appData(isArrival),
      crewArr: { ...this.appData(isArrival).crewArr, isArrival },
    };
    try {
      const ok = await this.crewListForm03Pdf.openPreview(data, crew, isArrival);
      if (!ok) {
        this.toast.showError('Allow pop-ups to open Crew List preview');
      }
    } catch (err) {
      this.toast.showError(err instanceof Error ? err.message : 'Crew list preview failed');
    }
  }

  /** Form 04 - CREW LIST [P][E][PI][G] — HTML editor → vector PDF (Electron) or html2canvas fallback. */
  private async openCrewListForm04Pdf(isArrival: boolean): Promise<void> {
    this.storage.updateCrewArr({ isArrival }, 'silent');
    const crew = isArrival ? this.storage.activeCrewArrival() : this.storage.activeCrewDeparture();
    const data: AppData = {
      ...this.appData(isArrival),
      crewArr: { ...this.appData(isArrival).crewArr, isArrival },
    };
    try {
      const ok = await this.crewListForm04Pdf.openPreview(data, crew, isArrival);
      if (!ok) {
        this.toast.showError('Allow pop-ups to open Crew List preview');
      }
    } catch (err) {
      this.toast.showError(err instanceof Error ? err.message : 'Crew list preview failed');
    }
  }

  /** Form 05 - CREW LIST [SBK][E] — HTML editor → vector PDF (Electron) or html2canvas fallback. */
  private async openCrewListForm05Pdf(isArrival: boolean): Promise<void> {
    this.storage.updateCrewArr({ isArrival }, 'silent');
    const crew = isArrival ? this.storage.activeCrewArrival() : this.storage.activeCrewDeparture();
    const data: AppData = {
      ...this.appData(isArrival),
      crewArr: { ...this.appData(isArrival).crewArr, isArrival },
    };
    try {
      const ok = await this.crewListForm05Pdf.openPreview(data, crew, isArrival);
      if (!ok) {
        this.toast.showError('Allow pop-ups to open Crew List preview');
      }
    } catch (err) {
      this.toast.showError(err instanceof Error ? err.message : 'Crew list preview failed');
    }
  }

  /** Form 06 - CREW LIST [SBK][PI][E][P][J] — HTML editor → vector PDF (Electron) or html2canvas fallback. */
  private async openCrewListForm06Pdf(isArrival: boolean): Promise<void> {
    this.storage.updateCrewArr({ isArrival }, 'silent');
    const crew = isArrival ? this.storage.activeCrewArrival() : this.storage.activeCrewDeparture();
    const data: AppData = {
      ...this.appData(isArrival),
      crewArr: { ...this.appData(isArrival).crewArr, isArrival },
    };
    try {
      const ok = await this.crewListForm06Pdf.openPreview(data, crew, isArrival);
      if (!ok) {
        this.toast.showError('Allow pop-ups to open Crew List preview');
      }
    } catch (err) {
      this.toast.showError(err instanceof Error ? err.message : 'Crew list preview failed');
    }
  }

  /** Form 07 - CREW LIST [SBK][PI][E][P][PI][E] — HTML editor → vector PDF (Electron) or html2canvas fallback. */
  private async openCrewListForm07Pdf(isArrival: boolean): Promise<void> {
    this.storage.updateCrewArr({ isArrival }, 'silent');
    const crew = isArrival ? this.storage.activeCrewArrival() : this.storage.activeCrewDeparture();
    const data: AppData = {
      ...this.appData(isArrival),
      crewArr: { ...this.appData(isArrival).crewArr, isArrival },
    };
    try {
      const ok = await this.crewListForm07Pdf.openPreview(data, crew, isArrival);
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

  ngOnInit(): void {
    const params = new URLSearchParams(window.location.search);
    const htmlFormExcel = params.get('htmlFormExcel');
    const returnUrl = params.get('return');
    if (htmlFormExcel && params.get('embed') !== '1') {
      void this.runHtmlFormExcelExport(returnUrl);
      return;
    }

    const reopenPoc = params.get(PORT_OF_CALL_SETTINGS_PARAM) === '1';
    const feedbackPoc01 = params.get(PORT_OF_CALL_FORM_01_FEEDBACK_PARAM);
    const feedbackPoc02 = params.get(PORT_OF_CALL_FORM_02_FEEDBACK_PARAM);
    const pocForm01Label = PORT_SETTINGS_DOC_LABELS.portOfCall;
    const pocForm02Label = PORT_SETTINGS_DOC_LABELS.portsOfCall;

    const reopenShipStores = params.get(SHIP_STORES_SETTINGS_PARAM) === '1';
    const feedbackSs01 = params.get(SHIP_STORES_FORM_01_FEEDBACK_PARAM);
    const feedbackSs02 = params.get(SHIP_STORES_FORM_02_FEEDBACK_PARAM);
    const ssForm01Label = SHIP_STORES_DOC_LABELS.shipStores;
    const ssForm02Label = SHIP_STORES_DOC_LABELS.shipStores02;

    const reopenPax = params.get('paxSettings') === '1';
    const feedbackPax01 = params.get(PASSENGER_LIST_FORM_01_FEEDBACK_PARAM);
    const feedbackPax02 = params.get(PASSENGER_LIST_FORM_02_FEEDBACK_PARAM);
    const paxForm01Label = PAX_LIST_TYPE_LABELS.pax;
    const paxForm02Label = PAX_LIST_TYPE_LABELS.paxV2;

    const reopen = params.get('crewListSettings') === '1';
    const feedback01 = params.get(CREW_LIST_FORM_01_FEEDBACK_PARAM);
    const feedback02 = params.get(CREW_LIST_FORM_02_FEEDBACK_PARAM);
    const feedback03 = params.get(CREW_LIST_FORM_03_FEEDBACK_PARAM);
    const feedback04 = params.get(CREW_LIST_FORM_04_FEEDBACK_PARAM);
    const feedback05 = params.get(CREW_LIST_FORM_05_FEEDBACK_PARAM);
    const feedback06 = params.get(CREW_LIST_FORM_06_FEEDBACK_PARAM);
    const feedback07 = params.get(CREW_LIST_FORM_07_FEEDBACK_PARAM);
    const form01Label = CREW_LIST_TYPE_LABELS[CREW_FORM_01];
    const form02Label = CREW_LIST_TYPE_LABELS[CREW_FORM_02];
    const form03Label = CREW_LIST_TYPE_LABELS[CREW_FORM_03];
    const form04Label = CREW_LIST_TYPE_LABELS[CREW_FORM_04];
    const form05Label = CREW_LIST_TYPE_LABELS[CREW_FORM_05];
    const form06Label = CREW_LIST_TYPE_LABELS[CREW_FORM_06];
    const form07Label = CREW_LIST_TYPE_LABELS[CREW_FORM_07];

    if (reopenPoc) {
      this.showPortOfCallSettings.set(true);
    }
    const portDocFromUrl = params.get(PORT_SETTINGS_DOC_PARAM);
    if (portDocFromUrl) {
      this.forms.updatePortOfCallSettings({
        settingsDocId: portDocFromUrl as PortSettingsDocId,
      });
    } else if (feedbackPoc02) {
      this.forms.updatePortOfCallSettings({ settingsDocId: 'portsOfCall' });
    } else if (feedbackPoc01) {
      this.forms.updatePortOfCallSettings({ settingsDocId: 'portOfCall' });
    }
    if (feedbackPoc01 === 'saved') {
      this.toast.show(`Saved: ${pocForm01Label}`, 'success');
    } else if (feedbackPoc01 === 'cancelled') {
      this.toast.show(`Cancelled: ${pocForm01Label}`, 'info');
    }
    if (feedbackPoc02 === 'saved') {
      this.toast.show(`Saved: ${pocForm02Label}`, 'success');
    } else if (feedbackPoc02 === 'cancelled') {
      this.toast.show(`Cancelled: ${pocForm02Label}`, 'info');
    }

    if (reopenShipStores) {
      this.showShipStoresSettings.set(true);
    }
    const shipStoresDocFromUrl = params.get(SHIP_STORES_SETTINGS_DOC_PARAM);
    if (shipStoresDocFromUrl) {
      this.forms.updateShipStoresSettingsDocId(shipStoresDocFromUrl as ShipStoresDocId);
    } else if (feedbackSs02) {
      this.forms.updateShipStoresSettingsDocId('shipStores02');
    } else if (feedbackSs01) {
      this.forms.updateShipStoresSettingsDocId('shipStores');
    }
    if (feedbackSs01 === 'saved') {
      this.toast.show(`Saved: ${ssForm01Label}`, 'success');
    } else if (feedbackSs01 === 'cancelled') {
      this.toast.show(`Cancelled: ${ssForm01Label}`, 'info');
    }
    if (feedbackSs02 === 'saved') {
      this.toast.show(`Saved: ${ssForm02Label}`, 'success');
    } else if (feedbackSs02 === 'cancelled') {
      this.toast.show(`Cancelled: ${ssForm02Label}`, 'info');
    }

    const reopenCrewEffect = params.get(CREW_EFFECT_SETTINGS_PARAM) === '1';
    const feedbackCe01 = params.get(CREW_EFFECT_FORM_01_FEEDBACK_PARAM);
    const feedbackCe02 = params.get(CREW_EFFECT_FORM_02_FEEDBACK_PARAM);
    const ceForm01Label = CREW_EFFECT_DOC_LABELS.crewEffect;
    const ceForm02Label = CREW_EFFECT_DOC_LABELS.crewEffect02;

    if (reopenCrewEffect) {
      this.showCrewEffectSettings.set(true);
    }
    if (feedbackCe02) {
      this.crewEffectSettingsDoc.set('crewEffect02');
    } else if (feedbackCe01) {
      this.crewEffectSettingsDoc.set('crewEffect');
    }
    if (feedbackCe01 === 'saved') {
      this.toast.show(`Saved: ${ceForm01Label}`, 'success');
    } else if (feedbackCe01 === 'cancelled') {
      this.toast.show(`Cancelled: ${ceForm01Label}`, 'info');
    }
    if (feedbackCe02 === 'saved') {
      this.toast.show(`Saved: ${ceForm02Label}`, 'success');
    } else if (feedbackCe02 === 'cancelled') {
      this.toast.show(`Cancelled: ${ceForm02Label}`, 'info');
    }

    const reopenNilList = params.get(NIL_LIST_SETTINGS_PARAM) === '1';
    const feedbackNilList = params.get(NIL_LIST_FORM_FEEDBACK_PARAM);
    const nilListLabel = 'NIL List';
    if (reopenNilList) {
      this.showNilListSettings.set(true);
    }
    if (feedbackNilList === 'saved') {
      this.toast.show(`Saved: ${nilListLabel}`, 'success');
    } else if (feedbackNilList === 'cancelled') {
      this.toast.show(`Cancelled: ${nilListLabel}`, 'info');
    }

    if (reopenPax) {
      this.showPaxSettings.set(true);
    }
    if (feedbackPax01 === 'saved') {
      this.toast.show(`Saved: ${paxForm01Label}`, 'success');
    } else if (feedbackPax01 === 'cancelled') {
      this.toast.show(`Cancelled: ${paxForm01Label}`, 'info');
    }
    if (feedbackPax02 === 'saved') {
      this.toast.show(`Saved: ${paxForm02Label}`, 'success');
    } else if (feedbackPax02 === 'cancelled') {
      this.toast.show(`Cancelled: ${paxForm02Label}`, 'info');
    }

    if (reopen) {
      this.showCrewListSettings.set(true);
    }
    if (feedback01 === 'saved') {
      this.toast.show(`Saved: ${form01Label}`, 'success');
    } else if (feedback01 === 'cancelled') {
      this.toast.show(`Cancelled: ${form01Label}`, 'info');
    }
    if (feedback02 === 'saved') {
      this.toast.show(`Saved: ${form02Label}`, 'success');
    } else if (feedback02 === 'cancelled') {
      this.toast.show(`Cancelled: ${form02Label}`, 'info');
    }
    if (feedback03 === 'saved') {
      this.toast.show(`Saved: ${form03Label}`, 'success');
    } else if (feedback03 === 'cancelled') {
      this.toast.show(`Cancelled: ${form03Label}`, 'info');
    }
    if (feedback05 === 'saved') {
      this.toast.show(`Saved: ${form05Label}`, 'success');
    } else if (feedback05 === 'cancelled') {
      this.toast.show(`Cancelled: ${form05Label}`, 'info');
    }
    if (feedback04 === 'saved') {
      this.toast.show(`Saved: ${form04Label}`, 'success');
    } else if (feedback04 === 'cancelled') {
      this.toast.show(`Cancelled: ${form04Label}`, 'info');
    }
    if (feedback06 === 'saved') {
      this.toast.show(`Saved: ${form06Label}`, 'success');
    } else if (feedback06 === 'cancelled') {
      this.toast.show(`Cancelled: ${form06Label}`, 'info');
    }
    if (feedback07 === 'saved') {
      this.toast.show(`Saved: ${form07Label}`, 'success');
    } else if (feedback07 === 'cancelled') {
      this.toast.show(`Cancelled: ${form07Label}`, 'info');
    }

    if (
      reopen ||
      reopenPoc ||
      reopenShipStores ||
      reopenCrewEffect ||
      reopenNilList ||
      reopenPax ||
      feedbackPoc01 ||
      feedbackPoc02 ||
      feedbackSs01 ||
      feedbackSs02 ||
      feedbackCe01 ||
      feedbackCe02 ||
      feedbackNilList ||
      feedback01 ||
      feedback02 ||
      feedback03 ||
      feedback04 ||
      feedback05 ||
      feedback06 ||
      feedback07 ||
      feedbackPax01 ||
      feedbackPax02
    ) {
      params.delete('crewListSettings');
      params.delete('paxSettings');
      params.delete(PORT_OF_CALL_SETTINGS_PARAM);
      params.delete(PORT_SETTINGS_DOC_PARAM);
      params.delete(PORT_OF_CALL_FORM_01_FEEDBACK_PARAM);
      params.delete(PORT_OF_CALL_FORM_02_FEEDBACK_PARAM);
      params.delete(SHIP_STORES_SETTINGS_PARAM);
      params.delete(SHIP_STORES_SETTINGS_DOC_PARAM);
      params.delete(SHIP_STORES_FORM_01_FEEDBACK_PARAM);
      params.delete(SHIP_STORES_FORM_02_FEEDBACK_PARAM);
      params.delete(CREW_EFFECT_SETTINGS_PARAM);
      params.delete(CREW_EFFECT_FORM_01_FEEDBACK_PARAM);
      params.delete(CREW_EFFECT_FORM_02_FEEDBACK_PARAM);
      params.delete(NIL_LIST_SETTINGS_PARAM);
      params.delete(NIL_LIST_FORM_FEEDBACK_PARAM);
      params.delete(PASSENGER_LIST_FORM_01_FEEDBACK_PARAM);
      params.delete(PASSENGER_LIST_FORM_02_FEEDBACK_PARAM);
      params.delete(CREW_LIST_FORM_01_FEEDBACK_PARAM);
      params.delete(CREW_LIST_FORM_02_FEEDBACK_PARAM);
      params.delete(CREW_LIST_FORM_03_FEEDBACK_PARAM);
      params.delete(CREW_LIST_FORM_04_FEEDBACK_PARAM);
      params.delete(CREW_LIST_FORM_05_FEEDBACK_PARAM);
      params.delete(CREW_LIST_FORM_06_FEEDBACK_PARAM);
      params.delete(CREW_LIST_FORM_07_FEEDBACK_PARAM);
      const query = params.toString();
      const path = window.location.pathname || '/';
      window.history.replaceState({}, '', query ? `${path}?${query}` : path);
    }
  }

  private async runHtmlFormExcelExport(returnUrl: string | null): Promise<void> {
    try {
      await this.storage.init();
      const ok = await this.htmlFormExcel.openFromSessionStorage();
      if (!ok) {
        this.toast.showError('Could not export Excel — form data missing or invalid');
      }
      await new Promise((resolve) => setTimeout(resolve, 800));
    } catch (err) {
      console.error('HTML form Excel export failed', err);
      this.toast.showError('Excel export failed');
    } finally {
      const fallback = window.location.pathname || '/';
      const target = returnUrl ? decodeURIComponent(returnUrl) : fallback;
      window.location.replace(target);
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

  protected portSettingsDoc(): PortSettingsDocId {
    return this.portOfCall().settingsDocId;
  }

  protected onPortSettingsDocChange(value: PortSettingsDocId): void {
    if (value === this.portSettingsDoc()) return;
    this.forms.updatePortOfCallSettings({ settingsDocId: value });
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

  protected shipStoresSettingsDoc(): ShipStoresDocId {
    return this.storage.shipStoresSettingsDocId();
  }

  protected onShipStoresSettingsDocChange(value: ShipStoresDocId): void {
    if (value === this.shipStoresSettingsDoc()) return;
    this.forms.updateShipStoresSettingsDocId(value);
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
      etaLibrary: this.storage.etaLibrary(),
      documentOverlay: this.storage.documentOverlay(),
      shipAssets: this.storage.shipAssets(),
      outputSettings: this.storage.outputSettings(),
      printPackages: this.storage.printPackages(),
      customDocuments: this.storage.customDocuments(),
    };
  }
}
