import { Component, inject, input, output } from '@angular/core';
import { CrewMember, hasCrewSignature } from '../../models/crew.models';
import { CrewSignatureService } from '../../services/crew-signature.service';
import { ToastService } from '../../services/toast.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';

@Component({
  selector: 'app-crew-signature-drop',
  template: `
    <div
      class="crew-sig-drop"
      [class.crew-sig-drop--filled]="filled()"
      [class.crew-sig-drop--drag]="dragOver"
      [title]="tooltip()"
      (click)="onClick($event)"
      (dragover)="onDragOver($event)"
      (dragleave)="onDragLeave()"
      (drop)="onDrop($event)"
    >
      <span class="crew-sig-drop-label">SIG</span>
      @if (filled()) {
        <span class="crew-sig-drop-hint">✓</span>
      }
    </div>
  `,
  styles: `
    .crew-sig-drop {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.15rem;
      min-width: 2.6rem;
      height: 1.55rem;
      padding: 0 0.35rem;
      border: 1px dashed #cbd5e1;
      border-radius: 4px;
      background: #f8fafc;
      color: #64748b;
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

    .crew-sig-drop:hover {
      transform: scale(1.04);
      border-color: #a78bfa;
    }

    .crew-sig-drop--drag {
      border-color: #7c3aed;
      background: #ede9fe;
    }

    .crew-sig-drop--filled {
      border-style: solid;
      background: #6d28d9;
      border-color: #6d28d9;
      color: #fff;
    }

    .crew-sig-drop-label,
    .crew-sig-drop-hint {
      pointer-events: none;
    }
  `,
})
export class CrewSignatureDropComponent {
  readonly member = input.required<CrewMember>();
  readonly changed = output<void>();

  private readonly signatures = inject(CrewSignatureService);
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  protected dragOver = false;

  protected filled(): boolean {
    return hasCrewSignature(this.member());
  }

  protected tooltip(): string {
    if (this.filled()) {
      return 'Crew Effect signature loaded · click to replace or remove';
    }
    return 'Crew Effect signature (drop PNG/JPEG/PDF or click)';
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver = true;
  }

  protected onDragLeave(): void {
    this.dragOver = false;
  }

  protected async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver = false;
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    await this.attachFile(file);
  }

  protected async onClick(event: MouseEvent): Promise<void> {
    event.stopPropagation();
    if (this.filled()) {
      const action = await this.confirmDialog.confirm({
        title: 'Crew Effect signature',
        message: 'Replace the signature image, or remove it?',
        confirmLabel: 'Replace',
        cancelLabel: 'Remove',
        variant: 'default',
      });
      if (action) {
        await this.pickNew();
        return;
      }
      await this.remove();
      return;
    }
    await this.pickNew();
  }

  private async pickNew(): Promise<void> {
    try {
      const ok = await this.signatures.pickAndSave(this.member().id);
      if (ok) this.changed.emit();
    } catch (e) {
      this.toast.showError(e instanceof Error ? e.message : 'Failed to save signature');
    }
  }

  private async attachFile(file: File): Promise<void> {
    try {
      await this.signatures.saveFromFile(this.member().id, file);
      this.changed.emit();
    } catch (e) {
      this.toast.showError(e instanceof Error ? e.message : 'Failed to save signature');
    }
  }

  private async remove(): Promise<void> {
    await this.signatures.remove(this.member().id);
    this.changed.emit();
  }
}
