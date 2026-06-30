import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { DatePickerComponent } from '../../components/date-picker/date-picker.component';
import { PortSelectComponent } from '../../components/port-select/port-select.component';
import { PORT_SEC_LVL_OPTIONS, PortTerminal, ShipInfo } from '../../models/crew.models';
import { StorageService } from '../../services/storage.service';
import { ReferenceListsStore } from '../../services/reference-lists.store';
import { ElectronLocalPrefsService } from '../../services/electron-local-prefs.service';
import { DocumentStampUploadComponent } from '../../components/document-stamp-upload/document-stamp-upload.component';
import { PrintPackagesComponent } from '../../components/print-packages/print-packages.component';
import { CustomDocumentsComponent } from '../../components/custom-documents/custom-documents.component';
import { DataBackupsModalComponent } from '../../components/data-backups-modal/data-backups-modal.component';
import { ClickOutsideDirective } from '../../directives/click-outside.directive';

@Component({
  selector: 'app-settings',
  imports: [
    FormsModule,
    RouterLink,
    DragDropModule,
    PortSelectComponent,
    DatePickerComponent,
    DocumentStampUploadComponent,
    PrintPackagesComponent,
    CustomDocumentsComponent,
    DataBackupsModalComponent,
    ClickOutsideDirective,
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class SettingsComponent {
  protected readonly storage = inject(StorageService);
  protected readonly refLists = inject(ReferenceListsStore);
  protected readonly localPrefs = inject(ElectronLocalPrefsService);

  protected readonly hasElectron = this.localPrefs.available;
  protected readonly minimizeToTray = this.localPrefs.minimizeToTray;

  protected readonly dataPath = signal<string | null>(null);
  protected readonly showDataBackupsModal = signal(false);

  protected readonly ship = this.storage.ship;
  protected readonly marsecLevelOptions = PORT_SEC_LVL_OPTIONS;
  protected readonly ports = this.storage.ports;
  protected readonly ranks = this.storage.ranks;
  protected readonly nationalities = this.storage.nationalities;
  protected readonly printPackages = this.storage.printPackages;

  protected readonly totalPortTerminals = computed(() =>
    this.ports().reduce((sum, p) => sum + (p.terminals?.length ?? 0), 0),
  );

  protected showPackagesModal = signal(false);
  protected showPortsModal = signal(false);
  protected showRanksModal = signal(false);
  protected showNationalitiesModal = signal(false);
  protected newPortName = signal('');
  protected newPortCode = signal('');
  protected newPortCountry = signal('');
  protected newRank = signal('');
  protected newNationality = signal('');
  protected expandedPort = signal('');
  protected newTerminalAbbrev = signal('');
  protected newTerminalName = signal('');

  constructor() {
    void this.storage.getDataPath().then((p) => this.dataPath.set(p));
    void this.localPrefs.load();
  }

  protected onMinimizeToTrayChange(enabled: boolean): void {
    void this.localPrefs.setMinimizeToTray(enabled);
  }

  protected openDataBackups(): void {
    this.showDataBackupsModal.set(true);
  }

  protected closeDataBackups(): void {
    this.showDataBackupsModal.set(false);
  }

  protected onShipChange(field: keyof ShipInfo, value: string): void {
    this.storage.updateShip({ [field]: value });
  }

  protected openPackages(): void {
    this.showPackagesModal.set(true);
  }

  protected closePackages(): void {
    this.showPackagesModal.set(false);
  }

  protected openPorts(): void {
    this.newPortName.set('');
    this.newPortCode.set('');
    this.newPortCountry.set('');
    this.expandedPort.set('');
    this.newTerminalAbbrev.set('');
    this.newTerminalName.set('');
    this.showPortsModal.set(true);
  }

  protected openRanks(): void {
    this.newRank.set('');
    this.showRanksModal.set(true);
  }

  protected closePorts(): void {
    this.showPortsModal.set(false);
    this.storage.finishFormSession();
  }

  protected openNationalities(): void {
    this.newNationality.set('');
    this.showNationalitiesModal.set(true);
  }

  protected closeNationalities(): void {
    this.showNationalitiesModal.set(false);
    this.storage.finishFormSession();
  }

  protected addNationalityItem(): void {
    this.refLists.addNationality(this.newNationality());
    this.newNationality.set('');
  }

  protected removeNationalityItem(name: string): void {
    this.refLists.removeNationality(name);
  }

  protected closeRanks(): void {
    this.showRanksModal.set(false);
    this.storage.finishFormSession();
  }

  protected addPortItem(): void {
    this.refLists.addPort(this.newPortName(), this.newPortCode(), this.newPortCountry());
    this.newPortName.set('');
    this.newPortCode.set('');
    this.newPortCountry.set('');
  }

  protected removePortItem(name: string): void {
    this.refLists.removePort(name);
    if (this.expandedPort() === name) this.expandedPort.set('');
  }

  protected togglePortTerminals(portName: string): void {
    this.expandedPort.update((cur) => (cur === portName ? '' : portName));
    this.newTerminalAbbrev.set('');
    this.newTerminalName.set('');
  }

  protected portTerminalCount(port: { terminals?: PortTerminal[] }): number {
    return port.terminals?.length ?? 0;
  }

  protected addPortTerminalItem(portName: string): void {
    this.refLists.addPortTerminal(portName, this.newTerminalAbbrev(), this.newTerminalName());
    this.newTerminalAbbrev.set('');
    this.newTerminalName.set('');
  }

  protected removePortTerminalItem(portName: string, index: number): void {
    this.refLists.removePortTerminal(portName, index);
  }

  protected addRankItem(): void {
    this.refLists.addRank(this.newRank());
    this.newRank.set('');
  }

  protected removeRankItem(name: string): void {
    this.refLists.removeRank(name);
  }

  protected dropRank(event: CdkDragDrop<string[]>): void {
    this.refLists.reorderRanks(event.previousIndex, event.currentIndex);
  }

  protected dropPort(event: CdkDragDrop<any[]>): void {
    this.refLists.reorderPorts(event.previousIndex, event.currentIndex);
  }

  protected dropNationality(event: CdkDragDrop<string[]>): void {
    this.refLists.reorderNationalities(event.previousIndex, event.currentIndex);
  }
}
