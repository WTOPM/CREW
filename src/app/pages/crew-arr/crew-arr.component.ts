import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CrewArrFormSettings } from '../../models/crew.models';
import { PdfCrewArrService } from '../../services/pdf-crew-arr.service';
import { StorageService } from '../../services/storage.service';
import { ToastService } from '../../services/toast.service';
import { NumberSpinDirective } from '../../directives/number-spin.directive';

@Component({
  selector: 'app-crew-arr',
  imports: [FormsModule, RouterLink, NumberSpinDirective],
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
      dgUnReference: this.storage.dgUnReference(),
      reeferLibrary: this.storage.reeferLibrary(),
      etaLibrary: this.storage.etaLibrary(),
      documentOverlay: this.storage.documentOverlay(),
      shipAssets: this.storage.shipAssets(),
      outputSettings: this.storage.outputSettings(),
      printPackages: this.storage.printPackages(),
      customDocuments: this.storage.customDocuments(),
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
