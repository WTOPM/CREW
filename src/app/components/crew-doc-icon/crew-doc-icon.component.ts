import { Component, inject, input, output } from '@angular/core';
import {
  CREW_DOCUMENT_TYPES,
  CrewDocumentType,
  formatCrewListName,
  hasCrewDocument,
  CrewMember,
} from '../../models/crew.models';
import { CrewDocumentService } from '../../services/crew-document.service';
import { ToastService } from '../../services/toast.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';

@Component({
  selector: 'app-crew-doc-icon',
  template: `
    <button
      type="button"
      class="crew-doc-icon"
      [class.crew-doc-icon--filled]="filled()"
      [class.crew-doc-icon--passport]="docType() === 'passport'"
      [class.crew-doc-icon--sbook]="docType() === 'seamansBook'"
      [class.crew-doc-icon--cyprus]="docType() === 'cyprusPassport'"
      [class.crew-doc-icon--drag]="dragOver"
      [class.crew-doc-icon--hold]="holdActive"
      [title]="tooltip()"
      [attr.aria-label]="tooltip()"
      (click)="onClick($event)"
      (mousedown)="onMouseDown($event)"
      (mouseup)="onMouseUp($event)"
      (mouseleave)="onMouseLeave($event)"
      (dragover)="onDragOver($event)"
      (dragleave)="onDragLeave($event)"
      (drop)="onDrop($event)"
    >
      <span class="crew-doc-icon-label">{{ shortLabel() }}</span>
    </button>
  `,
  styles: `
    .crew-doc-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.55rem;
      height: 1.55rem;
      padding: 0;
      border: 1px dashed #cbd5e1;
      border-radius: 4px;
      background: #f8fafc;
      color: #94a3b8;
      font-size: 0.58rem;
      font-weight: 800;
      line-height: 1;
      cursor: pointer;
      user-select: none;
      transition:
        background 0.12s ease,
        border-color 0.12s ease,
        transform 0.12s ease;
    }

    .crew-doc-icon:hover {
      transform: scale(1.06);
      border-color: #93c5fd;
    }

    .crew-doc-icon--drag {
      border-color: #3b82f6;
      background: #dbeafe;
    }

    .crew-doc-icon--hold {
      transform: scale(0.92);
      border-color: #dc2626;
      box-shadow: 0 0 0 2px rgb(220 38 38 / 25%);
    }

    .crew-doc-icon--filled {
      border-style: solid;
      color: #fff;
    }

    .crew-doc-icon--passport.crew-doc-icon--filled {
      background: #0369a1;
      border-color: #0369a1;
    }

    .crew-doc-icon--sbook.crew-doc-icon--filled {
      background: #0f766e;
      border-color: #0f766e;
    }

    .crew-doc-icon--cyprus.crew-doc-icon--filled {
      background: #b45309;
      border-color: #b45309;
    }

    .crew-doc-icon-label {
      pointer-events: none;
    }
  `,
})
export class CrewDocIconComponent {
  readonly member = input.required<CrewMember>();
  readonly docType = input.required<CrewDocumentType>();
  readonly attached = output<void>();

  private static readonly HOLD_MS = 550;

  private readonly docs = inject(CrewDocumentService);
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  protected dragOver = false;
  protected holdActive = false;
  private pressTimer: ReturnType<typeof setTimeout> | null = null;
  private suppressClick = false;

  protected filled(): boolean {
    return hasCrewDocument(this.member(), this.docType());
  }

  protected shortLabel(): string {
    return CREW_DOCUMENT_TYPES.find((t) => t.id === this.docType())?.short ?? '?';
  }

  protected tooltip(): string {
    const meta = CREW_DOCUMENT_TYPES.find((t) => t.id === this.docType());
    const label = meta?.label ?? 'Document';
    if (this.filled()) {
      return `Open ${label} · hold to delete`;
    }
    return `Attach ${label} (click or drop PDF)`;
  }

  protected onMouseDown(event: MouseEvent): void {
    if (event.button !== 0 || !this.filled()) return;
    event.stopPropagation();
    this.clearPressTimer();
    this.holdActive = true;
    this.pressTimer = setTimeout(() => {
      this.pressTimer = null;
      this.holdActive = false;
      this.suppressClick = true;
      void this.promptDelete();
    }, CrewDocIconComponent.HOLD_MS);
  }

  protected onMouseUp(event: MouseEvent): void {
    event.stopPropagation();
    this.clearPressTimer();
  }

  protected onMouseLeave(event: MouseEvent): void {
    event.stopPropagation();
    this.clearPressTimer();
  }

  protected async onClick(event: MouseEvent): Promise<void> {
    event.stopPropagation();
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }
    const member = this.member();
    const type = this.docType();
    if (this.filled()) {
      const ok = await this.docs.openPreview(member.id, type);
      if (!ok) {
        this.toast.showError('Allow pop-ups to open the scan, or PDF not found');
      }
      return;
    }
    try {
      const ok = await this.docs.pickAndAttach(member.id, type);
      if (ok) this.attached.emit();
    } catch (e) {
      this.toast.showError(e instanceof Error ? e.message : 'Failed to attach PDF');
    }
  }

  private clearPressTimer(): void {
    if (this.pressTimer) {
      clearTimeout(this.pressTimer);
      this.pressTimer = null;
    }
    this.holdActive = false;
  }

  private async promptDelete(): Promise<void> {
    const member = this.member();
    const type = this.docType();
    const meta = CREW_DOCUMENT_TYPES.find((t) => t.id === type);
    const label = meta?.label ?? 'document';
    const name = formatCrewListName(member) || 'this crew member';
    const ok = await this.confirmDialog.confirm({
      title: 'Delete document',
      message: `Delete ${label} for ${name}?`,
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await this.docs.remove(member.id, type);
      this.attached.emit();
      this.toast.show('Scan removed');
    } catch (e) {
      this.toast.showError(e instanceof Error ? e.message : 'Failed to delete scan');
    }
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver = true;
  }

  protected onDragLeave(event: DragEvent): void {
    event.stopPropagation();
    this.dragOver = false;
  }

  protected async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver = false;
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    try {
      await this.docs.attachFromFile(this.member().id, this.docType(), file);
      this.attached.emit();
      this.toast.show('PDF attached');
    } catch (e) {
      this.toast.showError(e instanceof Error ? e.message : 'Failed to attach PDF');
    }
  }
}
