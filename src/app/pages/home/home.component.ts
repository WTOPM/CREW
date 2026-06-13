import { Component, computed, inject, signal } from '@angular/core';

import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';

import { FormsModule } from '@angular/forms';

import { DocumentsNavComponent } from '../../components/documents-nav/documents-nav.component';

import { LookupSelectComponent } from '../../components/lookup-select/lookup-select.component';

import { CrewDocDropZoneComponent } from '../../components/crew-doc-drop-zone/crew-doc-drop-zone.component';
import { CrewDocIconComponent } from '../../components/crew-doc-icon/crew-doc-icon.component';
import { DatePickerComponent } from '../../components/date-picker/date-picker.component';
import { PortSelectComponent } from '../../components/port-select/port-select.component';
import { CrewDocumentService } from '../../services/crew-document.service';

import { ClickOutsideDirective } from '../../directives/click-outside.directive';

import {
  CrewListKind,
  CrewMember,
  DepartureToArrivalSyncPreview,
  ArrivalToDepartureSyncPreview,
  ShipInfo,
} from '../../models/crew.models';

import { PASSENGER_RANK, PassengerMember, PaxListKind } from '../../models/passenger.models';

import { StorageService } from '../../services/storage.service';

import { ToastService } from '../../services/toast.service';

import { filterCrewArchive, filterPassengerArchive } from '../../utils/archive-search.util';
import { formatDisplayDate } from '../../utils/date.util';

export type HomeListTab =
  | 'crew-arrival'
  | 'crew-departure'
  | 'pax-arrival'
  | 'pax-departure';

@Component({

  selector: 'app-home',

  imports: [
    FormsModule,
    DragDropModule,
    DocumentsNavComponent,
    LookupSelectComponent,
    PortSelectComponent,
    DatePickerComponent,
    CrewDocIconComponent,
    CrewDocDropZoneComponent,
    ClickOutsideDirective,
  ],

  templateUrl: './home.component.html',

  styleUrl: './home.component.css',

})

export class HomeComponent {

  protected readonly storage = inject(StorageService);

  private readonly toast = inject(ToastService);
  private readonly crewDocs = inject(CrewDocumentService);



  protected readonly ship = this.storage.ship;

  protected readonly ports = this.storage.ports;
  protected readonly ranks = this.storage.ranks;
  protected readonly nationalities = this.storage.nationalities;

  protected readonly activeCrewArrival = this.storage.activeCrewArrival;

  protected readonly activeCrewDeparture = this.storage.activeCrewDeparture;
  protected readonly crewListsInSync = this.storage.crewListsInSync;
  protected readonly crewListDiff = this.storage.crewListDiff;
  protected readonly passengerListsInSync = this.storage.passengerListsInSync;
  protected readonly passengerListDiff = this.storage.passengerListDiff;

  protected readonly archivedCrew = this.storage.archivedCrew;
  protected readonly allCrew = this.storage.allCrew;

  protected readonly activePassengersArrival = this.storage.activePassengersArrival;

  protected readonly activePassengersDeparture = this.storage.activePassengersDeparture;

  protected readonly archivedPassengers = this.storage.archivedPassengers;



  protected readonly listTab = signal<HomeListTab>('crew-arrival');

  protected readonly isCrewTab = computed(() => {
    const t = this.listTab();
    return t === 'crew-arrival' || t === 'crew-departure';
  });

  protected readonly crewListKind = computed((): CrewListKind =>
    this.listTab() === 'crew-departure' ? 'departure' : 'arrival',
  );

  protected readonly paxListKind = computed((): PaxListKind =>
    this.listTab() === 'pax-departure' ? 'departure' : 'arrival',
  );

  protected readonly listCrew = computed(() =>
    this.crewListKind() === 'arrival' ? this.activeCrewArrival() : this.activeCrewDeparture(),
  );

  protected readonly listPassengers = computed(() =>
    this.paxListKind() === 'arrival' ? this.activePassengersArrival() : this.activePassengersDeparture(),
  );

  protected readonly crewArchiveSearch = signal('');
  protected readonly paxArchiveSearch = signal('');

  protected readonly filteredArchivedCrew = computed(() =>
    filterCrewArchive(this.archivedCrew(), this.crewArchiveSearch()),
  );

