import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppData, PortCallHistoryEntry, portCountry } from '../../models/crew.models';
import { PartialDateInputComponent } from '../partial-date-input/partial-date-input.component';
import { PortSelectComponent } from '../port-select/port-select.component';
import { TimeInputComponent } from '../time-input/time-input.component';
import { defaultIsoDateInCurrentMonth } from '../../utils/partial-date.util';
import { PdfCrewArrService } from '../../services/pdf-crew-arr.service';
import { PdfPortOfCallService } from '../../services/pdf-port-of-call.service';
import { POC_MAX_ROW_COUNT, POC_MIN_ROW_COUNT, POC_TEMPLATE_ROW_COUNT } from '../../services/port-of-call-coordinates';
import { StorageService } from '../../services/storage.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-documents-nav',
  imports: [FormsModule, PortSelectComponent, PartialDateInputComponent, TimeInputComponent],
  templateUrl: './documents-nav.component.html',
  styleUrl: './documents-nav.component.css',
})
export class DocumentsNavComponent {
  private readonly storage = inject(StorageService);
  private readonly crewPdf = inject(PdfCrewArrService);
  private readonly portOfCallPdf = inject(PdfPortOfCallService);
  private readonly toast = inject(ToastService);

  protected readonly pocMinPorts = POC_MIN_ROW_COUNT;
  protected readonly pocMaxPorts = POC_MAX_ROW_COUNT;
  protected readonly pocRowsPerPage = POC_TEMPLATE_ROW_COUNT;

  protected readonly ports = this.storage.ports;
  protected readonly portCallHistory = this.storage.portCallHistory;
  protected readonly portOfCall = this.storage.portOfCall;

  protected showPortOfCallSettings = signal(false);

  protected openPassengerList(isArrival: boolean): void {
    this.storage.updatePaxArr({ isArrival }, 'silent');
    const passengers = isArrival
      ? this.storage.activePassengersArrival()
      : this.storage.activePassengersDeparture();
    const ok = this.crewPdf.openPassengerPreview(this.appData(), passengers);
    if (!ok) {
      this.toast.showError('Allow pop-ups to open Passenger List preview');
    }
  }

  protected openCrewList(isArrival: boolean): void {
    this.storage.updateCrewArr({ isArrival }, 'silent');
    const crew = isArrival ? this.storage.activeCrewArrival() : this.storage.activeCrewDeparture();
    const ok = this.crewPdf.openPreview(this.appData(isArrival), crew);
    if (!ok) {
      this.toast.showError('Allow pop-ups to open Crew List preview');
    }
  }

  protected openPortOfCallPdf(): void {
    const ok = this.portOfCallPdf.openPreview(this.appData());
    if (!ok) {
      this.toast.showError('Allow pop-ups to open Port of Call preview');
    }
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

  protected openMdh(): void {
    this.toast.show('MDH (Maritime Declaration of Health) — coming soon');
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
    };
  }
}
