import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CrewArrFormSettings } from '../../models/crew.models';
import { PdfCrewArrService } from '../../services/pdf-crew-arr.service';
import { StorageService } from '../../services/storage.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-crew-arr',
  imports: [FormsModule, RouterLink],
  templateUrl: './crew-arr.component.html',
  styleUrl: './crew-arr.component.css',
})
export class CrewArrComponent {
  private readonly storage = inject(StorageService);
  private readonly pdf = inject(PdfCrewArrService);
  private readonly toast = inject(ToastService);

  protected readonly crewArr = this.storage.crewArr;

  protected updateSetting<K extends keyof CrewArrFormSettings>(
    field: K,
    value: CrewArrFormSettings[K],
  ): void {
    this.storage.updateCrewArr({ [field]: value });
  }

  private appData() {
    return {
      ship: this.storage.ship(),
      crew: this.storage.allCrew(),
      crewArr: this.crewArr(),
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

  protected openPreview(): void {
    const crew = this.crewArr().isArrival
      ? this.storage.activeCrewArrival()
      : this.storage.activeCrewDeparture();
    void this.pdf.openPreview(this.appData(), crew).then((ok) => {
      if (!ok) this.toast.showError('Allow pop-ups to open Crew List preview');
    });
  }

  protected generatePdf(): void {
    const crew = this.crewArr().isArrival
      ? this.storage.activeCrewArrival()
      : this.storage.activeCrewDeparture();
    void this.pdf.generate(this.appData(), crew).then(() => {
      this.toast.showPdfGenerated();
    });
  }
}
