import { Component, inject } from '@angular/core';
import { AppData } from '../../models/crew.models';
import { PdfCrewArrService } from '../../services/pdf-crew-arr.service';
import { PdfPortOfCallService } from '../../services/pdf-port-of-call.service';
import { StorageService } from '../../services/storage.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-documents-nav',
  templateUrl: './documents-nav.component.html',
  styleUrl: './documents-nav.component.css',
})
export class DocumentsNavComponent {
  private readonly storage = inject(StorageService);
  private readonly crewPdf = inject(PdfCrewArrService);
  private readonly portOfCallPdf = inject(PdfPortOfCallService);
  private readonly toast = inject(ToastService);

  protected openCrewList(isArrival: boolean): void {
    this.storage.updateCrewArr({ isArrival }, 'silent');
    const ok = this.crewPdf.openPreview(this.appData(isArrival), this.storage.activeCrew());
    if (!ok) {
      this.toast.showError('Allow pop-ups to open Crew List preview');
    }
  }

  protected openPortOfCall(): void {
    const ok = this.portOfCallPdf.openPreview(this.appData());
    if (!ok) {
      this.toast.showError('Allow pop-ups to open Port of Call preview');
    }
  }

  protected openMdh(): void {
    this.toast.show('MDH (Maritime Declaration of Health) — в разработке');
  }

  private appData(isArrival?: boolean): AppData {
    const crewArr = this.storage.crewArr();
    return {
      ship: this.storage.ship(),
      crew: this.storage.allCrew(),
      crewArr: isArrival === undefined ? crewArr : { ...crewArr, isArrival },
      ports: this.storage.ports(),
      ranks: this.storage.ranks(),
      nationalities: this.storage.nationalities(),
      portCallHistory: this.storage.portCallHistory(),
      portOfCall: this.storage.portOfCall(),
    };
  }
}
