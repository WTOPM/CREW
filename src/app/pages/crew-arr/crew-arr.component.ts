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
      ports: this.storage.ports(),
      ranks: this.storage.ranks(),
    };
  }

  protected openPreview(): void {
    const ok = this.pdf.openPreview(this.appData(), this.storage.activeCrew());
    if (!ok) {
      this.toast.showError('Allow pop-ups to open Crew List preview');
    }
  }

  protected generatePdf(): void {
    this.pdf.generate(this.appData(), this.storage.activeCrew());
    this.toast.showPdfGenerated();
  }
}
