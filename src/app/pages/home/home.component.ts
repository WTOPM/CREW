import { Component, computed, inject, signal } from '@angular/core';

import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';

import { FormsModule } from '@angular/forms';

import { DocumentsNavComponent } from '../../components/documents-nav/documents-nav.component';

import { CrewDocDropZoneComponent } from '../../components/crew-doc-drop-zone/crew-doc-drop-zone.component';
import { CrewDocIconComponent } from '../../components/crew-doc-icon/crew-doc-icon.component';
import { DatePickerComponent } from '../../components/date-picker/date-picker.component';
import { PortSelectComponent } from '../../components/port-select/port-select.component';
import { CrewEditModalComponent } from '../../components/crew-edit-modal/crew-edit-modal.component';
import { PassengerEditModalComponent } from '../../components/passenger-edit-modal/passenger-edit-modal.component';
import { CrewDocumentService } from '../../services/crew-document.service';
import { CrewSignatureService } from '../../services/crew-signature.service';

import {
  CrewListKind,
  CrewMember,
  crewMemberListDiff,
  type CrewListMemberDiff,
  DepartureToArrivalSyncPreview,
  ArrivalToDepartureSyncPreview,
  ShipInfo,
} from '../../models/crew.models';

import { PASSENGER_RANK, PassengerMember, PaxListKind } from '../../models/passenger.models';

import { StorageService } from '../../services/storage.service';
import { CrewStore } from '../../services/crew.store';
import { PassengerStore } from '../../services/passenger.store';

import { ToastService } from '../../services/toast.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { AppSnapshotArchiveService } from '../../services/app-snapshot-archive.service';

import { filterCrewArchive, filterPassengerArchive } from '../../utils/archive-search.util';
import { formatDisplayDate } from '../../utils/date.util';

export type HomeListTab = 'crew-arrival' | 'crew-departure' | 'pax-arrival' | 'pax-departure';

@Component({
  selector: 'app-home',

  imports: [
    FormsModule,
    DragDropModule,
    DocumentsNavComponent,
    PortSelectComponent,
    DatePickerComponent,
    CrewDocIconComponent,
    CrewDocDropZoneComponent,
    CrewEditModalComponent,
    PassengerEditModalComponent,
  ],

  templateUrl: './home.component.html',

  styleUrl: './home.component.css',
})
export class HomeComponent {
  protected readonly storage = inject(StorageService);
  protected readonly crew = inject(CrewStore);
  protected readonly passengers = inject(PassengerStore);

  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly crewDocs = inject(CrewDocumentService);
  private readonly crewSignatures = inject(CrewSignatureService);
  protected readonly appSnapshot = inject(AppSnapshotArchiveService);

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

  protected readonly crewListKind = computed(
    (): CrewListKind => (this.listTab() === 'crew-departure' ? 'departure' : 'arrival'),
  );

  protected readonly paxListKind = computed(
    (): PaxListKind => (this.listTab() === 'pax-departure' ? 'departure' : 'arrival'),
  );

  protected readonly listCrew = computed(() =>
    this.crewListKind() === 'arrival' ? this.activeCrewArrival() : this.activeCrewDeparture(),
  );

  protected readonly listPassengers = computed(() =>
    this.paxListKind() === 'arrival'
      ? this.activePassengersArrival()
      : this.activePassengersDeparture(),
  );

  protected readonly crewArchiveSearch = signal('');
  protected readonly paxArchiveSearch = signal('');

  protected readonly filteredArchivedCrew = computed(() =>
    filterCrewArchive(this.archivedCrew(), this.crewArchiveSearch()),
  );

  protected readonly filteredArchivedPassengers = computed(() =>
    filterPassengerArchive(this.archivedPassengers(), this.paxArchiveSearch()),
  );

  protected editingCrew = signal<CrewMember | null>(null);

  protected editingPax = signal<PassengerMember | null>(null);

  protected showArchive = signal(false);

  protected showPaxArchive = signal(false);

  protected formatDate = formatDisplayDate;
  protected readonly passengerRank = PASSENGER_RANK;

  protected crewMemberDiff(member: CrewMember): CrewListMemberDiff | null {
    if (this.crewListsInSync()) return null;
    return crewMemberListDiff(member);
  }

  protected crewMemberDiffTitle(member: CrewMember): string | undefined {
    const diff = this.crewMemberDiff(member);
    if (diff === 'arrival-only') return 'On arrival only — not on departure list';
    if (diff === 'departure-only') return 'On departure only — not on arrival list';
    return undefined;
  }

