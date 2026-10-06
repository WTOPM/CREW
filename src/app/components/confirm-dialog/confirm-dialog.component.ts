import { Component, HostListener, inject } from '@angular/core';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';

@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.css',
})
export class ConfirmDialogComponent {
  private readonly confirmDialog = inject(ConfirmDialogService);
  protected readonly dialog = this.confirmDialog.dialog;

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.dialog()) this.cancel();
  }

  protected accept(): void {
    this.confirmDialog.accept();
  }

  protected acceptAlt(): void {
    this.confirmDialog.acceptAlt();
  }

  protected acceptAlt2(): void {
    this.confirmDialog.acceptAlt2();
  }

  protected cancel(): void {
    this.confirmDialog.cancel();
  }
}
