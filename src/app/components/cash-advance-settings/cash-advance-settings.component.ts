import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { cashAdvanceAmountsFor, crewMemberLabel } from '../../models/crew.models';
import { StorageService } from '../../services/storage.service';
import { FormsStore } from '../../services/forms.store';
import { DocumentStampOptionsComponent } from '../document-stamp-options/document-stamp-options.component';

@Component({
  selector: 'app-cash-advance-settings',
  imports: [FormsModule, DocumentStampOptionsComponent],
  templateUrl: './cash-advance-settings.component.html',
  styleUrl: './cash-advance-settings.component.css',
})
export class CashAdvanceSettingsComponent {
  private readonly storage = inject(StorageService);
  private readonly forms = inject(FormsStore);

  protected readonly form = this.storage.cashAdvanceForm;
  protected readonly crew = this.storage.activeCrewArrival;
  protected readonly amountsFor = cashAdvanceAmountsFor;
  protected readonly crewLabel = crewMemberLabel;

  protected onTitleChange(value: string): void {
    this.forms.updateCashAdvanceForm({ title: value });
  }

  protected onPayrollDateChange(value: string): void {
    this.forms.updateCashAdvanceForm({ payrollDate: value });
  }

  protected onAmountChange(crewId: string, field: 'usd' | 'eur', value: string): void {
    this.forms.updateCashAdvanceCrewAmount(crewId, { [field]: value });
  }
}
