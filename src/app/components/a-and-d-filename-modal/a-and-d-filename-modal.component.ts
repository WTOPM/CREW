import { Component, computed, input, linkedSignal, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AD_FILE_NAME_BLOCK_TYPES,
  buildAdFileNameFromPattern,
  createAdFileNameBlock,
  normalizeAdFileNamePattern,
  type AdFileNameBlock,
  type AdFileNameBlockType,
  type AdFileNamePattern,
  type AdReportDraft,
} from '../../models/a-and-d.models';

@Component({
  selector: 'app-a-and-d-filename-modal',
  imports: [FormsModule],
  templateUrl: './a-and-d-filename-modal.component.html',
  styleUrl: './a-and-d-filename-modal.component.css',
})
export class AAndDFilenameModalComponent {
  readonly pattern = input.required<AdFileNamePattern>();
  readonly draft = input.required<AdReportDraft>();
  readonly folderFiles = input.required<readonly string[]>();
  /** Settings ports — used to resolve Port name from Port code. */
  readonly ports = input<readonly { code?: string; name?: string }[]>([]);

  readonly save = output<AdFileNamePattern>();
  readonly cancel = output<void>();

  protected readonly blockTypes = AD_FILE_NAME_BLOCK_TYPES;

  protected readonly edit = linkedSignal(() => normalizeAdFileNamePattern(this.pattern()));

  protected readonly previewName = computed(() =>
    buildAdFileNameFromPattern(this.edit(), this.draft(), this.folderFiles(), {
      ports: this.ports(),
    }),
  );

  protected onBackdrop(event: MouseEvent): void {
    if (event.target !== event.currentTarget) return;
    this.cancel.emit();
  }

  protected setBlockType(id: string, type: string): void {
    const next = type as AdFileNameBlockType;
    if (!AD_FILE_NAME_BLOCK_TYPES.some((t) => t.type === next)) return;
    this.edit.update((p) => ({
      ...p,
      blocks: p.blocks.map((b) => (b.id === id ? { ...b, type: next } : b)),
    }));
  }

  protected setBlockText(id: string, text: string): void {
    this.edit.update((p) => ({
      ...p,
      blocks: p.blocks.map((b) => (b.id === id ? { ...b, text } : b)),
    }));
  }

  protected setBlockSep(id: string, sepAfter: string): void {
    this.edit.update((p) => ({
      ...p,
      blocks: p.blocks.map((b) => (b.id === id ? { ...b, sepAfter } : b)),
    }));
  }

  protected addBlock(): void {
    this.edit.update((p) => ({
      ...p,
      blocks: [...p.blocks, createAdFileNameBlock('custom', '', ' ')],
    }));
  }

  protected removeBlock(id: string): void {
    this.edit.update((p) => {
      const next = p.blocks.filter((b) => b.id !== id);
      return {
        ...p,
        blocks: next.length ? next : [createAdFileNameBlock('empty', '', ' ')],
      };
    });
  }

  protected moveBlock(id: string, dir: -1 | 1): void {
    this.edit.update((p) => {
      const i = p.blocks.findIndex((b) => b.id === id);
      if (i < 0) return p;
      const j = i + dir;
      if (j < 0 || j >= p.blocks.length) return p;
      const blocks = p.blocks.slice();
      const tmp = blocks[i]!;
      blocks[i] = blocks[j]!;
      blocks[j] = tmp;
      return { ...p, blocks };
    });
  }

  protected apply(): void {
    this.save.emit(normalizeAdFileNamePattern(this.edit()));
  }

  protected trackBlock(_index: number, block: AdFileNameBlock): string {
    return block.id;
  }
}
