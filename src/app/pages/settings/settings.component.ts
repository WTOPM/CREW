import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LookupSelectComponent } from '../../components/lookup-select/lookup-select.component';
import { PortSelectComponent } from '../../components/port-select/port-select.component';
import { PortCallHistoryEntry, ShipInfo, portCountry } from '../../models/crew.models';
import { StorageService } from '../../services/storage.service';
import { POC_MAX_ROW_COUNT, POC_MIN_ROW_COUNT } from '../../services/port-of-call-coordinates';

@Component({
  selector: 'app-settings',
  imports: [FormsModule, RouterLink, PortSelectComponent, LookupSelectComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class SettingsComponent {
  protected readonly storage = inject(StorageService);
  protected readonly pocMinRows = POC_MIN_ROW_COUNT;
  protected readonly pocMaxRows = POC_MAX_ROW_COUNT;

  protected readonly ship = this.storage.ship;
  protected readonly ports = this.storage.ports;
  protected readonly ranks = this.storage.ranks;
  protected readonly nationalities = this.storage.nationalities;
  protected readonly portCallHistory = this.storage.portCallHistory;
  protected readonly portOfCall = this.storage.portOfCall;

  protected showPortsModal = signal(false);
  protected showRanksModal = signal(false);
  protected showNationalitiesModal = signal(false);
  protected showPortOfCallModal = signal(false);
  protected newPortName = signal('');
  protected newPortCode = signal('');
  protected newPortCountry = signal('');
  protected newRank = signal('');
  protected newNationality = signal('');

  protected onShipChange(field: keyof ShipInfo, value: string): void {
    this.storage.updateShip({ [field]: value });
  }

  protected openPorts(): void {
    this.newPortName.set('');
    this.newPortCode.set('');
    this.newPortCountry.set('');
    this.showPortsModal.set(true);
  }

  protected openRanks(): void {
    this.newRank.set('');
    this.showRanksModal.set(true);
  }

  protected openPortOfCall(): void {
    this.showPortOfCallModal.set(true);
  }

  protected closePortOfCall(): void {
    this.showPortOfCallModal.set(false);
  }

  protected closePorts(): void {
    this.showPortsModal.set(false);
  }

  protected openNationalities(): void {
    this.newNationality.set('');
    this.showNationalitiesModal.set(true);
  }

  protected closeNationalities(): void {
    this.showNationalitiesModal.set(false);
  }

  protected addNationalityItem(): void {
    this.storage.addNationality(this.newNationality());
    this.newNationality.set('');
  }

  protected removeNationalityItem(name: string): void {
    this.storage.removeNationality(name);
  }

  protected closeRanks(): void {
    this.showRanksModal.set(false);
  }

  protected addPortItem(): void {
    this.storage.addPort(this.newPortName(), this.newPortCode(), this.newPortCountry());
    this.newPortName.set('');
    this.newPortCode.set('');
    this.newPortCountry.set('');
  }

  protected removePortItem(name: string): void {
    this.storage.removePort(name);
  }

  protected addRankItem(): void {
    this.storage.addRank(this.newRank());
    this.newRank.set('');
  }

  protected removeRankItem(name: string): void {
    this.storage.removeRank(name);
  }

  protected onPdfRowCountChange(value: string | number): void {
    const n = typeof value === 'number' ? value : parseInt(String(value), 10);
    if (isNaN(n)) return;
    this.storage.updatePortOfCallSettings({ pdfRowCount: n });
  }

  protected addPortCallRow(): void {
    this.storage.addPortCallEntry();
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
}
