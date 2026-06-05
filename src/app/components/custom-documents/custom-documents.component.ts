import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { StorageService } from '../../services/storage.service';
import { ToastService } from '../../services/toast.service';
import { uint8ToBase64 } from '../../utils/base64.util';

/**
 * Upload arbitrary static PDFs (e.g. Ship's Particulars). Stored inline as base64
 * and exposed to the document packages via DocumentCatalogService. The document's
 * name is taken from the uploaded file name.
 */
@Component({
  selector: 'app-custom-documents',
  imports: [],
  template: `
    <div class="cdoc">
      <div
        class="cdoc-drop"
        [class.cdoc-drop--active]="drag()"
        (click)="pick()"
        (dragover)="onDragOver($event)"
        (dragleave)="drag.set(false)"
        (drop)="onDrop($event)"
      >
        <span class="cdoc-drop-title">Add PDF document</span>
        <span class="cdoc-drop-hint">Drop a PDF or click to upload (e.g. Ship's Particulars)</span>
      </div>
      <input #file type="file" accept="application/pdf,.pdf" hidden (change)="onInput($event)" />

      @if (docs().length > 0) {
        <ul class="cdoc-list">
          @for (d of docs(); track d.id) {
            <li class="cdoc-item">
              <span class="cdoc-icon" aria-hidden="true">📄</span>
              <span class="cdoc-name">{{ d.name }}</span>
              <button type="button" class="btn-link warn" (click)="remove(d.id)">Remove</button>
            </li>
          }
        </ul>
      } @else {
        <p class="cdoc-empty">No uploaded documents yet.</p>
      }
    </div>
  `,
  styles: `
    .cdoc-drop {
      min-height: 70px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.25rem;
      padding: 0.65rem 0.75rem;
      border: 2px dashed #cbd5e1;
      border-radius: 10px;
      background: #f8fafc;
      cursor: pointer;
      transition: border-color 0.15s ease, background 0.15s ease;
    }
    .cdoc-drop:hover,
    .cdoc-drop--active {
      border-color: #3b82f6;
      background: #eff6ff;
    }
    .cdoc-drop-title {
      font-size: 0.82rem;
      font-weight: 700;
      color: #334155;
    }
    .cdoc-drop-hint {
      font-size: 0.76rem;
      color: #64748b;
    }
    .cdoc-list {
      list-style: none;
      margin: 0.75rem 0 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    .cdoc-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.4rem 0.55rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: #fff;
    }
    .cdoc-icon {
      flex-shrink: 0;
    }
    .cdoc-name {
      flex: 1;
      min-width: 0;
      font-size: 0.88rem;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .cdoc-empty {
      margin: 0.6rem 0 0;
      font-size: 0.82rem;
      color: var(--text-muted);
    }
  `,
})
export class CustomDocumentsComponent {
  private readonly storage = inject(StorageService);
  private readonly toast = inject(ToastService);
  private readonly fileRef = viewChild<ElementRef<HTMLInputElement>>('file');

  protected readonly docs = this.storage.customDocuments;
  protected readonly drag = signal(false);

  protected pick(): void {
    this.fileRef()?.nativeElement.click();
  }

  protected onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) void this.addFile(file);
    input.value = '';
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.drag.set(true);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.drag.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) void this.addFile(file);
  }

  private async addFile(file: File): Promise<void> {
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    if (!isPdf) {
      this.toast.showError('Please choose a PDF file');
      return;
    }
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const name = file.name.replace(/\.pdf$/i, '').trim() || 'Document';
      this.storage.addCustomDocument(name, uint8ToBase64(bytes));
      this.toast.show(`Added "${name}"`, 'success');
    } catch (err) {
      this.toast.showError(err instanceof Error ? err.message : 'Upload failed');
    }
  }

  protected remove(id: string): void {
    this.storage.removeCustomDocument(id);
    this.toast.show('Document removed', 'deleted');
  }
}
