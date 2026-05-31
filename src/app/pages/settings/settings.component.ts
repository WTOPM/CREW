import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PortSelectComponent } from '../../components/port-select/port-select.component';
import { ShipInfo } from '../../models/crew.models';
import { StorageService } from '../../services/storage.service';

@Component({
  selector: 'app-settings',
  imports: [FormsModule, RouterLink, PortSelectComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class SettingsComponent {
  protected readonly storage = inject(StorageService);

  protected readonly ship = this.storage.ship;
  protected readonly ports = this.storage.ports;
  protected readonly ranks = this.storage.ranks;

  protected showPortsModal = signal(false);
  protected showRanksModal = signal(false);
  protected newPortName = signal('');
  protected newPortCode = signal('');
  protected newRank = signal('');

  protected onShipChange(field: keyof ShipInfo, value: string): void {
    this.storage.updateShip({ [field]: value });
  }

  protected openPorts(): void {
    this.newPortName.set('');
    this.newPortCode.set('');
    this.showPortsModal.set(true);
  }

  protected openRanks(): void {
    this.newRank.set('');
    this.showRanksModal.set(true);
  }

  protected closePorts(): void {
    this.showPortsModal.set(false);
  }

  protected closeRanks(): void {
    this.showRanksModal.set(false);
  }

  protected addPortItem(): void {
    this.storage.addPort(this.newPortName(), this.newPortCode());
    this.newPortName.set('');
    this.newPortCode.set('');
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
}
