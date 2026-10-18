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
import { CrewMember, normalizeCrewCabin } from '../../models/crew.models';
import { StorageService } from '../../services/storage.service';
import { ToastService } from '../../services/toast.service';
import { addYearsToIsoDate } from '../../utils/date.util';
import { copyTextToClipboard, formatLabeledLines } from '../../utils/copy-text.util';
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
  /** Departure list: open to inspect fields without Save. */
  readonly viewOnly = input(false);
  readonly save = output<CrewMember>();
  readonly cancel = output<void>();

  private readonly storage = inject(StorageService);
  private readonly toast = inject(ToastService);
  private readonly host = inject(ElementRef<HTMLElement>);

  protected readonly draft = linkedSignal<CrewMember>(() => ({ ...this.member() }));

  protected readonly ranks = this.storage.ranks;
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
    if (this.viewOnly()) return;
    this.draft.update((d) => ({ ...d, [field]: value }));
  }

  /** Digits only while typing (max 3). */
  protected onCabinDraft(value: string): void {
    const digits = String(value ?? '').replace(/\D/g, '').slice(0, 3);
    this.updateField('cabin', digits);
  }

  /** Enter / blur — keep only a valid cabin 1–999 (or clear). */
  protected applyCabin(event?: Event): void {
    event?.preventDefault();
    const next = normalizeCrewCabin(this.draft().cabin);
    if (next !== this.draft().cabin) this.updateField('cabin', next);
  }

  protected onDocumentIssueDateCommitted(
    expiryField: 'passportExpiryDate' | 'sbookExpiryDate' | 'cyprusExpiryDate',
    issueIso: string,
  ): void {
    if (this.viewOnly()) return;
    if (!issueIso || !/^\d{4}-\d{2}-\d{2}$/.test(issueIso)) return;
    const expiry = this.draft()[expiryField];
    if (expiryField === 'sbookExpiryDate' && expiry === 'UNLIMITED') return;
    if (String(expiry ?? '').trim()) return;
    const expiryIso = addYearsToIsoDate(issueIso, 10);
    if (!expiryIso) return;
    this.updateField(expiryField, expiryIso);
  }

  protected setYellowFeverExpiryIsText(checked: boolean): void {
    if (this.viewOnly()) return;
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
    if (this.viewOnly()) return;
    const updated = this.storage.allCrew().find((m) => m.id === this.member().id);
    if (updated) this.draft.set({ ...updated });
  }

  protected onSave(): void {
    if (this.viewOnly()) return;
    const cabin = normalizeCrewCabin(this.draft().cabin);
    this.save.emit({ ...this.draft(), cabin });
  }

  protected async copyDetails(): Promise<void> {
    const d = this.draft();
    const flag = this.flagStateName();
    const yfExpiry = d.yellowFeverExpiryIsText
      ? d.yellowFeverExpiryText
      : d.yellowFeverExpiryDate;
    const text = formatLabeledLines([
      ['Family name', d.familyName],
      ['Given names', d.givenNames],
      ['Rank', d.rank],
      ['Nationality', d.nationality],
      ['Gender', d.gender],
      ['Date of birth', d.dateOfBirth],
      ['Place of birth', d.placeOfBirth],
      ['Passport No.', d.passport],
      ['Passport place of issue', d.passportPlaceOfIssue],
      ['Passport issue', d.passportIssueDate],
      ['Passport expiry', d.passportExpiryDate],
      ["Seaman's book No.", d.seamansBook],
      ["Seaman's book place of issue", d.seamansBookPlaceOfIssue],
      ["Seaman's book issue", d.sbookIssueDate],
      ["Seaman's book expiry", d.sbookExpiryDate],
      [`${flag} S/book No.`, d.cyprusSeamansBook],
      [`${flag} S/book issue`, d.cyprusIssueDate],
      [`${flag} S/book expiry`, d.cyprusExpiryDate],
      ['Visa', d.visa],
      ['Visa issue', d.visaIssueDate],
      ['Visa expiry', d.visaExpiryDate],
      ['Joining date', d.joiningDate],
      ['Joining port', d.joiningPort],
      ['Cabin', d.cabin],
      ['Vaccine', d.vaccineMedicalProduct],
      ['Vaccination date', d.dateOfVaccination],
      ['Yellow fever vaccination', d.dateOfYellowFeverVaccination],
      ['Yellow fever expiry', yfExpiry],
    ]);
    if (!text) {
      this.toast.show('Nothing to copy', 'info');
      return;
    }
    const ok = await copyTextToClipboard(text);
    if (ok) this.toast.show('Details copied', 'success');
    else this.toast.showError('Could not copy');
  }
}
