import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LookupSelectComponent } from '../../components/lookup-select/lookup-select.component';
import { PortSelectComponent } from '../../components/port-select/port-select.component';
import { CrewMember, ShipInfo, portCode, portLabel } from '../../models/crew.models';
import { ExcelImportService } from '../../services/excel-import.service';
import { PdfCrewArrService } from '../../services/pdf-crew-arr.service';
import { StorageService } from '../../services/storage.service';
import { ToastService } from '../../services/toast.service';
import { formatDisplayDate } from '../../utils/date.util';

@Component({
  selector: 'app-home',
  imports: [FormsModule, LookupSelectComponent, PortSelectComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  protected readonly storage = inject(StorageService);
  private readonly excelImport = inject(ExcelImportService);
  private readonly pdf = inject(PdfCrewArrService);
  private readonly toast = inject(ToastService);

  protected readonly ship = this.storage.ship;
  protected readonly ports = this.storage.ports;
  protected readonly ranks = this.storage.ranks;
  protected readonly activeCrew = this.storage.activeCrew;
  protected readonly archivedCrew = this.storage.archivedCrew;

  protected editingId = signal<string | null>(null);
  protected editDraft = signal<CrewMember | null>(null);
  protected showArchive = signal(false);
  protected dataPath = signal<string | null>(null);
  protected importMessage = signal('');

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

  protected updateDraft(field: keyof CrewMember, value: string | boolean): void {
    const draft = this.editDraft();
    if (!draft) return;
    this.editDraft.set({ ...draft, [field]: value });
  }

  protected async onExcelImport(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const data = this.excelImport.parseDocument(buffer);
      this.storage.replaceAll(data);
      this.importMessage.set(
        `Импортировано: ${data.crew.filter((c) => !c.archived).length} активных, ${data.crew.filter((c) => c.archived).length} в архиве`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Import failed';
      this.importMessage.set(msg);
      this.toast.showError(msg);
    }
    input.value = '';
  }

  protected exportJson(): void {
    void this.storage.exportData();
  }

  protected async onJsonImport(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      await this.storage.importFromFile(file);
      this.importMessage.set('Данные загружены из JSON');
    } catch {
      this.importMessage.set('Ошибка чтения JSON');
      this.toast.showError('Import failed');
    }
    input.value = '';
  }

  protected openCrewList(): void {
    const ok = this.pdf.openPreview(
      {
        ship: this.ship(),
        crew: this.storage.allCrew(),
        crewArr: this.storage.crewArr(),
        ports: this.ports(),
        ranks: this.ranks(),
      },
      this.activeCrew(),
    );
    if (!ok) {
      this.toast.showError('Allow pop-ups to open Crew List preview');
    }
  }
}
