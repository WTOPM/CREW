import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CREW_DOCUMENT_TYPES,
  crewMemberLabel,
  CrewDocumentType,
  CrewMember,
} from '../../models/crew.models';
import { CrewDocumentService } from '../../services/crew-document.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-crew-doc-drop-zone',
  imports: [FormsModule],
  template: `
    <div
      class="crew-doc-zone"
      [class.crew-doc-zone--active]="dragOver()"
      (click)="onZoneClick()"
      (dragover)="onDragOver($event)"
      (dragleave)="onDragLeave($event)"
      (drop)="onDrop($event)"
    >
      <span class="crew-doc-zone-icon" aria-hidden="true">📄</span>
      <span class="crew-doc-zone-text">
        Drop PDF here or click to choose file — then pick crew member and document type
      </span>
    </div>

    @if (showModal()) {
      <div class="modal-backdrop" (click)="closeModal()">
        <div class="modal crew-doc-modal" (click)="$event.stopPropagation()">
          <h3>Attach PDF scan</h3>
          <p class="crew-doc-modal-file">{{ pendingFile()?.name }}</p>
          <label>
            <span>Crew member</span>
            <select [(ngModel)]="selectedCrewId">
              <option value="">— select —</option>
              @for (m of crew(); track m.id) {
                <option [value]="m.id">{{ label(m) }}</option>
              }
            </select>
          </label>
          <fieldset class="choice-group">
            <legend class="choice-group__legend">Document type</legend>
            <div class="choice-segmented choice-segmented--row" role="radiogroup">
              @for (t of docTypes; track t.id) {
                <label class="choice-segmented__item">
                  <input type="radio" name="docType" [value]="t.id" [(ngModel)]="selectedDocType" />
                  <span class="choice-segmented__text">{{ t.label }}</span>
                </label>
              }
            </div>
          </fieldset>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" (click)="closeModal()">Cancel</button>
            <button type="button" class="btn btn-primary" [disabled]="!canAttach()" (click)="confirmAttach()">
              Attach
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .crew-doc-zone {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      margin-bottom: 0.85rem;
      padding: 0.55rem 0.85rem;
      border: 2px dashed #93c5fd;
      border-radius: 10px;
      background: linear-gradient(180deg, #f0f9ff 0%, #f8fafc 100%);
      cursor: pointer;
      transition:
        border-color 0.15s ease,
        background 0.15s ease;
    }

    .crew-doc-zone:hover,
    .crew-doc-zone--active {
      border-color: #3b82f6;
      background: #dbeafe;
    }

    .crew-doc-zone-icon {
      font-size: 1.35rem;
      line-height: 1;
    }

    .crew-doc-zone-text {
      font-size: 0.82rem;
      color: #475569;
      line-height: 1.35;
    }

    .crew-doc-modal {
      max-width: 420px;
    }

    .crew-doc-modal h3 {
      margin: 0 0 0.5rem;
    }

    .crew-doc-modal-file {
      margin: 0 0 1rem;
      font-size: 0.85rem;
      color: var(--text-muted);
      word-break: break-all;
    }

    .crew-doc-modal label {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      margin-bottom: 0.85rem;
      font-size: 0.85rem;
    }

    .crew-doc-modal select {
      padding: 0.5rem 0.65rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      font: inherit;
    }

    .choice-group {
      margin: 0 0 1rem;
    }
  `,
})
export class CrewDocDropZoneComponent {
  readonly crew = input<CrewMember[]>([]);
  readonly attached = output<void>();

  private readonly docs = inject(CrewDocumentService);
  private readonly toast = inject(ToastService);

  protected readonly docTypes = CREW_DOCUMENT_TYPES;
  protected readonly dragOver = signal(false);
  protected readonly showModal = signal(false);
  protected readonly pendingFile = signal<File | null>(null);
  protected selectedCrewId = '';
  protected selectedDocType: CrewDocumentType = 'passport';

  protected label = crewMemberLabel;

  protected onZoneClick(): void {
    void this.docs.pickPdfInBrowser().then((file) => {
      if (file) this.openModal(file);
    });
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(true);
  }

  protected onDragLeave(event: DragEvent): void {
    if (event.currentTarget === event.target) this.dragOver.set(false);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) this.openModal(file);
  }

  protected closeModal(): void {
    this.showModal.set(false);
    this.pendingFile.set(null);
  }

  protected canAttach(): boolean {
    return !!this.selectedCrewId && !!this.pendingFile();
  }

  protected async confirmAttach(): Promise<void> {
    const file = this.pendingFile();
    if (!file || !this.selectedCrewId) return;
    try {
      await this.docs.attachFromFile(this.selectedCrewId, this.selectedDocType, file);
      this.attached.emit();
      this.toast.show('PDF attached');
      this.closeModal();
    } catch (e) {
      this.toast.showError(e instanceof Error ? e.message : 'Failed to attach PDF');
    }
  }

  private openModal(file: File): void {
    this.pendingFile.set(file);
    this.selectedCrewId = this.crew()[0]?.id ?? '';
    this.selectedDocType = 'passport';
    this.showModal.set(true);
  }
}
