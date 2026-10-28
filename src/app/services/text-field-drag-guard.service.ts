import { DestroyRef, DOCUMENT, Injectable, inject } from '@angular/core';

/**
 * Blocks native drag-and-drop of selected text between inputs/textareas.
 * Accidental LMB drag was moving words/dates between grid cells; Ctrl+C/V still work.
 * File drop zones are unaffected (drag does not start from a text field).
 */
@Injectable({ providedIn: 'root' })
export class TextFieldDragGuardService {
  private readonly doc = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private installed = false;

  install(): void {
    if (this.installed || typeof this.doc === 'undefined') return;
    this.installed = true;

    const onDragStart = (e: DragEvent) => this.onDragStart(e);
    const onDragOver = (e: DragEvent) => this.onDragOverOrDrop(e);
    const onDrop = (e: DragEvent) => this.onDragOverOrDrop(e);

    this.doc.addEventListener('dragstart', onDragStart, true);
    this.doc.addEventListener('dragover', onDragOver, true);
    this.doc.addEventListener('drop', onDrop, true);
    this.destroyRef.onDestroy(() => {
      this.doc.removeEventListener('dragstart', onDragStart, true);
      this.doc.removeEventListener('dragover', onDragOver, true);
      this.doc.removeEventListener('drop', onDrop, true);
    });
  }

  private onDragStart(event: DragEvent): void {
    if (!this.isTextField(event.target)) return;
    event.preventDefault();
  }

  private onDragOverOrDrop(event: DragEvent): void {
    if (!this.isTextField(event.target)) return;
    // Keep OS file drops on type=file; block text/html drops into normal fields.
    if (event.type === 'drop' && this.hasFiles(event)) return;
    if (event.type === 'dragover' && this.hasFiles(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'none';
  }

  private hasFiles(event: DragEvent): boolean {
    const dt = event.dataTransfer;
    if (!dt) return false;
    if (dt.files && dt.files.length > 0) return true;
    return Array.from(dt.types ?? []).includes('Files');
  }

  private isTextField(target: EventTarget | null): target is HTMLInputElement | HTMLTextAreaElement {
    if (target instanceof HTMLTextAreaElement) return true;
    if (!(target instanceof HTMLInputElement)) return false;
    const type = (target.type || 'text').toLowerCase();
    return type !== 'button' && type !== 'checkbox' && type !== 'radio' && type !== 'file' && type !== 'hidden' && type !== 'image' && type !== 'reset' && type !== 'submit' && type !== 'range' && type !== 'color';
  }
}
