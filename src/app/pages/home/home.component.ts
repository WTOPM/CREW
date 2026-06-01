import { Component, inject, signal } from '@angular/core';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';
import { DocumentsNavComponent } from '../../components/documents-nav/documents-nav.component';
import { LookupSelectComponent } from '../../components/lookup-select/lookup-select.component';
import { PortSelectComponent } from '../../components/port-select/port-select.component';
import { CrewMember, ShipInfo, portCode, portLabel } from '../../models/crew.models';
import { StorageService } from '../../services/storage.service';
import { formatDisplayDate } from '../../utils/date.util';

@Component({
  selector: 'app-home',
  imports: [FormsModule, DragDropModule, DocumentsNavComponent, LookupSelectComponent, PortSelectComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  protected readonly storage = inject(StorageService);

  protected readonly ship = this.storage.ship;
  protected readonly ports = this.storage.ports;
  protected readonly ranks = this.storage.ranks;
  protected readonly nationalities = this.storage.nationalities;
  protected readonly activeCrew = this.storage.activeCrew;
  protected readonly archivedCrew = this.storage.archivedCrew;

  protected editingId = signal<string | null>(null);
  protected editDraft = signal<CrewMember | null>(null);
  protected showArchive = signal(false);
  protected dataPath = signal<string | null>(null);

  constructor() {
    void this.storage.getDataPath().then((p) => this.dataPath.set(p));
  }

  protected formatDate = formatDisplayDate;
  protected portLabel = portLabel;

  protected portCode(name: string): string {
    return portCode(name, this.ports());
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
    this.storage.updateCrewMember(id, draft);
    this.cancelEdit();
  }

  protected addMember(): void {
    const member = this.storage.addCrewMember();
    this.startEdit(member);
  }

  protected archive(id: string): void {
    this.storage.archiveCrewMember(id);
    if (this.editingId() === id) this.cancelEdit();
  }

  protected restore(id: string): void {
    this.storage.restoreCrewMember(id);
  }

  protected remove(id: string): void {
    if (confirm('Удалить запись безвозвратно?')) {
      this.storage.removeCrewMember(id);
    }
  }

  protected dropCrew(event: CdkDragDrop<CrewMember[]>): void {
    this.storage.reorderActiveCrew(event.previousIndex, event.currentIndex);
  }

  protected updateDraft(field: keyof CrewMember, value: string | boolean): void {
    const draft = this.editDraft();
    if (!draft) return;
    this.editDraft.set({ ...draft, [field]: value });
  }
}
