import {
  afterNextRender,
  Component,
  ElementRef,
  inject,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  createEmptyPassengerVoyageStay,
  PassengerMember,
  PassengerVoyageStay,
} from '../../models/passenger.models';
import { StorageService } from '../../services/storage.service';
import { ToastService } from '../../services/toast.service';
import { copyTextToClipboard, formatLabeledLines } from '../../utils/copy-text.util';
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
  /** Departure list: open to inspect fields without Save. */
  readonly viewOnly = input(false);
  readonly save = output<PassengerMember>();
  readonly cancel = output<void>();

  private readonly storage = inject(StorageService);
  private readonly toast = inject(ToastService);
  private readonly host = inject(ElementRef<HTMLElement>);

  protected readonly draft = linkedSignal<PassengerMember>(() => {
    const source = this.member();
    const voyageStays = [...(source.voyageStays ?? [])];
    if (!voyageStays.length) voyageStays.push(createEmptyPassengerVoyageStay());
    return { ...source, voyageStays };
  });

  protected readonly nationalities = this.storage.nationalities;
  protected readonly ports = this.storage.ports;

  constructor() {
    afterNextRender(() => this.applyViewOnlyFieldLocks(this.viewOnly()));
  }

  private applyViewOnlyFieldLocks(lock: boolean): void {
    const root = this.host.nativeElement;
    for (const node of Array.from(
      root.querySelectorAll(
        '.crew-form-layout input:not([type="checkbox"]):not([type="radio"]), .crew-form-layout textarea',
      ),
    )) {
      (node as HTMLInputElement | HTMLTextAreaElement).readOnly = lock;
    }
    for (const node of Array.from(
      root.querySelectorAll(
        '.crew-form-layout input[type="checkbox"], .crew-form-layout input[type="radio"], .crew-form-layout select',
      ),
    )) {
      (node as HTMLInputElement | HTMLSelectElement).disabled = lock;
    }
  }

  protected updateField(field: keyof PassengerMember, value: string | boolean): void {
    if (this.viewOnly()) return;
    this.draft.update((d) => ({ ...d, [field]: value }));
  }

  protected updateStayField(
    stayId: string,
    field: keyof Omit<PassengerVoyageStay, 'id'>,
    value: string,
  ): void {
    if (this.viewOnly()) return;
    this.draft.update((d) => ({
      ...d,
      voyageStays: d.voyageStays.map((stay) =>
        stay.id === stayId ? { ...stay, [field]: value } : stay,
      ),
    }));
  }

  protected addVoyageStay(): void {
    if (this.viewOnly()) return;
    this.draft.update((d) => ({
      ...d,
      voyageStays: [...d.voyageStays, createEmptyPassengerVoyageStay()],
    }));
  }

  protected removeVoyageStay(stayId: string): void {
    if (this.viewOnly()) return;
    this.draft.update((d) => {
      const next = d.voyageStays.filter((stay) => stay.id !== stayId);
      return {
        ...d,
        voyageStays: next.length ? next : [createEmptyPassengerVoyageStay()],
      };
    });
  }

  protected onSave(): void {
    if (this.viewOnly()) return;
    const draft = this.draft();
    const voyageStays = draft.voyageStays.filter((stay) => !isVoyageStayBlank(stay));
    this.save.emit({ ...draft, voyageStays });
  }

  protected async copyDetails(): Promise<void> {
    const d = this.draft();
    const rows: Array<[string, string]> = [
      ['Family name', d.familyName],
      ['Given names', d.givenNames],
      ['Nationality', d.nationality],
      ['Gender', d.gender],
      ['Date of birth', d.dateOfBirth],
      ['Place of birth', d.placeOfBirth],
      ['Passport No.', d.passport],
      ['Passport issue', d.passportIssueDate],
      ['Passport expiry', d.passportExpiryDate],
    ];
    for (const [i, stay] of d.voyageStays.entries()) {
      const n = d.voyageStays.length > 1 ? ` ${i + 1}` : '';
      rows.push(
        [`Embarkation date${n}`, stay.embarkationDate],
        [`Embarkation port${n}`, stay.embarkationPort],
        [`Disembarkation date${n}`, stay.disembarkationDate],
        [`Disembarkation port${n}`, stay.disembarkationPort],
      );
    }
    const text = formatLabeledLines(rows);
    if (!text) {
      this.toast.show('Nothing to copy', 'info');
      return;
    }
    const ok = await copyTextToClipboard(text);
    if (ok) this.toast.show('Details copied', 'success');
    else this.toast.showError('Could not copy');
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
