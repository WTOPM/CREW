import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { crewMemberLabel, crewMoneyListAmountsFor } from '../../models/crew.models';
import { StorageService } from '../../services/storage.service';
import { FormsStore } from '../../services/forms.store';
import { DocumentStampOptionsComponent } from '../document-stamp-options/document-stamp-options.component';

@Component({
  selector: 'app-crew-money-list-settings',
  imports: [FormsModule, DocumentStampOptionsComponent],
  templateUrl: './crew-money-list-settings.component.html',
  styleUrl: './crew-money-list-settings.component.css',
})
export class CrewMoneyListSettingsComponent {
  private readonly storage = inject(StorageService);
  private readonly forms = inject(FormsStore);

  protected readonly form = this.storage.crewMoneyListForm;
  protected readonly crew = this.storage.activeCrewArrival;
  protected readonly amountsFor = crewMoneyListAmountsFor;
  protected readonly crewLabel = crewMemberLabel;

  protected onAmountChange(crewId: string, field: 'usd' | 'euro' | 'others', value: string): void {
    this.forms.updateCrewMoneyListCrewAmount(crewId, { [field]: value });
  }
}
