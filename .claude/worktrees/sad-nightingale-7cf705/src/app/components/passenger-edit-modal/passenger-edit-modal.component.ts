import { Component, inject, input, linkedSignal, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PassengerMember } from '../../models/passenger.models';
import { StorageService } from '../../services/storage.service';
import { LookupSelectComponent } from '../lookup-select/lookup-select.component';
import { DatePickerComponent } from '../date-picker/date-picker.component';
import { ClickOutsideDirective } from '../../directives/click-outside.directive';

/**
 * Passenger edit form (modal). Mirror of CrewEditModalComponent (the "add" flow
 * pre-creates the row, so this is always editing an existing id). Owns a local working
 * draft; emits the edited passenger on save.
 */
@Component({
  selector: 'app-passenger-edit-modal',
  imports: [FormsModule, LookupSelectComponent, DatePickerComponent, ClickOutsideDirective],
  templateUrl: './passenger-edit-modal.component.html',
  styles: ':host { display: contents; }',
})
export class PassengerEditModalComponent {
  readonly member = input.required<PassengerMember>();
  readonly save = output<PassengerMember>();
  readonly cancel = output<void>();

  private readonly storage = inject(StorageService);

  protected readonly draft = linkedSignal<PassengerMember>(() => ({ ...this.member() }));

  protected readonly nationalities = this.storage.nationalities;

  protected updateField(field: keyof PassengerMember, value: string | boolean): void {
    this.draft.update((d) => ({ ...d, [field]: value }));
  }

  protected onSave(): void {
    this.save.emit(this.draft());
  }
}
