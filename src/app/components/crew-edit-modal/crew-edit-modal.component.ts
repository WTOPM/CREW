import { Component, inject, input, linkedSignal, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CrewMember } from '../../models/crew.models';
import { StorageService } from '../../services/storage.service';
import { LookupSelectComponent } from '../lookup-select/lookup-select.component';
import { DatePickerComponent } from '../date-picker/date-picker.component';
import { PortSelectComponent } from '../port-select/port-select.component';
import { CrewSignatureDropComponent } from '../crew-signature-drop/crew-signature-drop.component';
import { ClickOutsideDirective } from '../../directives/click-outside.directive';

/**
 * Crew member edit form (modal). The parent opens it for an existing or freshly-created
 * member (the "add" flow pre-creates the row, so this is always editing an existing id).
 * Owns a local working draft; emits the edited member on save.
 */
@Component({
  selector: 'app-crew-edit-modal',
  imports: [
    FormsModule,
    LookupSelectComponent,
    DatePickerComponent,
    PortSelectComponent,
    CrewSignatureDropComponent,
    ClickOutsideDirective,
  ],
  templateUrl: './crew-edit-modal.component.html',
  styles: ':host { display: contents; }',
})
export class CrewEditModalComponent {
  readonly member = input.required<CrewMember>();
  readonly save = output<CrewMember>();
  readonly cancel = output<void>();

  private readonly storage = inject(StorageService);

  protected readonly draft = linkedSignal<CrewMember>(() => ({ ...this.member() }));

  protected readonly ranks = this.storage.ranks;
  protected readonly nationalities = this.storage.nationalities;
  protected readonly ports = this.storage.ports;

  private flagStateName(): string {
    return this.storage.ship().nationality?.trim() || 'Flag state';
  }

  protected flagStateBookSectionTitle(): string {
    return `${this.flagStateName()} seaman's book`;
  }

  protected flagStateBookNumberLabel(): string {
    return `${this.flagStateName()} S/book No.`;
  }

  protected flagStateBookIssueLabel(): string {
    return `${this.flagStateName()} S/book issue`;
  }

  protected flagStateBookExpiryLabel(): string {
    return `${this.flagStateName()} S/book expiry`;
  }

  protected updateField(field: keyof CrewMember, value: string | boolean): void {
    this.draft.update((d) => ({ ...d, [field]: value }));
  }

  protected setYellowFeverExpiryIsText(checked: boolean): void {
    this.draft.update((d) => ({
      ...d,
      yellowFeverExpiryIsText: checked,
      yellowFeverExpiryText:
        checked && !d.yellowFeverExpiryText.trim()
          ? 'VALIDITY FOR LIFE OF PERSON'
          : d.yellowFeverExpiryText,
    }));
  }

  /** Signature drop persists to the store — re-read the member so the draft reflects it. */
  protected onSignatureChanged(): void {
    const updated = this.storage.allCrew().find((m) => m.id === this.member().id);
    if (updated) this.draft.set({ ...updated });
  }

  protected onSave(): void {
    this.save.emit(this.draft());
  }
}
