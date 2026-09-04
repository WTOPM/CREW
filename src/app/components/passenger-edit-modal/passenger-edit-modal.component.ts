import { Component, inject, input, linkedSignal, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  createEmptyPassengerVoyageStay,
  PassengerMember,
  PassengerVoyageStay,
} from '../../models/passenger.models';
import { StorageService } from '../../services/storage.service';
import { LookupSelectComponent } from '../lookup-select/lookup-select.component';
import { DatePickerComponent } from '../date-picker/date-picker.component';
import { PortSelectComponent } from '../port-select/port-select.component';
import { ClickOutsideDirective } from '../../directives/click-outside.directive';

/**
 * Passenger edit form (modal). Mirror of CrewEditModalComponent (the "add" flow
 * pre-creates the row, so this is always editing an existing id). Owns a local working
 * draft; emits the edited passenger on save.
 */
@Component({
  selector: 'app-passenger-edit-modal',
  imports: [
    FormsModule,
    LookupSelectComponent,
    DatePickerComponent,
    PortSelectComponent,
    ClickOutsideDirective,
  ],
  templateUrl: './passenger-edit-modal.component.html',
  styles: ':host { display: contents; }',
})
export class PassengerEditModalComponent {
  readonly member = input.required<PassengerMember>();
  readonly save = output<PassengerMember>();
  readonly cancel = output<void>();

  private readonly storage = inject(StorageService);

  protected readonly draft = linkedSignal<PassengerMember>(() => {
    const source = this.member();
    const voyageStays = [...(source.voyageStays ?? [])];
    if (!voyageStays.length) voyageStays.push(createEmptyPassengerVoyageStay());
    return { ...source, voyageStays };
  });

  protected readonly nationalities = this.storage.nationalities;
  protected readonly ports = this.storage.ports;

  protected updateField(field: keyof PassengerMember, value: string | boolean): void {
    this.draft.update((d) => ({ ...d, [field]: value }));
  }

  protected updateStayField(
    stayId: string,
    field: keyof Omit<PassengerVoyageStay, 'id'>,
    value: string,
  ): void {
    this.draft.update((d) => ({
      ...d,
      voyageStays: d.voyageStays.map((stay) =>
        stay.id === stayId ? { ...stay, [field]: value } : stay,
      ),
    }));
  }

  protected addVoyageStay(): void {
    this.draft.update((d) => ({
      ...d,
      voyageStays: [...d.voyageStays, createEmptyPassengerVoyageStay()],
    }));
  }

  protected removeVoyageStay(stayId: string): void {
    this.draft.update((d) => {
      const next = d.voyageStays.filter((stay) => stay.id !== stayId);
      return {
        ...d,
        voyageStays: next.length ? next : [createEmptyPassengerVoyageStay()],
      };
    });
  }

  protected onSave(): void {
    const draft = this.draft();
    const voyageStays = draft.voyageStays.filter((stay) => !isVoyageStayBlank(stay));
    this.save.emit({ ...draft, voyageStays });
  }
}

function isVoyageStayBlank(stay: PassengerVoyageStay): boolean {
  return (
    !stay.embarkationDate.trim() &&
    !stay.embarkationPort.trim() &&
    !stay.disembarkationDate.trim() &&
    !stay.disembarkationPort.trim()
  );
}