  protected crewArchiveCountLabel(): string {
    return this.archiveCountLabel(
      this.archivedCrew().length,
      this.filteredArchivedCrew().length,
      this.crewArchiveSearch(),
    );
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

  /** Descriptive toast text for voyage fields (official English). */
  private static readonly VOYAGE_FIELD_MESSAGES: Partial<Record<keyof ShipInfo, string>> = {
    lastPortOfCall: 'Last port of call updated',
    portOfCall: 'Port of call updated',
    nextPortOfCall: 'Next port of call updated',
    dateOfArrival: 'Date of arrival updated',
    dateOfDeparture: 'Date of departure updated',
  };

  protected onShipChange(field: keyof ShipInfo, value: string): void {
    const message = HomeComponent.VOYAGE_FIELD_MESSAGES[field];
    this.storage.updateShip({ [field]: value }, undefined, message);
  }

  protected startEdit(member: CrewMember): void {
    this.cancelPassengerEdit();
    this.editingCrew.set(member);
  }

  protected cancelEdit(): void {
    this.editingCrew.set(null);
  }

  protected onCrewSave(draft: CrewMember): void {
    const m = this.editingCrew();
    if (!m) return;
    this.crew.updateCrewMember(m.id, this.crewProfilePatch(draft), 'silent');
    this.cancelEdit();
    this.toast.showSaved();
  }

  protected startPassengerEdit(member: PassengerMember): void {
    this.cancelEdit();
    this.editingPax.set(member);
  }

  protected cancelPassengerEdit(): void {
    this.editingPax.set(null);
  }

  protected onPassengerSave(draft: PassengerMember): void {
    const p = this.editingPax();
    if (!p) return;
    this.passengers.updatePassenger(p.id, this.passengerProfilePatch(draft), 'silent');
    this.cancelPassengerEdit();
    this.toast.showSaved();
  }

  protected addMemberToArrival(): void {
    const member = this.crew.addCrewMemberToArrival();
    this.startEdit(member);
  }

  protected addMemberToDeparture(): void {
    const member = this.crew.addCrewMemberToDeparture();
    this.startEdit(member);
  }

  protected addMemberToArchive(): void {
    const member = this.crew.addCrewMemberToArchive();

    this.showArchive.set(true);

    this.startEdit(member);
  }

  protected addPassengerToArrival(): void {
    const member = this.passengers.addPassengerToArrival();
    this.startPassengerEdit(member);
  }

  protected addPassengerToDeparture(): void {
    const member = this.passengers.addPassengerToDeparture();
    this.startPassengerEdit(member);
  }

  protected addPassengerToArchive(): void {
    const member = this.passengers.addPassengerToArchive();

    this.showPaxArchive.set(true);

    this.startPassengerEdit(member);
  }

  protected setListTab(tab: HomeListTab): void {
    this.listTab.set(tab);
  }

  protected archive(id: string): void {
    this.crew.archiveFromCrewList(id, this.crewListKind());
    if (this.editingCrew()?.id === id) this.cancelEdit();
    this.toast.showArchived();
  }

  protected archivePassenger(id: string): void {
    this.passengers.archiveFromPassengerList(id, this.paxListKind());
    if (this.editingPax()?.id === id) this.cancelPassengerEdit();
    this.toast.showArchived();
  }

  protected restoreFromArchive(id: string): void {
    this.crew.restoreCrewMemberToList(id, this.crewListKind());

    this.toast.showRestored();
  }

  protected restorePassengerFromArchive(id: string): void {
    this.passengers.restorePassengerToList(id, this.paxListKind());

    this.toast.showRestored();
  }

  protected syncDepartureFromArrival(): void {
    const preview = this.crew.syncDepartureFromArrival();
    this.toast.show(this.arrivalToDepartureToast(preview), 'success');
  }

  protected applyDepartureToArrival(): void {
    const preview = this.crew.applyDepartureToArrival();
    this.listTab.set('crew-arrival');
    this.toast.show(this.departureToArrivalToast(preview, 'Crew'), 'success');
  }

  protected syncPassengerDepartureFromArrival(): void {
    const preview = this.passengers.syncPassengerDepartureFromArrival();
    this.toast.show(this.passengerArrivalToDepartureToast(preview), 'success');
  }

  protected applyPassengerDepartureToArrival(): void {
    const preview = this.passengers.applyPassengerDepartureToArrival();
    this.listTab.set('pax-arrival');
    this.toast.show(this.departureToArrivalToast(preview, 'Passengers'), 'success');
  }

  private departureToArrivalToast(preview: DepartureToArrivalSyncPreview, label: string): string {
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
    this.crew.removeFromDepartureList(id);
    if (member?.onArrivalList && !member.archived) {
      this.toast.show('Removed from departure (still on arrival)', 'info');
    } else {
      this.toast.show('Moved to archive from departure', 'info');
    }
  }

  protected removeFromArrival(id: string): void {
    const member = this.storage.allCrew().find((m) => m.id === id);
    const linked = this.storage.crewListsInSync();
    this.crew.removeFromArrivalList(id);
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
    this.passengers.removePassengerFromDepartureList(id);
    if (member?.onArrivalList && !member.archived) {
      this.toast.show('Removed from departure (still on arrival)', 'info');
    } else {
      this.toast.show('Moved to archive from departure', 'info');
    }
  }

  protected removePassengerFromArrival(id: string): void {
    const member = this.storage.allPassengers().find((m) => m.id === id);
    const linked = this.storage.passengerListsInSync();
    this.passengers.removePassengerFromArrivalList(id);
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

  protected async remove(id: string): Promise<void> {
    const ok = await this.confirmDialog.confirm({
      title: 'Delete crew member',
      message: 'Delete this crew member permanently? This cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;

    void this.crewDocs.deleteAllForCrew(id).then(() =>
      this.crewSignatures.deleteForCrew(id).then(() => {
        this.crew.removeCrewMember(id);
        this.toast.showDeleted();
      }),
    );
  }

  protected async removePassenger(id: string): Promise<void> {
    const ok = await this.confirmDialog.confirm({
      title: 'Delete passenger',
      message: 'Delete this passenger permanently? This cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;

    this.passengers.removePassenger(id);

    this.toast.showDeleted();
  }

  protected dropCrew(event: CdkDragDrop<CrewMember[]>): void {
    this.crew.reorderCrewList(this.crewListKind(), event.previousIndex, event.currentIndex);
  }

  protected dropPassengers(event: CdkDragDrop<PassengerMember[]>): void {
    this.passengers.reorderPassengerList(
      this.paxListKind(),
      event.previousIndex,
      event.currentIndex,
    );
  }

  protected restoreListLabel(): string {
    return this.crewListKind() === 'arrival' ? 'Add to arrival list' : 'Add to departure list';
  }

  protected restorePassengerListLabel(): string {
    return this.paxListKind() === 'arrival' ? 'Add to arrival list' : 'Add to departure list';
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
