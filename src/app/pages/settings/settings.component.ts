import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { DatePickerComponent } from '../../components/date-picker/date-picker.component';
import { PortSelectComponent } from '../../components/port-select/port-select.component';
import { PORT_SEC_LVL_OPTIONS, ShipInfo } from '../../models/crew.models';
import { StorageService } from '../../services/storage.service';
import { DocumentStampUploadComponent } from '../../components/document-stamp-upload/document-stamp-upload.component';
import { PrintPackagesComponent } from '../../components/print-packages/print-packages.component';
import { CustomDocumentsComponent } from '../../components/custom-documents/custom-documents.component';
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
    ClickOutsideDirective,
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class SettingsComponent {
  protected readonly storage = inject(StorageService);

  protected readonly dataPath = signal<string | null>(null);

  protected readonly ship = this.storage.ship;
  protected readonly marsecLevelOptions = PORT_SEC_LVL_OPTIONS;
  protected readonly ports = this.storage.ports;
  protected readonly ranks = this.storage.ranks;
  protected readonly nationalities = this.storage.nationalities;
  protected readonly printPackages = this.storage.printPackages;

  protected showPackagesModal = signal(false);
  protected showPortsModal = signal(false);
  protected showRanksModal = signal(false);
  protected showNationalitiesModal = signal(false);
  protected newPortName = signal('');
  protected newPortCode = signal('');
  protected newPortCountry = signal('');
  protected newRank = signal('');
  protected newNationality = signal('');

  constructor() {
    void this.storage.getDataPath().then((p) => this.dataPath.set(p));
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
    this.storage.addNationality(this.newNationality());
    this.newNationality.set('');
  }

  protected removeNationalityItem(name: string): void {
    this.storage.removeNationality(name);
  }

  protected closeRanks(): void {
    this.showRanksModal.set(false);
    this.storage.finishFormSession();
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

  protected dropRank(event: CdkDragDrop<string[]>): void {
    this.storage.reorderRanks(event.previousIndex, event.currentIndex);
  }

  protected dropPort(event: CdkDragDrop<any[]>): void {
    this.storage.reorderPorts(event.previousIndex, event.currentIndex);
  }

  protected dropNationality(event: CdkDragDrop<string[]>): void {
    this.storage.reorderNationalities(event.previousIndex, event.currentIndex);
  }

}

