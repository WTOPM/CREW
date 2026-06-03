import { Component, computed, inject, signal } from '@angular/core';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';
import { DocumentsNavComponent } from '../../components/documents-nav/documents-nav.component';
import { LookupSelectComponent } from '../../components/lookup-select/lookup-select.component';
import { PortSelectComponent } from '../../components/port-select/port-select.component';
import { CrewListKind, CrewMember, ShipInfo } from '../../models/crew.models';
import { StorageService } from '../../services/storage.service';
import { ToastService } from '../../services/toast.service';
import { formatDisplayDate } from '../../utils/date.util';

@Component({
  selector: 'app-home',
  imports: [FormsModule, DragDropModule, DocumentsNavComponent, LookupSelectComponent, PortSelectComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  protected readonly storage = inject(StorageService);
  private readonly toast = inject(ToastService);

  protected readonly ship = this.storage.ship;
  protected readonly ports = this.storage.ports;
  protected readonly ranks = this.storage.ranks;
  protected readonly nationalities = this.storage.nationalities;
  protected readonly activeCrewArrival = this.storage.activeCrewArrival;
  protected readonly activeCrewDeparture = this.storage.activeCrewDeparture;
  protected readonly archivedCrew = this.storage.archivedCrew;

  protected readonly crewTab = signal<CrewListKind>('arrival');
  protected readonly listCrew = computed(() =>
    this.crewTab() === 'arrival' ? this.activeCrewArrival() : this.activeCrewDeparture(),
  );

  protected editingId = signal<string | null>(null);
  protected editDraft = signal<CrewMember | null>(null);
  protected showArchive = signal(false);
  protected dataPath = signal<string | null>(null);

  constructor() {
    void this.storage.getDataPath().then((p) => this.dataPath.set(p));
  }

  protected formatDate = formatDisplayDate;

  /** Ship flag / registry (Settings → ship Nationality). */
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

  protected addMemberToArrival(): void {
    const member = this.storage.addCrewMemberToArrival();
    this.startEdit(member);
  }

  protected addMemberToArchive(): void {
    const member = this.storage.addCrewMemberToArchive();
    this.showArchive.set(true);
    this.startEdit(member);
  }

  protected setCrewTab(tab: CrewListKind): void {
    this.crewTab.set(tab);
  }

  protected archive(id: string): void {
    const member = this.storage.allCrew().find((m) => m.id === id);
    if (
      this.crewTab() === 'departure' &&
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

  protected restoreFromArchive(id: string): void {
    this.storage.restoreCrewMemberToList(id, this.crewTab());
    this.toast.showRestored();
  }

  protected syncDepartureFromArrival(): void {
    this.storage.syncDepartureFromArrival();
  }

  protected applyDepartureToArrival(): void {
    if (
      !confirm(
        'Apply departure crew to arrival? Arrival list will match departure (people only on arrival will be removed from arrival).',
      )
    ) {
      return;
    }
    this.storage.applyDepartureToArrival();
    this.crewTab.set('arrival');
    this.toast.show('Arrival list updated from departure', 'success');
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

  protected remove(id: string): void {
    if (confirm('Delete this crew member permanently?')) {
      this.storage.removeCrewMember(id);
      this.toast.showDeleted();
    }
  }

  protected dropCrew(event: CdkDragDrop<CrewMember[]>): void {
    this.storage.reorderCrewList(this.crewTab(), event.previousIndex, event.currentIndex);
  }

  protected restoreListLabel(): string {
    return this.crewTab() === 'arrival' ? 'Add to arrival list' : 'Add to departure list';
  }

  protected updateDraft(field: keyof CrewMember, value: string | boolean): void {
    const draft = this.editDraft();
    if (!draft) return;
    this.editDraft.set({ ...draft, [field]: value });
  }
}
