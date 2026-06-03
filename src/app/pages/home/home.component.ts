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

import {
  CrewListKind,
  CrewMember,
  DepartureToArrivalSyncPreview,
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

  protected dataPath = signal<string | null>(null);



  constructor() {

    void this.storage.getDataPath().then((p) => this.dataPath.set(p));

  }



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

    this.storage.updateCrewMember(id, draft, 'silent');

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

    this.storage.updatePassenger(id, draft, 'silent');

    this.cancelPassengerEdit();

    this.toast.showSaved();

  }



  protected addMemberToArrival(): void {

    const member = this.storage.addCrewMemberToArrival();

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



  protected addPassengerToArchive(): void {

    const member = this.storage.addPassengerToArchive();

    this.showPaxArchive.set(true);

    this.startPassengerEdit(member);

  }



  protected setListTab(tab: HomeListTab): void {
    const prev = this.listTab();
    this.listTab.set(tab);
    if (prev === 'crew-departure' && tab === 'crew-arrival') {
      const n = this.storage.archiveArrivalOnlyCrew();
      if (n > 0) {
        this.toast.show(
          `${n} crew moved to archive (on arrival, not on departure)`,
          'info',
        );
      }
    }
    if (prev === 'pax-departure' && tab === 'pax-arrival') {
      const n = this.storage.archiveArrivalOnlyPassengers();
      if (n > 0) {
        this.toast.show(
          `${n} passengers moved to archive (on arrival, not on departure)`,
          'info',
        );
      }
    }
  }



  protected archive(id: string): void {

    const member = this.storage.allCrew().find((m) => m.id === id);

    if (

      this.crewListKind() === 'departure' &&

      member &&

      !member.archived &&

      member.onArrivalList

    ) {

      this.storage.removeFromDepartureList(id);

      if (this.editingId() === id) this.cancelEdit();

      this.toast.show('Removed from departure (still on arrival)', 'info');

      return;

    }



    this.storage.archiveCrewMember(id);

    if (this.editingId() === id) this.cancelEdit();

    this.toast.showArchived();

  }



  protected archivePassenger(id: string): void {

    const member = this.storage.allPassengers().find((m) => m.id === id);

    if (

      this.paxListKind() === 'departure' &&

      member &&

      !member.archived &&

      member.onArrivalList

    ) {

      this.storage.removePassengerFromDepartureList(id);

      if (this.editingPassengerId() === id) this.cancelPassengerEdit();

      this.toast.show('Removed from departure (still on arrival)', 'info');

      return;

    }



    this.storage.archivePassenger(id);

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

    this.storage.syncDepartureFromArrival();

  }



  protected applyDepartureToArrival(): void {
    const preview = this.storage.previewDepartureToArrival();
    if (!this.confirmDepartureToArrival(preview, 'crew')) {
      return;
    }
    this.storage.applyDepartureToArrival();
    this.listTab.set('crew-arrival');
    this.toast.show(this.departureToArrivalToast(preview, 'Crew'), 'success');
  }



  protected syncPassengerDepartureFromArrival(): void {

    this.storage.syncPassengerDepartureFromArrival();

  }



  protected applyPassengerDepartureToArrival(): void {
    const preview = this.storage.previewPassengerDepartureToArrival();
    if (!this.confirmDepartureToArrival(preview, 'passengers')) {
      return;
    }
    this.storage.applyPassengerDepartureToArrival();
    this.listTab.set('pax-arrival');
    this.toast.show(this.departureToArrivalToast(preview, 'Passengers'), 'success');
  }

  private confirmDepartureToArrival(
    preview: DepartureToArrivalSyncPreview,
    label: 'crew' | 'passengers',
  ): boolean {
    if (preview.onDeparture === 0 && preview.arrivalOnlyToArchive === 0) {
      this.toast.showError(`No active ${label} on departure or arrival`);
      return false;
    }
    const lines = [
      'Update arrival list for the next port?',
      '',
      `• On departure: ${preview.onDeparture} → will be on arrival`,
    ];
    if (preview.arrivalOnlyToArchive > 0) {
      lines.push(
        `• Only on arrival (not on departure): ${preview.arrivalOnlyToArchive} → moved to archive`,
      );
    }
    return confirm(lines.join('\n'));
  }

  private departureToArrivalToast(
    preview: DepartureToArrivalSyncPreview,
    label: string,
  ): string {
    const parts = [`${label}: ${preview.onDeparture} from departure → arrival`];
    if (preview.arrivalOnlyToArchive > 0) {
      parts.push(`${preview.arrivalOnlyToArchive} to archive`);
    }
    return parts.join('; ');
  }



  protected removeFromDeparture(id: string): void {

    const member = this.storage.allCrew().find((m) => m.id === id);

    this.storage.removeFromDepartureList(id);

    if (member?.onArrivalList && !member.archived) {

      this.toast.show('Removed from departure (still on arrival)', 'info');

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



  protected updatePassengerDraft(field: keyof PassengerMember, value: string | boolean): void {

    const draft = this.passengerEditDraft();

    if (!draft) return;

    this.passengerEditDraft.set({ ...draft, [field]: value });

  }

}