  protected readonly filteredArchivedPassengers = computed(() =>
    filterPassengerArchive(this.archivedPassengers(), this.paxArchiveSearch()),
  );

  protected editingId = signal<string | null>(null);

  protected editDraft = signal<CrewMember | null>(null);

  protected editingPassengerId = signal<string | null>(null);

  protected passengerEditDraft = signal<PassengerMember | null>(null);

  protected showArchive = signal(false);

  protected showPaxArchive = signal(false);



  protected formatDate = formatDisplayDate;
  protected readonly passengerRank = PASSENGER_RANK;

  protected crewArchiveCountLabel(): string {
    return this.archiveCountLabel(this.archivedCrew().length, this.filteredArchivedCrew().length, this.crewArchiveSearch());
  }

  protected paxArchiveCountLabel(): string {
    return this.archiveCountLabel(
      this.archivedPassengers().length,
      this.filteredArchivedPassengers().length,
      this.paxArchiveSearch(),
    );
  }

  private archiveCountLabel(total: number, shown: number, query: string): string {
    if (!query.trim()) return String(total);
    return `${shown} / ${total}`;
  }



  protected flagStateName(): string {

    return this.ship().nationality?.trim() || 'Flag state';

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



  protected onShipChange(field: keyof ShipInfo, value: string): void {

    this.storage.updateShip({ [field]: value });

  }



  protected startEdit(member: CrewMember): void {

    this.cancelPassengerEdit();

    this.editingId.set(member.id);

    this.editDraft.set({ ...member });

  }



  protected cancelEdit(): void {

    this.editingId.set(null);

    this.editDraft.set(null);

  }



  protected saveEdit(): void {

    const draft = this.editDraft();

    const id = this.editingId();

    if (!draft || !id) return;

    this.storage.updateCrewMember(id, this.crewProfilePatch(draft), 'silent');

    this.cancelEdit();

    this.toast.showSaved();

  }



  protected startPassengerEdit(member: PassengerMember): void {

    this.cancelEdit();

    this.editingPassengerId.set(member.id);

    this.passengerEditDraft.set({ ...member });

  }



  protected cancelPassengerEdit(): void {

    this.editingPassengerId.set(null);

    this.passengerEditDraft.set(null);

  }



  protected savePassengerEdit(): void {

    const draft = this.passengerEditDraft();

    const id = this.editingPassengerId();

    if (!draft || !id) return;

    this.storage.updatePassenger(id, this.passengerProfilePatch(draft), 'silent');

    this.cancelPassengerEdit();

    this.toast.showSaved();

  }



  protected addMemberToArrival(): void {
    const member = this.storage.addCrewMemberToArrival();
    this.startEdit(member);
  }

  protected addMemberToDeparture(): void {
    const member = this.storage.addCrewMemberToDeparture();
    this.startEdit(member);
  }



  protected addMemberToArchive(): void {

    const member = this.storage.addCrewMemberToArchive();

    this.showArchive.set(true);

    this.startEdit(member);

  }



  protected addPassengerToArrival(): void {
    const member = this.storage.addPassengerToArrival();
    this.startPassengerEdit(member);
  }

  protected addPassengerToDeparture(): void {
    const member = this.storage.addPassengerToDeparture();
    this.startPassengerEdit(member);
  }



  protected addPassengerToArchive(): void {

    const member = this.storage.addPassengerToArchive();

    this.showPaxArchive.set(true);

    this.startPassengerEdit(member);

  }



  protected setListTab(tab: HomeListTab): void {
    this.listTab.set(tab);
  }



  protected archive(id: string): void {
    this.storage.archiveFromCrewList(id, this.crewListKind());
    if (this.editingId() === id) this.cancelEdit();
    this.toast.showArchived();
  }

  protected archivePassenger(id: string): void {
    this.storage.archiveFromPassengerList(id, this.paxListKind());
    if (this.editingPassengerId() === id) this.cancelPassengerEdit();
    this.toast.showArchived();
  }



  protected restoreFromArchive(id: string): void {

    this.storage.restoreCrewMemberToList(id, this.crewListKind());

    this.toast.showRestored();

  }



  protected restorePassengerFromArchive(id: string): void {

    this.storage.restorePassengerToList(id, this.paxListKind());

    this.toast.showRestored();

  }



  protected syncDepartureFromArrival(): void {
    const preview = this.storage.syncDepartureFromArrival();
    this.toast.show(this.arrivalToDepartureToast(preview), 'success');
  }



  protected applyDepartureToArrival(): void {
    const preview = this.storage.applyDepartureToArrival();
    this.listTab.set('crew-arrival');
    this.toast.show(this.departureToArrivalToast(preview, 'Crew'), 'success');
  }



  protected syncPassengerDepartureFromArrival(): void {
    const preview = this.storage.syncPassengerDepartureFromArrival();
    this.toast.show(this.passengerArrivalToDepartureToast(preview), 'success');
  }



  protected applyPassengerDepartureToArrival(): void {
    const preview = this.storage.applyPassengerDepartureToArrival();
    this.listTab.set('pax-arrival');
    this.toast.show(this.departureToArrivalToast(preview, 'Passengers'), 'success');
  }

  private departureToArrivalToast(
    preview: DepartureToArrivalSyncPreview,
    label: string,
  ): string {
    const parts = [`${label}: ${preview.onDeparture} from departure → arrival`];
    if (preview.arrivalOnlyToArchive > 0) {
      parts.push(`${preview.arrivalOnlyToArchive} to archive`);
    }
    if (preview.departureArchiveMerged > 0) {
      parts.push(`${preview.departureArchiveMerged} from departure archive merged`);
    }
    return parts.join('; ');
  }

  private arrivalToDepartureToast(preview: ArrivalToDepartureSyncPreview): string {
    const parts = [`${preview.onArrival} from arrival → departure`];
    if (preview.departureOnlyToArchive > 0) {
      parts.push(`${preview.departureOnlyToArchive} departure-only to archive`);
    }
    if (preview.departureArchiveMerged > 0) {
      parts.push(`${preview.departureArchiveMerged} departure archive merged`);
    }
    return parts.join('; ');
  }

  private passengerArrivalToDepartureToast(preview: ArrivalToDepartureSyncPreview): string {
    const parts = [`Passengers: ${preview.onArrival} from arrival → departure`];
    if (preview.departureOnlyToArchive > 0) {
      parts.push(`${preview.departureOnlyToArchive} departure-only to archive`);
    }
    if (preview.departureArchiveMerged > 0) {
      parts.push(`${preview.departureArchiveMerged} departure archive merged`);
    }
    return parts.join('; ');
  }



  protected removeFromDeparture(id: string): void {
    const member = this.storage.allCrew().find((m) => m.id === id);
    this.storage.removeFromDepartureList(id);
    if (member?.onArrivalList && !member.archived) {
      this.toast.show('Removed from departure (still on arrival)', 'info');
    } else {
      this.toast.show('Moved to archive from departure', 'info');
    }
  }

  protected removeFromArrival(id: string): void {
    const member = this.storage.allCrew().find((m) => m.id === id);
    const linked = this.storage.crewListsInSync();
    this.storage.removeFromArrivalList(id);
    if (linked) {
      this.toast.showArchived();
    } else if (member?.onDepartureList && !member.archived) {
      this.toast.show('Removed from arrival (still on departure list for printing)', 'info');
    } else {
      this.toast.showArchived();
    }
  }



  protected removePassengerFromDeparture(id: string): void {
    const member = this.storage.allPassengers().find((m) => m.id === id);
    this.storage.removePassengerFromDepartureList(id);
    if (member?.onArrivalList && !member.archived) {
      this.toast.show('Removed from departure (still on arrival)', 'info');
    } else {
      this.toast.show('Moved to archive from departure', 'info');
    }
  }

  protected removePassengerFromArrival(id: string): void {
    const member = this.storage.allPassengers().find((m) => m.id === id);
    const linked = this.storage.passengerListsInSync();
    this.storage.removePassengerFromArrivalList(id);
    if (linked) {
      this.toast.showArchived();
    } else if (member?.onDepartureList && !member.archived) {
      this.toast.show('Removed from arrival (still on departure list for printing)', 'info');
    } else {
      this.toast.showArchived();
    }
  }



  protected onCrewDocAttached(): void {
    /* storage signal refresh */
  }

  protected remove(id: string): void {

    if (confirm('Delete this crew member permanently?')) {
      void this.crewDocs.deleteAllForCrew(id).then(() => {
        this.storage.removeCrewMember(id);
        this.toast.showDeleted();
      });
    }

  }



  protected removePassenger(id: string): void {

    if (confirm('Delete this passenger permanently?')) {

      this.storage.removePassenger(id);

      this.toast.showDeleted();

    }

  }



  protected dropCrew(event: CdkDragDrop<CrewMember[]>): void {
    this.storage.reorderCrewList(this.crewListKind(), event.previousIndex, event.currentIndex);
  }



  protected dropPassengers(event: CdkDragDrop<PassengerMember[]>): void {
    this.storage.reorderPassengerList(this.paxListKind(), event.previousIndex, event.currentIndex);
  }



  protected restoreListLabel(): string {

    return this.crewListKind() === 'arrival' ? 'Add to arrival list' : 'Add to departure list';

  }



  protected restorePassengerListLabel(): string {

    return this.paxListKind() === 'arrival' ? 'Add to arrival list' : 'Add to departure list';

  }



  protected updateDraft(field: keyof CrewMember, value: string | boolean): void {

    const draft = this.editDraft();

    if (!draft) return;

    this.editDraft.set({ ...draft, [field]: value });

  }

  protected setYellowFeverExpiryIsText(checked: boolean): void {
    const draft = this.editDraft();
    if (!draft) return;
    this.editDraft.set({
      ...draft,
      yellowFeverExpiryIsText: checked,
      yellowFeverExpiryText:
        checked && !draft.yellowFeverExpiryText.trim()
          ? 'VALIDITY FOR LIFE OF PERSON'
          : draft.yellowFeverExpiryText,
    });
  }



  protected updatePassengerDraft(field: keyof PassengerMember, value: string | boolean): void {

    const draft = this.passengerEditDraft();

    if (!draft) return;

    this.passengerEditDraft.set({ ...draft, [field]: value });

  }

  /** Persist only profile fields — list flags stay in storage unchanged. */
  private passengerProfilePatch(draft: PassengerMember): Partial<PassengerMember> {
    return {
      familyName: draft.familyName,
      givenNames: draft.givenNames,
      gender: draft.gender,
      nationality: draft.nationality,
      dateOfBirth: draft.dateOfBirth,
      placeOfBirth: draft.placeOfBirth,
      passport: draft.passport,
      passportIssueDate: draft.passportIssueDate,
      passportExpiryDate: draft.passportExpiryDate,
    };
  }

  private crewProfilePatch(draft: CrewMember): Partial<CrewMember> {
    return {
      familyName: draft.familyName,
      givenNames: draft.givenNames,
      rank: draft.rank,
      nationality: draft.nationality,
      gender: draft.gender,
      dateOfBirth: draft.dateOfBirth,
      placeOfBirth: draft.placeOfBirth,
      passport: draft.passport,
      passportPlaceOfIssue: draft.passportPlaceOfIssue,
      passportIssueDate: draft.passportIssueDate,
      passportExpiryDate: draft.passportExpiryDate,
      seamansBook: draft.seamansBook,
      seamansBookPlaceOfIssue: draft.seamansBookPlaceOfIssue,
      sbookIssueDate: draft.sbookIssueDate,
      sbookExpiryDate: draft.sbookExpiryDate,
      cyprusSeamansBook: draft.cyprusSeamansBook,
      cyprusIssueDate: draft.cyprusIssueDate,
      cyprusExpiryDate: draft.cyprusExpiryDate,
      visa: draft.visa,
      visaIssueDate: draft.visaIssueDate,
      visaExpiryDate: draft.visaExpiryDate,
      joiningDate: draft.joiningDate,
      joiningPort: draft.joiningPort,
      vaccineMedicalProduct: draft.vaccineMedicalProduct,
      dateOfVaccination: draft.dateOfVaccination,
      dateOfYellowFeverVaccination: draft.dateOfYellowFeverVaccination,
      yellowFeverExpiryDate: draft.yellowFeverExpiryDate,
      yellowFeverExpiryText: draft.yellowFeverExpiryText,
      yellowFeverExpiryIsText: draft.yellowFeverExpiryIsText,
      documents: draft.documents,
    };
  }

}

